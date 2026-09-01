@file:Suppress(
    "CyclomaticComplexMethod",
    "MagicNumber",
    "PackageNaming",
    "SwallowedException",
    "TooGenericExceptionCaught",
    "TooManyFunctions",
)

package app.pantopus.android.ui.screens.auth.sign_up

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.auth.AccountType
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.OAuthBrowserCommand
import app.pantopus.android.data.auth.OAuthProvider
import app.pantopus.android.data.auth.OAuthSessionStore
import app.pantopus.android.ui.screens.auth.AuthValidation
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

/** Two-segment Personal / Business picker choice. */
enum class SignUpAccountTypeChoice {
    Personal,
    Business,
    ;

    val label: String
        get() =
            when (this) {
                Personal -> "Personal"
                Business -> "Business"
            }

    val asAccountType: AccountType
        get() =
            when (this) {
                Personal -> AccountType.Personal
                Business -> AccountType.Business
            }
}

/** Fields tracked by the signup form. */
enum class SignUpField {
    Email,
    Password,
    ConfirmPassword,
    Username,
    FirstName,
    MiddleName,
    LastName,
    DateOfBirth,
    PhoneNumber,
    Address,
    City,
    State,
    Zipcode,
    InviteCode,
}

/**
 * Form values + lifecycle for the Create-account surface. Mirrors iOS
 * `SignUpViewModel` 1:1 — same field set, same validators (`AuthValidation`),
 * same success / failure model, plus browser OAuth.
 */
@HiltViewModel
class SignUpViewModel
    @Inject
    constructor(
        private val authRepository: AuthRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        data class UiState(
            val email: String = "",
            val password: String = "",
            val confirmPassword: String = "",
            val username: String = "",
            val firstName: String = "",
            val middleName: String = "",
            val lastName: String = "",
            val dateOfBirth: LocalDate? = null,
            val phoneNumber: String = "",
            val address: String = "",
            val city: String = "",
            val state: String = "",
            val zipcode: String = "",
            val accountType: SignUpAccountTypeChoice = SignUpAccountTypeChoice.Personal,
            val inviteCode: String = "",
            val agreedToTerms: Boolean = false,
            val fieldErrors: Map<SignUpField, String> = emptyMap(),
            val hasAttemptedSubmit: Boolean = false,
            val isSubmitting: Boolean = false,
            val topLevelError: AuthError? = null,
            val didSucceed: Boolean = false,
        ) {
            val passwordStrength: Int get() = AuthValidation.passwordStrength(password)

            val passwordStrengthLabel: String get() =
                when (passwordStrength) {
                    1 -> "Weak"
                    2 -> "Fair"
                    3 -> "Strong"
                    else -> "—"
                }

            val isValid: Boolean get() =
                agreedToTerms && SignUpField.values().all { validate(it) == null }

            fun validate(field: SignUpField): String? =
                when (field) {
                    SignUpField.Email -> AuthValidation.email(email)
                    SignUpField.Password -> AuthValidation.password(password)
                    SignUpField.ConfirmPassword ->
                        when {
                            confirmPassword.isEmpty() -> "Confirm your password."
                            confirmPassword != password -> "Passwords don't match."
                            else -> null
                        }
                    SignUpField.Username -> AuthValidation.username(username)
                    SignUpField.FirstName ->
                        if (firstName.trim().isEmpty()) "First name is required." else null
                    SignUpField.LastName ->
                        if (lastName.trim().isEmpty()) "Last name is required." else null
                    SignUpField.MiddleName -> null
                    SignUpField.DateOfBirth -> AuthValidation.dateOfBirth(dateOfBirth)
                    SignUpField.PhoneNumber -> AuthValidation.phoneOptional(phoneNumber)
                    SignUpField.Address -> {
                        val trimmed = address.trim()
                        when {
                            trimmed.isEmpty() -> "Address is required."
                            trimmed.length < 5 -> "Address must be at least 5 characters."
                            else -> null
                        }
                    }
                    SignUpField.City -> {
                        val trimmed = city.trim()
                        when {
                            trimmed.isEmpty() -> "City is required."
                            trimmed.length < 2 -> "City must be at least 2 characters."
                            else -> null
                        }
                    }
                    SignUpField.State -> {
                        val trimmed = state.trim()
                        when {
                            trimmed.isEmpty() -> "State is required."
                            trimmed.length < 2 -> "State must be at least 2 characters."
                            else -> null
                        }
                    }
                    SignUpField.Zipcode -> {
                        val trimmed = zipcode.trim()
                        when {
                            trimmed.isEmpty() -> "ZIP is required."
                            trimmed.length < 3 -> "ZIP must be at least 3 characters."
                            else -> null
                        }
                    }
                    SignUpField.InviteCode -> null
                }

            fun validateAll(): Map<SignUpField, String> =
                buildMap {
                    SignUpField.values().forEach { field ->
                        validate(field)?.let { put(field, it) }
                    }
                }
        }

        /**
         * Referral code carried in from a `pantopus://join/:code` deep link
         * (`AuthRoutes.signUp`). Seeds the optional Invite code field so it
         * rides the register call as `invite_code`, exactly like RN's
         * `/(auth)/register?invite_code=CODE`
         * (`pantopus/frontend/apps/mobile/src/app/(auth)/register.tsx:129`).
         */
        private val seededInviteCode: String =
            savedStateHandle.get<String>(INVITE_CODE_KEY).orEmpty().trim()

        /** True when the screen was reached from a `join/:code` link. */
        val arrivedByInvite: Boolean = seededInviteCode.isNotEmpty()

        private val _uiState = MutableStateFlow(UiState(inviteCode = seededInviteCode))
        val uiState: StateFlow<UiState> = _uiState.asStateFlow()

        private val _browserAuth = Channel<OAuthBrowserCommand>(Channel.BUFFERED)
        val browserAuth = _browserAuth.receiveAsFlow()

        private var oauthOwnerId: String? = null
        private var awaitingResumeAfterBrowser: Boolean = false

        /**
         * The host actually left the foreground after the browser command
         * was issued. Custom Tabs (and the `ACTION_VIEW` fallback) always
         * pause the host before covering it, so a resume that was *not*
         * preceded by a pause is never the user backing out of the browser
         * — it is the host being re-attached, and a `LifecycleEventObserver`
         * added while the owner is already RESUMED replays ON_RESUME
         * synchronously. Cancelling on that would consume the pending
         * session and silently drop the real redirect.
         */
        private var hostLeftForeground: Boolean = false
        private var cancelJob: Job? = null

        private fun update(transform: (UiState) -> UiState) {
            _uiState.update(transform)
        }

        // Field setters used by the screen.
        fun onEmailChange(value: String) =
            update {
                it.copy(
                    email = value,
                    fieldErrors = it.fieldErrors - SignUpField.Email,
                    topLevelError = null,
                )
            }

        fun onPasswordChange(value: String) =
            update {
                it.copy(
                    password = value,
                    fieldErrors = it.fieldErrors - SignUpField.Password,
                )
            }

        fun onConfirmPasswordChange(value: String) =
            update {
                it.copy(
                    confirmPassword = value,
                    fieldErrors = it.fieldErrors - SignUpField.ConfirmPassword,
                )
            }

        fun onUsernameChange(value: String) = update { it.copy(username = value, fieldErrors = it.fieldErrors - SignUpField.Username) }

        fun onFirstNameChange(value: String) = update { it.copy(firstName = value, fieldErrors = it.fieldErrors - SignUpField.FirstName) }

        fun onMiddleNameChange(value: String) = update { it.copy(middleName = value) }

        fun onLastNameChange(value: String) = update { it.copy(lastName = value, fieldErrors = it.fieldErrors - SignUpField.LastName) }

        fun onDateOfBirthChange(value: LocalDate?) =
            update {
                it.copy(
                    dateOfBirth = value,
                    fieldErrors = it.fieldErrors - SignUpField.DateOfBirth,
                )
            }

        fun onPhoneChange(value: String) = update { it.copy(phoneNumber = value, fieldErrors = it.fieldErrors - SignUpField.PhoneNumber) }

        fun onAddressChange(value: String) = update { it.copy(address = value, fieldErrors = it.fieldErrors - SignUpField.Address) }

        fun onCityChange(value: String) = update { it.copy(city = value, fieldErrors = it.fieldErrors - SignUpField.City) }

        fun onStateChange(value: String) = update { it.copy(state = value, fieldErrors = it.fieldErrors - SignUpField.State) }

        fun onZipcodeChange(value: String) = update { it.copy(zipcode = value, fieldErrors = it.fieldErrors - SignUpField.Zipcode) }

        fun onAccountTypeChange(value: SignUpAccountTypeChoice) = update { it.copy(accountType = value) }

        fun onInviteCodeChange(value: String) = update { it.copy(inviteCode = value) }

        fun onTermsToggle() = update { it.copy(agreedToTerms = !it.agreedToTerms) }

        fun clearTopLevelError() = update { it.copy(topLevelError = null) }

        fun acknowledgeSuccess() = update { it.copy(didSucceed = false) }

        /**
         * The subset of [submit]'s validation the OAuth path can still
         * honour: account type (the backend hardcodes Personal), the 18+
         * date-of-birth gate, and the Terms agreement. Nothing else on the
         * form is sent by the browser flow, so nothing else is gated.
         * Returns the banner copy when the attempt must not start, and
         * flags the date-of-birth field when that is the blocker. Identical
         * on iOS (`SignUpViewModel.oauthPrerequisiteMessage`).
         */
        private fun oauthPrerequisiteMessage(): String? {
            val snapshot = _uiState.value
            if (snapshot.accountType == SignUpAccountTypeChoice.Business) return OAUTH_BUSINESS_MESSAGE
            val dateOfBirthError = AuthValidation.dateOfBirth(snapshot.dateOfBirth)
            if (dateOfBirthError != null) {
                update {
                    it.copy(
                        hasAttemptedSubmit = true,
                        fieldErrors = it.fieldErrors + (SignUpField.DateOfBirth to dateOfBirthError),
                    )
                }
                return dateOfBirthError
            }
            if (!snapshot.agreedToTerms) return OAUTH_TERMS_MESSAGE
            return null
        }

        fun signInWithOAuth(provider: OAuthProvider) {
            if (_uiState.value.isSubmitting) return
            update { it.copy(topLevelError = null) }
            val blocked = oauthPrerequisiteMessage()
            if (blocked != null) {
                update { it.copy(topLevelError = AuthError.ServerError(blocked)) }
                return
            }
            update { it.copy(isSubmitting = true, topLevelError = null) }
            viewModelScope.launch {
                val ownerId = UUID.randomUUID().toString()
                oauthOwnerId = ownerId
                val nonce = OAuthSessionStore.begin(ownerId)
                try {
                    val url = authRepository.oauthAuthorizationUrl(provider, nonce)
                    awaitingResumeAfterBrowser = true
                    _browserAuth.send(OAuthBrowserCommand.Open(url))
                    val callback =
                        OAuthSessionStore.callback
                            .filterNotNull()
                            .first { it.ownerId == ownerId }
                    if (!OAuthSessionStore.claim(ownerId, callback)) {
                        update { it.copy(isSubmitting = false) }
                        return@launch
                    }
                    when (callback) {
                        is OAuthSessionStore.Callback.Cancelled -> Unit
                        // Mirrors iOS `OAuthWebAuthenticationError.unableToStart`.
                        is OAuthSessionStore.Callback.Malformed,
                        is OAuthSessionStore.Callback.BrowserUnavailable,
                        ->
                            update { it.copy(topLevelError = AuthError.Unknown) }
                        // Attempt ended after a forged / unverifiable callback —
                        // no code was ever exchanged. Mirrors the iOS
                        // `rejectedCallback` -> `AuthError.serverError` mapping.
                        is OAuthSessionStore.Callback.Rejected ->
                            update {
                                it.copy(topLevelError = AuthError.ServerError(OAuthSessionStore.REJECTED_MESSAGE))
                            }
                        is OAuthSessionStore.Callback.Code ->
                            authRepository.exchangeOAuthCode(callback.value)
                        is OAuthSessionStore.Callback.Tokens ->
                            authRepository.exchangeOAuthTokens(
                                accessToken = callback.accessToken,
                                refreshToken = callback.refreshToken,
                            )
                    }
                    update { it.copy(isSubmitting = false) }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: AuthError) {
                    update { it.copy(isSubmitting = false, topLevelError = e) }
                } catch (e: Throwable) {
                    update { it.copy(isSubmitting = false, topLevelError = AuthError.Unknown) }
                } finally {
                    awaitingResumeAfterBrowser = false
                    hostLeftForeground = false
                    cancelJob?.cancel()
                    OAuthSessionStore.clear(ownerId)
                    if (oauthOwnerId == ownerId) oauthOwnerId = null
                }
            }
        }

        /**
         * Called when the host screen leaves the foreground — the browser
         * is now in front. Arms [onHostResumed]'s back-out heuristic.
         */
        fun onHostPaused() {
            if (!awaitingResumeAfterBrowser) return
            hostLeftForeground = true
        }

        /**
         * Called when the host screen resumes. Only a resume that follows a
         * real [onHostPaused] counts — see [hostLeftForeground].
         */
        fun onHostResumed() {
            if (!awaitingResumeAfterBrowser) return
            if (!hostLeftForeground) return
            hostLeftForeground = false
            val owner = oauthOwnerId ?: return
            cancelJob?.cancel()
            cancelJob =
                viewModelScope.launch {
                    delay(400)
                    if (OAuthSessionStore.cancelIfAwaiting(owner)) {
                        awaitingResumeAfterBrowser = false
                    }
                }
        }

        /**
         * Runs validation, then submits to `AuthRepository.signUp`. On
         * success flips `didSucceed = true` so the screen can route to the
         * verify-email surface (per the Q4 + backend-gap analysis in
         * `docs/mobile/auth-backend-contracts.md`).
         */
        fun submit() {
            val snapshot = _uiState.value
            val errors = snapshot.validateAll()
            update { it.copy(fieldErrors = errors, topLevelError = null, hasAttemptedSubmit = true) }
            if (errors.isNotEmpty() || !snapshot.agreedToTerms) return

            update { it.copy(isSubmitting = true) }
            viewModelScope.launch {
                try {
                    authRepository.signUp(
                        email = snapshot.email.trim().lowercase(),
                        password = snapshot.password,
                        phoneNumber = snapshot.phoneNumber.ifBlank { null },
                        username = snapshot.username.trim().lowercase(),
                        firstName = snapshot.firstName.trim(),
                        middleName = snapshot.middleName.ifBlank { null }?.trim(),
                        lastName = snapshot.lastName.trim(),
                        dateOfBirth = snapshot.dateOfBirth?.format(DateTimeFormatter.ISO_LOCAL_DATE),
                        address = snapshot.address.trim(),
                        city = snapshot.city.trim(),
                        state = snapshot.state.trim(),
                        zipcode = snapshot.zipcode.trim(),
                        accountType = snapshot.accountType.asAccountType,
                        inviteCode = snapshot.inviteCode.ifBlank { null }?.trim(),
                    )
                    update { it.copy(isSubmitting = false, didSucceed = true) }
                } catch (e: AuthError) {
                    update { it.copy(isSubmitting = false, topLevelError = e) }
                } catch (e: Throwable) {
                    update { it.copy(isSubmitting = false, topLevelError = AuthError.Unknown) }
                }
            }
        }

        companion object {
            /**
             * `SavedStateHandle` key for the optional `invite_code` query arg
             * on [app.pantopus.android.ui.screens.auth.AuthRoutes.SIGN_UP_PATTERN].
             */
            const val INVITE_CODE_KEY = "invite_code"

            /** Copy shown when the form was opened from a `join/:code` link. */
            const val INVITED_MESSAGE = "You've been invited to join Pantopus!"

            /**
             * Blocked because the OAuth callback can only ever produce a
             * Personal account: `backend/routes/users.js`
             * `ensureOAuthUserProfile` inserts `account_type: 'individual'`
             * unconditionally. Mirrors iOS
             * `SignUpViewModel.oauthBusinessMessage`.
             */
            const val OAUTH_BUSINESS_MESSAGE =
                "Business accounts must be created with email. " +
                    "Switch Account type to Personal to continue with Google or Apple."

            /**
             * Blocked because the browser flow never sends the form, so the
             * 18+ gate the email path enforces would be skipped. Mirrors iOS
             * `SignUpViewModel.oauthTermsMessage`.
             */
            const val OAUTH_TERMS_MESSAGE =
                "Agree to the Terms and Privacy Policy before continuing with Google or Apple."
        }
    }
