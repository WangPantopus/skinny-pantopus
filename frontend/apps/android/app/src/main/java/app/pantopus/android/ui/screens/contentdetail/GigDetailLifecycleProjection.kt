package app.pantopus.android.ui.screens.contentdetail

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
    content.copy(
        statusPill = currentGigStatus(gig, content.statusPill),
        dock = currentGigDock(content.dock, gig, viewer, canDeliver, canTip),
    )

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
