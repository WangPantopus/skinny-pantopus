@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.settings.password

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.account.AccountRepository
import app.pantopus.android.data.api.models.settings.PasswordUpdateBody
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.ui.components.PasswordStrength
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * A13.14 — Settings → Change password (reshape). Mirrors the iOS
 * `PasswordChangeViewModel` 1:1.
 *
 * Three-field form: current password (only when the account already
 * has a password — discovered via `GET /api/users/auth-methods`),
 * new password, confirm new password. Submit calls
 * `POST /api/users/password` (users.js:1771).
 *
 * Beyond the original three-field form, the reshape adds a live
 * [PasswordStrength] for the new password, breach detection against a small
 * sample list of common passwords (HIBP is out of scope — see
 * [COMMON_PASSWORDS]), a form-level error banner shown after a rejected
 * submit, and a quiet identity context band (email + last-changed — sample
 * data).
 *
 * Validation:
 * - current required when `hasPassword == true`
 * - new ≥ [MIN_LENGTH] chars (matches `PASSWORD_MIN_LENGTH` = 12 in users.js)
 * - new not on the breach list
 * - new ≠ current (server also enforces; we catch early for clarity)
 * - confirm == new
 */
@HiltViewModel
class PasswordChangeViewModel
    @Inject
    constructor(
        private val account: AccountRepository,
    ) : ViewModel() {
        sealed interface FormState {
            data object Loading : FormState

            data object Ready : FormState
        }

        enum class FieldKey { Current, New, Confirm }

        /** Error-tone banner pinned to the top of the form after a rejected submit. */
        data class FormBannerContent(
            val title: String,
            val message: String,
        )

        private val _formState = MutableStateFlow<FormState>(FormState.Loading)
        val formState: StateFlow<FormState> = _formState.asStateFlow()

        private val _hasPassword = MutableStateFlow(true)
        val hasPassword: StateFlow<Boolean> = _hasPassword.asStateFlow()

        private val _isSaving = MutableStateFlow(false)
        val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

        private val _fields =
            MutableStateFlow(
                mapOf(
                    FieldKey.Current to FormFieldState(id = "current"),
                    FieldKey.New to FormFieldState(id = "new"),
                    FieldKey.Confirm to FormFieldState(id = "confirm"),
                ),
            )
        val fields: StateFlow<Map<FieldKey, FormFieldState>> = _fields.asStateFlow()

        private val _formError = MutableStateFlow<FormBannerContent?>(null)
        val formError: StateFlow<FormBannerContent?> = _formError.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _shouldDismiss = MutableStateFlow(false)
        val shouldDismiss: StateFlow<Boolean> = _shouldDismiss.asStateFlow()

        /**
         * Identity reminder rendered in the context band. Sample data — the
         * auth-methods endpoint carries neither the email nor a last-changed
         * timestamp, so these are seeded defaults until the backend exposes them.
         */
        val accountEmail: String = "maria@pantopus.app"
        val lastChangedLabel: String = "84 days ago"

        val requiresCurrent: Boolean get() = _hasPassword.value

        private fun fieldValue(key: FieldKey): String = _fields.value[key]?.value.orEmpty()

        /** True when the new password matches an entry on the breach list. */
        val isNewPasswordBreached: Boolean
            get() {
                val candidate = fieldValue(FieldKey.New)
                return candidate.isNotEmpty() && COMMON_PASSWORDS.contains(candidate.lowercase())
            }

        /** Live strength for the new password, feeding `StrengthMeter`. */
        val strength: PasswordStrength
            get() = PasswordStrength.evaluate(fieldValue(FieldKey.New), breached = isNewPasswordBreached)

        val isCurrentValid: Boolean
            get() = requiresCurrent && fieldValue(FieldKey.Current).isNotEmpty() && _fields.value[FieldKey.Current]?.error == null

        val isNewValid: Boolean
            get() {
                val newValue = fieldValue(FieldKey.New)
                return newValue.isNotEmpty() &&
                    newValue.length >= MIN_LENGTH &&
                    !isNewPasswordBreached &&
                    _fields.value[FieldKey.New]?.error == null
            }

        val isConfirmValid: Boolean
            get() {
                val confirmValue = fieldValue(FieldKey.Confirm)
                return confirmValue.isNotEmpty() &&
                    confirmValue == fieldValue(FieldKey.New) &&
                    _fields.value[FieldKey.Confirm]?.error == null
            }

        val isDirty: Boolean
            get() =
                fieldValue(FieldKey.New).isNotEmpty() ||
                    fieldValue(FieldKey.Confirm).isNotEmpty() ||
                    (requiresCurrent && fieldValue(FieldKey.Current).isNotEmpty())

        val isValid: Boolean
            get() {
                val newValue = fieldValue(FieldKey.New)
                val currentValue = fieldValue(FieldKey.Current)
                val currentOk = !requiresCurrent || (currentValue.isNotEmpty() && currentValue != newValue)
                return newValue.length >= MIN_LENGTH &&
                    !isNewPasswordBreached &&
                    fieldValue(FieldKey.Confirm) == newValue &&
                    currentOk
            }

        fun load() {
            _formState.value = FormState.Loading
            viewModelScope.launch {
                when (val result = account.authMethods()) {
                    is NetworkResult.Success -> _hasPassword.value = result.data.hasPassword ?: true
                    is NetworkResult.Failure -> _hasPassword.value = true
                }
                _formState.value = FormState.Ready
            }
        }

        fun update(
            key: FieldKey,
            value: String,
        ) {
            val previous = _fields.value[key] ?: FormFieldState(id = key.name.lowercase())
            val next = _fields.value.toMutableMap()
            next[key] = previous.copy(value = value, touched = true, error = inlineError(key, value))
            // Re-run the confirm cross-field check when the new password changes.
            if (key == FieldKey.New) {
                next[FieldKey.Confirm]?.let { confirm ->
                    if (confirm.touched) {
                        next[FieldKey.Confirm] = confirm.copy(error = confirmError(confirm.value, value))
                    }
                }
            }
            _fields.value = next
        }

        fun save() {
            if (!isValid || _isSaving.value) return
            _formError.value = null
            val currentValue = fieldValue(FieldKey.Current)
            val newValue = fieldValue(FieldKey.New)
            _isSaving.value = true
            viewModelScope.launch {
                val body =
                    PasswordUpdateBody(
                        currentPassword = if (requiresCurrent) currentValue else null,
                        newPassword = newValue,
                    )
                when (val result = account.updatePassword(body)) {
                    is NetworkResult.Success -> {
                        _toast.value = "Password updated"
                        _shouldDismiss.value = true
                    }
                    is NetworkResult.Failure -> mapServerError(result.error)
                }
                _isSaving.value = false
            }
        }

        /**
         * Stub for the "Email me a reset link instead" shortcut on the current
         * field. A real implementation would POST to the password-reset route;
         * for now we acknowledge the request so the affordance is wired.
         */
        fun requestResetLink() {
            _toast.value = "We'll email you a reset link."
        }

        fun acknowledgeDismiss() {
            _shouldDismiss.value = false
        }

        fun dismissToast() {
            _toast.value = null
        }

        private fun inlineError(
            key: FieldKey,
            value: String,
        ): String? =
            when (key) {
                FieldKey.Current ->
                    if (requiresCurrent && value.isEmpty()) "Required" else null
                FieldKey.New -> {
                    val current = fieldValue(FieldKey.Current)
                    when {
                        value.isEmpty() -> null
                        COMMON_PASSWORDS.contains(value.lowercase()) ->
                            "Too common — appeared in 2.3M public records."
                        value.length < MIN_LENGTH -> "At least $MIN_LENGTH characters"
                        requiresCurrent && current.isNotEmpty() && value == current ->
                            "Choose something different from your current password"
                        else -> null
                    }
                }
                FieldKey.Confirm -> confirmError(value, fieldValue(FieldKey.New))
            }

        private fun confirmError(
            value: String,
            newValue: String,
        ): String? =
            when {
                value.isEmpty() -> null
                value != newValue -> "Doesn't match the new password above."
                else -> null
            }

        private fun markError(
            key: FieldKey,
            message: String,
        ) {
            val map = _fields.value.toMutableMap()
            val previous = map[key] ?: FormFieldState(id = key.name.lowercase())
            map[key] = previous.copy(error = message)
            _fields.value = map
        }

        private fun applyServerRejection(currentError: String) {
            markError(FieldKey.Current, currentError)
            _formError.value = STANDARD_BANNER
        }

        private fun mapServerError(error: NetworkError) {
            when (error) {
                is NetworkError.Unauthorized ->
                    applyServerRejection("That doesn't match the password on file.")
                is NetworkError.ClientError ->
                    if (error.code == 429) {
                        _formError.value =
                            FormBannerContent(
                                title = "Too many attempts",
                                message = "Wait a moment before trying again.",
                            )
                    } else {
                        markError(FieldKey.New, error.body ?: "Couldn't update your password")
                        _formError.value = STANDARD_BANNER
                    }
                is NetworkError.NotFound -> {
                    markError(FieldKey.New, "We couldn't find your account. Try signing back in.")
                    _formError.value = STANDARD_BANNER
                }
                else -> {
                    markError(FieldKey.New, "Couldn't update your password. Try again.")
                    _formError.value = STANDARD_BANNER
                }
            }
        }

        companion object {
            const val MIN_LENGTH: Int = 12

            /**
             * Sample list of breached/common passwords. A real integration would
             * check Have I Been Pwned's k-anonymity range API; that is out of
             * scope, so we ship a hardcoded list good enough to demo the breach
             * state. Mirrors the iOS list.
             */
            val COMMON_PASSWORDS: Set<String> =
                setOf(
                    "password",
                    "password1",
                    "password123",
                    "12345678",
                    "123456789",
                    "qwerty123",
                    "qwertyuiop",
                    "letmein123",
                    "iloveyou1",
                    "admin123",
                    "welcome123",
                    "abc12345",
                )

            private val STANDARD_BANNER =
                FormBannerContent(
                    title = "Couldn't update password",
                    // Sample copy mirroring the design frame. The "two fields" /
                    // "three attempts" counts are static until the backend returns a
                    // real rate-limit signal.
                    message = "Fix the two highlighted fields and try again. Three more attempts before a 15-minute cooldown.",
                )
        }
    }
