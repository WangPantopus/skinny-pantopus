package app.pantopus.android.data.api.models.plans

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class PlansSportsDto(
    val state: String = "unset",
    @Json(name = "can_choose") val canChoose: Boolean = false,
    val attribution: String? = null,
)

@JsonClass(generateAdapter = true)
data class SportsPreferencesDto(
    val watch: String? = null,
    val teams: List<String>? = null,
    val hidden: List<String>? = null,
    val leagues: List<String>? = null,
)

@JsonClass(generateAdapter = true)
data class PlanTeamDto(
    val id: String,
    val name: String,
    val label: String,
    val league: String,
    val city: String,
    val state: String,
)

@JsonClass(generateAdapter = true)
data class PlanTeamsResponse(
    val suggested: List<PlanTeamDto> = emptyList(),
    val results: List<PlanTeamDto> = emptyList(),
)
