@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.homes.HomeCopyGateFactory
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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
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
 *      - Recurring = automatic schedule or saved repeat preference
 *  - Active rows render a home-tinted summary banner (`N due today`
 *    + overdue count) above the list when there's anything to say.
 *  - 52dp `SecondaryCreate` FAB tinted [FabTint.Home] per the brief.
 *  - Category-tinted leading tile ([HouseholdTaskCategory] palette)
 *    shown when the task is unassigned; [RowLeading.Avatar] shown with
 *    the home identity ring when an assignee is set.
 *  - Active trailing = round-checkbox [RowTrailing.CircularAction]
 *    that optimistically toggles to Done.
 *  - Done trailing = success status chip; "Done <when> · Assigned to …"
 *    surfaces in the subtitle (tasks don't record who finished them).
 *  - Recurring trailing = kebab; recurrence cadence surfaces in the
 *    inline chip.
 *
 * The Recurring filter includes current automatic schedules and saved legacy
 * preferences. Their chips distinguish active/paused/review from saved-only.
 */
@HiltViewModel
class HouseholdTasksListViewModel
    internal constructor(
        accessFactory: HomeTaskAccessFactory,
        savedStateHandle: SavedStateHandle,
        private val clock: () -> Instant = Instant::now,
        private val membersRepo: HomeMembersRepository? = null,
        gates: HomeCopyGateFactory? = null,
    ) : ViewModel() {
        @Inject
        constructor(
            accessFactory: HomeTaskAccessFactory,
            savedStateHandle: SavedStateHandle,
            membersRepo: HomeMembersRepository,
            gates: HomeCopyGateFactory,
        ) : this(accessFactory, savedStateHandle, Instant::now, membersRepo, gates)

        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(HOUSEHOLD_TASKS_HOME_ID_KEY)) {
                "HouseholdTasksListViewModel requires a $HOUSEHOLD_TASKS_HOME_ID_KEY nav argument"
            }

        private val access = accessFactory.create(homeId, viewModelScope)

        /** Founder decision 3: who may see this screen from the store's copy, and what leaves with the screen. */
        private val gate = gates?.create(homeId, listOf(HomeStoreKeys.tasks(homeId), HomeStoreKeys.occupants(homeId)))
        private val showsCopy: Boolean get() = gate?.showsCopy == true
        private var generation = 0
        private var acting = false
        private var canCreate = false
        private var active = true
        private var work: Job? = null

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

        /** Pull to refresh is reading while the rows stay (Instant Screens): the pull indicator only. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        /** The quiet "Couldn't refresh. Showing 3:42 PM." line when a read fails on a copy past its max shown age. */
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        private var tasks: List<HomeTaskDto>? = null
        private var pendingOriginal: HomeTaskDto? = null

        /** Members' names by user id, for assignees; empty when the viewer can't read members ("Member 1A2B"). */
        private var memberNames: Map<String, String> = emptyMap()
        private var onOpenTask: (String) -> Unit = {}
        private var onAddTask: () -> Unit = {}
        private var onEditRecurring: (String) -> Unit = {}

        init {
            // First frame (Instant Screens): owners and household roles see the stored list while the screen opens; the
            // read waits for the screen to resume.
            if (showsCopy) showStoredCopy()
            viewModelScope.launch {
                access.invalidated.collect { if (it) fail(TASK_SESSION_CHANGED) }
            }
        }

        fun configureNavigation(
            onOpenTask: (String) -> Unit = {},
            onAddTask: () -> Unit = {},
            onEditRecurring: (String) -> Unit = {},
        ) {
            this.onOpenTask = onOpenTask
            this.onAddTask = onAddTask
            this.onEditRecurring = onEditRecurring
        }

        /**
         * Screen entry and every return (Instant Screens): owners and household roles see the stored list at once,
         * and the store answers a fresh copy without a request or revalidates an older one quietly.
         */
        fun load() = read(force = false)

        fun resume() {
            active = true
            read(force = false)
        }

        fun pause() {
            active = false
            generation++
            work?.cancel()
            work = null
            acting = false
            rollbackCompletion()
            _actionError.value = null
            _refreshing.value = false
            // Founder decision 3: owners and household roles keep what's on screen while away; anyone else blanks
            // and re-checks on return.
            if (!showsCopy) {
                clearContent()
                memberNames = emptyMap()
                _state.value = ListOfRowsUiState.Loading
            }
            gate?.leave()
        }

        /** Pull to refresh and Retry: read now. */
        fun refresh() = read(force = true)

        override fun onCleared() {
            gate?.leave()
        }

        private fun read(force: Boolean) {
            if (acting || !active) return
            val revision = ++generation
            if (tasks == null && showsCopy) showStoredCopy()
            if (tasks == null) _state.value = ListOfRowsUiState.Loading
            _refreshing.value = force && tasks != null
            work?.cancel()
            work =
                viewModelScope.launch {
                    taskAttempt(revision) {
                        val fromCopy = showsCopy && !force
                        val stored = readTasks(fromCopy)
                        if (!current(revision)) return@taskAttempt
                        _refreshing.value = false
                        val result = stored.data ?: throw (stored.failure ?: NetworkError.NotFound)
                        canCreate = result.collectionCapabilities?.canCreate == true
                        applySuccess(result.tasks)
                        _refreshNotice.value =
                            RefreshNotice(stored.fetchedAt, ::refresh).takeIf { stored.showsRefreshFailure(StoreKind.HOMES) }
                        loadMemberNames(revision, force = !fromCopy)
                    }
                }
        }

        /** An explicit authority refusal wins before any task copy is used. */
        private suspend fun readTasks(fromCopy: Boolean): Stored<GetHomeTasksResponse> {
            val refusal =
                gate?.checkForRead(!fromCopy) {
                    clearContent()
                    memberNames = emptyMap()
                    _state.value = ListOfRowsUiState.Loading
                }
            if (refusal != null) return Stored(failure = refusal)
            val stored = access.listStored(force = !fromCopy || !showsCopy)
            return if (!showsCopy && stored.failure != null) Stored(failure = stored.failure) else stored
        }

        private fun showStoredCopy() {
            val stored = access.storedList() ?: return
            canCreate = stored.collectionCapabilities?.canCreate == true
            membersRepo?.storedOccupants(homeId)?.let { occupants -> memberNames = namesOf(occupants.occupants) }
            applySuccess(stored.tasks)
        }

        /** Only when a task has an assignee, so an unassigned list costs no extra request. */
        private suspend fun loadMemberNames(
            revision: Int,
            force: Boolean,
        ) {
            val repo = membersRepo ?: return
            if (tasks.orEmpty().none { !it.assignedTo.isNullOrEmpty() }) return
            val occupants = repo.listOccupantsStored(homeId, force).data ?: return
            if (!current(revision)) return
            memberNames = namesOf(occupants.occupants)
            tasks?.let(::renderForCurrentTab)
        }

        private fun namesOf(occupants: List<OccupantDto>): Map<String, String> =
            occupants
                .mapNotNull(HouseholdTaskAssignableMember::from)
                .associate { it.id to it.displayName }

        fun selectTab(id: String) {
            _selectedTab.value = id
            tasks?.let(::renderForCurrentTab)
        }

        fun fab(): FabAction? =
            if (active && canCreate && access.isCurrent) {
                FabAction(
                    icon = PantopusIcon.Plus,
                    contentDescription = "Add a task",
                    variant = FabVariant.SecondaryCreate,
                    tint = FabTint.Home,
                    onClick = ::requestCreate,
                )
            } else {
                null
            }

        private fun requestCreate() {
            if (!readyToAct || !canCreate) return
            val revision = ++generation
            acting = true
            work?.cancel()
            work =
                viewModelScope.launch {
                    taskAttempt(revision) {
                        val result = access.list()
                        if (!current(revision)) return@taskAttempt
                        canCreate = result.collectionCapabilities?.canCreate == true
                        applySuccess(result.tasks)
                        if (canCreate) onAddTask()
                    }
                    if (current(revision)) acting = false
                }
        }

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

        fun toggleDone(taskId: String) {
            val original = tasks?.firstOrNull { it.id == taskId } ?: return
            if (!readyToAct || original.capabilities?.canComplete != true) return
            mutate(original) {
                access.complete(taskId, original.status != "done")
                access.list()
            }
        }

        fun requestDelete(taskId: String) {
            val task = tasks?.firstOrNull { it.id == taskId } ?: return
            if (!readyToAct || task.capabilities?.canDelete != true) return
            _pendingEvent.value = HouseholdTasksListEvent.ConfirmDelete(taskId, task.title)
        }

        fun acknowledgeEvent() {
            _pendingEvent.value = null
        }

        fun clearActionError() {
            _actionError.value = null
        }

        fun deleteTask(taskId: String) {
            val task = tasks?.firstOrNull { it.id == taskId } ?: return
            if (!readyToAct || task.capabilities?.canDelete != true) return
            mutate {
                access.delete(taskId)
                access.list()
            }
        }

        private fun mutate(
            completing: HomeTaskDto? = null,
            operation: suspend () -> GetHomeTasksResponse,
        ) {
            acting = true
            val revision = ++generation
            work?.cancel()
            pendingOriginal = completing
            if (completing != null) {
                val pending =
                    completing.copy(
                        status = if (completing.status == "done") "open" else "done",
                        completedAt = if (completing.status == "done") null else clock().toString(),
                    )
                applySuccess(tasks.orEmpty().map { if (it.id == pending.id) pending else it })
            }
            work =
                viewModelScope.launch {
                    taskAttempt(revision) {
                        val result = operation()
                        if (!current(revision)) return@taskAttempt
                        canCreate = result.collectionCapabilities?.canCreate == true
                        pendingOriginal = null
                        applySuccess(result.tasks)
                    }
                    if (current(revision)) acting = false
                }
        }

        private fun rollbackCompletion() {
            val original = pendingOriginal ?: return
            pendingOriginal = null
            tasks?.let { loaded -> applySuccess(loaded.map { if (it.id == original.id) original else it }) }
        }

        private val readyToAct: Boolean get() = active && !acting && access.isCurrent

        private fun current(revision: Int): Boolean = active && revision == generation && access.isCurrent

        private suspend fun taskAttempt(
            revision: Int,
            operation: suspend () -> Unit,
        ) {
            try {
                operation()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: NetworkError) {
                if (current(revision)) {
                    if (pendingOriginal != null && error.code !in listOf(401, 403, 404)) {
                        rollbackCompletion()
                        _actionError.value = error.displayMessage("Couldn't confirm the task change. Try again.")
                    } else {
                        if (error.code in listOf(401, 403, 404)) gate?.invalidate()
                        fail(error.displayMessage("Could not refresh task access. Try again."))
                    }
                }
            } catch (error: IllegalStateException) {
                if (active && revision == generation) fail(error.message ?: TASK_ACCESS_CHANGED)
            } catch (error: IllegalArgumentException) {
                if (active && revision == generation) fail(error.message ?: TASK_ACCESS_CHANGED)
            }
        }

        private fun clearContent() {
            tasks = null
            pendingOriginal = null
            canCreate = false
            _tabs.value = initialTabs()
            _banner.value = null
            _pendingEvent.value = null
        }

        private fun fail(message: String) {
            generation++
            acting = false
            _refreshing.value = false
            clearContent()
            memberNames = emptyMap()
            _state.value = ListOfRowsUiState.Error(message)
            _actionError.value = message
        }

        private fun applySuccess(loaded: List<HomeTaskDto>) {
            tasks = loaded
            _tabs.value = tabsWithCounts(loaded)
            renderForCurrentTab(loaded)
        }

        private fun renderForCurrentTab(loaded: List<HomeTaskDto>) {
            val now = clock()
            val tab = HouseholdTasksTab.fromId(_selectedTab.value)
            val filtered = loaded.filter { it.id == pendingOriginal?.id || passes(it, tab, now) }
            if (filtered.isEmpty()) {
                _banner.value = null
                _state.value = emptyContent(tab, hasTasks = loaded.isNotEmpty())
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

        private fun emptyContent(
            tab: HouseholdTasksTab,
            hasTasks: Boolean,
        ): ListOfRowsUiState.Empty =
            when (tab) {
                // Tasks that are all finished aren't "no tasks yet".
                HouseholdTasksTab.Active ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.ListChecks,
                        headline = if (hasTasks) "No open tasks" else "No tasks yet",
                        subcopy = if (hasTasks) "Tasks you finish move to Done." else "Household tasks you can view will appear here.",
                        ctaTitle = "Add a task".takeIf { canCreate },
                        onCta = if (canCreate) ::requestCreate else null,
                    )
                HouseholdTasksTab.Done ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.CheckCircle,
                        headline = "Nothing done yet",
                        subcopy = "Finished chores from the last 30 days will show up here.",
                        ctaTitle = "Add a task".takeIf { canCreate },
                        onCta = if (canCreate) ::requestCreate else null,
                    )
                HouseholdTasksTab.Recurring ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.ArrowsRepeat,
                        headline = "No recurring chores",
                        subcopy = "Tasks with repeat schedules or saved preferences will appear here.",
                        ctaTitle = "Add a recurring task".takeIf { canCreate },
                        onCta = if (canCreate) ::requestCreate else null,
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
            val projection = project(task, now, memberNames, access.actorId)
            val taskId = task.id
            return RowModel(
                id = task.id,
                title = projection.title,
                subtitle = projection.subtitle,
                template = RowTemplate.StatusChip,
                leading = leadingFor(projection),
                trailing = trailingFor(task, tab, taskId),
                onTap = { if (active && access.isCurrent && !acting) onOpenTask(taskId) },
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

        private fun trailingFor(
            task: HomeTaskDto,
            tab: HouseholdTasksTab,
            taskId: String,
        ): RowTrailing {
            if (taskId == pendingOriginal?.id) return RowTrailing.Status("Pending", StatusChipVariant.Neutral)
            if (tab == HouseholdTasksTab.Recurring) return RowTrailing.Chevron
            val complete = task.capabilities?.canComplete == true
            val delete = task.capabilities?.canDelete == true
            val isDone = task.status == "done"
            val completion =
                RowIconAction(
                    icon = if (isDone) PantopusIcon.Check else PantopusIcon.Circle,
                    accessibilityLabel = if (isDone) "Mark not done" else "Mark done",
                    background = PantopusColors.homeBg,
                    foreground = PantopusColors.home,
                    onClick = { toggleDone(taskId) },
                )
            val removal =
                RowIconAction(
                    icon = PantopusIcon.Trash,
                    accessibilityLabel = "Delete task",
                    background = PantopusColors.appSurfaceSunken,
                    foreground = PantopusColors.error,
                    onClick = { requestDelete(taskId) },
                )
            return when {
                complete && delete -> RowTrailing.IconActions(completion, removal)
                complete -> completion.singleTaskAction()
                delete -> removal.singleTaskAction()
                else -> RowTrailing.Chevron
            }
        }

        private fun RowIconAction.singleTaskAction(): RowTrailing =
            RowTrailing.CircularAction(
                icon,
                accessibilityLabel,
                background,
                foreground,
                onClick,
            )

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
                memberNames: Map<String, String> = emptyMap(),
                viewerId: String? = null,
            ): HouseholdTaskRowProjection {
                val category = HouseholdTaskCategory.from(task.title, task.taskType)
                val assigneeLabel = assigneeDisplay(task.assignedTo, memberNames)
                val own = task.assignedTo != null && task.assignedTo == viewerId
                // The line says "you" for the viewer's own tasks.
                val avatarName = rowAvatarName(task.assignedTo, assigneeLabel, memberNames, own)
                val isAssigned = avatarName != null
                val assignee = if (own) "you" else assigneeLabel
                val recurrenceChip = task.automaticRecurrence?.label() ?: humanRecurrence(task.recurrenceRule)?.let { "Saved: $it" }
                return when (task.status) {
                    "done" -> {
                        // Tasks don't record who finished them, so the row names the assignee, not a "done by".
                        val done = humanRelativeTime(task.completedAt ?: task.updatedAt, now)?.let { "Done $it" } ?: "Done"
                        HouseholdTaskRowProjection(
                            title = task.title,
                            subtitle = assignee?.let { "$done · Assigned to $it" } ?: done,
                            chipText = null,
                            chipVariant = null,
                            chipIcon = null,
                            recurrenceChip = recurrenceChip,
                            category = category,
                            isAssigned = isAssigned,
                            assigneeLabel = avatarName,
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
                            assigneeLabel = avatarName,
                            highlight = RowHighlight.Muted,
                        )
                    else -> {
                        val due = dueChip(task.dueAt, now)
                        val assigneeLine = assignee?.let { "Assigned to $it" } ?: "Unassigned"
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
                            assigneeLabel = avatarName,
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
             *   - Recurring = automatic schedule or saved repeat preference
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
                    HouseholdTasksTab.Recurring -> task.automaticRecurrence != null || !task.recurrenceRule.isNullOrBlank()
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
             * Tasks carry only the assignee's id; names come from the household's members. A viewer
             * who can't read members gets a short fingerprint, not a guessed name.
             */
            @JvmStatic
            fun assigneeDisplay(
                assigneeId: String?,
                memberNames: Map<String, String> = emptyMap(),
            ): String? {
                if (assigneeId.isNullOrEmpty()) return null
                return memberNames[assigneeId] ?: "Member ${assigneeId.take(4).uppercase(Locale.US)}"
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
                        .withZone(ZoneId.systemDefault())
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
                            .atStartOfDay(ZoneId.systemDefault())
                            .toInstant()
                    }.getOrNull()
        }
    }

/**
 * The row avatar names the assignee. For the viewer's own task it needs their name from the members
 * list; without it the category icon shows (a "Member 1A2B" avatar would mean nothing to them).
 */
private fun rowAvatarName(
    assigneeId: String?,
    assigneeLabel: String?,
    memberNames: Map<String, String>,
    own: Boolean,
): String? = if (own && assigneeId?.let(memberNames::get) == null) null else assigneeLabel
