@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.members

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.InvitationDto
import app.pantopus.android.data.api.models.homes.InviteMemberRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Discrete steps in the wizard. Numeric order = navigation order. */
enum class InviteMemberStep(
    val number: Int,
    val title: String,
    val subcopy: String,
) {
    Role(
        number = 1,
        title = "Pick a role",
        subcopy = "Members get full access. Guests are short-term — sitters, visitors, contractors.",
    ),
    Identify(
        number = 2,
        title = "Who are you inviting?",
        subcopy = "We'll send them a link to verify their address and join the household.",
    ),
    Review(
        number = 3,
        title = "Send invite",
        subcopy = "Confirm the details below. You can resend or cancel later from the Pending tab.",
    ),
    ;

    companion object {
        val total: Int = entries.size
    }
}

/** Form snapshot held by the VM. */
data class InviteMemberForm(
    val role: MemberRole = MemberRole.Member,
    val email: String = "",
    val message: String = "",
)

/** Combined state the screen observes. */
data class InviteMemberState(
    val currentStep: InviteMemberStep = InviteMemberStep.Role,
    val form: InviteMemberForm = InviteMemberForm(),
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
)

/** Outbound events the host screen reacts to. */
sealed interface InviteMemberEvent {
    data class Submitted(
        val invitation: InvitationDto,
    ) : InviteMemberEvent

    data object Dismiss : InviteMemberEvent
}

/**
 * Drives the Invite Member wizard. Conforms to [WizardModel] so the
 * shared `WizardShell` handles chrome / progress / close-confirm.
 *
 * Instantiated by the host screen with the home id. Not a Hilt VM —
 * the screen owns the lifecycle.
 */
class InviteMemberWizardViewModel(
    private val homeId: String,
    private val repo: HomeMembersRepository,
    private val viewModelScopeOverride: kotlinx.coroutines.CoroutineScope? = null,
) : ViewModel(), WizardModel {
    private val scope get() = viewModelScopeOverride ?: viewModelScope

    private val _state = MutableStateFlow(InviteMemberState())
    val state: StateFlow<InviteMemberState> = _state.asStateFlow()

    private val _pendingEvent = MutableStateFlow<InviteMemberEvent?>(null)
    val pendingEvent: StateFlow<InviteMemberEvent?> = _pendingEvent.asStateFlow()

    fun acknowledgeEvent() {
        _pendingEvent.value = null
    }

    // ─── Form mutations ─────────────────────────────────────────

    fun setRole(role: MemberRole) {
        _state.update { it.copy(form = it.form.copy(role = role), errorMessage = null) }
    }

    fun setEmail(value: String) {
        _state.update { it.copy(form = it.form.copy(email = value), errorMessage = null) }
    }

    fun setMessage(value: String) {
        _state.update { it.copy(form = it.form.copy(message = value), errorMessage = null) }
    }

    // ─── WizardModel ─────────────────────────────────────────────

    override val chrome: WizardChrome
        get() {
            val current = _state.value.currentStep
            return WizardChrome(
                title = "Invite member",
                progressLabel =
                    WizardProgressLabel.StepOf(
                        current = current.number,
                        total = InviteMemberStep.total,
                    ),
                progressFraction = current.number.toFloat() / InviteMemberStep.total.toFloat(),
                leading = if (current == InviteMemberStep.Role) WizardLeadingControl.Close else WizardLeadingControl.Back,
                primaryCtaLabel = primaryLabel,
                primaryCtaEnabled = primaryEnabled,
                isSubmitting = _state.value.isSubmitting,
                dirty = isDirty,
                showsProgressBar = true,
            )
        }

    private val primaryLabel: String
        get() =
            when (_state.value.currentStep) {
                InviteMemberStep.Review -> "Send invite"
                else -> "Next"
            }

    private val primaryEnabled: Boolean
        get() =
            when (_state.value.currentStep) {
                InviteMemberStep.Role -> true
                InviteMemberStep.Identify -> isValidEmail(_state.value.form.email)
                InviteMemberStep.Review -> isValidEmail(_state.value.form.email)
            }

    private val isDirty: Boolean
        get() = _state.value.form != InviteMemberForm()

    override fun onLeading() {
        _state.update { it.copy(errorMessage = null) }
        val current = _state.value.currentStep
        if (current == InviteMemberStep.Role) {
            _pendingEvent.value = InviteMemberEvent.Dismiss
            return
        }
        val previous = InviteMemberStep.entries.firstOrNull { it.number == current.number - 1 } ?: return
        _state.update { it.copy(currentStep = previous) }
    }

    override fun onDiscard() {
        _pendingEvent.value = InviteMemberEvent.Dismiss
    }

    override fun onPrimary() {
        _state.update { it.copy(errorMessage = null) }
        val current = _state.value.currentStep
        if (current != InviteMemberStep.Review) {
            val next = InviteMemberStep.entries.firstOrNull { it.number == current.number + 1 } ?: return
            _state.update { it.copy(currentStep = next) }
            return
        }
        submit()
    }

    private fun submit() {
        if (_state.value.isSubmitting) return
        _state.update { it.copy(isSubmitting = true) }
        scope.launch {
            val form = _state.value.form
            val trimmedEmail = form.email.trim()
            val trimmedMessage = form.message.trim().ifEmpty { null }
            val request =
                InviteMemberRequest(
                    email = trimmedEmail,
                    userId = null,
                    relationship = form.role.wire,
                    message = trimmedMessage,
                )
            when (val result = repo.invite(homeId, request)) {
                is NetworkResult.Success -> {
                    _state.update { it.copy(isSubmitting = false) }
                    _pendingEvent.value = InviteMemberEvent.Submitted(result.data.invitation)
                }
                is NetworkResult.Failure -> {
                    _state.update {
                        it.copy(
                            isSubmitting = false,
                            errorMessage = result.error.message,
                        )
                    }
                }
            }
        }
    }

    companion object {
        private const val EMAIL_MAX_LENGTH = 254

        /**
         * Loose email validation — backend re-validates. Just enough to
         * gate the Next CTA on the Identify step.
         */
        fun isValidEmail(raw: String): Boolean {
            val trimmed = raw.trim()
            if (trimmed.isEmpty() || trimmed.length > EMAIL_MAX_LENGTH) return false
            val parts = trimmed.split("@")
            if (parts.size != 2) return false
            val local = parts[0]
            val domain = parts[1]
            return local.isNotEmpty() && domain.contains(".")
        }
    }
}
