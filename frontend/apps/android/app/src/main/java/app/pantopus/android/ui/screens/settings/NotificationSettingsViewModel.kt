@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.hub.NotificationPreferences
import app.pantopus.android.data.api.models.hub.NotificationPreferencesPatch
import app.pantopus.android.data.api.models.hub.QuietHoursPatch
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.hub.NotificationPreferencesRepository
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * A14.5 — Notification & briefing preferences, backed by
 * `GET/PUT /api/hub/preferences` (routes `backend/routes/hub.js:648`
 * and `:716`).
 *
 * Four cards, projected onto the shared GroupedList archetype and
 * mirrored row-for-row in the iOS `NotificationSettingsViewModel`:
 * Briefings (morning + evening enable toggles, each revealing a
 * send-time chip strip when on), Alert preferences (five switches),
 * Quiet hours (one toggle — the server signals on/off by whether a
 * start time is stored — plus From / Until chip strips), and Briefing
 * location (radio over `primary_home | viewing_location |
 * device_location`).
 *
 * Mutations are optimistic and debounce-saved on a 600 ms timer, so a
 * burst of taps collapses into a single PUT carrying the merged patch
 * (RN debounces the same window at `notification-preferences.tsx:62-75`
 * but drops all but the last key — we merge instead). A failed PUT
 * toasts and re-fetches, which rolls the row back to server truth.
 *
 * Times go over the wire as `HH:mm` strings: Joi rejects anything else
 * (`hub.js:699-709`), so never format them for the display locale.
 */
@HiltViewModel
class NotificationSettingsViewModel
    @Inject
    constructor(
        private val repository: NotificationPreferencesRepository,
    ) : ViewModel() {
        val title: String = "Notifications"

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        /**
         * Which zone the server interprets the briefing times in.
         * Pinned under the last card so `07:30` is never ambiguous.
         */
        private val _footerCaption = MutableStateFlow<String?>(null)
        val footerCaption: StateFlow<String?> = _footerCaption.asStateFlow()

        /** Transient save / load feedback, mirroring RN's toasts. */
        private val _toast = MutableStateFlow<ToastMessage?>(null)
        val toast: StateFlow<ToastMessage?> = _toast.asStateFlow()

        /** Server truth, mutated optimistically ahead of the debounced PUT. */
        private var preferences: NotificationPreferences? = null
        private var pendingPatch = NotificationPreferencesPatch()
        private var saveJob: Job? = null

        /** Overridable in tests so the debounce never races the assertions. */
        internal var saveDebounceMillis: Long = DEFAULT_SAVE_DEBOUNCE_MS

        fun load() {
            if (preferences == null) _state.value = GroupedListUiState.Loading
            viewModelScope.launch { fetch() }
        }

        fun refresh() {
            viewModelScope.launch { fetch() }
        }

        fun consumeToast() {
            _toast.value = null
        }

        // MARK: - Row callbacks

        @Suppress("CyclomaticComplexMethod")
        fun onToggle(
            rowId: String,
            isOn: Boolean,
        ) {
            val current = preferences ?: return
            when (rowId) {
                RowId.MORNING_BRIEFING ->
                    applyLocally(
                        current.copy(dailyBriefingEnabled = isOn),
                        NotificationPreferencesPatch(dailyBriefingEnabled = isOn),
                    )
                RowId.EVENING_BRIEFING ->
                    applyLocally(
                        current.copy(eveningBriefingEnabled = isOn),
                        NotificationPreferencesPatch(eveningBriefingEnabled = isOn),
                    )
                RowId.WEATHER_ALERTS ->
                    applyLocally(
                        current.copy(weatherAlertsEnabled = isOn),
                        NotificationPreferencesPatch(weatherAlertsEnabled = isOn),
                    )
                RowId.AQI_ALERTS ->
                    applyLocally(
                        current.copy(aqiAlertsEnabled = isOn),
                        NotificationPreferencesPatch(aqiAlertsEnabled = isOn),
                    )
                RowId.HOME_REMINDERS ->
                    applyLocally(
                        current.copy(homeRemindersEnabled = isOn),
                        NotificationPreferencesPatch(homeRemindersEnabled = isOn),
                    )
                RowId.GIG_UPDATES ->
                    applyLocally(
                        current.copy(gigUpdatesEnabled = isOn),
                        NotificationPreferencesPatch(gigUpdatesEnabled = isOn),
                    )
                RowId.MAIL_SUMMARY ->
                    applyLocally(
                        current.copy(mailSummaryEnabled = isOn),
                        NotificationPreferencesPatch(mailSummaryEnabled = isOn),
                    )
                RowId.QUIET_HOURS -> setQuietHours(current, isOn)
                else -> Unit
            }
        }

        fun onSelectChip(
            rowId: String,
            value: String,
        ) {
            val current = preferences ?: return
            when (rowId) {
                RowId.MORNING_TIME ->
                    applyLocally(
                        current.copy(dailyBriefingTimeLocal = value),
                        NotificationPreferencesPatch(dailyBriefingTimeLocal = value),
                    )
                RowId.EVENING_TIME ->
                    applyLocally(
                        current.copy(eveningBriefingTimeLocal = value),
                        NotificationPreferencesPatch(eveningBriefingTimeLocal = value),
                    )
                RowId.QUIET_HOURS_START ->
                    applyLocally(
                        current.copy(quietHoursStartLocal = value),
                        NotificationPreferencesPatch(
                            quietHours = QuietHoursPatch(value, current.quietHoursEndLocal),
                        ),
                    )
                RowId.QUIET_HOURS_END ->
                    applyLocally(
                        current.copy(quietHoursEndLocal = value),
                        NotificationPreferencesPatch(
                            quietHours = QuietHoursPatch(current.quietHoursStartLocal, value),
                        ),
                    )
                else -> Unit
            }
        }

        fun onSelectRadio(rowId: String) {
            val current = preferences ?: return
            val option = LOCATION_OPTIONS.firstOrNull { it.rowId == rowId } ?: return
            applyLocally(
                current.copy(locationMode = option.mode),
                NotificationPreferencesPatch(locationMode = option.mode),
            )
        }

        // MARK: - Networking

        private suspend fun fetch() {
            when (val result = repository.preferences()) {
                is NetworkResult.Success -> publish(result.data)
                is NetworkResult.Failure ->
                    if (preferences == null) {
                        _state.value = GroupedListUiState.Error(result.error.message)
                    } else {
                        // Something is already on screen — keep it and
                        // surface the failure as a toast, like RN.
                        _toast.value = ToastMessage("Failed to load preferences", ToastKind.Error)
                    }
            }
        }

        /** Apply locally, re-project, and (re)arm the debounce timer. */
        private fun applyLocally(
            updated: NotificationPreferences,
            patch: NotificationPreferencesPatch,
        ) {
            publish(updated)
            pendingPatch = pendingPatch.mergedWith(patch)
            saveJob?.cancel()
            saveJob =
                viewModelScope.launch {
                    delay(saveDebounceMillis)
                    flushPendingSave()
                }
        }

        /** Test seam — drain the debounce window immediately. */
        internal suspend fun flushPendingSaveNow() {
            saveJob?.cancel()
            saveJob = null
            flushPendingSave()
        }

        private suspend fun flushPendingSave() {
            val patch = pendingPatch
            pendingPatch = NotificationPreferencesPatch()
            if (patch.isEmpty) return
            when (val result = repository.updatePreferences(patch)) {
                is NetworkResult.Success -> {
                    publish(result.data)
                    _toast.value = ToastMessage("Saved", ToastKind.Success)
                }
                is NetworkResult.Failure -> {
                    _toast.value = ToastMessage("Failed to save", ToastKind.Error)
                    // Roll back by re-reading server truth (RN does the same).
                    fetch()
                }
            }
        }

        private fun setQuietHours(
            current: NotificationPreferences,
            enabled: Boolean,
        ) {
            if (enabled) {
                applyLocally(
                    current.copy(quietHoursStartLocal = DEFAULT_QUIET_START, quietHoursEndLocal = DEFAULT_QUIET_END),
                    NotificationPreferencesPatch(
                        quietHours = QuietHoursPatch(DEFAULT_QUIET_START, DEFAULT_QUIET_END),
                    ),
                )
            } else {
                applyLocally(
                    current.copy(quietHoursStartLocal = null, quietHoursEndLocal = null),
                    NotificationPreferencesPatch(quietHours = QuietHoursPatch(null, null)),
                )
            }
        }

        private fun publish(next: NotificationPreferences) {
            preferences = next
            _footerCaption.value = next.dailyBriefingTimezone?.takeIf { it.isNotBlank() }?.let { "Briefing times use $it" }
            _state.value = GroupedListUiState.Loaded(groups(next))
        }

        // MARK: - Group projection

        private fun groups(prefs: NotificationPreferences): List<GroupedListGroup> =
            listOf(
                briefingsGroup(prefs),
                alertsGroup(prefs),
                quietHoursGroup(prefs),
                locationGroup(prefs),
            )

        private fun briefingsGroup(prefs: NotificationPreferences): GroupedListGroup =
            GroupedListGroup(
                id = GroupId.BRIEFINGS,
                overline = "Briefings",
                rows =
                    buildList {
                        add(
                            GroupedListRow(
                                id = RowId.MORNING_BRIEFING,
                                label = "Morning Briefing",
                                subtext = "Current weather plus the most relevant thing for today",
                                control = RowControl.Toggle(prefs.dailyBriefingEnabled),
                            ),
                        )
                        if (prefs.dailyBriefingEnabled) {
                            add(
                                GroupedListRow(
                                    id = RowId.MORNING_TIME,
                                    label = "Briefing Time",
                                    subtext = "Choose when this briefing arrives",
                                    control = RowControl.Chips(MORNING_TIME_OPTIONS, prefs.dailyBriefingTimeLocal),
                                ),
                            )
                        }
                        add(
                            GroupedListRow(
                                id = RowId.EVENING_BRIEFING,
                                label = "Evening Briefing",
                                subtext = "Tomorrow's forecast plus one useful thing to handle tonight",
                                control = RowControl.Toggle(prefs.eveningBriefingEnabled),
                            ),
                        )
                        if (prefs.eveningBriefingEnabled) {
                            add(
                                GroupedListRow(
                                    id = RowId.EVENING_TIME,
                                    label = "Briefing Time",
                                    subtext = "Choose when this briefing arrives",
                                    control = RowControl.Chips(EVENING_TIME_OPTIONS, prefs.eveningBriefingTimeLocal),
                                ),
                            )
                        }
                    },
            )

        private fun alertsGroup(prefs: NotificationPreferences): GroupedListGroup =
            GroupedListGroup(
                id = GroupId.ALERTS,
                overline = "Alert preferences",
                rows =
                    listOf(
                        GroupedListRow(
                            id = RowId.WEATHER_ALERTS,
                            label = "Weather Alerts",
                            subtext = "Severe weather and storm warnings",
                            control = RowControl.Toggle(prefs.weatherAlertsEnabled),
                        ),
                        GroupedListRow(
                            id = RowId.AQI_ALERTS,
                            label = "Air Quality Alerts",
                            subtext = "Unhealthy AQI notifications",
                            control = RowControl.Toggle(prefs.aqiAlertsEnabled),
                        ),
                        GroupedListRow(
                            id = RowId.HOME_REMINDERS,
                            label = "Home Reminders",
                            subtext = "Bills, tasks, and calendar events",
                            control = RowControl.Toggle(prefs.homeRemindersEnabled),
                        ),
                        GroupedListRow(
                            id = RowId.GIG_UPDATES,
                            label = "Gig Updates",
                            subtext = "Active gig status changes",
                            control = RowControl.Toggle(prefs.gigUpdatesEnabled),
                        ),
                        GroupedListRow(
                            id = RowId.MAIL_SUMMARY,
                            label = "Mail Summary",
                            subtext = "Daily mailbox digest",
                            control = RowControl.Toggle(prefs.mailSummaryEnabled),
                        ),
                    ),
            )

        private fun quietHoursGroup(prefs: NotificationPreferences): GroupedListGroup =
            GroupedListGroup(
                id = GroupId.QUIET_HOURS,
                overline = "Quiet hours",
                rows =
                    buildList {
                        add(
                            GroupedListRow(
                                id = RowId.QUIET_HOURS,
                                label = "Quiet Hours",
                                subtext = "Silence briefings during set hours",
                                control = RowControl.Toggle(prefs.quietHoursEnabled),
                            ),
                        )
                        if (prefs.quietHoursEnabled) {
                            add(
                                GroupedListRow(
                                    id = RowId.QUIET_HOURS_START,
                                    label = "From",
                                    control =
                                        RowControl.Chips(
                                            QUIET_START_OPTIONS,
                                            prefs.quietHoursStartLocal ?: DEFAULT_QUIET_START,
                                        ),
                                ),
                            )
                            add(
                                GroupedListRow(
                                    id = RowId.QUIET_HOURS_END,
                                    label = "Until",
                                    control =
                                        RowControl.Chips(
                                            QUIET_END_OPTIONS,
                                            prefs.quietHoursEndLocal ?: DEFAULT_QUIET_END,
                                        ),
                                ),
                            )
                        }
                    },
            )

        private fun locationGroup(prefs: NotificationPreferences): GroupedListGroup =
            GroupedListGroup(
                id = GroupId.BRIEFING_LOCATION,
                overline = "Briefing location",
                rows =
                    LOCATION_OPTIONS.map { option ->
                        GroupedListRow(
                            id = option.rowId,
                            label = option.label,
                            control = RowControl.Radio(prefs.locationMode == option.mode),
                        )
                    },
            )

        /** One radio row in the Briefing-location card. */
        data class LocationOption(
            val mode: String,
            val rowId: String,
            val label: String,
        )

        /** Stable card ids — parity contract with iOS `GroupID`. */
        object GroupId {
            const val BRIEFINGS = "briefings"
            const val ALERTS = "alerts"
            const val QUIET_HOURS = "quietHours"
            const val BRIEFING_LOCATION = "briefingLocation"
        }

        /** Stable row ids — parity contract with iOS `RowID`. */
        object RowId {
            const val MORNING_BRIEFING = "briefings.morning"
            const val MORNING_TIME = "briefings.morningTime"
            const val EVENING_BRIEFING = "briefings.evening"
            const val EVENING_TIME = "briefings.eveningTime"
            const val WEATHER_ALERTS = "alerts.weather"
            const val AQI_ALERTS = "alerts.aqi"
            const val HOME_REMINDERS = "alerts.homeReminders"
            const val GIG_UPDATES = "alerts.gigUpdates"
            const val MAIL_SUMMARY = "alerts.mailSummary"
            const val QUIET_HOURS = "quietHours.enabled"
            const val QUIET_HOURS_START = "quietHours.start"
            const val QUIET_HOURS_END = "quietHours.end"
            const val LOCATION_PRIMARY_HOME = "briefingLocation.primaryHome"
            const val LOCATION_VIEWING = "briefingLocation.viewingLocation"
            const val LOCATION_DEVICE = "briefingLocation.deviceLocation"
        }

        companion object {
            private const val DEFAULT_SAVE_DEBOUNCE_MS = 600L

            /** RN `TIME_OPTIONS` (`notification-preferences.tsx:16-18`). */
            val MORNING_TIME_OPTIONS =
                listOf("06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00")

            /** RN `EVENING_TIME_OPTIONS` (`notification-preferences.tsx:20-22`). */
            val EVENING_TIME_OPTIONS =
                listOf("17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00")

            val QUIET_START_OPTIONS = listOf("20:00", "21:00", "22:00", "23:00", "00:00")
            val QUIET_END_OPTIONS = listOf("05:00", "06:00", "07:00", "08:00", "09:00")

            /** RN seeds these when quiet hours are switched on (`…tsx:208`). */
            const val DEFAULT_QUIET_START = "22:00"
            const val DEFAULT_QUIET_END = "07:00"

            /**
             * RN `LOCATION_MODES` (`notification-preferences.tsx:24-28`).
             * The backend also accepts `custom`, which needs lat/lng and
             * has no RN or native editor — a stored `custom` simply
             * leaves all three radios unselected rather than being
             * silently rewritten.
             */
            val LOCATION_OPTIONS =
                listOf(
                    LocationOption(
                        NotificationPreferences.MODE_PRIMARY_HOME,
                        RowId.LOCATION_PRIMARY_HOME,
                        "Primary Home",
                    ),
                    LocationOption(
                        NotificationPreferences.MODE_VIEWING_LOCATION,
                        RowId.LOCATION_VIEWING,
                        "Current Viewing Location",
                    ),
                    LocationOption(
                        NotificationPreferences.MODE_DEVICE_LOCATION,
                        RowId.LOCATION_DEVICE,
                        "Device Location",
                    ),
                )
        }
    }
