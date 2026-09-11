package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.geo.GeoSuggestion
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.HomeTaskGigLocation
import app.pantopus.android.data.api.models.homes.HomeTaskGigRequest
import app.pantopus.android.data.api.models.homes.HomeTaskGigSource
import app.pantopus.android.data.api.models.homes.HomeTaskGigState
import app.pantopus.android.data.homes.PendingHomeTaskGig

data class HomeTaskGigInput(
    val title: String = "",
    val description: String = "",
    val budget: String = "",
    val category: String = "General",
    val policy: String = "standard",
    val address: String = "",
)

data class HomeTaskGigUiState(
    val visible: Boolean = false,
    val active: Boolean = false,
    val busy: Boolean = false,
    val task: HomeTaskDto? = null,
    val publication: HomeTaskGigState? = null,
    val pending: PendingHomeTaskGig? = null,
    val canDismiss: Boolean = false,
    val error: String? = null,
    val input: HomeTaskGigInput = HomeTaskGigInput(),
    val reviewed: Boolean = false,
    val location: HomeTaskGigLocation? = null,
    val suggestions: List<GeoSuggestion> = emptyList(),
) {
    val canEdit get() = active && visible && !busy && task != null && publication?.canPublish == true && pending == null
    val canPublish get() = canEdit && reviewed && request("00000000-0000-4000-8000-000000000001")?.valid() == true

    fun request(id: String): HomeTaskGigRequest? {
        val source = publication ?: return null
        val normalized = input.budget.trim().replace(',', '.')
        val price = normalized.takeIf { it.matches(Regex("^[0-9]+(?:\\.[0-9]{1,2})?$")) }?.toDoubleOrNull() ?: return null
        return HomeTaskGigRequest(
            HomeTaskGigSource(source.homeId, source.taskId, id, source.taskUpdatedAt),
            input.title.trim(),
            input.description.trim(),
            price,
            input.category,
            input.policy,
            location ?: return null,
        )
    }
}
