@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.invitee.confirm

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.PublicBookingCreatedResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.ManageTokenStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * A6 — the public booking commit flow. Owns the intake → review → (payment) →
 * confirmed path inside A5's single `book/{slug}` destination (the steps are
 * local, not separate routes). On a successful create it PERSISTS the one-time
 * `manageToken` (via [ManageTokenStore], keyed by booking id) and moves to the
 * confirmed step; a 409 surfaces the shared `ConflictAlternativesSheet` (never a
 * dead end); 400 validation maps back to field errors; the priced path (behind
 * [SchedulingFeatureFlags] + Stripe test mode) shows a represented payment step.
 *
 * Seeded via [start] with the in-process [InviteeConfirmArgs] A5 hands over —
 * the VM is scoped to A5's destination, so it takes no `SavedStateHandle`.
 */
@HiltViewModel
class InviteeConfirmViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val manageTokens: ManageTokenStore,
        private val flags: SchedulingFeatureFlags,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel() {
        private val _state = MutableStateFlow(ConfirmFlowState())
        val state: StateFlow<ConfirmFlowState> = _state.asStateFlow()

        private var args: InviteeConfirmArgs? = null
        private var started = false
        private var holdJob: Job? = null

        val questions: List<IntakeQuestion> get() = args?.questions.orEmpty()

        val paidEnabled: Boolean
            get() {
                val et = args?.eventType ?: return false
                return flags.paidSchedulingEnabled && ConfirmUtils.priceMode(et.priceCents, et.depositCents) != PriceMode.Free
            }

        fun start(newArgs: InviteeConfirmArgs) {
            if (started) return
            started = true
            args = newArgs
            _state.value =
                ConfirmFlowState(
                    step = ConfirmStep.Details,
                    values = prefillValues(newArgs.prefill),
                    slotStartUtc = newArgs.startAtUtc,
                    slotEndUtc = newArgs.endAtUtc,
                    tz = newArgs.tz.ifBlank { ConfirmUtils.deviceTimezone() },
                )
            startHoldCountdown()
        }

        /** Collapse a signed-in identity into the prefilled name/email values. */
        private fun prefillValues(prefill: InviteePrefill?): IntakeValues {
            if (prefill == null) return IntakeValues()
            val parts = prefill.name.trim().split(Regex("\\s+"), limit = 2)
            return IntakeValues(
                firstName = parts.firstOrNull().orEmpty(),
                lastName = if (parts.size > 1) parts[1] else "",
                email = prefill.email,
                isPrefilled = true,
            )
        }

        /** "Not you?" — drop the prefilled identity and reveal the editable fields. */
        fun clearPrefill() {
            _state.update {
                it.copy(values = it.values.copy(firstName = "", lastName = "", email = "", isPrefilled = false))
            }
        }

        private fun startHoldCountdown() {
            holdJob?.cancel()
            holdJob =
                viewModelScope.launch {
                    while (true) {
                        delay(ONE_SECOND_MS)
                        val current = _state.value
                        if (current.step == ConfirmStep.Payment || current.step == ConfirmStep.Confirmed) break
                        if (current.holdSecondsLeft <= 0) break
                        _state.update { it.copy(holdSecondsLeft = (it.holdSecondsLeft - 1).coerceAtLeast(0)) }
                    }
                }
        }

        // ─── Intake editing ──────────────────────────────────────────────────

        fun updateValues(values: IntakeValues) {
            _state.update { current ->
                // Live-clear shown errors for fields the user is fixing.
                val cleared =
                    if (current.shownErrors.isEmpty()) {
                        current.shownErrors
                    } else {
                        ConfirmUtils.validateIntake(values, questions)
                    }
                current.copy(values = values, shownErrors = if (current.shownErrors.isEmpty()) emptyMap() else cleared)
            }
        }

        fun setAnswer(
            key: String,
            value: AnswerValue,
        ) {
            val current = _state.value
            updateValues(current.values.copy(answers = current.values.answers + (key to value)))
        }

        fun setTz(tz: String) {
            _state.update { it.copy(tz = tz) }
        }

        // ─── Step transitions ────────────────────────────────────────────────

        fun onPrimary() {
            val current = _state.value
            if (current.holdExpired) return // composable routes "pick another time" via onPickAnother
            when (current.step) {
                ConfirmStep.Details -> {
                    val live = ConfirmUtils.validateIntake(current.values, questions)
                    if (live.isNotEmpty()) {
                        _state.update { it.copy(shownErrors = live) }
                        return
                    }
                    _state.update { it.copy(step = ConfirmStep.Review, shownErrors = emptyMap(), errorMessage = null) }
                }
                ConfirmStep.Review -> submit()
                ConfirmStep.Payment -> confirmPayment()
                ConfirmStep.Confirmed -> Unit
            }
        }

        fun back() {
            _state.update { current ->
                when (current.step) {
                    ConfirmStep.Review -> current.copy(step = ConfirmStep.Details, errorMessage = null)
                    else -> current
                }
            }
        }

        fun dismissConflict() {
            _state.update { it.copy(conflict = null) }
        }

        fun dismissError() {
            _state.update { it.copy(errorMessage = null) }
        }

        fun pickAlternative(
            startUtc: String,
            endUtc: String?,
        ) {
            _state.update { it.copy(conflict = null, slotStartUtc = startUtc, slotEndUtc = endUtc, step = ConfirmStep.Review) }
            submit(startUtc, endUtc)
        }

        // ─── Create ──────────────────────────────────────────────────────────

        fun submit(
            overrideStartUtc: String? = null,
            overrideEndUtc: String? = null,
        ) {
            val a = args ?: return
            val start = overrideStartUtc ?: _state.value.slotStartUtc
            if (start.isBlank()) return
            _state.update { it.copy(submitting = true, conflict = null, errorMessage = null) }
            viewModelScope.launch {
                val body =
                    ConfirmUtils.buildBookingRequest(
                        values = _state.value.values,
                        startAtUtc = start,
                        durationMin = a.eventType.defaultDuration,
                        timezone = _state.value.tz,
                        questions = a.questions,
                    )
                val oneOff = a.oneOffToken
                val result =
                    if (oneOff != null) {
                        repo.publicCreateOneOffBooking(oneOff, body)
                    } else {
                        repo.publicCreateBooking(a.slug.orEmpty(), a.eventTypeSlug.orEmpty(), body)
                    }
                when (result) {
                    is NetworkResult.Success -> onCreated(result.data, a)
                    is NetworkResult.Failure -> onCreateFailed(result.error, oneOff != null)
                }
            }
        }

        private suspend fun onCreated(
            data: PublicBookingCreatedResponse,
            a: InviteeConfirmArgs,
        ) {
            val token = data.manageToken
            if (token != null) manageTokens.save(data.booking.id, token)
            val requiresApproval = data.booking.requiresApproval ?: a.eventType.requiresApproval ?: false
            if (paidEnabled && data.clientSecret != null) {
                _state.update {
                    it.copy(
                        step = ConfirmStep.Payment,
                        clientSecret = data.clientSecret,
                        manageToken = token,
                        // Keep the created id: confirmPayment() builds ConfirmedData
                        // from it once the payment step completes.
                        createdBookingId = data.booking.id,
                        submitting = false,
                    )
                }
                return
            }
            _state.update {
                it.copy(
                    step = ConfirmStep.Confirmed,
                    manageToken = token,
                    createdBookingId = data.booking.id,
                    submitting = false,
                    confirmed =
                        ConfirmedData(
                            bookingId = data.booking.id,
                            manageToken = token,
                            sentToEmail = it.values.email.trim(),
                            requiresApproval = requiresApproval,
                            confirmationMessage = data.page?.confirmationMessage,
                            paid = null,
                        ),
                )
            }
        }

        private fun onCreateFailed(
            error: app.pantopus.android.data.api.net.NetworkError,
            oneOff: Boolean,
        ) {
            val decoded =
                errors.decode(error, notFoundAs = if (oneOff) SchedulingError.Expired else SchedulingError.Unavailable)
            when (decoded) {
                is SchedulingError.Conflict ->
                    _state.update { it.copy(conflict = decoded, submitting = false) }
                is SchedulingError.Validation ->
                    _state.update {
                        it.copy(
                            step = ConfirmStep.Details,
                            shownErrors = mapValidation(decoded),
                            errorMessage = "Please fix the highlighted details.",
                            submitting = false,
                        )
                    }
                is SchedulingError.Paused ->
                    _state.update { it.copy(errorMessage = "This page isn't accepting bookings right now.", submitting = false) }
                is SchedulingError.Expired ->
                    _state.update {
                        it.copy(
                            errorMessage = "This link is no longer valid. Ask your host for a new one.",
                            submitting = false,
                        )
                    }
                is SchedulingError.Unavailable ->
                    _state.update { it.copy(errorMessage = "This booking page is unavailable.", submitting = false) }
                is SchedulingError.Generic ->
                    _state.update { it.copy(errorMessage = decoded.message, submitting = false) }
                else ->
                    _state.update { it.copy(errorMessage = "Something went wrong. Please try again.", submitting = false) }
            }
        }

        /** Represented payment confirmation — the real PaymentSheet lives behind A14/Stripe. */
        private fun confirmPayment() {
            val a = args ?: return
            val token = _state.value.manageToken
            val et = a.eventType
            val mode = ConfirmUtils.priceMode(et.priceCents, et.depositCents)
            _state.update {
                val bookingId = it.confirmed?.bookingId ?: it.createdBookingId.orEmpty()
                it.copy(
                    step = ConfirmStep.Confirmed,
                    submitting = false,
                    confirmed =
                        ConfirmedData(
                            bookingId = bookingId,
                            manageToken = token,
                            sentToEmail = it.values.email.trim(),
                            requiresApproval = et.requiresApproval ?: false,
                            confirmationMessage = null,
                            paid =
                                PaidConfirmInfo(
                                    mode = mode,
                                    amountPaidCents = ConfirmUtils.dueNowCents(et.priceCents, et.depositCents),
                                    balanceCents = ConfirmUtils.balanceCents(et.priceCents, et.depositCents),
                                    currency = et.currency,
                                    txnLine = ConfirmUtils.receiptTxnLine(bookingId = bookingId, tz = it.tz),
                                ),
                        ),
                )
            }
        }

        private fun mapValidation(validation: SchedulingError.Validation): Map<String, String> =
            validation.details.mapNotNull { detail ->
                val field = detail.field ?: return@mapNotNull null
                val key =
                    when (field) {
                        "name" -> "firstName"
                        else -> field
                    }
                key to (detail.message ?: "This field is invalid")
            }.toMap()

        private companion object {
            const val ONE_SECOND_MS = 1000L
        }
    }
