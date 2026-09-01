@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.settings.notifications

import androidx.lifecycle.ViewModel
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

/** Per-home notification preferences, rendered by [HomeNotificationsScreen]. */
@HiltViewModel
class HomeNotificationsViewModel
    @Inject
    constructor() : ViewModel() {
        val title = "Home notifications"

        private val toggles =
            mutableMapOf(
                "taskReminders" to true,
                "billDue" to true,
                "packages" to true,
                "maintenance" to true,
                "polls" to true,
            )

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        fun load() {
            _state.value =
                GroupedListUiState.Loaded(
                    groups =
                        listOf(
                            GroupedListGroup(
                                id = "prefs",
                                rows =
                                    listOf(
                                        row("taskReminders", "Task reminders"),
                                        row("billDue", "Bill due dates"),
                                        row("packages", "Package arrivals"),
                                        row("maintenance", "Maintenance alerts"),
                                        row("polls", "New polls"),
                                    ),
                            ),
                        ),
                )
        }

        fun onToggle(
            id: String,
            enabled: Boolean,
        ) {
            toggles[id] = enabled
            load()
        }

        private fun row(
            id: String,
            label: String,
        ): GroupedListRow =
            GroupedListRow(
                id = id,
                label = label,
                control = RowControl.Toggle(toggles[id] ?: false),
            )

        companion object {
            /**
             * No backend route stores per-home notification preferences (see
             * `backend/routes/notifications.js` — only device/push registration
             * and read-state). The toggles are session-local, so the footer
             * says so instead of implying the choice was saved. Byte-identical
             * to iOS `HomeNotificationsViewModel.unavailableCaption`.
             */
            const val UNAVAILABLE_CAPTION =
                "Per-home notification routing isn't live yet — these switches don't change what you receive."
        }
    }
