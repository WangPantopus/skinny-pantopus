@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.business

import androidx.compose.ui.graphics.Color
import app.pantopus.android.data.api.models.scheduling.EventTypeAssigneeDto
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.theme.PantopusColors

/**
 * A pickable team member for the assignment surfaces (G1 round-robin, G2
 * collective). `id` is the user id — the `subject_id` an assignee row carries
 * and the `freeByMember` key team-availability returns.
 */
data class AssignmentMember(
    val id: String,
    val name: String,
    val role: String?,
    val avatarUrl: String?,
)

/** The loaded assignment context for one business event type. */
data class AssignmentPool(
    val eventType: EventTypeDto,
    val assignees: List<EventTypeAssigneeDto>,
    val members: List<AssignmentMember>,
)

/**
 * Loads the event type detail (`GET /event-types/:id` → event type + assignees)
 * and folds in the business roster (`GET /api/businesses/:id/members`) so both
 * assignment sheets choose from the same pool. The roster read is best-effort;
 * the event-type read gates the result.
 */
suspend fun loadAssignmentPool(
    repo: SchedulingRepository,
    businessTeam: BusinessTeamRepository,
    owner: SchedulingOwner.Business,
    eventTypeId: String,
): NetworkResult<AssignmentPool> =
    when (val detail = repo.getEventType(owner, eventTypeId)) {
        is NetworkResult.Failure -> NetworkResult.Failure(detail.error)
        is NetworkResult.Success -> {
            val roster = (businessTeam.members(owner.businessUserId) as? NetworkResult.Success)?.data
            val members =
                roster?.members.orEmpty().mapNotNull { member ->
                    val user = member.user ?: return@mapNotNull null
                    AssignmentMember(
                        id = user.id,
                        name = user.name ?: user.username ?: "Member",
                        role = member.title ?: member.roleBase?.replaceFirstChar { it.uppercase() },
                        avatarUrl = user.profilePictureUrl,
                    )
                }
            NetworkResult.Success(
                AssignmentPool(
                    eventType = detail.data.eventType,
                    assignees = detail.data.assignees,
                    members = members,
                ),
            )
        }
    }

/** Up to two uppercase initials for a display name. */
fun initialsFor(name: String): String {
    val words = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    return when {
        words.isEmpty() -> "?"
        words.size == 1 -> words[0].take(2).uppercase()
        else -> (words[0].take(1) + words[1].take(1)).uppercase()
    }
}

/**
 * A deterministic two-stop avatar gradient drawn only from design tokens (the
 * mocks use per-member gradient discs; tokens-only keeps the CI hex guard
 * happy). Stable per [seed] so a member keeps the same swatch across reloads.
 */
fun avatarGradient(seed: String): Pair<Color, Color> {
    val palette =
        listOf(
            PantopusColors.business to PantopusColors.businessDark,
            PantopusColors.primary500 to PantopusColors.primary700,
            PantopusColors.home to PantopusColors.homeDark,
            PantopusColors.magic to PantopusColors.businessDark,
            PantopusColors.warmAmber to PantopusColors.warning,
            PantopusColors.info to PantopusColors.primary800,
        )
    val index = ((seed.hashCode() % palette.size) + palette.size) % palette.size
    return palette[index]
}
