package app.pantopus.android.ui.screens.homes

import app.pantopus.android.data.api.models.homedashboard.HomeDashboardCountsDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardResponse
import app.pantopus.android.data.api.models.homedashboard.HomeHealthScoreDto
import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.ui.screens.shared.content_detail.GridTabsTab
import app.pantopus.android.ui.screens.shared.content_detail.HomeHeroStat
import app.pantopus.android.ui.screens.shared.content_detail.QuickActionTile
import app.pantopus.android.ui.screens.shared.content_detail.QuickActionTone
import app.pantopus.android.ui.theme.PantopusIcon
import java.math.BigDecimal
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Currency
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Pure mapping from `GET /api/homes/:id/dashboard`
 * (`backend/routes/home.js:6224`) onto the Home dashboard's hero stats,
 * quick-action tiles, and Overview sections. No fixtures — every value
 * traces back to a field on the aggregate response.
 *
 * Mirrors iOS `Features/Homes/HomeDashboardProjection.swift`.
 */
@Suppress("TooManyFunctions")
object HomeDashboardProjection {
    /**
     * Grid-tab strip — static chrome, identical on iOS. This is the
     * ungated superset; [gatedTabs] applies the per-home permission
     * filter.
     */
    val tabs: List<GridTabsTab> =
        listOf(
            GridTabsTab("overview", "Overview"),
            GridTabsTab("tasks", "Tasks"),
            GridTabsTab("bills", "Bills"),
            GridTabsTab("packages", "Packages"),
            GridTabsTab("members", "Members"),
            GridTabsTab("ownership", "Ownership"),
        )

    /**
     * Permission-gated tab strip. Mirrors RN's
     * `src/app/homes/[id]/dashboard.tsx:169-176`, which gates on the five
     * navigation booleans from `GET /api/homes/:id/me`
     * (`backend/routes/homeIam.js:51`) and never on role strings.
     * A null access record (403 / offline) leaves the strip ungated so a
     * failed side-read can't blank the screen — the same fallback RN
     * takes at `src/app/homes/[id]/index.tsx:124`.
     */
    fun gatedTabs(access: HomeAccessDto?): List<GridTabsTab> {
        if (access == null) return tabs
        return tabs.filter { tab ->
            when (tab.id) {
                "tasks" -> access.canManageTasks
                "bills" -> access.canManageFinance
                "members" -> access.canManageAccess
                "ownership" -> access.isOwner || access.canManageHome
                else -> true
            }
        }
    }

    /** Maximum "Upcoming" rows, matching iOS. */
    private const val UPCOMING_LIMIT = 5
    private const val MILLION = 1_000_000
    private const val THOUSAND = 1_000
    private const val PERCENT = 100
    private const val CENTS_PER_DOLLAR = 100.0
    private const val MINUTE_SECONDS = 60L
    private const val HOUR_SECONDS = 3_600L
    private const val DAY_SECONDS = 86_400L
    private const val WEEK_SECONDS = 604_800L
    private const val WEEK_DAYS = 7L

    // ── Hero stats ──────────────────────────────────────────────────

    /**
     * Three-slot hero row. The backend aggregate has no access-code count,
     * so the middle slot carries `bills_due` (the design's "Access codes"
     * number has no server-side source).
     */
    fun stats(counts: HomeDashboardCountsDto?): List<HomeHeroStat> {
        val safe = counts ?: HomeDashboardCountsDto()
        return listOf(
            HomeHeroStat("packages", safe.packagesExpected.toString(), "Packages"),
            HomeHeroStat("bills", safe.billsDue.toString(), "Bills"),
            HomeHeroStat("tasks", safe.tasksOpen.toString(), "Tasks"),
        )
    }

    // ── Quick actions ───────────────────────────────────────────────

    /**
     * Quick-action tiles, permission-gated the same way RN gates its
     * dashboard cards (`src/app/homes/[id]/index.tsx:324`, `:353`,
     * `:374`) using the IAM permission strings from
     * `GET /api/homes/:id/me`. A null access record leaves every tile in
     * place — RN's `can()` also falls through to "allow" when it has no
     * permission list to test.
     */
    fun quickActions(
        counts: HomeDashboardCountsDto?,
        access: HomeAccessDto? = null,
    ): List<QuickActionTile> {
        val safe = counts ?: HomeDashboardCountsDto()

        fun allowed(permission: String): Boolean = access?.can(permission) ?: true
        return buildList {
            if (allowed("tasks.view")) {
                add(tile("view_tasks", "Tasks", PantopusIcon.ListChecks, QuickActionTone.Warning, safe.tasksOpen))
            }
            if (allowed("finance.view")) {
                add(tile("view_bills", "Bills", PantopusIcon.Receipt, QuickActionTone.Error, safe.billsDue))
            }
            if (allowed("mailbox.view")) {
                add(
                    tile(
                        "view_packages",
                        "Packages",
                        PantopusIcon.Package,
                        QuickActionTone.Business,
                        safe.packagesExpected,
                    ),
                )
            }
            add(
                tile(
                    "add_member",
                    "Members",
                    PantopusIcon.Users,
                    QuickActionTone.Home,
                    safe.membersActive,
                    showsBadge = false,
                ),
            )
        }
    }

    @Suppress("LongParameterList")
    private fun tile(
        id: String,
        label: String,
        icon: PantopusIcon,
        tone: QuickActionTone,
        count: Int,
        showsBadge: Boolean = true,
    ): QuickActionTile =
        QuickActionTile(
            id = id,
            label = label,
            icon = icon,
            tone = if (count > 0) tone else QuickActionTone.Home,
            badge = if (showsBadge && count > 0) count.toString() else null,
            isMuted = count == 0,
        )

    // ── Overview ────────────────────────────────────────────────────

    fun overview(
        dashboard: HomeDashboardResponse?,
        health: HomeHealthScoreDto?,
    ): HomeDashboardOverviewContent =
        HomeDashboardOverviewContent(
            upcoming = upcoming(dashboard),
            activity = activity(dashboard),
            emergency = emergency(health),
        )

    fun upcoming(dashboard: HomeDashboardResponse?): List<HomeDashboardTimelineItem> {
        val today = dashboard?.today ?: return emptyList()
        val items = mutableListOf<HomeDashboardTimelineItem>()

        today.nextBill?.let { bill ->
            items +=
                HomeDashboardTimelineItem(
                    id = "bill-${bill.id}",
                    icon = PantopusIcon.Receipt,
                    tone = QuickActionTone.Error,
                    title = "${billLabel(bill)} bill due",
                    subtitle = currency(bill.displayAmount, bill.currency),
                    trailing = whenLabel(bill.dueDate),
                )
        }

        today.nextEvents.forEach { event ->
            items +=
                HomeDashboardTimelineItem(
                    id = "event-${event.id}",
                    icon = PantopusIcon.Calendar,
                    tone = QuickActionTone.Personal,
                    title = event.title,
                    subtitle =
                        firstNonEmpty(event.locationNotes, event.description, humanized(event.eventType))
                            ?: "Calendar event",
                    trailing = whenLabel(event.startAt),
                )
        }

        today.tasksDue.forEach { task ->
            items +=
                HomeDashboardTimelineItem(
                    id = "task-${task.id}",
                    icon = PantopusIcon.ListChecks,
                    tone = QuickActionTone.Warning,
                    title = task.title,
                    subtitle = firstNonEmpty(task.description, humanized(task.taskType)) ?: "Household task",
                    trailing = whenLabel(task.dueAt),
                )
        }

        if (today.deliveriesArriving > 0) {
            val count = today.deliveriesArriving
            items +=
                HomeDashboardTimelineItem(
                    id = "deliveries",
                    icon = PantopusIcon.Package,
                    tone = QuickActionTone.Business,
                    title = if (count == 1) "1 package on the way" else "$count packages on the way",
                    subtitle = "Ordered, shipped, or out for delivery",
                    trailing = null,
                )
        }

        return items.take(UPCOMING_LIMIT)
    }

    fun activity(dashboard: HomeDashboardResponse?): List<HomeDashboardActivityItem> {
        if (dashboard == null) return emptyList()
        val namesByUserId =
            dashboard.members
                .mapNotNull { member ->
                    val id = member.user?.id ?: member.userId ?: return@mapNotNull null
                    val name = firstNonEmpty(member.user?.name, member.user?.username) ?: return@mapNotNull null
                    id to name
                }
                .toMap()

        return dashboard.recentActivity.mapIndexed { index, entry ->
            val actorName = entry.actorUserId?.let { namesByUserId[it] }
            val phrase = humanized(entry.action) ?: entry.action
            HomeDashboardActivityItem(
                id = entry.id,
                initials = initials(actorName),
                tone = if (index % 2 == 0) QuickActionTone.Personal else QuickActionTone.Home,
                title = actorName?.let { "$it: $phrase" } ?: phrase,
                detail = humanized(entry.targetType) ?: "Home activity",
                time = relativeTime(entry.createdAt).orEmpty(),
            )
        }
    }

    /**
     * The aggregate has no emergency block, so the configured flag comes
     * from the health score's `emergency` dimension
     * (`backend/services/homeHealthService.js:83` — score 0 means "no
     * emergency contacts set").
     */
    fun emergency(health: HomeHealthScoreDto?): HomeDashboardEmergencyInfo {
        val configured = (health?.breakdown?.get("emergency")?.score ?: 0) > 0
        return HomeDashboardEmergencyInfo(
            title = "Emergency info",
            body =
                if (configured) {
                    "Tap to access shut-off valves, landlord contacts, insurance."
                } else {
                    "Add shut-off valves, landlord contacts, insurance - for when it matters."
                },
            isConfigured = configured,
        )
    }

    // ── Formatting ──────────────────────────────────────────────────

    fun billLabel(bill: BillDto): String = firstNonEmpty(bill.providerName, humanized(bill.billType)) ?: "Utility"

    fun currency(
        amount: BigDecimal,
        code: String?,
    ): String {
        val formatter = NumberFormat.getCurrencyInstance(Locale.US)
        runCatching { formatter.currency = Currency.getInstance(code ?: "USD") }
        return formatter.format(amount)
    }

    /** Compact money for the property-value card ("$1.2M" / "$940K"). */
    fun compactCurrency(value: Double): String =
        when {
            value >= MILLION -> String.format(Locale.US, "$%.1fM", value / MILLION)
            value >= THOUSAND -> "$${(value / THOUSAND).roundToInt()}K"
            else -> fullCurrency(value)
        }

    fun fullCurrency(value: Double): String {
        val formatter = NumberFormat.getCurrencyInstance(Locale.US)
        formatter.maximumFractionDigits = 0
        return formatter.format(value)
    }

    fun monthYear(iso: String?): String? =
        parseInstant(iso)?.let {
            DateTimeFormatter
                .ofPattern("MMMM yyyy", Locale.US)
                .format(ZonedDateTime.ofInstant(it, ZoneId.systemDefault()))
        }

    /** "Overdue" / "Today 4 PM" / "Tomorrow" / "Fri" / "Mar 3". */
    fun whenLabel(iso: String?): String? {
        val instant = parseInstant(iso) ?: return null
        val zoned = ZonedDateTime.ofInstant(instant, ZoneId.systemDefault())
        val now = ZonedDateTime.now(ZoneId.systemDefault())
        val isToday = zoned.toLocalDate() == now.toLocalDate()
        val days = ChronoUnit.DAYS.between(now.toLocalDate(), zoned.toLocalDate())
        return when {
            zoned.isBefore(now) && !isToday -> "Overdue"
            isToday -> "Today ${DateTimeFormatter.ofPattern("h a", Locale.US).format(zoned)}"
            days == 1L -> "Tomorrow"
            days < WEEK_DAYS -> DateTimeFormatter.ofPattern("EEE", Locale.US).format(zoned)
            else -> DateTimeFormatter.ofPattern("MMM d", Locale.US).format(zoned)
        }
    }

    fun relativeTime(iso: String?): String? {
        val instant = parseInstant(iso) ?: return null
        val elapsed = Instant.now().epochSecond - instant.epochSecond
        return when {
            elapsed < MINUTE_SECONDS -> "just now"
            elapsed < HOUR_SECONDS -> "${elapsed / MINUTE_SECONDS}m ago"
            elapsed < DAY_SECONDS -> "${elapsed / HOUR_SECONDS}h ago"
            elapsed < WEEK_SECONDS -> "${elapsed / DAY_SECONDS}d ago"
            else -> "${elapsed / WEEK_SECONDS}w ago"
        }
    }

    fun parseInstant(iso: String?): Instant? {
        if (iso.isNullOrEmpty()) return null
        return runCatching { Instant.parse(iso) }.getOrNull()
            ?: runCatching { ZonedDateTime.parse(iso).toInstant() }.getOrNull()
            ?: runCatching {
                LocalDate
                    .parse(iso)
                    .atStartOfDay(ZoneId.systemDefault())
                    .toInstant()
            }.getOrNull()
    }

    /** `guest_pass_created` / `pet.create` → "Guest pass created". */
    fun humanized(raw: String?): String? {
        if (raw.isNullOrEmpty()) return null
        val spaced = raw.replace('_', ' ').replace('.', ' ').trim()
        if (spaced.isEmpty()) return null
        return spaced.replaceFirstChar { it.uppercase(Locale.US) }
    }

    fun initials(name: String?): String {
        if (name.isNullOrEmpty()) return "PA"
        val joined =
            name
                .split(" ")
                .take(2)
                .mapNotNull { it.firstOrNull()?.toString() }
                .joinToString("")
                .uppercase(Locale.US)
        return joined.ifEmpty { "PA" }
    }

    fun firstNonEmpty(vararg candidates: String?): String? = candidates.firstOrNull { !it.isNullOrBlank() }

    /** Percentage recomputed the same way the backend does (`home.js:7526`). */
    fun percentage(
        completed: Int,
        total: Int,
    ): Int = if (total == 0) 0 else (completed.toDouble() / total * PERCENT).roundToInt()

    /** `avg_amount_cents` → dollars for the bill-trend benchmark copy. */
    fun centsToDollars(cents: Double): Double = cents / CENTS_PER_DOLLAR
}
