@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.settings

import androidx.compose.runtime.Immutable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.UpdateBookingPageRequest
import app.pantopus.android.data.api.models.scheduling.UpdateNotificationPrefsRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

internal val REMINDER_PRESETS = listOf(1440 to "1 day", 60 to "1 hr", 15 to "15 min")

@Immutable
data class NotifRow(
    val key: String,
    val label: String,
    val sub: String?,
    val enabled: Boolean,
    val locked: Boolean = false,
)

@Immutable
data class NotifPrefsData(
    val notifyMe: List<NotifRow>,
    val notifyAttendees: List<NotifRow>,
    val reminderMinutes: List<Int>,
    val paused: Boolean,
    /**
     * How long the pause was set for ("2 hours") and when it lifts ("11:42 AM")
     * — the design PauseBanner leads with both (scheduling-notif-frames.jsx
     * :198-199). Read from the flexible prefs map (`pause_minutes` /
     * `pause_until`); null when the pause carries no window, in which case the
     * banner falls back to its static copy.
     */
    val pausedForLabel: String? = null,
    val resumesAtLabel: String? = null,
    val pushOff: Boolean,
    /** Pillar accent for chips/header tint — defaults to Personal (current data contract is personal-only). */
    val pillar: SchedulingPillar = SchedulingPillar.Personal,
)

@Immutable
sealed interface NotificationPrefsUiState {
    data object Loading : NotificationPrefsUiState

    data class Loaded(val data: NotifPrefsData) : NotificationPrefsUiState

    data class Error(val message: String) : NotificationPrefsUiState
}

/**
 * A4 Notification Preferences. The notify_me/notify_attendees blob is per-user, but reminder
 * lead times and the pause flag live on the OWNER's BookingPage — so the owner must come from
 * the route (mirroring Settings), or a Business/Home hub would edit the personal page's
 * reminders and pause state. The flexible prefs map round-trips unknown keys.
 */
@HiltViewModel
class NotificationPrefsViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val owner: SchedulingOwner =
            SchedulingOwner.fromRoute(
                savedStateHandle[SchedulingRoutes.ARG_OWNER_KIND],
                savedStateHandle[SchedulingRoutes.ARG_OWNER_ID],
            )
        private val _state = MutableStateFlow<NotificationPrefsUiState>(NotificationPrefsUiState.Loading)
        val state: StateFlow<NotificationPrefsUiState> = _state.asStateFlow()

        /** The full prefs object as returned by the server — preserved so unknown keys round-trip. */
        private var prefsRoot: Map<String, Any?> = emptyMap()

        /** OS-level push permission state, supplied by the screen (which holds the Android Context). */
        private var pushOff: Boolean = false

        fun load(pushOff: Boolean = this.pushOff) {
            this.pushOff = pushOff
            _state.value = NotificationPrefsUiState.Loading
            viewModelScope.launch {
                val prefsDef = viewModelScope.async { repo.getNotificationPreferences() }
                val pageDef = viewModelScope.async { repo.getBookingPage(owner) }
                val prefsResult = prefsDef.await()
                val page = (pageDef.await() as? NetworkResult.Success)?.data?.page

                if (prefsResult !is NetworkResult.Success) {
                    _state.value = NotificationPrefsUiState.Error("Couldn't load notification preferences.")
                    return@launch
                }
                prefsRoot = prefsResult.data.prefs
                val (pausedFor, resumesAt) = pauseWindow()
                _state.value =
                    NotificationPrefsUiState.Loaded(
                        NotifPrefsData(
                            notifyMe = buildNotifyMe(),
                            notifyAttendees = buildNotifyAttendees(),
                            reminderMinutes = page?.reminderMinutes ?: emptyList(),
                            paused = page?.isPaused ?: false,
                            pausedForLabel = pausedFor,
                            resumesAtLabel = resumesAt,
                            pushOff = pushOff,
                            pillar = owner.pillar(),
                        ),
                    )
            }
        }

        fun refresh() = load()

        /** Un-pause from the banner's Resume pill (the pill was previously inert). */
        fun resume() {
            val loaded = _state.value as? NotificationPrefsUiState.Loaded ?: return
            if (!loaded.data.paused) return
            // Optimistic: the banner disappears immediately; a failed PUT restores it.
            _state.value =
                NotificationPrefsUiState.Loaded(
                    loaded.data.copy(paused = false, pausedForLabel = null, resumesAtLabel = null),
                )
            viewModelScope.launch {
                val result = repo.updateBookingPage(owner, UpdateBookingPageRequest(isPaused = false))
                if (result !is NetworkResult.Success) {
                    _state.value = NotificationPrefsUiState.Loaded(loaded.data)
                }
            }
        }

        /**
         * "Paused for 2 hours" / "Resumes 11:42 AM" labels from the flexible
         * prefs map. The backend booking page carries only the `is_paused`
         * boolean, so the window — when one was chosen — round-trips through
         * the prefs JSONB (`pause_minutes` + ISO `pause_until`). Absent or
         * elapsed values yield nulls and the banner keeps its static copy.
         */
        private fun pauseWindow(): Pair<String?, String?> {
            val until =
                (prefsRoot["pause_until"] as? String)
                    ?.let { runCatching { Instant.parse(it) }.getOrNull() }
                    ?.takeIf { it > Instant.now() }
                    ?: return null to null
            val minutes =
                (prefsRoot["pause_minutes"] as? Number)?.toInt()
                    ?: Duration.between(Instant.now(), until).toMinutes().toInt()
            val resumeLabel =
                until
                    .atZone(ZoneId.systemDefault())
                    .format(DateTimeFormatter.ofPattern("h:mm a", Locale.US))
            return pauseDurationLabel(minutes) to resumeLabel
        }

        private fun pauseDurationLabel(minutes: Int): String? =
            when {
                minutes <= 0 -> null
                minutes % 60 == 0 -> (minutes / 60).let { if (it == 1) "1 hour" else "$it hours" }
                else -> "$minutes min"
            }

        private fun nested(key: String): Map<String, Any?> =
            @Suppress("UNCHECKED_CAST")
            (prefsRoot[key] as? Map<String, Any?>)
                ?: emptyMap()

        private fun bool(
            map: Map<String, Any?>,
            key: String,
            default: Boolean,
        ): Boolean = (map[key] as? Boolean) ?: default

        private fun buildNotifyMe(): List<NotifRow> {
            val m = nested("notify_me")
            return listOf(
                NotifRow("new_booking", "New booking", "We'll tell you the moment someone books.", bool(m, "new_booking", true)),
                NotifRow("cancellation", "Cancellation", null, bool(m, "cancellation", true)),
                NotifRow("reschedule", "Reschedule", null, bool(m, "reschedule", true)),
                NotifRow("reminder", "Reminder sent", "When your reminder goes out", bool(m, "reminder", true)),
                // Defaults mirror the backend's DEFAULT_NOTIFY_ME (schedulingNotifyPrefs.js)
                // so an untouched blob renders the states the server actually applies.
                NotifRow("no_show", "No-show", "Attendee missed the booking", bool(m, "no_show", true)),
                // booking_request is the approval-flow alert, NOT a daily digest — the old
                // "Daily agenda" label toggled a key the server treats as "someone requested
                // a time", silently muting approval alerts for anyone who turned it off.
                NotifRow(
                    "booking_request",
                    "Booking request",
                    "Someone requests a time that needs your approval",
                    bool(m, "booking_request", true),
                ),
            )
        }

        private fun buildNotifyAttendees(): List<NotifRow> {
            val a = nested("notify_attendees")
            return listOf(
                NotifRow("confirmation", "Booking confirmation", "Sent the moment they book", enabled = true, locked = true),
                NotifRow("reminder", "Reminder", "Before the booking starts", bool(a, "reminder", true)),
                NotifRow("reschedule", "Reschedule notice", null, bool(a, "reschedule", true)),
                NotifRow("cancellation", "Cancellation notice", null, bool(a, "cancellation", true)),
            )
        }

        fun toggleNotifyMe(key: String) {
            val loaded = _state.value as? NotificationPrefsUiState.Loaded ?: return
            val updated = loaded.data.notifyMe.map { if (it.key == key && !it.locked) it.copy(enabled = !it.enabled) else it }
            _state.value = NotificationPrefsUiState.Loaded(loaded.data.copy(notifyMe = updated))
            persistPrefs(updated, loaded.data.notifyAttendees)
        }

        fun toggleNotifyAttendees(key: String) {
            val loaded = _state.value as? NotificationPrefsUiState.Loaded ?: return
            val updated = loaded.data.notifyAttendees.map { if (it.key == key && !it.locked) it.copy(enabled = !it.enabled) else it }
            _state.value = NotificationPrefsUiState.Loaded(loaded.data.copy(notifyAttendees = updated))
            persistPrefs(loaded.data.notifyMe, updated)
        }

        private fun persistPrefs(
            notifyMe: List<NotifRow>,
            notifyAttendees: List<NotifRow>,
        ) {
            val meMap = notifyMe.associate { it.key to it.enabled }
            val attMap = notifyAttendees.associate { it.key to it.enabled } + ("confirmation" to true)
            val root = prefsRoot.toMutableMap()
            // Merge over the existing nested maps rather than replacing them — the server
            // blob may carry keys this screen doesn't render (added by web/newer builds),
            // and a rebuild-from-rows write would silently erase those preferences.
            root["notify_me"] = nested("notify_me") + meMap
            root["notify_attendees"] = nested("notify_attendees") + attMap
            prefsRoot = root
            viewModelScope.launch {
                when (val r = repo.updateNotificationPreferences(UpdateNotificationPrefsRequest(prefs = root))) {
                    is NetworkResult.Success -> prefsRoot = r.data.prefs
                    is NetworkResult.Failure -> load()
                }
            }
        }

        fun toggleReminder(minutes: Int) {
            val loaded = _state.value as? NotificationPrefsUiState.Loaded ?: return
            val current = loaded.data.reminderMinutes
            val updated = (if (minutes in current) current - minutes else current + minutes).sortedDescending()
            _state.value = NotificationPrefsUiState.Loaded(loaded.data.copy(reminderMinutes = updated))
            viewModelScope.launch {
                if (repo.updateBookingPage(
                        owner,
                        UpdateBookingPageRequest(reminderMinutes = updated),
                    ) is NetworkResult.Failure
                ) {
                    load()
                }
            }
        }
    }
