@file:Suppress("MagicNumber", "PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.disambiguate

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.ResolveRoutingRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.ui.components.EnvelopeOcrTone
import app.pantopus.android.ui.screens.homes.invite_owner.ToastPayload
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.roundToInt

/** Nav-arg keys for the disambiguate form. */
const val DISAMBIGUATE_MAIL_ID_KEY = "mailId"
const val DISAMBIGUATE_OCR_TEXT_KEY = "ocrText"
const val DISAMBIGUATE_CONFIDENCE_KEY = "confidence"
const val DISAMBIGUATE_ENVELOPE_URL_KEY = "envelopeUrl"

/** Role of a candidate within the household — drives the role chip + avatar tint. */
enum class CandidateRole(val title: String) {
    Owner("Owner"),
    Resident("Resident"),
    Guest("Guest"),
}

/** Whether a candidate currently receives mail at this address (grant line). */
enum class MailGrant(val label: String) {
    ReceivesMail("Receives mail"),
    NoMailAccess("No mail access"),
}

/** Match-strength tier derived from a candidate's OCR-vs-record score. */
enum class MailMatchTier(val word: String) {
    Strong("Strong match"),
    Partial("Partial"),
    Weak("Weak"),
    ;

    companion object {
        /** ≥ 0.7 strong, ≥ 0.35 partial, else weak. */
        fun fromScore(score: Double): MailMatchTier =
            when {
                score >= 0.7 -> Strong
                score >= 0.35 -> Partial
                else -> Weak
            }
    }
}

/**
 * A possible recipient surfaced for the scanned mail. Sample data — there is
 * no candidates endpoint, so [matchScore] is hardcoded per frame.
 */
data class MailCandidate(
    val id: String,
    val name: String,
    val role: CandidateRole,
    val grant: MailGrant,
    val matchScore: Double,
    val presence: String?,
    val verified: Boolean,
    /** Backend drawer this candidate resolves into (`personal | home | business`). */
    val drawer: String,
) {
    val initials: String
        get() =
            name.split(" ").take(2)
                .mapNotNull { it.firstOrNull()?.toString() }
                .joinToString("")
                .uppercase()

    val matchPercent: Int get() = (matchScore * 100).roundToInt()

    val tier: MailMatchTier get() = MailMatchTier.fromScore(matchScore)
}

/** What the user picked as the routing target. */
sealed interface MailRoutingSelection {
    /** One of the listed candidates, by id. */
    data class Candidate(val id: String) : MailRoutingSelection

    /** The "This is me" quick action — routes to the personal drawer. */
    data object Me : MailRoutingSelection
}

/** A fallback path offered in the unclear frame when no candidate is confident. */
enum class FallbackAction(
    val title: String,
    val subtitle: String,
    val isDestructive: Boolean,
) {
    Rescan("Re-scan envelope", "Hold under brighter light. Most-used fix.", false),
    TypeName("Type recipient name", "Skip OCR, enter the name yourself.", false),
    ReturnToSender("Return to sender", "Mark as undeliverable — sender notified.", false),
    MarkAsJunk("Mark as junk", "Skip routing. Sender added to junk filter.", true),
}

/** Aggregate UI state for the Disambiguate form. */
data class DisambiguateUiState(
    val ocrRecipient: String = "",
    val confidence: Double = 0.0,
    val envelopeUrl: String? = null,
    val candidates: List<MailCandidate> = emptyList(),
    val selection: MailRoutingSelection? = null,
    val lastFallback: FallbackAction? = null,
    val isSubmitting: Boolean = false,
    val toast: ToastPayload? = null,
    val shouldDismiss: Boolean = false,
) {
    /** Below this OCR read confidence the scan is treated as unclear. */
    val isUnclear: Boolean get() = confidence < CLARITY_THRESHOLD

    /** Envelope + OCR-box + strip tone. */
    val ocrTone: EnvelopeOcrTone
        get() = if (isUnclear) EnvelopeOcrTone.Unclear else EnvelopeOcrTone.Clean

    val confidencePercent: Int get() = (confidence * 100).roundToInt()

    /** Detected text shown on the envelope name line + OcrStrip. */
    val detectedText: String
        get() =
            ocrRecipient.ifEmpty {
                if (isUnclear) "M___ K___ · 4__ Elm St" else "Maria K. · 412 Elm St"
            }

    /** Sub-line under the detected text in the OcrStrip. */
    val ocrSubtext: String
        get() =
            if (isUnclear) {
                "Smudge on the name line. Try a brighter re-scan for a sharper read."
            } else {
                "Address matches this household."
            }

    /** OCR-box pill label (e.g. "name · 97%"). */
    val ocrBoxLabel: String get() = "name · $confidencePercent%"

    /** Overline above the candidate list — differs by frame. */
    val candidatesOverline: String
        get() = if (isUnclear) "Best guesses · none confident" else "Who is this for?"

    /**
     * Unclear scans always disable Confirm (the fallback card is the path
     * forward); clean scans enable once something is selected.
     */
    val canConfirm: Boolean get() = !isUnclear && !isSubmitting && selection != null

    /** Hint shown above the disabled Confirm CTA in the unclear frame. */
    val confirmHint: String?
        get() = if (isUnclear) "Pick a recipient — or choose a fallback above." else null

    /** True once the user has touched the form. Drives the discard-confirm. */
    val isDirty: Boolean get() = selection != null || lastFallback != null

    fun isSelected(id: String): Boolean = selection == MailRoutingSelection.Candidate(id)

    companion object {
        const val CLARITY_THRESHOLD = 0.6
    }
}

/**
 * A13.15 Disambiguate — reshaped recipient picker. Resolution still POSTs
 * `/api/mailbox/v2/resolve` (`backend/routes/mailboxV2.js:555`): the backend
 * resolves into one of three drawers (`personal | home | business`), so each
 * candidate carries the `drawer` it routes to. The candidate ranking itself is
 * sample data — there is no candidates endpoint yet (real OCR ranking is out of
 * scope; confidence values are hardcoded).
 */
@HiltViewModel
class DisambiguateMailFormViewModel
    @Inject
    constructor(
        private val repo: MailboxRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val mailId: String =
            requireNotNull(savedStateHandle[DISAMBIGUATE_MAIL_ID_KEY]) {
                "DisambiguateMailFormViewModel requires a '$DISAMBIGUATE_MAIL_ID_KEY' nav arg."
            }

        private val _state: MutableStateFlow<DisambiguateUiState>

        init {
            val confidence: Double = savedStateHandle[DISAMBIGUATE_CONFIDENCE_KEY] ?: 0.0
            val isClear = confidence >= DisambiguateUiState.CLARITY_THRESHOLD
            val candidates = sampleCandidates(clear = isClear)
            // Clean scans auto-pick the single strong match so Confirm is live.
            val preselect =
                if (isClear) {
                    candidates.firstOrNull { it.tier == MailMatchTier.Strong }
                        ?.let { MailRoutingSelection.Candidate(it.id) }
                } else {
                    null
                }
            _state =
                MutableStateFlow(
                    DisambiguateUiState(
                        ocrRecipient = savedStateHandle[DISAMBIGUATE_OCR_TEXT_KEY] ?: "",
                        confidence = confidence,
                        envelopeUrl = savedStateHandle[DISAMBIGUATE_ENVELOPE_URL_KEY],
                        candidates = candidates,
                        selection = preselect,
                    ),
                )
        }

        val state: StateFlow<DisambiguateUiState> = _state.asStateFlow()

        /** Pick a candidate row (clean frame only — unclear rows are inert). */
        fun selectCandidate(id: String) {
            if (_state.value.isUnclear) return
            _state.update { it.copy(selection = MailRoutingSelection.Candidate(id)) }
        }

        /** "This is me" quick action — routes to the personal drawer. */
        fun selectThisIsMe() {
            if (_state.value.isUnclear) return
            _state.update { it.copy(selection = MailRoutingSelection.Me) }
        }

        /**
         * "Route to…" quick action — clears the auto-pick so the user chooses a
         * recipient (or a different address) themselves.
         */
        fun routeToOther() {
            if (_state.value.isUnclear) return
            _state.update { it.copy(selection = null) }
        }

        /**
         * Choose one of the unclear-frame fallback paths. Real wiring (re-scan,
         * manual entry, return / junk endpoints) is out of scope, so this records
         * the choice and surfaces a confirming toast.
         */
        fun selectFallback(action: FallbackAction) {
            _state.update {
                it.copy(
                    lastFallback = action,
                    toast = ToastPayload("${action.title} — coming up.", isError = false),
                )
            }
        }

        /** "None of these — add new person" text button (out-of-scope wiring). */
        fun addNewPerson() {
            _state.update {
                it.copy(toast = ToastPayload("Add a new person — coming up.", isError = false))
            }
        }

        fun dismissToast() {
            _state.update { it.copy(toast = null) }
        }

        fun acknowledgeDismiss() {
            _state.update { it.copy(shouldDismiss = false) }
        }

        fun submit() {
            val current = _state.value
            val drawer =
                resolvedDrawer(current) ?: run {
                    _state.update {
                        it.copy(toast = ToastPayload("Pick a recipient first.", isError = true))
                    }
                    return
                }
            _state.update { it.copy(isSubmitting = true) }
            val request =
                ResolveRoutingRequest(
                    mailId = mailId,
                    drawer = drawer,
                    addAlias = null,
                    aliasString = null,
                )
            viewModelScope.launch {
                when (val result = repo.resolve(request)) {
                    is NetworkResult.Success -> {
                        _state.update {
                            it.copy(
                                isSubmitting = false,
                                toast = ToastPayload("Recipient confirmed.", isError = false),
                            )
                        }
                        // Hold the success toast on screen briefly so it renders
                        // before the form pops.
                        kotlinx.coroutines.delay(1_500)
                        _state.update { it.copy(shouldDismiss = true) }
                    }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(
                                isSubmitting = false,
                                toast =
                                    ToastPayload(
                                        result.error.message ?: "Couldn't route this mail.",
                                        isError = true,
                                    ),
                            )
                        }
                }
            }
        }

        /**
         * The backend drawer for the current selection, or null when nothing is
         * picked / the scan is unclear.
         */
        private fun resolvedDrawer(state: DisambiguateUiState): String? {
            if (state.isUnclear) return null
            return when (val selection = state.selection) {
                is MailRoutingSelection.Me -> "personal"
                is MailRoutingSelection.Candidate ->
                    state.candidates.firstOrNull { it.id == selection.id }?.drawer
                null -> null
            }
        }

        companion object {
            /**
             * Hardcoded candidate ranking. The clean set has one strong match;
             * the unclear set degrades every score so nothing is confident.
             */
            fun sampleCandidates(clear: Boolean): List<MailCandidate> =
                listOf(
                    MailCandidate(
                        id = "maria",
                        name = "Maria Kovács",
                        role = CandidateRole.Owner,
                        grant = MailGrant.ReceivesMail,
                        matchScore = if (clear) 0.97 else 0.41,
                        presence = "Owner since 2019 · Apt 3B",
                        verified = true,
                        drawer = "home",
                    ),
                    MailCandidate(
                        id = "marcus",
                        name = "Marcus Khan",
                        role = CandidateRole.Resident,
                        grant = MailGrant.ReceivesMail,
                        matchScore = if (clear) 0.22 else 0.38,
                        presence = "Moved in Jan · Apt 3B",
                        verified = true,
                        drawer = "home",
                    ),
                    MailCandidate(
                        id = "mika",
                        name = "Mika Kim",
                        role = CandidateRole.Guest,
                        grant = MailGrant.NoMailAccess,
                        matchScore = if (clear) 0.18 else 0.19,
                        presence = "Visiting until Sun",
                        verified = false,
                        drawer = "home",
                    ),
                )
        }
    }
