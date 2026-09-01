@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.invite_owner

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.InviteOwnerRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.form.FormAggregate
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.screens.shared.form.FormValidator
import app.pantopus.android.ui.screens.shared.form.all
import app.pantopus.android.ui.screens.shared.form.email
import app.pantopus.android.ui.screens.shared.form.emailNotMatching
import app.pantopus.android.ui.screens.shared.form.maxLength
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.max
import kotlin.math.roundToInt

/** Nav-arg keys for the Invite Owner form. */
const val INVITE_OWNER_HOME_ID_KEY = "homeId"
const val INVITE_OWNER_CURRENT_EMAIL_KEY = "currentUserEmail"

/** Stable identifiers for every editable Invite Owner field. */
enum class InviteOwnerField(val key: String) {
    Email("email"),
    Phone("phone"),
    Role("role"),
}

/** Top-level render state for the Invite Owner form. */
sealed interface InviteOwnerPhase {
    data object Loading : InviteOwnerPhase

    data object Empty : InviteOwnerPhase

    data object Editing : InviteOwnerPhase

    data class Error(val message: String) : InviteOwnerPhase
}

/** Aggregate UI state for the Invite Owner form. */
data class InviteOwnerUiState(
    val phase: InviteOwnerPhase = InviteOwnerPhase.Loading,
    val homeContext: InviteOwnerHomeContext = InviteOwnerSampleData.homeContext("preview"),
    val owners: List<InviteOwnerOwnerShare> = emptyList(),
    val fields: Map<InviteOwnerField, FormFieldState> =
        InviteOwnerField.entries.associateWith { FormFieldState(id = it.key) },
    val grantPercent: Int = 0,
    val originalGrantPercent: Int = 0,
    /**
     * RN's "Fast track (vouch)" switch, defaulted ON
     * (`src/app/homes/[id]/owners/invite.tsx:22`). Sent as `fast_track`;
     * the handler files the claim as `method: 'vouch'` +
     * `state: 'pending_challenge_window'` instead of `invite` /
     * `submitted` (`backend/routes/homeOwnership.js:1473-1481`).
     */
    val fastTrack: Boolean = true,
    val autoBalancesSoleOwner: Boolean = false,
    val isSaving: Boolean = false,
    val toast: ToastPayload? = null,
    val shouldDismiss: Boolean = false,
) {
    val aggregate: FormAggregate
        get() = FormAggregate.from(InviteOwnerField.entries.mapNotNull { fields[it] })

    val existingTotal: Int get() = owners.sumOf { it.sharePercent }
    val totalAfterGrant: Int get() = existingTotal + grantPercent
    val availablePool: Int get() = max(0, 100 - existingTotal)
    val conflictOverage: Int get() = max(0, totalAfterGrant - 100)
    val hasShareConflict: Boolean get() = conflictOverage > 0

    val isValid: Boolean
        get() =
            phase == InviteOwnerPhase.Editing &&
                aggregate.isValid &&
                fields[InviteOwnerField.Email]?.value?.trim()?.isNotEmpty() == true &&
                grantPercent > 0 &&
                !hasShareConflict

    val isDirty: Boolean get() = aggregate.isDirty || grantPercent != originalGrantPercent

    val ownershipSummary: InviteOwnershipSummary
        get() =
            InviteOwnershipSummary(
                owners = owners,
                availablePercent = availablePool,
                grantPercent = grantPercent,
                totalAfterGrant = totalAfterGrant,
                conflictOverage = conflictOverage,
            )

    val retentionHint: String
        get() {
            val sole = owners.singleOrNull()
            return if (sole != null && sole.name == "You") {
                "Used for bill splits and decision quorum. You keep ${sole.sharePercent}%."
            } else {
                "Used for bill splits and decision quorum."
            }
        }

    val conflictMessage: String?
        get() {
            if (!hasShareConflict) return null
            return "Total would be $totalAfterGrant%. $ownerMathSentence Pick $availablePool% or less, or rebalance existing shares."
        }

    private val ownerMathSentence: String
        get() {
            val clauses = owners.map { "${it.name} holds ${it.sharePercent}%" }
            if (clauses.isEmpty()) return "Existing owners already use $existingTotal%."
            if (clauses.size == 1) return "${clauses.first()}."
            return "${clauses.dropLast(1).joinToString(", ")} and ${clauses.last()}."
        }
}

/** Tiny tone+text bundle the screen turns into a toast. */
data class ToastPayload(
    val text: String,
    val isError: Boolean,
)

/** A13.2 single-screen Invite Owner view model. */
@HiltViewModel
class InviteOwnerFormViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val homesRepo: HomesRepository,
    ) : ViewModel() {
        private val homeId: String =
            requireNotNull(savedStateHandle[INVITE_OWNER_HOME_ID_KEY]) {
                "InviteOwnerFormViewModel requires a '$INVITE_OWNER_HOME_ID_KEY' nav arg."
            }
        private val currentUserEmail: String =
            savedStateHandle[INVITE_OWNER_CURRENT_EMAIL_KEY] ?: ""
        private val initialDraft = InviteOwnerSampleData.draftFor(homeId)

        private val _state = MutableStateFlow(stateFrom(initialDraft, InviteOwnerPhase.Loading))
        val state: StateFlow<InviteOwnerUiState> = _state.asStateFlow()

        fun load() {
            _state.update { current ->
                if (current.phase != InviteOwnerPhase.Loading) return@update current
                current.copy(phase = if (current.owners.isEmpty()) InviteOwnerPhase.Empty else InviteOwnerPhase.Editing)
            }
        }

        fun refresh() {
            _state.value = stateFrom(initialDraft, InviteOwnerPhase.Loading)
            load()
        }

        fun update(
            field: InviteOwnerField,
            value: String,
        ) {
            _state.update { current ->
                val nextValue =
                    if (field == InviteOwnerField.Role) {
                        value.take(InviteOwnerSampleData.NOTE_MAX_LENGTH)
                    } else {
                        value
                    }
                val snapshot =
                    current.fields[field]?.copy(
                        value = nextValue,
                        touched = true,
                        error = validator(field).validate(nextValue),
                    ) ?: FormFieldState(id = field.key, value = nextValue, touched = true)
                current.copy(fields = current.fields + (field to snapshot))
            }
        }

        fun updateFastTrack(value: Boolean) {
            _state.update { it.copy(fastTrack = value) }
        }

        fun updateGrantPercent(value: Int) {
            _state.update { current ->
                val clamped = value.coerceIn(0, 100)
                val withGrant = current.copy(grantPercent = clamped)
                syncSoleOwnerShareIfNeeded(withGrant)
            }
        }

        fun snapGrantToAvailablePool() {
            _state.update { current ->
                current.copy(
                    grantPercent = current.availablePool,
                    toast = ToastPayload("Share snapped to ${current.availablePool}%.", isError = false),
                )
            }
        }

        fun rebalanceShares() {
            _state.update { current ->
                if (current.owners.isEmpty() || current.grantPercent <= 0) return@update current
                val ownerPool = max(0, 100 - current.grantPercent)
                val currentTotal = max(1, current.existingTotal)
                var remaining = ownerPool
                val owners =
                    current.owners.mapIndexed { index, owner ->
                        val share =
                            if (index == current.owners.lastIndex) {
                                remaining
                            } else {
                                (owner.sharePercent.toDouble() / currentTotal.toDouble() * ownerPool.toDouble())
                                    .roundToInt()
                                    .also { remaining -= it }
                            }
                        owner.copy(sharePercent = max(0, share))
                    }
                current.copy(
                    owners = owners,
                    autoBalancesSoleOwner = false,
                    toast = ToastPayload("Existing shares rebalanced.", isError = false),
                )
            }
        }

        fun dismissToast() {
            _state.update { it.copy(toast = null) }
        }

        fun acknowledgeDismiss() {
            _state.update { it.copy(shouldDismiss = false) }
        }

        /** Run all validators. Returns the first invalid field, if any. */
        fun validateAll(): InviteOwnerField? {
            var firstInvalid: InviteOwnerField? = null
            _state.update { current ->
                val updated =
                    current.fields.mapValues { (field, snapshot) ->
                        val message = validator(field).validate(snapshot.value)
                        if (firstInvalid == null && message != null) firstInvalid = field
                        snapshot.copy(error = message, touched = true)
                    }
                if (firstInvalid == null && current.grantPercent <= 0) firstInvalid = InviteOwnerField.Email
                current.copy(fields = updated)
            }
            return firstInvalid
        }

        fun submit() {
            val invalid = validateAll()
            val current = _state.value
            if (invalid != null || current.hasShareConflict || current.grantPercent <= 0) {
                _state.update {
                    it.copy(
                        toast =
                            ToastPayload(
                                text =
                                    if (current.hasShareConflict) {
                                        "Resolve the ownership split first."
                                    } else {
                                        "Fix the highlighted field."
                                    },
                                isError = true,
                            ),
                    )
                }
                return
            }
            _state.update { it.copy(isSaving = true) }
            viewModelScope.launch {
                val email = current.fields[InviteOwnerField.Email]?.value?.trim().orEmpty()
                val phoneRaw = current.fields[InviteOwnerField.Phone]?.value?.trim().orEmpty()
                val phone = phoneRaw.ifEmpty { null }
                // The invite route identifies the co-owner by email/phone;
                // the share-split math is a client-only affordance it does
                // not consume, so it stays local.
                when (
                    val result =
                        homesRepo.inviteOwner(
                            homeId,
                            InviteOwnerRequest(email = email, phone = phone, fastTrack = current.fastTrack),
                        )
                ) {
                    is NetworkResult.Success -> {
                        _state.update {
                            it.copy(isSaving = false, toast = ToastPayload("Invite sent.", isError = false))
                        }
                        delay(650)
                        _state.update { it.copy(shouldDismiss = true) }
                    }
                    is NetworkResult.Failure -> {
                        _state.update {
                            it.copy(
                                isSaving = false,
                                toast =
                                    ToastPayload(
                                        result.error.message.ifEmpty { "Couldn't send the invite. Try again." },
                                        isError = true,
                                    ),
                            )
                        }
                    }
                }
            }
        }

        private fun stateFrom(
            draft: InviteOwnerDraft,
            phase: InviteOwnerPhase,
        ): InviteOwnerUiState {
            val fields = fieldsFrom(draft)
            return syncSoleOwnerShareIfNeeded(
                InviteOwnerUiState(
                    phase = phase,
                    homeContext = draft.homeContext,
                    owners = draft.owners,
                    fields = fields,
                    grantPercent = draft.grantPercent,
                    originalGrantPercent = draft.grantPercent,
                    autoBalancesSoleOwner = draft.autoBalancesSoleOwner,
                ),
            )
        }

        private fun fieldsFrom(draft: InviteOwnerDraft): Map<InviteOwnerField, FormFieldState> =
            mapOf(
                InviteOwnerField.Email to
                    FormFieldState(
                        id = InviteOwnerField.Email.key,
                        value = draft.email,
                        touched = draft.email.isNotEmpty(),
                        error =
                            if (draft.email.isNotEmpty()) {
                                validator(InviteOwnerField.Email).validate(draft.email)
                            } else {
                                null
                            },
                    ),
                InviteOwnerField.Phone to
                    FormFieldState(
                        id = InviteOwnerField.Phone.key,
                        value = draft.phone,
                        touched = draft.phone.isNotEmpty(),
                        error = if (draft.phone.isNotEmpty()) phoneError(draft.phone) else null,
                    ),
                InviteOwnerField.Role to
                    FormFieldState(
                        id = InviteOwnerField.Role.key,
                        value = draft.role,
                        touched = draft.role.isNotEmpty(),
                        error =
                            if (draft.role.isNotEmpty()) {
                                validator(InviteOwnerField.Role).validate(draft.role)
                            } else {
                                null
                            },
                    ),
            )

        private fun syncSoleOwnerShareIfNeeded(current: InviteOwnerUiState): InviteOwnerUiState {
            if (!current.autoBalancesSoleOwner || current.owners.size != 1) return current
            return current.copy(
                owners = listOf(current.owners.first().copy(sharePercent = max(0, 100 - current.grantPercent))),
            )
        }

        private fun validator(field: InviteOwnerField): FormValidator =
            when (field) {
                InviteOwnerField.Email ->
                    FormValidator.all(
                        listOf(FormValidator.email(), FormValidator.emailNotMatching(currentUserEmail)),
                    )
                InviteOwnerField.Phone -> FormValidator { phoneError(it) }
                InviteOwnerField.Role -> FormValidator.maxLength(InviteOwnerSampleData.NOTE_MAX_LENGTH)
            }
    }

private fun phoneError(value: String): String? {
    val trimmed = value.trim()
    if (trimmed.isEmpty()) return null
    if (E164_PATTERN.matches(trimmed)) return null
    if (trimmed.any { it !in PHONE_ALLOWED }) return "Enter a valid phone number."
    val digits = trimmed.filter { it.isDigit() }
    return if (digits.length == 10 || (digits.length == 11 && digits.firstOrNull() == '1')) {
        null
    } else {
        "Enter a valid phone number."
    }
}

private val E164_PATTERN = Regex("""^\+[1-9]\d{1,14}$""")
private const val PHONE_ALLOWED = "0123456789 +()-."
