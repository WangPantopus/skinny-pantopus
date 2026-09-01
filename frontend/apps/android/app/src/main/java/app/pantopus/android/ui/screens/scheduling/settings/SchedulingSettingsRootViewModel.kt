@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.settings

import androidx.compose.runtime.Immutable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject

private const val SAVED_TOAST_MS = 2000L
private const val SAVED_CHIP_MS = 1800L
private const val MIN_PER_DAY = 1440
private const val MIN_PER_HOUR = 60

@Immutable
sealed interface SchedulingSettingsUiState {
    data object Loading : SchedulingSettingsUiState

    data class Loaded(val data: SettingsData) : SchedulingSettingsUiState

    data class Error(val message: String) : SchedulingSettingsUiState
}

@Immutable
data class SettingsData(
    val slug: String?,
    val isFresh: Boolean,
    val isBusiness: Boolean,
    val paidEnabled: Boolean,
    val remindersValue: String?,
    val timezoneValue: String,
    val paymentsConnected: Boolean,
    val monoFooter: String,
    val pillar: SchedulingPillar = SchedulingPillar.Personal,
    /** Key of the row currently being saved (null = none in-flight). */
    val savingRow: String? = null,
    /** Key of the row that just finished saving (shows SavedChip briefly). */
    val justSavedRow: String? = null,
)

/**
 * A3 Scheduling Settings Root ("Booking settings").
 *
 * Owner comes from the route (see `SchedulingRoutes.settings`), mirroring iOS's
 * `SchedulingSettingsModel(owner:)`. It must not be hardcoded: this screen's danger zone
 * resets the booking link, so a Personal default would destroy the personal page whenever
 * the hub was scoped to a Home or Business.
 */
@HiltViewModel
class SchedulingSettingsRootViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        private val featureFlags: SchedulingFeatureFlags,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val owner: SchedulingOwner =
            SchedulingOwner.fromRoute(
                savedStateHandle[SchedulingRoutes.ARG_OWNER_KIND],
                savedStateHandle[SchedulingRoutes.ARG_OWNER_ID],
            )

        private val _state = MutableStateFlow<SchedulingSettingsUiState>(SchedulingSettingsUiState.Loading)
        val state: StateFlow<SchedulingSettingsUiState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var fetchJob: Job? = null

        fun load() {
            _state.value = SchedulingSettingsUiState.Loading
            fetchJob?.cancel()
            fetchJob =
                viewModelScope.launch {
                    val pageResult = repo.getBookingPage(owner)
                    val page =
                        when (pageResult) {
                            is NetworkResult.Success -> pageResult.data.page
                            is NetworkResult.Failure -> {
                                _state.value = SchedulingSettingsUiState.Error(errors.decode(pageResult.error).settingsMessage())
                                return@launch
                            }
                        }
                    // Bare async {} children of this launch — cancelling the fetch
                    // (or a failure in either) cancels both, instead of orphaning
                    // scope-rooted asyncs that outlive the launch.
                    val paymentsDef = async { repo.getPaymentsStatus(owner) }
                    val eventTypesDef = async { repo.getEventTypes(owner) }
                    val payments = (paymentsDef.await() as? NetworkResult.Success)?.data
                    val eventTypeCount = (eventTypesDef.await() as? NetworkResult.Success)?.data?.eventTypes?.size ?: 0
                    _state.value = SchedulingSettingsUiState.Loaded(buildData(page, payments?.connected == true, eventTypeCount))
                }
        }

        fun refresh() = load()

        private fun buildData(
            page: BookingPageDto,
            paymentsConnected: Boolean,
            eventTypeCount: Int,
        ): SettingsData {
            val isFresh = page.reminderMinutes.isEmpty() && eventTypeCount == 0
            val zone = page.timezone ?: ZoneId.systemDefault().id
            return SettingsData(
                slug = page.slug,
                isFresh = isFresh,
                isBusiness = owner is SchedulingOwner.Business,
                paidEnabled = featureFlags.paidSchedulingEnabled,
                remindersValue = page.reminderMinutes.sortedDescending().joinToString(" · ") { reminderLabel(it) }.ifBlank { null },
                timezoneValue = "$zone · auto",
                paymentsConnected = paymentsConnected,
                monoFooter = "pantopus.com/book/${page.slug ?: "…"} · owner · you",
                pillar = owner.pillar(),
            )
        }

        fun resetSlug() {
            viewModelScope.launch {
                when (repo.resetSlug(owner)) {
                    is NetworkResult.Success -> {
                        flashToast("Changes saved")
                        load()
                    }
                    is NetworkResult.Failure -> flashToast("Couldn't reset booking link")
                }
            }
        }

        fun disableScheduling() {
            viewModelScope.launch {
                when (repo.disableBookingPage(owner)) {
                    is NetworkResult.Success -> flashToast("Changes saved")
                    is NetworkResult.Failure -> flashToast("Couldn't disable scheduling")
                }
            }
        }

        /**
         * Signal that a specific row write is in-flight.
         * Call before the network request; call [rowSaved] or [rowSaveFailed] on completion.
         */
        fun rowSaving(rowKey: String) {
            val loaded = _state.value as? SchedulingSettingsUiState.Loaded ?: return
            _state.value = SchedulingSettingsUiState.Loaded(loaded.data.copy(savingRow = rowKey, justSavedRow = null))
        }

        /** Signal that the in-flight row write succeeded — shows SavedChip briefly. */
        fun rowSaved(rowKey: String) {
            val loaded = _state.value as? SchedulingSettingsUiState.Loaded ?: return
            _state.value = SchedulingSettingsUiState.Loaded(loaded.data.copy(savingRow = null, justSavedRow = rowKey))
            viewModelScope.launch {
                delay(SAVED_CHIP_MS)
                val current = _state.value as? SchedulingSettingsUiState.Loaded ?: return@launch
                if (current.data.justSavedRow == rowKey) {
                    _state.value = SchedulingSettingsUiState.Loaded(current.data.copy(justSavedRow = null))
                }
            }
        }

        /** Signal that the in-flight row write failed — clears shimmer, no chip. */
        fun rowSaveFailed() {
            val loaded = _state.value as? SchedulingSettingsUiState.Loaded ?: return
            _state.value = SchedulingSettingsUiState.Loaded(loaded.data.copy(savingRow = null, justSavedRow = null))
        }

        private fun flashToast(message: String) {
            viewModelScope.launch {
                _toast.value = message
                delay(SAVED_TOAST_MS)
                _toast.value = null
            }
        }

        // Navigation route helpers. The automations rows carry this root's owner
        // (iOS parity: `.defaultReminders(owner:)` etc.) — reminders persist onto
        // the owner's BookingPage and workflows/templates mutate the owner's rows.
        fun notificationsRoute() = SchedulingRoutes.notifications(owner.routeKind, owner.ownerRouteId)

        fun remindersRoute() = SchedulingRoutes.remindersQuickSetup(owner.routeKind, owner.ownerRouteId)

        fun workflowsRoute() = SchedulingRoutes.workflowsList(owner.routeKind, owner.ownerRouteId)

        fun templatesRoute() = SchedulingRoutes.templateLibrary(owner.routeKind, owner.ownerRouteId)

        fun availabilityRoute() = SchedulingRoutes.AVAILABILITY_LIST

        fun cancellationPolicyRoute() = SchedulingRoutes.CANCELLATION_REFUND_POLICY

        fun paymentsRoute() = SchedulingRoutes.PAYMENTS_SETUP

        fun teamRoute() = SchedulingRoutes.TEAM_BOOKING_AVAILABILITY

        private fun reminderLabel(minutes: Int): String =
            when {
                minutes % MIN_PER_DAY == 0 -> "${minutes / MIN_PER_DAY} day"
                minutes % MIN_PER_HOUR == 0 -> "${minutes / MIN_PER_HOUR} hr"
                else -> "$minutes min"
            }

        private fun SchedulingError.settingsMessage(): String =
            (this as? SchedulingError.Generic)?.message ?: "Couldn't load booking settings."
    }
