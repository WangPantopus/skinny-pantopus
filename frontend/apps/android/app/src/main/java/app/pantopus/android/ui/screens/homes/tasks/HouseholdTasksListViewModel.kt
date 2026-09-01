@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.UpdateHomeTaskRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.ui.components.IdentityPillar
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
import app.pantopus.android.ui.screens.shared.list_of_rows.RowIconAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject

/**
 * Canonical chip status for one household task. Reduces the backend's
 * 4-state `status` column to the 3 buckets the design surfaces.
 */
enum class HouseholdTaskChipStatus { Active, Done, Canceled }

/** Tab identifiers — kept as strings so they survive the
 *  `ListOfRowsScreen` selectedTab contract. */
enum class HouseholdTasksTab(val id: String) {
    Active("active"),
    Done("done"),
    Recurring("recurring"),
    ;

    companion object {
        fun fromId(id: String): HouseholdTasksTab = entries.firstOrNull { it.id == id } ?: Active
    }
}

/**
 * Banner data for the Active-tab summary banner. Pure projection from
 * the loaded tasks + clock — exposed as a top-level value so tests can
 * exercise it without standing the VM up.
 */
data class HouseholdTasksBannerSummary(
    val dueTodayCount: Int,
    val overdueCount: Int,
) {
    /**
     * Whether the banner has anything to render. The Active tab hides
     * the banner when this returns `false` so a fresh household with
     * only future-dated chores doesn't carry a "0 due today" preamble.
     */
    val hasContent: Boolean
        get() = dueTodayCount > 0 || overdueCount > 0
}

/**
 * Pure projection of one task into a row's display fields. Tested
 * directly via [HouseholdTasksListViewModel.project].
 */
data class HouseholdTaskRowProjection(
    val title: String,
    val subtitle: String,
    val chipText: String?,
    val chipVariant: StatusChipVariant?,
    val chipIcon: PantopusIcon?,
    val recurrenceChip: String?,
    val category: HouseholdTaskCategory,
    val isAssigned: Boolean,
    val assigneeLabel: String?,
    val highlight: RowHighlight?,
)

/**
 * One-shot event the screen turns into a confirm dialog. The VM never
 * presents UI itself — same contract as `MyHomesListEvent`.
 */
sealed interface HouseholdTasksListEvent {
    /**
     * The row's trash affordance was tapped — the screen opens the
     * destructive confirm naming [title].
     */
    data class ConfirmDelete(
        val taskId: String,
        val title: String,
    ) : HouseholdTasksListEvent
}

/** Nav arg key for the Household tasks list route. */
const val HOUSEHOLD_TASKS_HOME_ID_KEY = "homeId"

/**
 * ViewModel for the Household tasks list (T6.3c / P11). Wraps
 * `GET /api/homes/:id/tasks` and projects each task into the shared
 * `ListOfRowsScreen` archetype with three tabs (Active / Done /
 * Recurring) tinted in the home pillar.
 *
 * Distinct from `MyTasksViewModel` (T5.3.2) which lists the user's
 * posted-to-neighbours gigs reached via `me.gigs`. This is the
 * PER-HOME chore list — internal "who's vacuuming, taking out the
 * trash, walking the dog" — reached via `me.tasks` and the Home
 * Dashboard "Tasks" quick-action tile.
 *
 * Design contract (see `householdtasks-frames.jsx`):
 *  - Three tabs with live counts:
 *      - Active    = status in {open, in_progress}
 *      - Done      = status == 'done' (rolling 30-day window)
 *      - Recurring = recurrence_rule != null
 *  - Active rows render a home-tinted summary banner (`N due today`
 *    + overdue count) above the list when there's anything to say.
 *  - 52dp `SecondaryCreate` FAB tinted [FabTint.Home] per the brief.
 *  - Category-tinted leading tile ([HouseholdTaskCategory] palette)
 *    shown when the task is unassigned; [RowLeading.Avatar] shown with
 *    the home identity ring when an assignee is set.
 *  - Active trailing = round-checkbox [RowTrailing.CircularAction]
 *    that optimistically toggles to Done.
 *  - Done trailing = success status chip; "Done by … · …" surfaces
 *    in the subtitle.
 *  - Recurring trailing = kebab; recurrence cadence surfaces in the
 *    inline chip.
 *
 * Backend deviation from prompt: the prompt specifies
 * `template_id != null` for the Recurring filter, but the live
 * `HomeTask` schema (`backend/database/schema.sql:6833`) has no
 * `template_id` column — recurrence is captured in the
 * `recurrence_rule` RRULE text field. The Recurring filter therefore
 * uses `recurrence_rule != null`, which is the canonical signal today.
 */
@HiltViewModel
class HouseholdTasksListViewModel
    internal constructor(
        private val repo: HomeTasksRepository,
        savedStateHandle: SavedStateHandle,
        private val clock: () -> Instant = Instant::now,
    ) : ViewModel() {
        @Inject
        constructor(
            repo: HomeTasksRepository,
            savedStateHandle: SavedStateHandle,
        ) : this(repo, savedStateHandle, Instant::now)

        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(HOUSEHOLD_TASKS_HOME_ID_KEY)) {
                "HouseholdTasksListViewModel requires a $HOUSEHOLD_TASKS_HOME_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(HouseholdTasksTab.Active.id)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _tabs = MutableStateFlow(initialTabs())
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        /**
         * Set when a row's trash affordance fires. The screen drains it
         * into an `AlertDialog` and calls [acknowledgeEvent].
         */
        private val _pendingEvent = MutableStateFlow<HouseholdTasksListEvent?>(null)
        val pendingEvent: StateFlow<HouseholdTasksListEvent?> = _pendingEvent.asStateFlow()

        /** Surfaced by the screen as an alert when a delete fails. */
        private val _actionError = MutableStateFlow<String?>(null)
        val actionError: StateFlow<String?> = _actionError.asStateFlow()

        private var tasks: List<HomeTaskDto>? = null
        private var onOpenTask: (String) -> Unit = {}
        private var onAddTask: () -> Unit = {}
        private var onEditRecurring: (String) -> Unit = {}

        fun configureNavigation(
            onOpenTask: (String) -> Unit = {},
            onAddTask: () -> Unit = {},
            onEditRecurring: (String) -> Unit = {},
        ) {
            this.onOpenTask = onOpenTask
            this.onAddTask = onAddTask
            this.onEditRecurring = onEditRecurring
        }

        fun load() {
            refresh()
        }

        fun refresh() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getHomeTasks(homeId)) {
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
                contentDescription = "Add a task",
                variant = FabVariant.SecondaryCreate,
                tint = FabTint.Home,
                onClick = { onAddTask() },
            )

        /**
         * T6.3c: top-bar action is `null` by design. The design's
         * filter glyph isn't wired to a real filter sheet yet; the 3
         * tabs cover the design's filter intent.
         */
        val topBarAction: TopBarAction? = null

        /**
         * Compute the banner summary for the currently-loaded tasks.
         * Exposed `internal` so tests can exercise it without going
         * through the Compose layer.
         */
        fun currentBannerSummary(): HouseholdTasksBannerSummary {
            val loaded = tasks ?: return HouseholdTasksBannerSummary(0, 0)
            return summarize(loaded, clock())
        }

        /**
         * Optimistic Active-tab "toggle done" — flips the row locally,
         * fires the PUT, rolls back on failure.
         */
        fun toggleDone(taskId: String) {
            val loaded = tasks ?: return
            val idx = loaded.indexOfFirst { it.id == taskId }
            if (idx < 0) return
            val original = loaded[idx]
            val newStatus = if (original.status == "done") "open" else "done"
            val completedAt = if (newStatus == "done") clock().toString() else null
            val updated =
                loaded
                    .toMutableList()
                    .apply {
                        this[idx] = original.copy(status = newStatus, completedAt = completedAt)
                    }
            tasks = updated
            _tabs.value = tabsWithCounts(updated)
            renderForCurrentTab(updated)
            viewModelScope.launch {
                val result =
                    repo.updateHomeTask(
                        homeId = homeId,
                        taskId = taskId,
                        request = UpdateHomeTaskRequest(status = newStatus, completedAt = completedAt),
                    )
                if (result is NetworkResult.Failure) {
                    // Roll back.
                    val rolled =
                        tasks
                            ?.toMutableList()
                            ?.apply {
                                val i = indexOfFirst { it.id == taskId }
                                if (i >= 0) this[i] = original
                            }
                    if (rolled != null) {
                        tasks = rolled
                        _tabs.value = tabsWithCounts(rolled)
                        renderForCurrentTab(rolled)
                    }
                }
            }
        }

        /**
         * Row trash tapped — hand the confirm to the screen. RN raises
         * the same confirm from the row's trash glyph
         * (`src/app/homes/[id]/tasks.tsx:76-84`).
         */
        fun requestDelete(taskId: String) {
            val task = tasks?.firstOrNull { it.id == taskId } ?: return
            _pendingEvent.value = HouseholdTasksListEvent.ConfirmDelete(taskId, task.title)
        }

        /** Clears [pendingEvent] once the screen has opened its dialog. */
        fun acknowledgeEvent() {
            _pendingEvent.value = null
        }

        /** Clears the delete-failure alert. */
        fun clearActionError() {
            _actionError.value = null
        }

        /**
         * `DELETE /api/homes/:id/tasks/:taskId` — route
         * `backend/routes/home.js:4354`. Optimistically drops the row,
         * then restores it (and surfaces [actionError]) if the server
         * refuses.
         */
        fun deleteTask(taskId: String) {
            val loaded = tasks ?: return
            val idx = loaded.indexOfFirst { it.id == taskId }
            if (idx < 0) return
            val original = loaded[idx]
            val pruned = loaded.toMutableList().apply { removeAt(idx) }
            tasks = pruned
            _tabs.value = tabsWithCounts(pruned)
            renderForCurrentTab(pruned)
            viewModelScope.launch {
                val result = repo.deleteHomeTask(homeId = homeId, taskId = taskId)
                if (result is NetworkResult.Failure) {
                    val rolled =
                        (tasks ?: emptyList())
                            .toMutableList()
                            .apply { add(idx.coerceAtMost(size), original) }
                    tasks = rolled
                    _tabs.value = tabsWithCounts(rolled)
                    renderForCurrentTab(rolled)
                    _actionError.value =
                        result.error.displayMessage("Couldn't delete that task. Try again.")
                }
            }
        }

        private fun applySuccess(loaded: List<HomeTaskDto>) {
            tasks = loaded
            _tabs.value = tabsWithCounts(loaded)
            renderForCurrentTab(loaded)
        }

        private fun renderForCurrentTab(loaded: List<HomeTaskDto>) {
            val now = clock()
            val tab = HouseholdTasksTab.fromId(_selectedTab.value)
            val filtered = loaded.filter { passes(it, tab, now) }
            if (filtered.isEmpty()) {
                _banner.value = null
                _state.value = emptyContent(tab)
                return
            }
            val rows = filtered.map { rowFor(it, tab, now) }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "tasks", rows = rows)),
                    hasMore = false,
                )
            _banner.value = bannerFor(tab, loaded, now)
        }

        private fun emptyContent(tab: HouseholdTasksTab): ListOfRowsUiState.Empty =
            when (tab) {
                HouseholdTasksTab.Active ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.ListChecks,
                        headline = "No tasks yet",
                        subcopy =
                            "Track who's doing what. Add a one-off chore, or set up the " +
                                "recurring stuff (trash, dog walks, plants) once and let it " +
                                "spawn itself.",
                        ctaTitle = "Add a task",
                        onCta = { onAddTask() },
                    )
                HouseholdTasksTab.Done ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.CheckCircle,
                        headline = "Nothing done yet",
                        subcopy = "Finished chores from the last 30 days will show up here.",
                        ctaTitle = "Add a task",
                        onCta = { onAddTask() },
                    )
                HouseholdTasksTab.Recurring ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.ArrowsRepeat,
                        headline = "No recurring chores",
                        subcopy =
                            "Set up the weekly trash run, daily dog walks, or plant watering " +
                                "once and they'll spawn themselves.",
                        ctaTitle = "Add a recurring task",
                        onCta = { onAddTask() },
                    )
            }

        private fun bannerFor(
            tab: HouseholdTasksTab,
            loaded: List<HomeTaskDto>,
            now: Instant,
        ): BannerConfig? {
            // Only show the banner on the Active tab.
            if (tab != HouseholdTasksTab.Active) return null
            val summary = summarize(loaded, now)
            if (!summary.hasContent) return null
            return BannerConfig(
                icon = PantopusIcon.ListChecks,
                title = bannerTitle(summary),
                subtitle = bannerSubtitle(summary),
                tint = BannerCtaTint.Home,
            )
        }

        private fun bannerTitle(summary: HouseholdTasksBannerSummary): String =
            when {
                summary.dueTodayCount == 0 && summary.overdueCount > 0 ->
                    if (summary.overdueCount == 1) "1 task overdue" else "${summary.overdueCount} tasks overdue"
                summary.dueTodayCount == 1 -> "1 task due today"
                else -> "${summary.dueTodayCount} tasks due today"
            }

        private fun bannerSubtitle(summary: HouseholdTasksBannerSummary): String? =
            when {
                summary.overdueCount > 0 ->
                    if (summary.overdueCount == 1) {
                        "1 overdue · finish or reassign"
                    } else {
                        "${summary.overdueCount} overdue · finish or reassign"
                    }
                else -> "You're on track for the week"
            }

        private fun rowFor(
            task: HomeTaskDto,
            tab: HouseholdTasksTab,
            now: Instant,
        ): RowModel {
            val projection = project(task, now)
            val taskId = task.id
            return RowModel(
                id = task.id,
                title = projection.title,
                subtitle = projection.subtitle,
                template = RowTemplate.StatusChip,
                leading = leadingFor(projection),
                trailing = trailingFor(task, tab, taskId),
                onTap = { onOpenTask(taskId) },
                inlineChip =
                    if (tab == HouseholdTasksTab.Recurring && projection.recurrenceChip != null) {
                        RowChip(
                            text = projection.recurrenceChip,
                            icon = PantopusIcon.ArrowsRepeat,
                            tint =
                                RowChip.Tint.Custom(
                                    background = projection.category.background,
                                    foreground = projection.category.foreground,
                                ),
                        )
                    } else {
                        null
                    },
                chips = chipsLine(tab, projection),
                highlight = projection.highlight,
            )
        }

        private fun leadingFor(projection: HouseholdTaskRowProjection): RowLeading {
            return if (projection.isAssigned && projection.assigneeLabel != null) {
                RowLeading.Avatar(
                    name = projection.assigneeLabel,
                    imageUrl = null,
                    identity = IdentityPillar.Home,
                    ringProgress = 1f,
                )
            } else {
                RowLeading.TypeIcon(
                    icon = projection.category.icon,
                    background = projection.category.background,
                    foreground = projection.category.foreground,
                )
            }
        }

        /**
         * Active + Done rows carry a two-button trailing: the checkbox
         * that toggles the task **both ways** (RN's checkbox does
         * `done → open` as well, `src/app/homes/[id]/tasks.tsx:52-58`)
         * and the trash affordance RN puts on every row (`:167-169`).
         * Recurring keeps its kebab — a recurring chore is still
         * deletable from the Active tab, where the same row appears.
         */
        private fun trailingFor(
            task: HomeTaskDto,
            tab: HouseholdTasksTab,
            taskId: String,
        ): RowTrailing =
            when (tab) {
                HouseholdTasksTab.Active, HouseholdTasksTab.Done -> {
                    val isDone = task.status == "done"
                    RowTrailing.IconActions(
                        primary =
                            RowIconAction(
                                icon = if (isDone) PantopusIcon.Check else PantopusIcon.Circle,
                                accessibilityLabel = if (isDone) "Mark not done" else "Mark done",
                                background = if (isDone) PantopusColors.homeBg else PantopusColors.appSurface,
                                foreground = if (isDone) PantopusColors.home else PantopusColors.appTextMuted,
                                onClick = { toggleDone(taskId) },
                            ),
                        secondary =
                            RowIconAction(
                                icon = PantopusIcon.Trash,
                                accessibilityLabel = "Delete task",
                                background = PantopusColors.appSurfaceSunken,
                                foreground = PantopusColors.error,
                                onClick = { requestDelete(taskId) },
                            ),
                    )
                }
                HouseholdTasksTab.Recurring -> RowTrailing.Kebab
            }

        private fun chipsLine(
            tab: HouseholdTasksTab,
            projection: HouseholdTaskRowProjection,
        ): List<RowChip>? {
            if (tab == HouseholdTasksTab.Recurring) return null
            val text = projection.chipText ?: return null
            val variant = projection.chipVariant ?: return null
            return listOf(RowChip(text = text, icon = projection.chipIcon, tint = RowChip.Tint.Status(variant)))
        }

        private fun tabsWithCounts(loaded: List<HomeTaskDto>): List<ListOfRowsTab> {
            val now = clock()
            val active = loaded.count { HouseholdTasksListViewModel.passes(it, HouseholdTasksTab.Active, now) }
            val done = loaded.count { HouseholdTasksListViewModel.passes(it, HouseholdTasksTab.Done, now) }
            val recurring = loaded.count { HouseholdTasksListViewModel.passes(it, HouseholdTasksTab.Recurring, now) }
            return listOf(
                ListOfRowsTab(HouseholdTasksTab.Active.id, "Active", active),
                ListOfRowsTab(HouseholdTasksTab.Done.id, "Done", done),
                ListOfRowsTab(HouseholdTasksTab.Recurring.id, "Recurring", recurring),
            )
        }

        private fun initialTabs(): List<ListOfRowsTab> =
            listOf(
                ListOfRowsTab(HouseholdTasksTab.Active.id, "Active"),
                ListOfRowsTab(HouseholdTasksTab.Done.id, "Done"),
                ListOfRowsTab(HouseholdTasksTab.Recurring.id, "Recurring"),
            )

        companion object {
            /**
             * Pure mapping from a task + clock to display strings.
             * Public-static for tests.
             */
            @JvmStatic
            fun project(
                task: HomeTaskDto,
                now: Instant,
            ): HouseholdTaskRowProjection {
                val category = HouseholdTaskCategory.from(task.title, task.taskType)
                val assigneeLabel = assigneeDisplay(task.assignedTo)
                val isAssigned = assigneeLabel != null
                val recurrenceChip = humanRecurrence(task.recurrenceRule)
                return when (task.status) {
                    "done" -> {
                        val doneTime = humanRelativeTime(task.completedAt ?: task.updatedAt, now)
                        val by = assigneeLabel ?: "Someone"
                        HouseholdTaskRowProjection(
                            title = task.title,
                            subtitle = doneTime?.let { "Done by $by · $it" } ?: "Done by $by",
                            chipText = null,
                            chipVariant = null,
                            chipIcon = null,
                            recurrenceChip = recurrenceChip,
                            category = category,
                            isAssigned = isAssigned,
                            assigneeLabel = assigneeLabel,
                            highlight = RowHighlight.Muted,
                        )
                    }
                    "canceled" ->
                        HouseholdTaskRowProjection(
                            title = task.title,
                            subtitle = "Canceled",
                            chipText = "Canceled",
                            chipVariant = StatusChipVariant.Neutral,
                            chipIcon = PantopusIcon.X,
                            recurrenceChip = recurrenceChip,
                            category = category,
                            isAssigned = isAssigned,
                            assigneeLabel = assigneeLabel,
                            highlight = RowHighlight.Muted,
                        )
                    else -> {
                        val due = dueChip(task.dueAt, now)
                        val assigneeLine = assigneeLabel?.let { "Assigned to $it" } ?: "Unassigned"
                        val subtitle = due.subtitleLine?.let { "$assigneeLine · $it" } ?: assigneeLine
                        HouseholdTaskRowProjection(
                            title = task.title,
                            subtitle = subtitle,
                            chipText = due.text,
                            chipVariant = due.variant,
                            chipIcon = due.icon,
                            recurrenceChip = recurrenceChip,
                            category = category,
                            isAssigned = isAssigned,
                            assigneeLabel = assigneeLabel,
                            highlight = null,
                        )
                    }
                }
            }

            /** Helper struct for [dueChip]. */
            data class DueChip(
                val text: String?,
                val variant: StatusChipVariant?,
                val icon: PantopusIcon?,
                val subtitleLine: String?,
            )

            /**
             * Pure helper — maps `due_at` + clock to (chip text, chip
             * variant, chip icon, subtitle-due-line). Returns nulls when
             * the task has no due date.
             */
            @JvmStatic
            fun dueChip(
                iso: String?,
                now: Instant,
            ): DueChip {
                val due = iso?.let(::parseInstant) ?: return DueChip(null, null, null, null)
                val zone = ZoneId.systemDefault()
                val dueDay: LocalDate = due.atZone(zone).toLocalDate()
                val nowDay: LocalDate = now.atZone(zone).toLocalDate()
                val days = ChronoUnit.DAYS.between(nowDay, dueDay).toInt()
                return when {
                    days < 0 -> {
                        val lateBy = -days
                        val label = if (lateBy == 1) "1 day late" else "$lateBy days late"
                        DueChip(label, StatusChipVariant.ErrorVariant, PantopusIcon.AlertCircle, label)
                    }
                    days == 0 -> DueChip("Today", StatusChipVariant.Warning, PantopusIcon.Clock, "Due today")
                    days == 1 -> DueChip("Tomorrow", StatusChipVariant.Warning, PantopusIcon.Clock, "Due tomorrow")
                    days <= 7 -> {
                        val label = formatWeekday(due) ?: "This week"
                        DueChip(label, StatusChipVariant.Neutral, null, "Due $label")
                    }
                    else -> {
                        val label = formatDateShort(due) ?: "Later"
                        DueChip(label, StatusChipVariant.Neutral, null, "Due $label")
                    }
                }
            }

            /**
             * Tab membership per the brief:
             *   - Active    = status in {open, in_progress}
             *   - Done      = status == done within the last 30 days
             *   - Recurring = recurrence_rule != null
             */
            @JvmStatic
            fun passes(
                task: HomeTaskDto,
                tab: HouseholdTasksTab,
                now: Instant,
            ): Boolean =
                when (tab) {
                    HouseholdTasksTab.Active -> task.status == "open" || task.status == "in_progress"
                    HouseholdTasksTab.Done -> {
                        if (task.status != "done") {
                            false
                        } else {
                            val iso = task.completedAt ?: task.updatedAt
                            val date = iso?.let(::parseInstant)
                            date == null || Duration.between(date, now).toDays() <= 30
                        }
                    }
                    HouseholdTasksTab.Recurring -> !task.recurrenceRule.isNullOrBlank()
                }

            /** Pure summary projection. Public-static for tests. */
            @JvmStatic
            fun summarize(
                tasks: List<HomeTaskDto>,
                now: Instant,
            ): HouseholdTasksBannerSummary {
                val zone = ZoneId.systemDefault()
                val nowDay = now.atZone(zone).toLocalDate()
                var dueToday = 0
                var overdue = 0
                tasks.forEach { task ->
                    val due = task.dueAt?.let(::parseInstant)
                    if ((task.status == "open" || task.status == "in_progress") && due != null) {
                        val dueDay = due.atZone(zone).toLocalDate()
                        val days = ChronoUnit.DAYS.between(nowDay, dueDay)
                        when {
                            days < 0 -> overdue += 1
                            days == 0L -> dueToday += 1
                        }
                    }
                }
                return HouseholdTasksBannerSummary(dueTodayCount = dueToday, overdueCount = overdue)
            }

            /**
             * Surface a fingerprint for an assignee uuid. The backend
             * returns just an id today — no joined user profile. Until
             * a server-side join lands, surface a short identifier so
             * the row stays distinguishable but the UI doesn't lie
             * about who's assigned.
             */
            @JvmStatic
            fun assigneeDisplay(assigneeId: String?): String? {
                if (assigneeId.isNullOrEmpty()) return null
                return "Member ${assigneeId.take(4).uppercase(Locale.US)}"
            }

            /**
             * Human-readable rendering of an RRULE-ish recurrence
             * string. The backend stores free-form text; we surface the
             * friendliest rendering we can derive without a full RRULE
             * parser.
             */
            @JvmStatic
            fun humanRecurrence(rule: String?): String? {
                val raw = rule?.trim().orEmpty()
                if (raw.isEmpty()) return null
                val lower = raw.lowercase()
                return when {
                    lower.contains("freq=daily") -> "Daily"
                    lower.contains("freq=weekly") -> {
                        val byday = parseByDay(lower)
                        if (byday != null) "Weekly · $byday" else "Weekly"
                    }
                    lower.contains("freq=monthly") -> "Monthly"
                    lower.contains("freq=yearly") -> "Yearly"
                    else -> raw
                }
            }

            private fun parseByDay(rrule: String): String? {
                val key = "byday="
                val start = rrule.indexOf(key)
                if (start < 0) return null
                val tail = rrule.substring(start + key.length)
                val token = tail.substringBefore(';')
                val map =
                    mapOf(
                        "mo" to "Mon",
                        "tu" to "Tue",
                        "we" to "Wed",
                        "th" to "Thu",
                        "fr" to "Fri",
                        "sa" to "Sat",
                        "su" to "Sun",
                    )
                val pieces = token.split(",").mapNotNull { map[it.trim().lowercase()] }
                return if (pieces.isEmpty()) null else pieces.joinToString(", ")
            }

            /** "2h ago" / "yesterday" / "Mar 4" — short, relative. */
            @JvmStatic
            fun humanRelativeTime(
                iso: String?,
                now: Instant,
            ): String? {
                val date = iso?.let(::parseInstant) ?: return null
                val delta = Duration.between(date, now)
                val seconds = delta.seconds
                return when {
                    seconds < 60 -> "just now"
                    seconds < 3600 -> "${seconds / 60}m ago"
                    seconds < 24 * 3600 -> "${seconds / 3600}h ago"
                    seconds < 48 * 3600 -> "yesterday"
                    else -> formatDateShort(date)
                }
            }

            @JvmStatic
            fun formatDateShort(date: Instant): String? =
                runCatching {
                    DateTimeFormatter
                        .ofPattern("MMM d", Locale.US)
                        .withZone(ZoneId.of("UTC"))
                        .format(date)
                }.getOrNull()

            @JvmStatic
            fun formatWeekday(date: Instant): String? =
                runCatching {
                    DateTimeFormatter
                        .ofPattern("EEE", Locale.US)
                        .withZone(ZoneId.systemDefault())
                        .format(date)
                }.getOrNull()

            private fun parseInstant(iso: String): Instant? =
                runCatching { Instant.parse(iso) }
                    .recoverCatching {
                        DateTimeFormatter
                            .ofPattern("yyyy-MM-dd")
                            .parse(iso, LocalDate::from)
                            .atStartOfDay(ZoneId.of("UTC"))
                            .toInstant()
                    }.getOrNull()
        }
    }
