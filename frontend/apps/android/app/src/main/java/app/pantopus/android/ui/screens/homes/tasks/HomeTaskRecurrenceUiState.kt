package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceRequest
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceState
import app.pantopus.android.data.api.models.homes.recurrenceDate
import app.pantopus.android.data.homes.PendingHomeTaskRecurrence

data class HomeTaskRecurrenceUiState(
    val visible: Boolean = false,
    val active: Boolean = false,
    val busy: Boolean = false,
    val task: HomeTaskDto? = null,
    val schedule: HomeTaskRecurrenceState? = null,
    val pending: PendingHomeTaskRecurrence? = null,
    val canDismiss: Boolean = false,
    val error: String? = null,
    val frequency: String = "WEEKLY",
    val interval: String = "1",
    val timezone: String = "UTC",
) {
    val canChange get() = active && visible && !busy && pending == null && task != null && schedule?.canManage == true
    val canStart get() =
        canChange && task?.status != "canceled" && recurrenceDate(task?.dueAt) != null &&
            startRequest("00000000-0000-4000-8000-000000000001")?.valid() == true &&
            (
                schedule?.configuration?.let {
                    it.state != "active" || it.frequency != frequency || it.interval.toString() != interval || it.timezone != timezone
                } ?: true
            )
    val canPause get() = canChange && schedule?.configuration?.let { it.state != "paused" } == true

    fun startRequest(id: String): HomeTaskRecurrenceRequest? =
        schedule?.let {
            HomeTaskRecurrenceRequest(id, "start", it.revision, it.taskUpdatedAt, frequency, interval.toIntOrNull(), timezone)
        }

    fun fieldsFromCurrent(): HomeTaskRecurrenceUiState {
        val command = pending?.takeIf { it.confirmed == null }?.request
        return copy(
            frequency = command?.frequency ?: schedule?.configuration?.frequency ?: "WEEKLY",
            interval = (command?.interval ?: schedule?.configuration?.interval ?: 1).toString(),
            timezone = command?.timezone ?: schedule?.configuration?.timezone ?: "UTC",
        )
    }
}
