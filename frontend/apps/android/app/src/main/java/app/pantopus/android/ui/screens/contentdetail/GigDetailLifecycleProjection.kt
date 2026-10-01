package app.pantopus.android.ui.screens.contentdetail

import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.ui.theme.PantopusIcon

/** Both layouts render current server lifecycle, never inferred openness. */
internal fun currentGigDetail(
    content: ContentDetailContent,
    gig: GigDto,
    viewer: String?,
    canDeliver: Boolean,
    canTip: Boolean,
): ContentDetailContent =
    launchScopedGigDetail(
        content.copy(
            statusPill = currentGigStatus(gig, content.statusPill),
            dock = currentGigDock(content.dock, gig, viewer, canDeliver, canTip),
        ),
    )

/** Launch cut #4 (Open Gigs): a task's detail shows no bids, bid counts or "Be the first to bid". */
private fun launchScopedGigDetail(content: ContentDetailContent): ContentDetailContent {
    if (LaunchFeatures.openGigs) return content
    return content.copy(
        statusPill = content.statusPill?.let { pill -> if (pill.label.startsWith("Open · ")) pill.copy(label = "Open") else pill },
        modules = content.modules.filterNot { it is ContentDetailModule.Bids || it.id == "be-first" },
    )
}

private fun currentGigStatus(
    gig: GigDto,
    fallback: ContentDetailPill?,
): ContentDetailPill {
    val label =
        when (gig.status?.lowercase()) {
            "open" -> return fallback ?: ContentDetailPill("status", "Open", PantopusIcon.Circle, ContentDetailPill.Tone.Warning)
            "assigned" -> "Assigned"
            "accepted", "awarded" -> "Awarded"
            "in_progress" -> "In progress"
            "completed" -> "Completed"
            "cancelled", "canceled" -> "Cancelled"
            else -> "Status unavailable"
        }
    val tone =
        when (label) {
            "Assigned", "Awarded", "Completed" -> ContentDetailPill.Tone.Success
            "In progress" -> ContentDetailPill.Tone.Warning
            else -> ContentDetailPill.Tone.Neutral
        }
    return ContentDetailPill("status", label, if (label == "Cancelled") PantopusIcon.Ban else PantopusIcon.Circle, tone)
}

private fun currentGigDock(
    dock: ContentDetailDock,
    gig: GigDto,
    viewer: String?,
    canDeliver: Boolean,
    canTip: Boolean,
): ContentDetailDock {
    val status = gig.status?.lowercase()
    val owner = viewer != null && viewer == gig.userId
    val secondary = dock.secondary.takeUnless { owner && gig.acceptedBy.isNullOrEmpty() }
    val primary =
        when {
            status == "completed" && canTip -> dock.primary
            status == "in_progress" && canDeliver -> ContentDetailDockButton("Mark as delivered", PantopusIcon.CheckCheck)
            // The assigned worker's next step, as in the Task progress panel.
            status == "assigned" && viewer != null && viewer == gig.acceptedBy ->
                ContentDetailDockButton("Start task", PantopusIcon.Play)
            status == "open" && !owner -> dock.primary
            else -> {
                val label =
                    when (status) {
                        "open" -> "Your task"
                        "cancelled", "canceled" -> "Cancelled"
                        else -> "Bidding closed"
                    }
                ContentDetailDockButton(label, PantopusIcon.Lock, enabled = false)
            }
        }
    return ContentDetailDock(secondary, primary)
}
