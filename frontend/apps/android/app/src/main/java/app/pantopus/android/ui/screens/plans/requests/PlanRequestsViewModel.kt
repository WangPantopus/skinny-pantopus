package app.pantopus.android.ui.screens.plans.requests

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanRequestViewDto
import app.pantopus.android.data.api.models.plans.UpdatePlanBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.plans.PlanAutoRule
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.data.plans.isAtHome
import app.pantopus.android.data.plans.planCode
import app.pantopus.android.data.plans.planMessage
import app.pantopus.android.ui.screens.plans.PlansRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The host's requests page (board H10). */
data class PlanRequestsUi(
    val loading: Boolean = true,
    val failed: String? = null,
    val plan: PlanDto? = null,
    val pending: List<PlanRequestViewDto> = emptyList(),
    val waitlisted: List<PlanRequestViewDto> = emptyList(),
    /** Requests being answered right now. */
    val working: Set<String> = emptySet(),
    /** Asks the host to confirm sharing their address before the first accept at home. */
    val confirmAccept: PlanRequestViewDto? = null,
    val notice: String? = null,
)

/**
 * Requests for a plan the person hosts (board H10): accept or decline each, and the "Let in people you've hosted"
 * rule. At home, the first accept asks "Accepting shares your address with them" and sends the host's yes.
 */
@HiltViewModel
class PlanRequestsViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repository: PlansRepository,
    ) : ViewModel() {
        private val planId: String = savedStateHandle.get<String>(PlansRoutes.PLAN_ID_KEY).orEmpty()
        private val _ui = MutableStateFlow(PlanRequestsUi(plan = repository.card(planId)))
        val ui: StateFlow<PlanRequestsUi> = _ui.asStateFlow()
        private var sharedAddressOk = false

        fun load() {
            viewModelScope.launch {
                val planRead = async { repository.plan(planId) }
                val requestsRead = async { repository.requests(planId) }
                val plan = planRead.await()
                val requests = requestsRead.await()
                _ui.update { current ->
                    current.copy(
                        loading = false,
                        plan = (plan as? NetworkResult.Success)?.data ?: current.plan,
                        pending = (requests as? NetworkResult.Success)?.data?.pending ?: current.pending,
                        waitlisted = (requests as? NetworkResult.Success)?.data?.waitlisted ?: current.waitlisted,
                        failed =
                            (requests as? NetworkResult.Failure)?.error?.planMessage?.takeIf {
                                current.pending.isEmpty() && current.waitlisted.isEmpty()
                            },
                    )
                }
            }
        }

        fun accept(request: PlanRequestViewDto) {
            val plan = _ui.value.plan
            if (plan?.isAtHome == true && !sharedAddressOk) {
                _ui.update { it.copy(confirmAccept = request) }
                return
            }
            answer(request.id, accept = true)
        }

        /** The host said yes to sharing their address (H10's sentence); accept goes ahead. */
        fun confirmSharingAddress() {
            val request = _ui.value.confirmAccept ?: return
            sharedAddressOk = true
            _ui.update { it.copy(confirmAccept = null) }
            answer(request.id, accept = true)
        }

        fun dismissConfirm() {
            _ui.update { it.copy(confirmAccept = null) }
        }

        fun decline(request: PlanRequestViewDto) = answer(request.id, accept = false)

        private fun answer(
            requestId: String,
            accept: Boolean,
        ) {
            if (requestId in _ui.value.working) return
            _ui.update { it.copy(working = it.working + requestId) }
            viewModelScope.launch {
                val result =
                    if (accept) {
                        repository.accept(planId, requestId, confirmSharesAddress = sharedAddressOk)
                    } else {
                        repository.decline(planId, requestId)
                    }
                _ui.update { current ->
                    when (result) {
                        is NetworkResult.Success ->
                            current.copy(
                                working = current.working - requestId,
                                pending = current.pending.filterNot { it.id == requestId },
                                notice = if (accept) "Accepted. They're in." else "Declined. They won't see who said no.",
                            )
                        is NetworkResult.Failure ->
                            if (result.error.planCode == "confirm_shares_address") {
                                // At home the first yes shows H10's sentence first (409 from the server).
                                current.copy(
                                    working = current.working - requestId,
                                    confirmAccept = current.pending.firstOrNull { it.id == requestId },
                                )
                            } else {
                                current.copy(
                                    working = current.working - requestId,
                                    notice =
                                        when (result.error.planCode) {
                                            "full" -> "Their party doesn't fit the spots left. Make room first, or decline."
                                            "not_waiting" -> "They're no longer waiting."
                                            else -> result.error.planMessage
                                        },
                                )
                            }
                    }
                }
                load()
            }
        }

        /** "Let in people you've hosted": adds or removes the rule (never offered for playdates). */
        fun setHostedBefore(enabled: Boolean) {
            val plan = _ui.value.plan ?: return
            val rules = plan.autoRules.orEmpty().toMutableSet()
            if (enabled) rules += PlanAutoRule.HOSTED_BEFORE else rules -= PlanAutoRule.HOSTED_BEFORE
            _ui.update { it.copy(plan = plan.copy(autoRules = rules.toList())) }
            viewModelScope.launch {
                when (val result = repository.update(planId, UpdatePlanBody(autoRules = rules.toList()))) {
                    is NetworkResult.Success -> _ui.update { it.copy(plan = result.data) }
                    is NetworkResult.Failure -> _ui.update { it.copy(plan = plan, notice = result.error.planMessage) }
                }
            }
        }

        fun noticeShown() {
            _ui.update { it.copy(notice = null) }
        }
    }
