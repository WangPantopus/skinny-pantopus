@file:Suppress("PackageNaming", "TooManyFunctions", "ReturnCount", "CyclomaticComplexMethod", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.payments

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.UpdateBookingPageRequest
import app.pantopus.android.data.api.models.scheduling.UpdateEventTypeRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * G14 Cancellation & Refund Policy editor (Stream A14). A preset picker
 * (Flexible / Moderate / Strict / Custom) with inline custom rows, a live
 * "what the invitee sees" preview, and a Save that round-trips:
 *  - page-level ([eventTypeId] == null) → `PUT /booking-page` `cancellation_policy`
 *    (a preset name string, or a compact JSON object string for Custom — the
 *    backend column is `Joi.string().max(1000)`).
 *  - per-service ([eventTypeId] != null) → `PUT /event-types/:id`
 *    `cancellation_window_min` / `reschedule_cutoff_min` / `refund_policy` /
 *    `no_show_fee_cents` / `deposit_refundable`.
 *
 * Behind [SchedulingFeatureFlags.paidSchedulingEnabled] (Stripe TEST mode);
 * owner is the Business pillar. Mirrors the iOS `CancellationPolicyEditorViewModel`.
 */
@HiltViewModel
class CancellationRefundPolicyViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val flags: SchedulingFeatureFlags,
        auth: AuthRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        /** The four refund presets. The raw name is what page-level stores. */
        enum class Preset(val rawValue: String, val summary: String) {
            Flexible("Flexible", "Full refund up to 24h before"),
            Moderate("Moderate", "50% refund up to 48h before"),
            Strict("Strict", "No refund after booking"),
            Custom("Custom", "Set your own rules"),
        }

        /** How a no-show is charged. Per-service maps it to `no_show_fee_cents`. */
        enum class NoShowMode(val rawValue: String, val label: String) {
            ChargeFull("charge_full", "Charge full price"),
            ChargeDeposit("charge_deposit", "Charge the deposit"),
            NoCharge("no_charge", "No charge"),
        }

        private val eventTypeId: String? = savedStateHandle[EVENT_TYPE_ID_KEY]
        private val owner: SchedulingOwner =
            (auth.state.value as? AuthRepository.State.SignedIn)
                ?.user
                ?.id
                ?.let { SchedulingOwner.Business(it) }
                ?: SchedulingOwner.Personal

        private val _state = MutableStateFlow<CancellationPolicyUiState>(CancellationPolicyUiState.Loading)
        val state: StateFlow<CancellationPolicyUiState> = _state.asStateFlow()

        private val _saving = MutableStateFlow(false)
        val saving: StateFlow<Boolean> = _saving.asStateFlow()

        private val _saveError = MutableStateFlow<String?>(null)
        val saveError: StateFlow<String?> = _saveError.asStateFlow()

        private val _didSave = MutableStateFlow(false)
        val didSave: StateFlow<Boolean> = _didSave.asStateFlow()

        // Editor state.
        private var selectedPreset = Preset.Flexible
        private var customCutoffHours = 24
        private var customRefundPct = 50
        private var depositNonRefundable = true
        private var noShowMode = NoShowMode.ChargeFull

        // Captured for the per-service no-show-fee mapping.
        private var priceCents = 0
        private var depositCents = 0

        @Suppress("UNCHECKED_CAST")
        private val policyAdapter: JsonAdapter<Map<String, Any?>> =
            Moshi.Builder().build().adapter(
                Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java),
            )

        fun load() {
            if (!flags.paidSchedulingEnabled) {
                _state.value = CancellationPolicyUiState.NotEnabled
                return
            }
            _state.value = CancellationPolicyUiState.Loading
            viewModelScope.launch {
                val id = eventTypeId
                if (id != null) {
                    when (val r = repo.getEventType(owner, id)) {
                        is NetworkResult.Success -> {
                            applyEventType(r.data.eventType)
                            emitLoaded()
                        }
                        is NetworkResult.Failure ->
                            _state.value = CancellationPolicyUiState.Error(r.error.message)
                    }
                } else {
                    when (val r = repo.getBookingPage(owner)) {
                        is NetworkResult.Success -> {
                            applyPagePolicy(r.data.page.cancellationPolicy)
                            emitLoaded()
                        }
                        is NetworkResult.Failure ->
                            _state.value = CancellationPolicyUiState.Error(r.error.message)
                    }
                }
            }
        }

        fun refresh() = load()

        // ─── Selection / edits ────────────────────────────────────────────────

        fun select(preset: Preset) {
            selectedPreset = preset
            when (preset) {
                Preset.Flexible -> {
                    customCutoffHours = 24
                    customRefundPct = 0
                }
                Preset.Moderate -> {
                    customCutoffHours = 48
                    customRefundPct = 50
                }
                Preset.Strict -> {
                    customCutoffHours = 0
                    customRefundPct = 0
                }
                Preset.Custom -> Unit // keep current custom values
            }
            emitLoaded()
        }

        fun decrementCutoff() {
            val idx = CUTOFF_LADDER.indexOf(customCutoffHours)
            customCutoffHours =
                if (idx > 0) {
                    CUTOFF_LADDER[idx - 1]
                } else {
                    CUTOFF_LADDER.lastOrNull { it < customCutoffHours } ?: 0
                }
            emitLoaded()
        }

        fun incrementCutoff() {
            val idx = CUTOFF_LADDER.indexOf(customCutoffHours)
            customCutoffHours =
                if (idx in 0 until CUTOFF_LADDER.size - 1) {
                    CUTOFF_LADDER[idx + 1]
                } else {
                    CUTOFF_LADDER.firstOrNull { it > customCutoffHours } ?: CUTOFF_LADDER.last()
                }
            emitLoaded()
        }

        fun decrementRefund() {
            customRefundPct = (customRefundPct - REFUND_STEP).coerceAtLeast(0)
            emitLoaded()
        }

        fun incrementRefund() {
            customRefundPct = (customRefundPct + REFUND_STEP).coerceAtMost(REFUND_MAX)
            emitLoaded()
        }

        fun setDepositNonRefundable(value: Boolean) {
            depositNonRefundable = value
            emitLoaded()
        }

        fun cycleNoShow() {
            val all = NoShowMode.entries
            val idx = all.indexOf(noShowMode)
            noShowMode = all[(idx + 1) % all.size]
            emitLoaded()
        }

        // ─── Save ───────────────────────────────────────────────────────────

        fun save() {
            if (_saving.value) return
            _saving.value = true
            _saveError.value = null
            viewModelScope.launch {
                val id = eventTypeId
                val result =
                    if (id != null) {
                        repo.updateEventType(owner, id, eventTypeUpdate())
                    } else {
                        repo.updateBookingPage(
                            owner,
                            UpdateBookingPageRequest(cancellationPolicy = pagePolicyValue()),
                        )
                    }
                _saving.value = false
                when (result) {
                    is NetworkResult.Success -> _didSave.value = true
                    is NetworkResult.Failure -> _saveError.value = result.error.message
                }
            }
        }

        fun clearSaveError() {
            _saveError.value = null
        }

        // ─── Encoding ─────────────────────────────────────────────────────────

        /** Page-level `cancellation_policy`: preset name, or JSON string for Custom. */
        internal fun pagePolicyValue(): String =
            when (selectedPreset) {
                Preset.Flexible, Preset.Moderate, Preset.Strict -> selectedPreset.rawValue
                Preset.Custom ->
                    buildString {
                        append("{")
                        append("\"preset\":\"custom\",")
                        append("\"free_cancel_window_min\":${customCutoffHours * MINUTES_PER_HOUR},")
                        append("\"refund_after_pct\":$customRefundPct,")
                        append("\"deposit_non_refundable\":$depositNonRefundable,")
                        append("\"no_show\":\"${noShowMode.rawValue}\"")
                        append("}")
                    }
            }

        internal fun eventTypeUpdate(): UpdateEventTypeRequest {
            val windowMin = customCutoffHours * MINUTES_PER_HOUR
            return UpdateEventTypeRequest(
                depositRefundable = !depositNonRefundable,
                cancellationWindowMin = windowMin,
                rescheduleCutoffMin = windowMin,
                noShowFeeCents = noShowFeeCents(),
                refundPolicy = refundPolicyValue(),
            )
        }

        /** Map the editor state onto the backend `refund_policy` enum. */
        internal fun refundPolicyValue(): String =
            when (selectedPreset) {
                Preset.Flexible -> "full"
                Preset.Moderate -> "partial"
                Preset.Strict -> "none"
                Preset.Custom ->
                    when {
                        depositNonRefundable && customRefundPct > 0 -> "deposit_only"
                        customRefundPct >= REFUND_MAX -> "full"
                        customRefundPct == 0 -> "none"
                        else -> "partial"
                    }
            }

        private fun noShowFeeCents(): Int =
            when (noShowMode) {
                NoShowMode.ChargeFull -> priceCents
                NoShowMode.ChargeDeposit -> depositCents
                NoShowMode.NoCharge -> 0
            }

        // ─── Loading projections ──────────────────────────────────────────────

        private fun applyEventType(et: EventTypeDto) {
            priceCents = et.priceCents ?: 0
            depositCents = et.depositCents ?: 0
            val window = et.cancellationWindowMin ?: 0
            val policy = et.refundPolicy ?: "full"
            depositNonRefundable = (et.depositRefundable == false) || policy == "deposit_only"
            customCutoffHours = window / MINUTES_PER_HOUR
            selectedPreset =
                when {
                    policy == "full" && window == FLEXIBLE_WINDOW_MIN -> {
                        customRefundPct = 0
                        Preset.Flexible
                    }
                    policy == "partial" && window == MODERATE_WINDOW_MIN -> {
                        customRefundPct = 50
                        Preset.Moderate
                    }
                    policy == "none" -> {
                        customRefundPct = 0
                        Preset.Strict
                    }
                    else -> {
                        customRefundPct = refundPctFor(policy)
                        Preset.Custom
                    }
                }
            val fee = et.noShowFeeCents ?: 0
            noShowMode =
                when {
                    fee == 0 -> NoShowMode.NoCharge
                    fee == depositCents && depositCents > 0 -> NoShowMode.ChargeDeposit
                    else -> NoShowMode.ChargeFull
                }
        }

        private fun applyPagePolicy(value: String?) {
            if (value.isNullOrBlank()) {
                select(Preset.Flexible)
                return
            }
            Preset.entries.firstOrNull { it.rawValue == value }?.let {
                select(it)
                return
            }
            if (value.trimStart().startsWith("{")) {
                runCatching { policyAdapter.fromJson(value) }.getOrNull()?.let { obj ->
                    selectedPreset = Preset.Custom
                    (obj["free_cancel_window_min"] as? Number)?.let { customCutoffHours = it.toInt() / MINUTES_PER_HOUR }
                    (obj["refund_after_pct"] as? Number)?.let { customRefundPct = it.toInt() }
                    depositNonRefundable = (obj["deposit_non_refundable"] as? Boolean) ?: true
                    (obj["no_show"] as? String)?.let { raw ->
                        NoShowMode.entries.firstOrNull { it.rawValue == raw }?.let { noShowMode = it }
                    }
                    return
                }
            }
            select(Preset.Flexible)
        }

        private fun emitLoaded() {
            _state.value =
                CancellationPolicyUiState.Loaded(
                    PolicyForm(
                        selectedPreset = selectedPreset,
                        customCutoffHours = customCutoffHours,
                        customRefundPct = customRefundPct,
                        depositNonRefundable = depositNonRefundable,
                        noShowMode = noShowMode,
                        canDecrementCutoff = customCutoffHours > CUTOFF_LADDER.first(),
                        canIncrementCutoff = customCutoffHours < CUTOFF_LADDER.last(),
                        canDecrementRefund = customRefundPct > 0,
                        canIncrementRefund = customRefundPct < REFUND_MAX,
                        previewText = previewText(),
                        footnote = footnote(),
                    ),
                )
        }

        private fun previewText(): String =
            when (selectedPreset) {
                Preset.Flexible -> "Free cancellation up to 24 hours before. After that, no refund."
                Preset.Moderate -> "50% refund up to 48 hours before. After that, no refund."
                Preset.Strict -> "No refund once the booking is confirmed."
                Preset.Custom -> customPreviewText()
            }

        private fun customPreviewText(): String {
            val parts = mutableListOf<String>()
            if (customCutoffHours > 0) {
                parts += "${hoursLabel(customCutoffHours)} before: full refund."
                parts +=
                    if (customRefundPct > 0) {
                        "After that: $customRefundPct% refund."
                    } else {
                        "After that: no refund."
                    }
            } else {
                parts +=
                    if (customRefundPct > 0) {
                        "$customRefundPct% refund anytime."
                    } else {
                        "No refund once confirmed."
                    }
            }
            if (depositNonRefundable) parts += "Deposit is non-refundable."
            return parts.joinToString(" ")
        }

        private fun footnote(): String =
            if (selectedPreset == Preset.Flexible) {
                "Flexible is the friendliest — most people start here."
            } else {
                "Invitees see this wording before they pay."
            }

        companion object {
            const val EVENT_TYPE_ID_KEY = "eventTypeId"
            val CUTOFF_LADDER = listOf(0, 1, 2, 4, 6, 12, 24, 48, 72)
            private const val REFUND_STEP = 5
            private const val REFUND_MAX = 100
            private const val MINUTES_PER_HOUR = 60
            private const val HOURS_PER_DAY = 24
            private const val FLEXIBLE_WINDOW_MIN = 1440
            private const val MODERATE_WINDOW_MIN = 2880

            internal fun refundPctFor(policy: String): Int =
                when (policy) {
                    "full" -> 100
                    "partial" -> 50
                    else -> 0
                }

            internal fun hoursLabel(hours: Int): String =
                if (hours % HOURS_PER_DAY == 0 && hours > 0) {
                    val days = hours / HOURS_PER_DAY
                    "$days day${if (days == 1) "" else "s"}"
                } else {
                    "$hours hour${if (hours == 1) "" else "s"}"
                }
        }
    }

/** Immutable render payload for the policy editor. */
data class PolicyForm(
    val selectedPreset: CancellationRefundPolicyViewModel.Preset,
    val customCutoffHours: Int,
    val customRefundPct: Int,
    val depositNonRefundable: Boolean,
    val noShowMode: CancellationRefundPolicyViewModel.NoShowMode,
    val canDecrementCutoff: Boolean,
    val canIncrementCutoff: Boolean,
    val canDecrementRefund: Boolean,
    val canIncrementRefund: Boolean,
    val previewText: String,
    val footnote: String,
) {
    val isCustom: Boolean get() = selectedPreset == CancellationRefundPolicyViewModel.Preset.Custom
}

/** Four-state machine for the policy editor. */
sealed interface CancellationPolicyUiState {
    data object Loading : CancellationPolicyUiState

    /** Paid scheduling is off → "coming soon" surface. */
    data object NotEnabled : CancellationPolicyUiState

    data class Loaded(val form: PolicyForm) : CancellationPolicyUiState

    data class Error(val message: String) : CancellationPolicyUiState
}
