@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.verify_landlord.postcard

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeVerificationRepository
import app.pantopus.android.ui.screens.homes.verify_landlord.VerifyLandlordSubmitState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject

/** Nav-arg key for the home whose postcard is being verified. */
const val POSTCARD_VERIFICATION_HOME_ID_KEY: String = "homeId"

/** Lifecycle state of the physical postcard. */
enum class PostcardDeliveryStage { Mailed, InTransit, Delivered }

/** Full payload describing the postcard verification surface. */
data class PostcardVerificationContent(
    val recipientName: String,
    val street: String,
    val cityZip: String,
    val trackingNumber: String,
    val mailedOn: String,
    val inTransitOn: String?,
    val deliveredOn: String?,
    val resendAvailableOn: String,
)

/**
 * Deterministic seed for the delivery-timeline chrome. The backend has
 * no USPS tracking surface (see `PostcardDtos.kt`), so the timeline is
 * presentation only — it never gates the code field or the Verify CTA.
 */
object PostcardVerificationSampleData {
    val deliveredContent: PostcardVerificationContent =
        PostcardVerificationContent(
            recipientName = "Mira Patel",
            street = "412 Elm St, Apt 3B",
            cityZip = "San Francisco, CA 94114",
            trackingNumber = "#9405 5036 …8421",
            mailedOn = "Oct 9",
            inTransitOn = "Oct 11",
            deliveredOn = "Oct 12",
            resendAvailableOn = "Oct 15",
        )

    val inTransitContent: PostcardVerificationContent =
        PostcardVerificationContent(
            recipientName = "Mira Patel",
            street = "412 Elm St, Apt 3B",
            cityZip = "San Francisco, CA 94114",
            trackingNumber = "#9405 5036 …8421",
            mailedOn = "Oct 9",
            inTransitOn = "Oct 11",
            deliveredOn = null,
            resendAvailableOn = "Oct 15",
        )

    fun content(stage: PostcardDeliveryStage): PostcardVerificationContent =
        if (stage == PostcardDeliveryStage.Delivered) deliveredContent else inTransitContent
}

/** Transient banner surfaced under the code field. */
data class PostcardNotice(
    val text: String,
    val isError: Boolean,
)

/** Outbound events the host nav stack acts on. */
sealed interface PostcardVerificationOutboundEvent {
    data object Dismiss : PostcardVerificationOutboundEvent

    /**
     * Verify pressed and the code matched — caller should pop the
     * screen and route to the verified-home success surface.
     */
    data class Verified(val homeId: String) : PostcardVerificationOutboundEvent
}

/** Aggregate UI state for A12.7. */
data class PostcardVerificationUiState(
    val stage: PostcardDeliveryStage,
    val content: PostcardVerificationContent,
    val codeInput: String = "",
    val submitState: VerifyLandlordSubmitState = VerifyLandlordSubmitState.Idle,
    /** Parsed from the 400 body's `attempts_remaining` (route line 2611-2614). */
    val attemptsRemaining: Int? = null,
    /** Backend said the code is gone (404 / 410 / 429). */
    val needsNewCode: Boolean = false,
    /** True once the user says they hold the card, or it landed. */
    val hasCodeInHand: Boolean = false,
    /** Expiry returned by `request-postcard`, formatted for display. */
    val codeExpiresOn: String? = null,
    val notice: PostcardNotice? = null,
    val isRequestingCode: Boolean = false,
) {
    val isSubmitting: Boolean get() = submitState is VerifyLandlordSubmitState.Submitting

    /**
     * The code field only ever locks while a submit is in flight — the
     * delivery stage never gates it. RN keeps the field live at all
     * times (`verify-postcard.tsx:145-152`).
     */
    val isCodeInputUnlocked: Boolean get() = !isSubmitting

    /**
     * Whether the screen renders the "enter your code" frame rather than
     * the waiting-for-delivery / request-a-code frame.
     *
     * [needsNewCode] wins: once the backend says the pending code is gone
     * (404 / 410 expired / 429 too many attempts) RN drops the user back
     * on the request step (`verify-postcard.tsx:79-82`), so typing into a
     * dead code field is never the foreground affordance.
     */
    val showsCodeEntryFrame: Boolean
        get() = !needsNewCode && (hasCodeInHand || stage == PostcardDeliveryStage.Delivered)

    val primaryCtaEnabled: Boolean
        get() = codeInput.length == CODE_LENGTH && !isSubmitting

    val primaryCtaLabel: String
        get() = if (isSubmitting) "Verifying…" else "Verify code"

    val attemptsRemainingLabel: String?
        get() {
            val remaining = attemptsRemaining ?: return null
            if (remaining > ATTEMPTS_WARNING_THRESHOLD) return null
            return if (remaining == 1) "1 attempt remaining" else "$remaining attempts remaining"
        }

    val codeExpiryLabel: String?
        get() = codeExpiresOn?.let { "Code expires $it" }

    companion object {
        /**
         * Length of the code printed on the postcard. The backend
         * accepts 6–8 alphanumerics (`verifyPostcardSchema`,
         * `backend/routes/homeOwnership.js:2544`); the mailer prints 6.
         */
        const val CODE_LENGTH: Int = 6

        /** Only surface the countdown once it gets tight. */
        const val ATTEMPTS_WARNING_THRESHOLD: Int = 3
    }
}

/**
 * View model for A12.7. Holds the (informational) delivery stage, the
 * user's 6-char code, and a `submitState` machine identical in shape to
 * the wizard's [VerifyLandlordSubmitState].
 *
 * Code entry is never gated on the delivery stage: the backend exposes
 * no delivery tracking, so a stage-based lock made
 * `POST /api/homes/:id/verify-postcard` unreachable for every real home.
 */
@HiltViewModel
open class PostcardVerificationViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val verificationRepository: HomeVerificationRepository,
    ) : ViewModel() {
        private val homeId: String =
            requireNotNull(savedStateHandle[POSTCARD_VERIFICATION_HOME_ID_KEY]) {
                "PostcardVerificationViewModel requires a '$POSTCARD_VERIFICATION_HOME_ID_KEY' nav arg."
            }

        protected open val submitDelayMillis: Long = SUBMIT_DELAY_DEFAULT_MILLIS

        /**
         * Offline/preview/test seam. When non-null, [verify] checks the
         * typed code against this value locally instead of calling the
         * backend. Production leaves it null, so the code is validated by
         * `POST /api/homes/:id/verify-postcard`.
         */
        protected open val expectedCode: String? = null

        private val _state =
            MutableStateFlow(
                PostcardVerificationUiState(
                    stage = PostcardDeliveryStage.InTransit,
                    content = PostcardVerificationSampleData.content(PostcardDeliveryStage.InTransit),
                ),
            )
        val state: StateFlow<PostcardVerificationUiState> = _state.asStateFlow()
        val pendingEvent = MutableStateFlow<PostcardVerificationOutboundEvent?>(null)

        // MARK: - Mutations

        fun updateCode(raw: String) {
            val sanitized = raw.uppercase().take(PostcardVerificationUiState.CODE_LENGTH)
            _state.update { it.copy(codeInput = sanitized) }
        }

        /**
         * RN's "I already have a code" escape hatch — flips the screen to
         * the code-entry frame without waiting on the delivery timeline.
         */
        fun markHasCode() {
            // RN's request step routes straight to `enter` — the user says
            // they're holding a card, so stop insisting on a new one.
            _state.update { it.copy(hasCodeInHand = true, needsNewCode = false, notice = null) }
        }

        /**
         * Request (or re-request) the mailed code via
         * `POST /api/homes/:id/request-postcard`.
         */
        fun requestNewCode() {
            _state.update { it.copy(codeInput = "", attemptsRemaining = null) }
            // Offline/test seam (expectedCode != null) just clears input.
            if (expectedCode != null) {
                _state.update { it.copy(needsNewCode = false) }
                return
            }
            if (_state.value.isRequestingCode) return
            _state.update { it.copy(isRequestingCode = true) }
            viewModelScope.launch { performRequestCode() }
        }

        /** Legacy entry point kept for the "Resend" affordance. */
        fun resendPostcard() = requestNewCode()

        /**
         * Used by debug / preview tooling and snapshot tests to flip
         * between the in-transit and delivered frames without waiting
         * on the simulated USPS clock.
         */
        fun setStage(next: PostcardDeliveryStage) {
            _state.update { current ->
                current.copy(
                    stage = next,
                    content = PostcardVerificationSampleData.content(next),
                    hasCodeInHand = current.hasCodeInHand || next == PostcardDeliveryStage.Delivered,
                )
            }
        }

        fun verifyTapped() {
            val snapshot = _state.value
            if (!snapshot.primaryCtaEnabled) return
            viewModelScope.launch { verify() }
        }

        fun dismissTapped() {
            pendingEvent.value = PostcardVerificationOutboundEvent.Dismiss
        }

        fun acknowledgeEvent() {
            pendingEvent.value = null
        }

        // MARK: - Request

        private suspend fun performRequestCode() {
            when (val result = verificationRepository.requestPostcard(homeId)) {
                is NetworkResult.Success -> {
                    _state.update {
                        it.copy(
                            isRequestingCode = false,
                            needsNewCode = false,
                            // RN's `handleRequestCode` drops the user on the
                            // enter-code step once the mailer accepts the
                            // request (`verify-postcard.tsx:45`).
                            hasCodeInHand = true,
                            submitState = VerifyLandlordSubmitState.Idle,
                            codeExpiresOn = formatExpiry(result.data.postcard.expiresAt),
                            notice = PostcardNotice(text = result.data.message, isError = false),
                        )
                    }
                }
                is NetworkResult.Failure -> {
                    val message = result.error.message
                    if (message.contains("already have a pending", ignoreCase = true)) {
                        // RN: an existing pending code drops the user
                        // straight into the enter-code step.
                        _state.update {
                            it.copy(
                                isRequestingCode = false,
                                hasCodeInHand = true,
                                needsNewCode = false,
                                notice =
                                    PostcardNotice(
                                        text =
                                            "A verification code has already been requested for " +
                                                "this address. Enter it below.",
                                        isError = false,
                                    ),
                            )
                        }
                        return
                    }
                    _state.update {
                        it.copy(
                            isRequestingCode = false,
                            notice =
                                PostcardNotice(
                                    text = message.ifBlank { "Couldn't request a code. Try again." },
                                    isError = true,
                                ),
                        )
                    }
                }
            }
        }

        // MARK: - Submit

        private suspend fun verify() {
            _state.update { it.copy(submitState = VerifyLandlordSubmitState.Submitting, notice = null) }
            val localExpected = expectedCode
            if (localExpected != null) {
                // Offline/test seam — compare locally, no network.
                if (submitDelayMillis > 0) delay(submitDelayMillis)
                val snapshot = _state.value
                if (snapshot.codeInput == localExpected) {
                    _state.update { it.copy(submitState = VerifyLandlordSubmitState.Submitted) }
                    pendingEvent.value = PostcardVerificationOutboundEvent.Verified(homeId)
                } else {
                    _state.update {
                        it.copy(
                            submitState =
                                VerifyLandlordSubmitState.Error(
                                    "That code didn't match. Double-check the postcard.",
                                ),
                            codeInput = "",
                        )
                    }
                }
                return
            }
            when (val result = verificationRepository.verifyPostcard(homeId, _state.value.codeInput)) {
                is NetworkResult.Success -> {
                    _state.update {
                        it.copy(
                            submitState = VerifyLandlordSubmitState.Submitted,
                            attemptsRemaining = null,
                            needsNewCode = false,
                        )
                    }
                    pendingEvent.value = PostcardVerificationOutboundEvent.Verified(homeId)
                }
                is NetworkResult.Failure -> applyVerifyFailure(result.error)
            }
        }

        /**
         * Map the handler's documented failure shapes
         * (`backend/routes/homeOwnership.js:2548-2615`): 404 → no pending
         * code, 410 → expired, 429 → too many attempts, 400 → invalid
         * code + `attempts_remaining`.
         */
        private fun applyVerifyFailure(error: NetworkError) {
            when {
                error is NetworkError.Transport -> {
                    _state.update {
                        it.copy(
                            submitState =
                                VerifyLandlordSubmitState.Error(
                                    "You're offline. Try again when you're back online.",
                                ),
                        )
                    }
                }
                error is NetworkError.NotFound -> {
                    _state.update {
                        it.copy(
                            needsNewCode = true,
                            codeInput = "",
                            submitState =
                                VerifyLandlordSubmitState.Error(
                                    "No pending verification code found. Request a new one.",
                                ),
                        )
                    }
                }
                error is NetworkError.ClientError && (error.code == HTTP_GONE || error.code == HTTP_TOO_MANY) -> {
                    _state.update {
                        it.copy(
                            needsNewCode = true,
                            attemptsRemaining = 0,
                            codeInput = "",
                            submitState =
                                VerifyLandlordSubmitState.Error(
                                    error.message.ifBlank { "That code has expired. Request a new one." },
                                ),
                        )
                    }
                }
                error is NetworkError.ClientError -> {
                    _state.update {
                        it.copy(
                            attemptsRemaining = attemptsRemainingIn(error.body),
                            codeInput = "",
                            submitState =
                                VerifyLandlordSubmitState.Error(
                                    error.message.ifBlank {
                                        "That code didn't match. Double-check the postcard."
                                    },
                                ),
                        )
                    }
                }
                else -> {
                    _state.update {
                        it.copy(
                            codeInput = "",
                            submitState =
                                VerifyLandlordSubmitState.Error(
                                    error.message.ifBlank { "Couldn't verify that code. Try again." },
                                ),
                        )
                    }
                }
            }
        }

        private fun attemptsRemainingIn(body: String?): Int? {
            if (body.isNullOrBlank()) return null
            return runCatching {
                val json = org.json.JSONObject(body)
                if (json.has("attempts_remaining")) json.getInt("attempts_remaining") else null
            }.getOrNull()
        }

        private fun formatExpiry(iso: String?): String? {
            if (iso.isNullOrBlank()) return null
            return runCatching {
                val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                parser.timeZone = TimeZone.getTimeZone("UTC")
                val trimmed = iso.substringBefore('.').substringBefore('Z').take(EXPIRY_ISO_LENGTH)
                val parsed = parser.parse(trimmed) ?: return null
                DateFormat.getDateInstance(DateFormat.MEDIUM, Locale.getDefault()).format(parsed)
            }.getOrNull()
        }

        companion object {
            const val SUBMIT_DELAY_DEFAULT_MILLIS: Long = 800L
            const val DEFAULT_EXPECTED_CODE: String = "4Q2K7B"
            private const val HTTP_GONE = 410
            private const val HTTP_TOO_MANY = 429
            private const val EXPIRY_ISO_LENGTH = 19
        }
    }
