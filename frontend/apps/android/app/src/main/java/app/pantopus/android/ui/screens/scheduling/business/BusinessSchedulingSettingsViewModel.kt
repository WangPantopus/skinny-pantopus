@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.business

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.UpdateBookingPageRequest
import app.pantopus.android.data.api.models.scheduling.UpdateNotificationPrefsRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject

/**
 * G5 Business Scheduling Settings (Stream A13) — the Business-pillar booking
 * settings index: Confirmation · Scheduling defaults · Policy · Notifications ·
 * Payments. Loads the business booking page (+ payments status, event types for
 * the representative defaults, notification preferences, and team access for
 * admin gating). Mirrors iOS `BusinessSchedulingSettingsViewModel` +
 * `bizsettings-frames.jsx` (saved / loading / auto-confirm / payments-required /
 * gated).
 *
 * Honest backend mapping: timezone → real (`PUT /booking-page`); notifications →
 * real (`PUT /notification-preferences`, business-namespaced keys); payments →
 * real status (`GET /payments/status`) + Connect deep-link. Confirmation /
 * min-notice / horizon / buffers are per-SERVICE on the backend (no owner-level
 * store) — shown as representative defaults from the owner's event types and
 * routed to the event-type list to change.
 */
@HiltViewModel
class BusinessSchedulingSettingsViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val businessTeam: BusinessTeamRepository,
        private val auth: AuthRepository,
        private val errors: SchedulingErrorDecoder,
        private val flags: SchedulingFeatureFlags,
    ) : ViewModel() {
        data class Content(
            val timezone: String,
            val confirmationApprove: Boolean,
            val minNoticeValue: String,
            val horizonValue: String,
            val buffersValue: String,
            val cancellationValue: String,
            val notifyOwner: Boolean,
            val notifyAssigned: Boolean,
            val paymentsConnected: Boolean,
            val payoutSub: String,
            val paymentsRequired: Boolean,
            val showPayments: Boolean,
            val gated: Boolean,
            val savingTimezone: Boolean,
        )

        sealed interface UiState {
            data object Loading : UiState

            data class Loaded(val content: Content) : UiState

            data class Error(val message: String) : UiState
        }

        private val _state = MutableStateFlow<UiState>(UiState.Loading)
        val state: StateFlow<UiState> = _state.asStateFlow()

        private val _savedToast = MutableStateFlow(false)
        val savedToast: StateFlow<Boolean> = _savedToast.asStateFlow()

        private var prefs: Map<String, Any?> = emptyMap()
        private var eventTypes: List<EventTypeDto> = emptyList()
        private var cancellationPolicy: String? = null

        fun load() {
            _state.value = UiState.Loading
            val owner = businessOwner()
            if (owner == null) {
                _state.value = UiState.Error("Switch to a business profile to manage booking settings.")
                return
            }
            viewModelScope.launch {
                when (val pageResult = repo.getBookingPage(owner)) {
                    is NetworkResult.Failure ->
                        _state.value = UiState.Error(errors.decode(pageResult.error).displayMessage("Couldn't load booking settings."))
                    is NetworkResult.Success -> {
                        val page = pageResult.data.page
                        cancellationPolicy = page.cancellationPolicy
                        val paymentsD = async { repo.getPaymentsStatus(owner).dataOrNull() }
                        val typesD = async { repo.getEventTypes(owner).dataOrNull()?.eventTypes.orEmpty() }
                        val prefsD = async { repo.getNotificationPreferences().dataOrNull()?.prefs.orEmpty() }
                        val accessD = async { businessTeam.access(owner.businessUserId).dataOrNull() }

                        val payments = paymentsD.await()
                        eventTypes = typesD.await()
                        prefs = prefsD.await()
                        val access = accessD.await()

                        val gated = access != null && !access.isOwner && !access.permissions.contains(PERM_TEAM_MANAGE)
                        val connected = payments?.connected == true
                        val hasPaid = eventTypes.any { (it.priceCents ?: 0) > 0 }
                        _state.value =
                            UiState.Loaded(
                                Content(
                                    timezone = page.timezone ?: ZoneId.systemDefault().id,
                                    confirmationApprove = majorityRequiresApproval(),
                                    minNoticeValue = minNoticeValue(),
                                    horizonValue = horizonValue(),
                                    buffersValue = buffersValue(),
                                    cancellationValue = cancellationValue(),
                                    notifyOwner = boolPref(KEY_NOTIFY_OWNER, true),
                                    notifyAssigned = boolPref(KEY_NOTIFY_ASSIGNED, false),
                                    paymentsConnected = connected,
                                    payoutSub = if (connected) "Payout connected" else "Not connected",
                                    paymentsRequired = hasPaid && !connected,
                                    showPayments = flags.paidSchedulingEnabled || connected || hasPaid,
                                    gated = gated,
                                    savingTimezone = false,
                                ),
                            )
                    }
                }
            }
        }

        fun refresh() = load()

        // ─── Timezone ───────────────────────────────────────────────────────────

        fun saveTimezone(id: String) {
            val content = (_state.value as? UiState.Loaded)?.content ?: return
            if (id == content.timezone) return
            val owner = businessOwner() ?: return
            _state.value = UiState.Loaded(content.copy(savingTimezone = true))
            viewModelScope.launch {
                when (val result = repo.updateBookingPage(owner, UpdateBookingPageRequest(timezone = id))) {
                    is NetworkResult.Success -> {
                        val tz = result.data.page.timezone ?: id
                        updateContent { it.copy(timezone = tz, savingTimezone = false) }
                        flashSaved()
                    }
                    is NetworkResult.Failure -> updateContent { it.copy(savingTimezone = false) }
                }
            }
        }

        // ─── Confirmation (local representative default) ───────────────────────

        /**
         * The owner-level confirmation default is per-SERVICE on the backend, so
         * this flips the representative value locally; the row routes the owner to
         * the event-type list to actually change it.
         */
        fun setConfirmation(approve: Boolean) = updateContent { it.copy(confirmationApprove = approve) }

        // ─── Notifications ────────────────────────────────────────────────────

        fun setNotifyOwner(on: Boolean) {
            updateContent { it.copy(notifyOwner = on) }
            persistPrefs()
        }

        fun setNotifyAssigned(on: Boolean) {
            updateContent { it.copy(notifyAssigned = on) }
            persistPrefs()
        }

        private fun persistPrefs() {
            val content = (_state.value as? UiState.Loaded)?.content ?: return
            val merged = prefs.toMutableMap()
            merged[KEY_NOTIFY_OWNER] = content.notifyOwner
            merged[KEY_NOTIFY_ASSIGNED] = content.notifyAssigned
            viewModelScope.launch {
                when (val result = repo.updateNotificationPreferences(UpdateNotificationPrefsRequest(prefs = merged))) {
                    is NetworkResult.Success -> {
                        prefs = result.data.prefs
                        updateContent {
                            it.copy(
                                notifyOwner = boolPref(KEY_NOTIFY_OWNER, true),
                                notifyAssigned = boolPref(KEY_NOTIFY_ASSIGNED, false),
                            )
                        }
                        flashSaved()
                    }
                    is NetworkResult.Failure ->
                        updateContent {
                            it.copy(
                                notifyOwner = boolPref(KEY_NOTIFY_OWNER, true),
                                notifyAssigned = boolPref(KEY_NOTIFY_ASSIGNED, false),
                            )
                        }
                }
            }
        }

        fun toastShown() {
            _savedToast.value = false
        }

        // ─── Navigation routes (consumed by the screen) ────────────────────────

        fun schedulingDefaultsRoute(): String {
            val owner = businessOwner()
            return app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
                .eventTypeList(owner?.routeKind, owner?.ownerRouteId)
        }

        fun cancellationPolicyRoute(): String =
            app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes.CANCELLATION_REFUND_POLICY

        fun paymentsRoute(): String = app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes.PAYMENTS_SETUP

        // ─── Helpers ────────────────────────────────────────────────────────────

        private fun businessOwner(): SchedulingOwner.Business? =
            (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id?.let { SchedulingOwner.Business(it) }

        private inline fun updateContent(transform: (Content) -> Content) {
            val current = (_state.value as? UiState.Loaded)?.content ?: return
            _state.value = UiState.Loaded(transform(current))
        }

        private fun flashSaved() {
            _savedToast.value = true
        }

        private fun boolPref(
            key: String,
            default: Boolean,
        ): Boolean = (prefs[key] as? Boolean) ?: default

        private fun majorityRequiresApproval(): Boolean {
            val flagsList = eventTypes.map { it.requiresApproval }
            if (flagsList.isEmpty()) return true
            return flagsList.count { it } * 2 >= flagsList.size
        }

        private fun minNoticeValue(): String =
            mostCommon(eventTypes.mapNotNull { it.minNoticeMin })?.let { durationLabel(it) } ?: "Set per service"

        private fun horizonValue(): String {
            val days = mostCommon(eventTypes.mapNotNull { it.maxHorizonDays }) ?: return "Set per service"
            return "$days days out"
        }

        private fun buffersValue(): String {
            val before = mostCommon(eventTypes.mapNotNull { it.bufferBeforeMin }) ?: 0
            val after = mostCommon(eventTypes.mapNotNull { it.bufferAfterMin }) ?: 0
            if (before == 0 && after == 0) return if (eventTypes.isEmpty()) "Set per service" else "None"
            return "$before min before · $after after"
        }

        private fun cancellationValue(): String {
            cancellationPolicy?.takeIf { it.isNotBlank() }?.let { return it }
            val window = mostCommon(eventTypes.mapNotNull { it.cancellationWindowMin })
            if (window != null && window > 0) return "Flexible · ${durationLabel(window)}"
            return if (eventTypes.isEmpty()) "Set per service" else "Flexible"
        }

        private fun mostCommon(values: List<Int>): Int? {
            if (values.isEmpty()) return null
            return values.groupingBy { it }.eachCount().entries
                .maxWithOrNull(compareBy({ it.value }, { it.key }))?.key
        }

        private fun durationLabel(minutes: Int): String =
            when {
                minutes % 1440 == 0 -> "${minutes / 1440} day${if (minutes / 1440 == 1) "" else "s"}"
                minutes % 60 == 0 -> "${minutes / 60} hour${if (minutes / 60 == 1) "" else "s"}"
                else -> "$minutes min"
            }

        private fun <T> NetworkResult<T>.dataOrNull(): T? = (this as? NetworkResult.Success)?.data

        private fun SchedulingError.displayMessage(fallback: String): String =
            when (this) {
                is SchedulingError.Generic -> message
                else -> fallback
            }

        private companion object {
            const val PERM_TEAM_MANAGE = "team.manage"
            const val KEY_NOTIFY_OWNER = "business_notify_owner"
            const val KEY_NOTIFY_ASSIGNED = "business_notify_assigned_member"
        }
    }
