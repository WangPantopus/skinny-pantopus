@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.issues

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CreateHomeIssueRequest
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.HomeIssueDto
import app.pantopus.android.data.api.models.homes.HomeIssuesResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeIssueRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomeIssuesRepository
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.homes.HomeCopyGateFactory
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooter
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooterAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID
import javax.inject.Inject

/** Nav-arg key for the home whose issues are listed. */
const val HOME_ISSUES_HOME_ID_KEY: String = "homeId"

/** Canonical chip status derived from `HomeIssueDto.status`. */
enum class HomeIssueChipStatus { Open, Scheduled, InProgress, Completed, Dismissed, Unknown }

/**
 * Tabs mirror RN's buckets exactly
 * (`src/app/homes/[id]/maintenance.tsx:36`):
 *   Open      → `suggested` | `open`
 *   Scheduled → `scheduled` | `in_progress`
 *   History   → `resolved` | `canceled` (the server's `HomeIssue.status`)
 */
enum class HomeIssuesTab(val id: String) {
    Open("open"),
    Scheduled("scheduled"),
    History("history"),
    ;

    companion object {
        fun fromId(id: String): HomeIssuesTab = entries.firstOrNull { it.id == id } ?: Open
    }
}

/** One-shot events the screen reacts to (sheet / confirm presentation). */
sealed interface HomeIssuesEvent {
    data object OpenReport : HomeIssuesEvent

    data class ConfirmDismiss(val issueId: String, val title: String) : HomeIssuesEvent
}

/** Pure projection of one issue into a row's display fields. */
data class HomeIssueRowProjection(
    val title: String,
    val subtitle: String?,
    val chipText: String,
    val chipVariant: StatusChipVariant,
    val chipIcon: PantopusIcon?,
    val status: HomeIssueChipStatus,
)

/**
 * Per-home **issue tracker** (the `HomeIssue` collection) — native
 * counterpart of RN's `src/app/homes/[id]/maintenance.tsx`, which
 * despite its filename lists issues, not maintenance tasks. A DIFFERENT
 * backend collection from [app.pantopus.android.ui.screens.homes.maintenance.MaintenanceListViewModel];
 * both surfaces ship side by side.
 *
 * Routes:
 *  - `GET  /api/homes/:id/issues`          — backend/routes/home.js:4386
 *  - `POST /api/homes/:id/issues`          — backend/routes/home.js:4420
 *  - `PUT  /api/homes/:id/issues/:issueId` — backend/routes/home.js:4462
 */
@HiltViewModel
open class HomeIssuesListViewModel
    @Inject
    constructor(
        private val repo: HomeIssuesRepository,
        private val adminRepo: HomeAdminRepository,
        gates: HomeCopyGateFactory,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(HOME_ISSUES_HOME_ID_KEY)) {
                "HomeIssuesListViewModel requires a $HOME_ISSUES_HOME_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(HomeIssuesTab.Open.id)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _tabs = MutableStateFlow(tabsWithCounts(null))
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        /** One-shot presentation signal; the screen clears it after use. */
        val pendingEvent = MutableStateFlow<HomeIssuesEvent?>(null)

        /** Inline error surfaced as a snackbar after a failed mutation. */
        val toast = MutableStateFlow<String?>(null)

        /** Pull to refresh is reading while the rows stay (Instant Screens): the pull indicator only. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        /** The quiet "Couldn't refresh. Showing 3:42 PM." line when a read fails on a copy past its max shown age. */
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        /** Founder decision 3: who may see this screen from the store's copy, and what leaves with the screen. */
        private val gate = gates.create(homeId, listOf(HomeStoreKeys.issues(homeId), HomeStoreKeys.me(homeId)))
        private var readGeneration = 0L

        private var issues: List<HomeIssueDto>? = null
        private var pendingCreate: Pair<CreateHomeIssueRequest, String>? = null

        /** The viewer's effective Home permissions; unreadable access leaves the list read-only. */
        private var access: HomeAccessDto? = null

        /**
         * Report and status actions wait until this visit's access read confirms them (a fresh answer); a copy's
         * access only shows the list (as on iOS).
         */
        private var accessConfirmed = false

        /** As the server allows: maintenance editors report issues; maintenance managers and home editors update them. */
        private val canReport: Boolean
            get() = accessConfirmed && access?.let { it.can("maintenance.edit") || it.can("maintenance.manage") } == true

        private val canUpdate: Boolean
            get() = accessConfirmed && access?.let { it.can("home.edit") || it.can("maintenance.manage") } == true

        /**
         * Screen entry and every return (Instant Screens): owners and household roles see the stored issues at once,
         * and the store answers a fresh copy without a request or revalidates an older one quietly.
         */
        fun load() {
            if (issues == null && gate.showsCopy) showStoredCopy()
            read(force = false)
        }

        /** Pull to refresh and Retry: read now. */
        fun refresh() {
            _refreshing.value = issues != null
            read(force = true)
        }

        override fun onCleared() {
            gate.leave()
        }

        private fun read(force: Boolean) {
            if (issues == null) _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch { fetch(force) }
        }

        private fun showStoredCopy() {
            val stored = repo.storedIssues(homeId) ?: return
            access = adminRepo.storedMyAccess(homeId)
            publish(stored.issues)
        }

        fun selectTab(id: String) {
            _selectedTab.value = id
            issues?.let(::render)
        }

        fun acknowledgeEvent() {
            if (pendingEvent.value == HomeIssuesEvent.OpenReport) pendingCreate = null
            pendingEvent.value = null
        }

        fun acknowledgeToast() {
            toast.value = null
        }

        fun fab(): FabAction? =
            if (!canReport) {
                null
            } else {
                FabAction(
                    icon = PantopusIcon.Plus,
                    contentDescription = "Report issue",
                    variant = FabVariant.CanonicalCreate,
                    tint = FabTint.Home,
                    onClick = { pendingEvent.value = HomeIssuesEvent.OpenReport },
                )
            }

        // MARK: - Mutations

        /**
         * `POST /api/homes/:id/issues` — RN `maintenance.tsx:53`. Returns
         * true when the row was created so the sheet can dismiss.
         */
        open suspend fun createIssue(
            title: String,
            description: String?,
        ): Boolean {
            val trimmedTitle = title.trim()
            if (trimmedTitle.isEmpty()) return false
            val trimmedDescription = description?.trim()?.takeIf { it.isNotEmpty() }
            val draft = CreateHomeIssueRequest(title = trimmedTitle, description = trimmedDescription)
            if (pendingCreate?.first != draft) pendingCreate = draft to UUID.randomUUID().toString()
            return when (
                val result =
                    repo.createHomeIssue(
                        homeId,
                        draft.copy(clientRequestId = pendingCreate?.second),
                    )
            ) {
                is NetworkResult.Success -> {
                    pendingCreate = null
                    fetch(force = true)
                    true
                }
                is NetworkResult.Failure -> {
                    toast.value = result.error.displayMessage("Failed to create issue")
                    false
                }
            }
        }

        /** Status transition — RN `maintenance.tsx:65` (`updateStatus`). */
        fun updateStatus(
            issueId: String,
            status: String,
        ) {
            viewModelScope.launch {
                when (
                    val result =
                        repo.updateHomeIssue(homeId, issueId, UpdateHomeIssueRequest(status = status))
                ) {
                    is NetworkResult.Success -> fetch(force = true)
                    is NetworkResult.Failure ->
                        toast.value = result.error.displayMessage("Failed to update issue")
                }
            }
        }

        /**
         * Dismiss after a destructive confirm. The server stores a dismissed
         * issue as `canceled`; it refuses RN's `dismissed`.
         */
        fun dismissIssue(issueId: String) = updateStatus(issueId, "canceled")

        // MARK: - Fetch + render

        private suspend fun fetch(force: Boolean) {
            val generation = ++readGeneration
            val fromCopy = gate.showsCopy && !force
            var reads = readAll(force = !fromCopy)
            // Household access ended meanwhile: whatever came from a copy is read again now.
            if (fromCopy && !gate.showsCopy) reads = readAll(force = true)
            if (generation != readGeneration) return
            _refreshing.value = false
            val (stored, me) = reads
            val loaded = stored.data
            if (loaded != null) {
                access = me.data
                // Confirmed = the server answered for this access within the Homes window (a fresh copy or this read); an
                // older copy kept after a failed re-read (offline) shows the list but confirms nothing.
                accessConfirmed = me.isFresh(StoreKind.HOMES)
                publish(loaded.issues)
            } else {
                issues = null
                _banner.value = null
                _state.value =
                    ListOfRowsUiState.Error(
                        (stored.failure ?: NetworkError.NotFound).displayMessage("Couldn't load this home's issues."),
                    )
            }
            _refreshNotice.value = RefreshNotice(stored.fetchedAt, ::refresh).takeIf { stored.showsRefreshFailure(StoreKind.HOMES) }
        }

        /** The issues and the viewer's access, read side by side with the access re-check. */
        private suspend fun readAll(force: Boolean): Pair<Stored<HomeIssuesResponse>, Stored<HomeAccessDto>> =
            coroutineScope {
                val recheck = async { gate.recheck(force) }
                val loaded = async { repo.getHomeIssuesStored(homeId, force) }
                val me = async { adminRepo.myAccessStored(homeId, force) }
                recheck.await()
                loaded.await() to me.await()
            }

        private fun publish(loaded: List<HomeIssueDto>) {
            issues = loaded
            _tabs.value = tabsWithCounts(loaded)
            render(loaded)
        }

        private fun render(loaded: List<HomeIssueDto>) {
            val tab = HomeIssuesTab.fromId(_selectedTab.value)
            val filtered = loaded.filter { bucket(it) == tab }
            if (filtered.isEmpty()) {
                _banner.value = null
                _state.value = emptyState(tab)
                return
            }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "issues", rows = filtered.map(::rowFor))),
                    hasMore = false,
                )
            _banner.value = bannerFor(tab, loaded)
        }

        private fun emptyState(tab: HomeIssuesTab): ListOfRowsUiState.Empty {
            // Only viewers who can report an issue get the Report issue button.
            val reportTitle = "Report issue".takeIf { canReport }
            val report: (() -> Unit)? = { pendingEvent.value = HomeIssuesEvent.OpenReport }.takeIf { canReport }
            return when (tab) {
                HomeIssuesTab.Open ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Wrench,
                        headline = "No open issues",
                        subcopy =
                            "Report a leak, a broken appliance, or anything else that needs " +
                                "fixing. Everyone in the household sees it and can track the fix.",
                        ctaTitle = reportTitle,
                        onCta = report,
                    )
                HomeIssuesTab.Scheduled ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Calendar,
                        headline = "Nothing scheduled",
                        subcopy = "Issues you schedule for a fix show up here until they're completed.",
                        ctaTitle = reportTitle,
                        onCta = report,
                    )
                HomeIssuesTab.History ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.CheckCircle,
                        headline = "No history",
                        subcopy = "Completed and dismissed issues are archived here.",
                        ctaTitle = reportTitle,
                        onCta = report,
                    )
            }
        }

        private fun bannerFor(
            tab: HomeIssuesTab,
            loaded: List<HomeIssueDto>,
        ): BannerConfig? {
            if (tab != HomeIssuesTab.Open) return null
            val openCount = loaded.count { bucket(it) == HomeIssuesTab.Open }
            if (openCount == 0) return null
            return BannerConfig(
                icon = PantopusIcon.Wrench,
                title = if (openCount == 1) "1 open issue" else "$openCount open issues",
                subtitle = "Schedule the fix or mark it done once it's handled.",
                tint = BannerCtaTint.Home,
            )
        }

        private fun rowFor(issue: HomeIssueDto): RowModel {
            val projection = project(issue)
            return RowModel(
                id = issue.id,
                title = projection.title,
                subtitle = projection.subtitle,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.TypeIcon(
                        icon = leadingIcon(projection.status),
                        background = leadingBackground(projection.status),
                        foreground = leadingForeground(projection.status),
                    ),
                trailing = RowTrailing.Status(projection.chipText, projection.chipVariant),
                timeMeta = formatDateShort(issue.updatedAt ?: issue.createdAt),
                footer = footerFor(issue.id, issue.title, projection.status),
            )
        }

        private fun footerFor(
            issueId: String,
            title: String,
            status: HomeIssueChipStatus,
        ): RowFooter? {
            if (!canUpdate) return null
            val actions = mutableListOf<RowFooterAction>()
            when (status) {
                HomeIssueChipStatus.Open ->
                    actions +=
                        RowFooterAction(
                            title = "Schedule",
                            icon = PantopusIcon.Calendar,
                            variant = CompactButtonVariant.Primary,
                            testTag = "homeIssues.row_$issueId.schedule",
                            onClick = { updateStatus(issueId, "scheduled") },
                        )
                HomeIssueChipStatus.Scheduled, HomeIssueChipStatus.InProgress ->
                    actions +=
                        RowFooterAction(
                            title = "Mark complete",
                            icon = PantopusIcon.CheckCircle,
                            variant = CompactButtonVariant.Primary,
                            testTag = "homeIssues.row_$issueId.complete",
                            onClick = { updateStatus(issueId, "resolved") },
                        )
                HomeIssueChipStatus.Completed,
                HomeIssueChipStatus.Dismissed,
                HomeIssueChipStatus.Unknown,
                -> Unit
            }
            if (status != HomeIssueChipStatus.Completed && status != HomeIssueChipStatus.Dismissed) {
                actions +=
                    RowFooterAction(
                        title = "Dismiss",
                        icon = PantopusIcon.Trash2,
                        variant = CompactButtonVariant.Destructive,
                        testTag = "homeIssues.row_$issueId.dismiss",
                        onClick = {
                            pendingEvent.value = HomeIssuesEvent.ConfirmDismiss(issueId, title)
                        },
                    )
            }
            return if (actions.isEmpty()) null else RowFooter(actions)
        }

        private fun tabsWithCounts(loaded: List<HomeIssueDto>?): List<ListOfRowsTab> =
            listOf(
                ListOfRowsTab(
                    HomeIssuesTab.Open.id,
                    "Open",
                    loaded?.count { bucket(it) == HomeIssuesTab.Open },
                ),
                ListOfRowsTab(
                    HomeIssuesTab.Scheduled.id,
                    "Scheduled",
                    loaded?.count { bucket(it) == HomeIssuesTab.Scheduled },
                ),
                ListOfRowsTab(
                    HomeIssuesTab.History.id,
                    "History",
                    loaded?.count { bucket(it) == HomeIssuesTab.History },
                ),
            )

        private fun bucket(issue: HomeIssueDto): HomeIssuesTab? =
            when (chipStatus(issue)) {
                HomeIssueChipStatus.Open -> HomeIssuesTab.Open
                HomeIssueChipStatus.Scheduled, HomeIssueChipStatus.InProgress -> HomeIssuesTab.Scheduled
                HomeIssueChipStatus.Completed, HomeIssueChipStatus.Dismissed -> HomeIssuesTab.History
                HomeIssueChipStatus.Unknown -> null
            }

        private fun leadingIcon(status: HomeIssueChipStatus): PantopusIcon =
            when (status) {
                HomeIssueChipStatus.Open -> PantopusIcon.AlertCircle
                HomeIssueChipStatus.Scheduled -> PantopusIcon.Calendar
                HomeIssueChipStatus.InProgress -> PantopusIcon.Wrench
                HomeIssueChipStatus.Completed -> PantopusIcon.CheckCircle
                HomeIssueChipStatus.Dismissed -> PantopusIcon.XCircle
                HomeIssueChipStatus.Unknown -> PantopusIcon.Wrench
            }

        private fun leadingBackground(status: HomeIssueChipStatus) =
            when (status) {
                HomeIssueChipStatus.Open -> PantopusColors.warningBg
                HomeIssueChipStatus.Scheduled -> PantopusColors.primary50
                HomeIssueChipStatus.InProgress -> PantopusColors.businessBg
                HomeIssueChipStatus.Completed -> PantopusColors.successBg
                HomeIssueChipStatus.Dismissed, HomeIssueChipStatus.Unknown -> PantopusColors.appSurfaceSunken
            }

        private fun leadingForeground(status: HomeIssueChipStatus) =
            when (status) {
                HomeIssueChipStatus.Open -> PantopusColors.warning
                HomeIssueChipStatus.Scheduled -> PantopusColors.primary600
                HomeIssueChipStatus.InProgress -> PantopusColors.business
                HomeIssueChipStatus.Completed -> PantopusColors.success
                HomeIssueChipStatus.Dismissed, HomeIssueChipStatus.Unknown -> PantopusColors.appTextSecondary
            }

        companion object {
            /**
             * RN buckets `suggested` alongside `open`
             * (`maintenance.tsx:36`), so both map onto `Open`.
             */
            fun chipStatus(issue: HomeIssueDto): HomeIssueChipStatus =
                when (issue.status ?: "open") {
                    "suggested", "open" -> HomeIssueChipStatus.Open
                    "scheduled" -> HomeIssueChipStatus.Scheduled
                    "in_progress" -> HomeIssueChipStatus.InProgress
                    "completed", "resolved" -> HomeIssueChipStatus.Completed
                    "dismissed", "canceled" -> HomeIssueChipStatus.Dismissed
                    else -> HomeIssueChipStatus.Unknown
                }

            /** Pure projection — asserted directly by unit tests. */
            fun project(issue: HomeIssueDto): HomeIssueRowProjection {
                val status = chipStatus(issue)
                val description = issue.description?.trim()
                val severity = issue.severity?.trim()
                val subtitle =
                    when {
                        !description.isNullOrEmpty() -> description
                        !severity.isNullOrEmpty() ->
                            "${severity.replaceFirstChar { it.uppercase() }} severity"
                        else -> null
                    }
                return when (status) {
                    HomeIssueChipStatus.Open ->
                        HomeIssueRowProjection(
                            issue.title,
                            subtitle,
                            "Open",
                            StatusChipVariant.Warning,
                            PantopusIcon.AlertCircle,
                            status,
                        )
                    HomeIssueChipStatus.Scheduled ->
                        HomeIssueRowProjection(
                            issue.title,
                            subtitle,
                            "Scheduled",
                            StatusChipVariant.Info,
                            PantopusIcon.Calendar,
                            status,
                        )
                    HomeIssueChipStatus.InProgress ->
                        HomeIssueRowProjection(
                            issue.title,
                            subtitle,
                            "In progress",
                            StatusChipVariant.Business,
                            PantopusIcon.Wrench,
                            status,
                        )
                    HomeIssueChipStatus.Completed ->
                        HomeIssueRowProjection(
                            issue.title,
                            subtitle,
                            "Completed",
                            StatusChipVariant.Success,
                            PantopusIcon.CheckCircle,
                            status,
                        )
                    HomeIssueChipStatus.Dismissed ->
                        HomeIssueRowProjection(
                            issue.title,
                            subtitle,
                            "Dismissed",
                            StatusChipVariant.Neutral,
                            PantopusIcon.XCircle,
                            status,
                        )
                    HomeIssueChipStatus.Unknown ->
                        HomeIssueRowProjection(
                            issue.title,
                            subtitle,
                            (issue.status ?: "Unknown").replaceFirstChar { it.uppercase() },
                            StatusChipVariant.Neutral,
                            null,
                            status,
                        )
                }
            }

            private val shortDate: DateTimeFormatter =
                DateTimeFormatter.ofPattern("MMM d", Locale.US)

            fun formatDateShort(iso: String?): String? {
                if (iso.isNullOrEmpty()) return null
                return runCatching {
                    shortDate.format(Instant.parse(iso).atZone(ZoneId.systemDefault()))
                }.getOrNull()
            }
        }
    }
