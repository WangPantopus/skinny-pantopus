@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.businesses.team

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessSeatDto
import app.pantopus.android.data.api.models.businesses.BusinessSeatInviteRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Discrete steps in the wizard. Numeric order = navigation order. */
enum class InviteTeammateStep(
    val number: Int,
    val title: String,
    val subcopy: String,
) {
    Role(
        number = 1,
        title = "Pick a role",
        subcopy = "Roles set what a teammate can see and do. You can change it later.",
    ),
    Identify(
        number = 2,
        title = "Who are you inviting?",
        subcopy = "We'll create a seat and send a link they can use to join your business.",
    ),
    Review(
        number = 3,
        title = "Send invite",
        subcopy = "Confirm the details below. You can cancel the invite later from the Pending section.",
    ),
    ;

    companion object {
        val total: Int = entries.size
    }
}

/** Form snapshot held by the VM. */
data class InviteTeammateForm(
    val role: BusinessRole = BusinessRole.Viewer,
    val displayName: String = "",
    val email: String = "",
    val note: String = "",
)

/** Combined state the screen observes. */
data class InviteTeammateState(
    val currentStep: InviteTeammateStep = InviteTeammateStep.Role,
    val form: InviteTeammateForm = InviteTeammateForm(),
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
)

/** Outbound events the host screen reacts to. */
sealed interface InviteTeammateEvent {
    data class Submitted(val seat: BusinessSeatDto) : InviteTeammateEvent

    data object Dismiss : InviteTeammateEvent
}

/**
 * Drives the Invite Teammate wizard. Conforms to [WizardModel] so the
 * shared `WizardShell` handles chrome / progress / close-confirm. Cloned
 * from `InviteMemberWizardViewModel`.
 */
class InviteTeammateWizardViewModel(
    private val businessId: String,
    private val repo: BusinessTeamRepository,
    private val viewModelScopeOverride: CoroutineScope? = null,
) : ViewModel(), WizardModel {
    private val scope get() = viewModelScopeOverride ?: viewModelScope

    private val _state = MutableStateFlow(InviteTeammateState())
    val state: StateFlow<InviteTeammateState> = _state.asStateFlow()

    private val _pendingEvent = MutableStateFlow<InviteTeammateEvent?>(null)
    val pendingEvent: StateFlow<InviteTeammateEvent?> = _pendingEvent.asStateFlow()

    fun acknowledgeEvent() {
        _pendingEvent.value = null
    }

    // ─── Form mutations ─────────────────────────────────────────

    fun setRole(role: BusinessRole) {
        _state.update { it.copy(form = it.form.copy(role = role), errorMessage = null) }
    }

    fun setDisplayName(value: String) {
        _state.update { it.copy(form = it.form.copy(displayName = value), errorMessage = null) }
    }

    fun setEmail(value: String) {
        _state.update { it.copy(form = it.form.copy(email = value), errorMessage = null) }
    }

    fun setNote(value: String) {
        _state.update { it.copy(form = it.form.copy(note = value), errorMessage = null) }
    }

    // ─── WizardModel ─────────────────────────────────────────────

    override val chrome: WizardChrome
        get() {
            val current = _state.value.currentStep
            return WizardChrome(
                title = "Invite teammate",
                progressLabel =
                    WizardProgressLabel.StepOf(
                        current = current.number,
                        total = InviteTeammateStep.total,
                    ),
                progressFraction = current.number.toFloat() / InviteTeammateStep.total.toFloat(),
                leading = if (current == InviteTeammateStep.Role) WizardLeadingControl.Close else WizardLeadingControl.Back,
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
                InviteTeammateStep.Review -> "Send invite"
                else -> "Next"
            }

    private val primaryEnabled: Boolean
        get() =
            when (_state.value.currentStep) {
                InviteTeammateStep.Role -> true
                InviteTeammateStep.Identify, InviteTeammateStep.Review -> isFormValid
            }

    private val isFormValid: Boolean
        get() = _state.value.form.displayName.isNotBlank() && isValidEmail(_state.value.form.email)

    private val isDirty: Boolean
        get() = _state.value.form != InviteTeammateForm()

    override fun onLeading() {
        _state.update { it.copy(errorMessage = null) }
        val current = _state.value.currentStep
        if (current == InviteTeammateStep.Role) {
            _pendingEvent.value = InviteTeammateEvent.Dismiss
            return
        }
        val previous = InviteTeammateStep.entries.firstOrNull { it.number == current.number - 1 } ?: return
        _state.update { it.copy(currentStep = previous) }
    }

    override fun onDiscard() {
        _pendingEvent.value = InviteTeammateEvent.Dismiss
    }

    override fun onPrimary() {
        _state.update { it.copy(errorMessage = null) }
        val current = _state.value.currentStep
        if (current != InviteTeammateStep.Review) {
            val next = InviteTeammateStep.entries.firstOrNull { it.number == current.number + 1 } ?: return
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
            val request =
                BusinessSeatInviteRequest(
                    displayName = form.displayName.trim(),
                    roleBase = form.role.wire,
                    inviteEmail = form.email.trim(),
                    notes = form.note.trim().ifEmpty { null },
                )
            when (val result = repo.inviteSeat(businessId, request)) {
                is NetworkResult.Success -> {
                    _state.update { it.copy(isSubmitting = false) }
                    _pendingEvent.value = InviteTeammateEvent.Submitted(result.data.seat)
                }
                is NetworkResult.Failure -> {
                    _state.update { it.copy(isSubmitting = false, errorMessage = result.error.message) }
                }
            }
        }
    }

    companion object {
        private const val EMAIL_MAX_LENGTH = 254

        /** Loose email validation — backend re-validates. */
        fun isValidEmail(raw: String): Boolean {
            val trimmed = raw.trim()
            if (trimmed.isEmpty() || trimmed.length > EMAIL_MAX_LENGTH) return false
            val parts = trimmed.split("@")
            if (parts.size != 2) return false
            return parts[0].isNotEmpty() && parts[1].contains(".")
        }
    }
}
