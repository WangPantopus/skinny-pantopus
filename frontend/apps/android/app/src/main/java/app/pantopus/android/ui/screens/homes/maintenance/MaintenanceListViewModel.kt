@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.maintenance

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.MaintenanceTaskDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** Canonical chip status for a maintenance task. */
enum class MaintenanceChipStatus { Scheduled, DueSoon, Overdue, InProgress, Completed, Cancelled }

/** Tab identifiers — kept as strings so they survive the
 *  `ListOfRowsScreen` selectedTab contract. */
enum class MaintenanceTab(val id: String) {
    Scheduled("scheduled"),
    Completed("completed"),
    All("all"),
    ;

    companion object {
        fun fromId(id: String): MaintenanceTab = entries.firstOrNull { it.id == id } ?: Scheduled
    }
}

/**
 * Pure projection of one maintenance task into a row's display fields.
 * Tested directly via [MaintenanceListViewModel.project].
 */
data class MaintenanceRowProjection(
    val title: String,
    val subtitle: String,
    val amount: String,
    val chipText: String,
    val chipVariant: StatusChipVariant,
    val chipIcon: PantopusIcon?,
    val status: MaintenanceChipStatus,
    val category: MaintenanceCategory,
    val inlineChip: RowChip?,
    val highlight: RowHighlight?,
)

private data class MaintenanceProjectionStyle(
    val chipText: String,
    val chipVariant: StatusChipVariant,
    val chipIcon: PantopusIcon?,
    val inlineChip: RowChip?,
    val highlight: RowHighlight?,
)

/**
 * Banner data for the Maintenance summary banner.
 */
data class MaintenanceBannerSummary(
    val overdueCount: Int,
    val ytdSpendLabel: String?,
    val scheduledSubtitle: String?,
) {
    val hasContent: Boolean
        get() = overdueCount > 0 || ytdSpendLabel != null || scheduledSubtitle != null
}

/** Nav arg key for the Maintenance list route. */
const val MAINTENANCE_HOME_ID_KEY = "homeId"

/**
 * ViewModel for the per-home Maintenance list (T6.3b / P10).
 *
 * Mirrors the Bills T6.0a shape: wraps `GET /api/homes/:id/maintenance`,
 * projects each task into the `RowTrailing.AmountWithChip` template +
 * a category-tinted `RowLeading.TypeIcon`. The 3 tabs (Scheduled /
 * Completed / All) are client-side projections — backend accepts a
 * single `?status=` filter but the design wants tabs that cluster
 * multiple statuses.
 */
@HiltViewModel
class MaintenanceListViewModel
    internal constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
        private val clock: () -> Instant = Instant::now,
    ) : ViewModel() {
        @Inject
        constructor(
            repo: HomesRepository,
            savedStateHandle: SavedStateHandle,
        ) : this(repo, savedStateHandle, Instant::now)

        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(MAINTENANCE_HOME_ID_KEY)) {
                "MaintenanceListViewModel requires a $MAINTENANCE_HOME_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(MaintenanceTab.Scheduled.id)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _tabs = MutableStateFlow(initialTabs())
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        private var tasks: List<MaintenanceTaskDto>? = null
        private var onOpenTask: (String) -> Unit = {}
        private var onAddTask: () -> Unit = {}
        private var onOpenIssues: (() -> Unit)? = null

        fun configureNavigation(
            onOpenTask: (String) -> Unit = {},
            onAddTask: () -> Unit = {},
            onOpenIssues: (() -> Unit)? = null,
        ) {
            this.onOpenTask = onOpenTask
            this.onAddTask = onAddTask
            this.onOpenIssues = onOpenIssues
        }

        fun load() {
            refresh()
        }

        fun refresh() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getHomeMaintenance(homeId)) {
                    is NetworkResult.Success -> applySuccess(result.data.tasks)
                    is NetworkResult.Failure -> {
                        tasks = null
                        _banner.value = null
                        _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                    }
                }
            }
        }

        fun selectTab(id: String) {
            _selectedTab.value = id
            tasks?.let(::renderForCurrentTab)
        }

        fun fab(): FabAction =
            FabAction(
                icon = PantopusIcon.Plus,
                contentDescription = "Log maintenance",
                variant = FabVariant.CanonicalCreate,
                tint = FabTint.Home,
                onClick = { onAddTask() },
            )

        /**
         * Trailing top-bar action routes to the per-home **issue tracker**
         * (`/api/homes/:id/issues`) — a different backend collection from
         * the maintenance-task log this screen renders. RN files both
         * under "Maintenance", so this is the least-surprising place to
         * reach it. Null when the host didn't wire `onOpenIssues`.
         */
        val topBarAction: TopBarAction?
            get() =
                onOpenIssues?.let { open ->
                    TopBarAction(
                        icon = PantopusIcon.AlertCircle,
                        contentDescription = "Home issues",
                        onClick = open,
                    )
                }

        fun currentBannerSummary(): MaintenanceBannerSummary {
            val loaded = tasks ?: return MaintenanceBannerSummary(0, null, null)
            return summarize(loaded, clock())
        }

        private fun applySuccess(loaded: List<MaintenanceTaskDto>) {
            tasks = loaded
            _tabs.value = tabsWithCounts(loaded)
            renderForCurrentTab(loaded)
        }

        private fun renderForCurrentTab(loaded: List<MaintenanceTaskDto>) {
            val now = clock()
            val tab = MaintenanceTab.fromId(_selectedTab.value)
            val active = loaded.filter { passes(it, tab, now) }
            if (active.isEmpty()) {
                _banner.value = null
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Hammer,
                        headline = "No maintenance logged yet",
                        subcopy =
                            "Track HVAC tune-ups, gutter cleans, filter swaps and " +
                                "inspections. Build a service history that protects warranties " +
                                "and resale value.",
                        ctaTitle = "Log maintenance",
                        onCta = { onAddTask() },
                    )
                return
            }
            val rows = active.map { rowFor(it, now) }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "maintenance", rows = rows)),
                    hasMore = false,
                )
            _banner.value = bannerFor(tab, loaded, now)
        }

        private fun bannerFor(
            tab: MaintenanceTab,
            loaded: List<MaintenanceTaskDto>,
            now: Instant,
        ): BannerConfig? {
            if (tab != MaintenanceTab.Scheduled) return null
            val summary = summarize(loaded, now)
            if (!summary.hasContent) return null
            return BannerConfig(
                icon = PantopusIcon.Hammer,
                title = bannerTitle(summary),
                subtitle = bannerSubtitle(summary),
                tint = BannerCtaTint.Home,
            )
        }

        private fun bannerTitle(summary: MaintenanceBannerSummary): String = summary.scheduledSubtitle ?: "Maintenance"

        private fun bannerSubtitle(summary: MaintenanceBannerSummary): String? {
            if (summary.overdueCount > 0) {
                val label =
                    if (summary.overdueCount == 1) "1 overdue" else "${summary.overdueCount} overdue"
                return summary.ytdSpendLabel?.let { "$label · $it spent YTD" } ?: label
            }
            return summary.ytdSpendLabel?.let { "$it spent YTD · all current" } ?: "All current"
        }

        private fun rowFor(
            task: MaintenanceTaskDto,
            now: Instant,
        ): RowModel {
            val projection = project(task, now)
            val category = projection.category
            return RowModel(
                id = task.id,
                title = projection.title,
                subtitle = projection.subtitle,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.TypeIcon(
                        icon = category.icon,
                        background = category.background,
                        foreground = category.foreground,
                    ),
                trailing =
                    RowTrailing.AmountWithChip(
                        amount = projection.amount,
                        chipText = projection.chipText,
                        chipVariant = projection.chipVariant,
                        chipIcon = projection.chipIcon,
                    ),
                onTap = { onOpenTask(task.id) },
                inlineChip = projection.inlineChip,
                highlight = projection.highlight,
            )
        }

        private fun passes(
            task: MaintenanceTaskDto,
            tab: MaintenanceTab,
            now: Instant,
        ): Boolean {
            val chip = chipStatus(task, now)
            return when (tab) {
                MaintenanceTab.Scheduled ->
                    chip != MaintenanceChipStatus.Completed && chip != MaintenanceChipStatus.Cancelled
                MaintenanceTab.Completed -> chip == MaintenanceChipStatus.Completed
                MaintenanceTab.All -> chip != MaintenanceChipStatus.Cancelled
            }
        }

        private fun tabsWithCounts(loaded: List<MaintenanceTaskDto>): List<ListOfRowsTab> {
            val now = clock()
            var scheduled = 0
            var completed = 0
            var all = 0
            for (t in loaded) {
                val chip = chipStatus(t, now)
                if (chip == MaintenanceChipStatus.Cancelled) continue
                all += 1
                if (chip == MaintenanceChipStatus.Completed) {
                    completed += 1
                } else {
                    scheduled += 1
                }
            }
            return listOf(
                ListOfRowsTab(MaintenanceTab.Scheduled.id, "Scheduled", scheduled),
                ListOfRowsTab(MaintenanceTab.Completed.id, "Completed", completed),
                ListOfRowsTab(MaintenanceTab.All.id, "All", all),
            )
        }

        private fun initialTabs(): List<ListOfRowsTab> =
            listOf(
                ListOfRowsTab(MaintenanceTab.Scheduled.id, "Scheduled"),
                ListOfRowsTab(MaintenanceTab.Completed.id, "Completed"),
                ListOfRowsTab(MaintenanceTab.All.id, "All"),
            )

        companion object {
            /** Pure projection — pure mapping from a task + clock to display strings. */
            @JvmStatic
            fun project(
                task: MaintenanceTaskDto,
                now: Instant,
            ): MaintenanceRowProjection {
                val chip = chipStatus(task, now)
                val category = MaintenanceCategory.from(task.task)
                val title = if (task.task.isEmpty()) category.label else task.task
                val amount = formatCost(task.cost)
                val dueShort = formatDateShort(task.dueDate)
                val recurrenceLabel = recurrenceLabel(task.recurrence)
                val vendorLine = vendorSubtitle(task.vendor, recurrenceLabel)
                val style = projectionStyle(chip, dueShort)
                return MaintenanceRowProjection(
                    title = title,
                    subtitle = vendorLine,
                    amount = amount,
                    chipText = style.chipText,
                    chipVariant = style.chipVariant,
                    chipIcon = style.chipIcon,
                    status = chip,
                    category = category,
                    inlineChip = style.inlineChip,
                    highlight = style.highlight,
                )
            }

            private fun projectionStyle(
                chip: MaintenanceChipStatus,
                dueShort: String?,
            ): MaintenanceProjectionStyle =
                when (chip) {
                    MaintenanceChipStatus.Completed ->
                        MaintenanceProjectionStyle(
                            chipText = "Completed",
                            chipVariant = StatusChipVariant.Success,
                            chipIcon = PantopusIcon.Check,
                            inlineChip = null,
                            highlight = null,
                        )
                    MaintenanceChipStatus.Cancelled ->
                        MaintenanceProjectionStyle(
                            chipText = "Cancelled",
                            chipVariant = StatusChipVariant.Neutral,
                            chipIcon = PantopusIcon.X,
                            inlineChip = null,
                            highlight = RowHighlight.Muted,
                        )
                    MaintenanceChipStatus.Overdue ->
                        MaintenanceProjectionStyle(
                            chipText = "Overdue",
                            chipVariant = StatusChipVariant.ErrorVariant,
                            chipIcon = PantopusIcon.AlertCircle,
                            inlineChip =
                                dueShort?.let {
                                    RowChip(
                                        text = "Was due $it",
                                        icon = PantopusIcon.Clock,
                                        tint = RowChip.Tint.Status(StatusChipVariant.ErrorVariant),
                                    )
                                },
                            highlight = null,
                        )
                    MaintenanceChipStatus.DueSoon ->
                        MaintenanceProjectionStyle(
                            chipText = "Due soon",
                            chipVariant = StatusChipVariant.Warning,
                            chipIcon = PantopusIcon.Clock,
                            inlineChip =
                                dueShort?.let {
                                    RowChip(
                                        text = it,
                                        icon = PantopusIcon.Calendar,
                                        tint = RowChip.Tint.Status(StatusChipVariant.Warning),
                                    )
                                },
                            highlight = null,
                        )
                    MaintenanceChipStatus.InProgress ->
                        MaintenanceProjectionStyle(
                            chipText = "In progress",
                            chipVariant = StatusChipVariant.Info,
                            chipIcon = PantopusIcon.Hammer,
                            inlineChip = null,
                            highlight = null,
                        )
                    MaintenanceChipStatus.Scheduled ->
                        MaintenanceProjectionStyle(
                            chipText = "Scheduled",
                            chipVariant = StatusChipVariant.Info,
                            chipIcon = PantopusIcon.Calendar,
                            inlineChip =
                                dueShort?.let {
                                    RowChip(
                                        text = it,
                                        icon = PantopusIcon.Calendar,
                                        tint = RowChip.Tint.Status(StatusChipVariant.Info),
                                    )
                                },
                            highlight = null,
                        )
                }

            /** Derive the chip status:
             *   - [Cancelled]  when status is "cancelled"
             *   - [Completed]  when status is "completed"
             *   - [InProgress] when status is "in_progress"
             *   - [Overdue]    when status is "scheduled" + due_date < now
             *   - [DueSoon]    when status is "scheduled" + due within 7d
             *   - [Scheduled]  otherwise. */
            @JvmStatic
            fun chipStatus(
                task: MaintenanceTaskDto,
                now: Instant,
            ): MaintenanceChipStatus {
                val due = task.dueDate?.let(::parseInstant)
                val sevenDaysOut = now.plus(Duration.ofDays(7))
                return when {
                    task.status == "cancelled" -> MaintenanceChipStatus.Cancelled
                    task.status == "completed" -> MaintenanceChipStatus.Completed
                    task.status == "in_progress" -> MaintenanceChipStatus.InProgress
                    due?.isBefore(now) == true -> MaintenanceChipStatus.Overdue
                    due != null && !due.isAfter(sevenDaysOut) -> MaintenanceChipStatus.DueSoon
                    else -> MaintenanceChipStatus.Scheduled
                }
            }

            /** Pure summary projection. Public-static for tests. */
            @JvmStatic
            fun summarize(
                tasks: List<MaintenanceTaskDto>,
                now: Instant,
            ): MaintenanceBannerSummary {
                val utc = ZoneId.of("UTC")
                val yearStart =
                    now
                        .atZone(utc)
                        .toLocalDate()
                        .withDayOfYear(1)
                        .atStartOfDay(utc)
                        .toInstant()
                var overdueCount = 0
                var scheduledCount = 0
                var ytdSpend = BigDecimal.ZERO
                var nextDue: Pair<Instant, MaintenanceTaskDto>? = null
                for (task in tasks) {
                    val chip = chipStatus(task, now)
                    when (chip) {
                        MaintenanceChipStatus.Overdue -> {
                            overdueCount += 1
                            scheduledCount += 1
                            nextDue = nextDueCandidate(nextDue, task, now, allowPast = true)
                        }
                        MaintenanceChipStatus.Scheduled,
                        MaintenanceChipStatus.DueSoon,
                        MaintenanceChipStatus.InProgress,
                        -> {
                            scheduledCount += 1
                            nextDue = nextDueCandidate(nextDue, task, now)
                        }
                        MaintenanceChipStatus.Completed -> {
                            ytdCost(task, yearStart)?.let { ytdSpend = ytdSpend.add(it) }
                        }
                        MaintenanceChipStatus.Cancelled -> Unit
                    }
                }
                val ytdLabel = if (ytdSpend > BigDecimal.ZERO) formatCurrency(ytdSpend) else null
                val scheduledSubtitle = scheduledSubtitle(scheduledCount, nextDue, now)
                return MaintenanceBannerSummary(
                    overdueCount = overdueCount,
                    ytdSpendLabel = ytdLabel,
                    scheduledSubtitle = scheduledSubtitle,
                )
            }

            private fun nextDueCandidate(
                current: Pair<Instant, MaintenanceTaskDto>?,
                task: MaintenanceTaskDto,
                now: Instant,
                allowPast: Boolean = false,
            ): Pair<Instant, MaintenanceTaskDto>? {
                val due = task.dueDate?.let(::parseInstant) ?: return current
                if (!allowPast && due.isBefore(now)) return current
                return earlierDueCandidate(current, due, task)
            }

            private fun earlierDueCandidate(
                current: Pair<Instant, MaintenanceTaskDto>?,
                due: Instant,
                task: MaintenanceTaskDto,
            ): Pair<Instant, MaintenanceTaskDto> =
                when {
                    current == null -> due to task
                    due.isBefore(current.first) -> due to task
                    else -> current
                }

            private fun ytdCost(
                task: MaintenanceTaskDto,
                yearStart: Instant,
            ): BigDecimal? {
                val cost = task.cost ?: return null
                val performedAt =
                    task.updatedAt?.let(::parseInstant)
                        ?: task.createdAt?.let(::parseInstant)
                        ?: return null
                return if (!performedAt.isBefore(yearStart)) cost else null
            }

            private fun scheduledSubtitle(
                scheduledCount: Int,
                nextDue: Pair<Instant, MaintenanceTaskDto>?,
                now: Instant,
            ): String? {
                if (scheduledCount == 0) return null
                val prefix = scheduledCountLabel(scheduledCount)
                val due = nextDue ?: return prefix
                val title = if (due.second.task.isEmpty()) "next task" else due.second.task
                val days = Duration.between(now, due.first).toDays().toInt()
                val whenLabel =
                    when {
                        days < 0 -> "overdue"
                        days == 0 -> "today"
                        days == 1 -> "tomorrow"
                        else -> "in $days days"
                    }
                return "$prefix · $title $whenLabel"
            }

            private fun scheduledCountLabel(count: Int): String = if (count == 1) "1 scheduled" else "$count scheduled"

            @JvmStatic
            fun formatCurrency(amount: BigDecimal): String =
                NumberFormat.getCurrencyInstance(Locale.US).apply {
                    maximumFractionDigits = 0
                    minimumFractionDigits = 0
                }.format(amount)

            private fun formatCost(cost: BigDecimal?): String {
                if (cost == null) return "—"
                if (cost.signum() == 0) return "DIY"
                return formatCurrency(cost)
            }

            @JvmStatic
            fun formatDateShort(iso: String?): String? {
                if (iso.isNullOrBlank()) return null
                val instant = parseInstant(iso) ?: return null
                val local = instant.atZone(ZoneId.of("UTC"))
                return DateTimeFormatter.ofPattern("MMM d", Locale.US).format(local)
            }

            private fun parseInstant(iso: String): Instant? =
                runCatching { Instant.parse(iso) }
                    .recoverCatching {
                        DateTimeFormatter
                            .ofPattern("yyyy-MM-dd")
                            .parse(iso, LocalDate::from)
                            .atStartOfDay(ZoneId.of("UTC"))
                            .toInstant()
                    }.getOrNull()

            private fun recurrenceLabel(recurrence: String): String? =
                when (recurrence) {
                    "one_time" -> null
                    "weekly" -> "Weekly"
                    "monthly" -> "Monthly"
                    "quarterly" -> "Quarterly"
                    "yearly" -> "Yearly"
                    else -> null
                }

            private fun vendorSubtitle(
                vendor: String?,
                recurrence: String?,
            ): String {
                val vendorPart = if (vendor.isNullOrEmpty()) "Self-managed" else vendor
                return recurrence?.let { "$vendorPart · $it" } ?: vendorPart
            }
        }
    }
