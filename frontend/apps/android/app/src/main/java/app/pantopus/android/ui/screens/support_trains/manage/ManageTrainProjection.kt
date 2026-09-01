@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.support_trains.manage

import app.pantopus.android.data.api.models.support_trains.SupportTrainDetailDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainSlotDto
import app.pantopus.android.ui.screens.support_trains.detail.SupportTrainDetailProjection
import app.pantopus.android.ui.theme.PantopusIcon
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Maps the shared `GET /api/support-trains/:id` payload onto the
 * organizer dashboard model. Mirrors iOS `ManageTrainProjection`.
 *
 * PROJECTION GAPS: `/:id` exposes per-slot filled/capacity counts but no
 * helper roster, dropout count, or audience segmentation, so the helper
 * count is proxied from covered slots, dropout shows `0`, and the audience
 * picker is a single "All helpers" chip. The Organize rows are static UI
 * affordances (their destinations are separate screens).
 */
object ManageTrainProjection {
    private const val MILLIS_PER_DAY = 1000L * 60 * 60 * 24

    fun project(dto: SupportTrainDetailDto): ManageTrainContent {
        val slots = dto.slots ?: emptyList()
        val total = slots.size
        val filled = slots.count { it.isCovered }
        val open = maxOf(0, total - filled)
        val percent = if (total > 0) Math.round(filled.toFloat() * 100f / total.toFloat()) else 0
        val days = daysLeft(slots)
        val isActive = dto.status in listOf("published", "active", "paused")
        // No helper roster in `/:id` — proxy the count from covered slots.
        val helpers = filled.toString()

        return ManageTrainContent(
            trainId = dto.id,
            title = dto.title ?: dto.recipientSummary ?: "Support train",
            dateRangeLabel = dateRangeLabel(slots),
            isActive = isActive,
            slotFillValue = "$filled/$total",
            helpersValue = helpers,
            daysLeftValue = "${days}d",
            dropoutValue = "0",
            slotsFilled = filled,
            slotsOpen = open,
            slotsDropout = 0,
            slotsTotal = total,
            slotFillCaption = "$filled / $total · $percent%",
            draftMessage = "",
            audienceChips = listOf(AudienceChipContent(id = "all", label = "All helpers", count = helpers)),
            selectedAudienceId = "all",
            pushToPhones = true,
            organizeRows = defaultOrganizeRows(total),
            closeRow = defaultCloseRow(),
            close =
                CloseTrainSheetContent(
                    daysEarlyLabel = "Locks new signups · $days days early",
                    mealsDelivered = "$filled",
                    neighborsHelped = helpers,
                    coverageDays = "${days}d",
                    recipientQuote = dto.story ?: "",
                ),
            status = dto.status ?: "",
            viewerRole = SupportTrainDetailProjection.viewerRole(dto),
        )
    }

    private fun defaultOrganizeRows(slotsTotal: Int): List<OrganizeRowContent> =
        listOf(
            OrganizeRowContent(
                id = "edit-dates",
                icon = PantopusIcon.CalendarCog,
                tone = OrganizeRowTone.AMBER,
                label = "Edit dates & slots",
                meta = "$slotsTotal",
                sub = "Add, swap, or remove cooking days. Helpers see live changes.",
                isDestructive = false,
            ),
            OrganizeRowContent(
                id = "invite",
                icon = PantopusIcon.UserPlus,
                tone = OrganizeRowTone.SKY,
                label = "Invite more helpers",
                meta = null,
                sub = "Share a link or pick from neighbors who follow this train.",
                isDestructive = false,
            ),
            OrganizeRowContent(
                id = "analytics",
                icon = PantopusIcon.BarChart3,
                tone = OrganizeRowTone.GREEN,
                label = "Analytics",
                meta = null,
                sub = "Fill rate, response time, top contributors.",
                isDestructive = false,
            ),
        )

    private fun defaultCloseRow(): OrganizeRowContent =
        OrganizeRowContent(
            id = "close",
            icon = PantopusIcon.Archive,
            tone = OrganizeRowTone.RED,
            label = "Close train",
            meta = null,
            sub = "Lock new signups and send a thank-you to everyone.",
            isDestructive = true,
        )

    private fun dateRangeLabel(slots: List<SupportTrainSlotDto>): String {
        val dates = slots.mapNotNull { parseDate(it.slotDate) }
        val min = dates.minByOrNull { it.time } ?: return ""
        val max = dates.maxByOrNull { it.time } ?: return ""
        return "${format(min)} → ${format(max)} · ${slots.size} days"
    }

    private fun daysLeft(slots: List<SupportTrainSlotDto>): Int {
        val max = slots.mapNotNull { parseDate(it.slotDate) }.maxByOrNull { it.time } ?: return 0
        val diff = ((max.time - startOfTodayUtc().time) / MILLIS_PER_DAY).toInt()
        return maxOf(0, diff)
    }

    private fun parseDate(value: String?): Date? {
        if (value == null) return null
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
        return runCatching { fmt.parse(value.take(10)) }.getOrNull()
    }

    private fun format(date: Date): String =
        SimpleDateFormat("MMM d", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(date)

    private fun startOfTodayUtc(): Date {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.time
    }
}
