@file:Suppress(
    "MagicNumber",
    "PackageNaming",
    "TooManyFunctions",
    "ReturnCount",
    "LongMethod",
    "ComplexMethod",
    "CyclomaticComplexMethod",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.my_posts

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.posts.MyPostDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.posts.PulsePostsRefreshNotifier
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.shared.activity_filter_sheet.ActivityFilter
import app.pantopus.android.ui.screens.shared.activity_filter_sheet.ActivitySortOrder
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterOption
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowBodyEmphasis
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowEngagement
import app.pantopus.android.ui.screens.shared.list_of_rows.RowEngagementCta
import app.pantopus.android.ui.screens.shared.list_of_rows.RowEngagementItem
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
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
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject

/** Stable tab ids exposed for tests + the screen. */
object MyPostsTab {
    const val ACTIVE = "active"
    const val ARCHIVED = "archived"
}

/** Lightweight presentation contract for the per-row kebab action sheet. */
data class MyPostsKebabTarget(
    val postId: String,
    val isArchived: Boolean,
)

/** Presentation contract for the destructive delete confirmation alert. */
data class MyPostsDeleteTarget(
    val postId: String,
)

/**
 * T5.3.3 — My posts. Drives the screen against the shared
 * [app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen]
 * archetype. See header comment in the iOS counterpart
 * (MyPostsViewModel.swift) for the mapping rules.
 *
 * Endpoints (existing — frontend-only PR per product call):
 *   - GET    /api/posts/user/:userId  (posts.js:3016, active set)
 *   - DELETE /api/posts/:id           (posts.js:2483)
 *
 * Mutations:
 *   - archive / unarchive — POST /:id/archive and /:id/unarchive with
 *     optimistic rollback on failure.
 */
@HiltViewModel
class MyPostsViewModel
    @Inject
    constructor(
        private val postsRepo: PostsRepository,
        private val authRepo: AuthRepository,
        private val postsRefresh: PulsePostsRefreshNotifier,
    ) : ViewModel() {
        private var posts: List<MyPostDto> = emptyList()
        private var localArchiveOverrides: MutableMap<String, String?> = mutableMapOf()
        private var loadedAtLeastOnce = false
        private var nowProvider: () -> Instant = { Instant.now() }

        private var openPostHandler: (MyPostDto) -> Unit = {}
        private var composeHandler: () -> Unit = {}
        private var editPostHandler: (MyPostDto) -> Unit = {}

        init {
            viewModelScope.launch {
                postsRefresh.ticks.collect {
                    refresh()
                }
            }
        }

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(MyPostsTab.ACTIVE)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _tabs = MutableStateFlow(defaultTabs())
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _topBarAction =
            MutableStateFlow<TopBarAction?>(
                TopBarAction(
                    icon = PantopusIcon.Filter,
                    contentDescription = "Filter posts",
                    onClick = { openFilterSheet() },
                ),
            )
        val topBarAction: StateFlow<TopBarAction?> = _topBarAction.asStateFlow()

        // Activity filter (P5.4)
        private val _showFilterSheet = MutableStateFlow(false)
        val showFilterSheet: StateFlow<Boolean> = _showFilterSheet.asStateFlow()

        private val _activityFilter = MutableStateFlow(ActivityFilter())
        val activityFilter: StateFlow<ActivityFilter> = _activityFilter.asStateFlow()

        /** Posts filter by intent, so the chips read as a post "Type". */
        val statusFilterTitle = "Type"

        /** Per-surface status chips — the post intents. */
        val statusFilterOptions =
            listOf(
                PulseIntent.Ask,
                PulseIntent.Recommend,
                PulseIntent.Event,
                PulseIntent.Lost,
                PulseIntent.Alert,
                PulseIntent.Deal,
                PulseIntent.Announce,
                PulseIntent.NeighborhoodWin,
                PulseIntent.VisitorGuide,
            ).map { FilterOption(id = intentFilterId(it), label = intentLabel(it)) }

        /** Posts have no per-row value — only date ordering applies. */
        val sortFilterOptions = ActivitySortOrder.TIME_ONLY

        fun openFilterSheet() {
            _showFilterSheet.value = true
        }

        fun dismissFilterSheet() {
            _showFilterSheet.value = false
        }

        fun applyFilter(filter: ActivityFilter) {
            _activityFilter.value = filter
            applyState()
        }

        private val _fab =
            MutableStateFlow<FabAction?>(
                FabAction(
                    icon = PantopusIcon.Pencil,
                    contentDescription = "Write a post",
                    variant = FabVariant.SecondaryCreate,
                    onClick = { composeHandler() },
                ),
            )
        val fab: StateFlow<FabAction?> = _fab.asStateFlow()

        private val _kebabTarget = MutableStateFlow<MyPostsKebabTarget?>(null)
        val kebabTarget: StateFlow<MyPostsKebabTarget?> = _kebabTarget.asStateFlow()

        private val _deleteTarget = MutableStateFlow<MyPostsDeleteTarget?>(null)
        val deleteTarget: StateFlow<MyPostsDeleteTarget?> = _deleteTarget.asStateFlow()

        /** Wire navigation callbacks before [load]. Same shape as MyBids. */
        fun bindCallbacks(
            onOpenPost: (MyPostDto) -> Unit,
            onCompose: () -> Unit,
            onEditPost: (MyPostDto) -> Unit,
        ) {
            openPostHandler = onOpenPost
            composeHandler = onCompose
            editPostHandler = onEditPost
            _fab.value =
                FabAction(
                    icon = PantopusIcon.Pencil,
                    contentDescription = "Write a post",
                    variant = FabVariant.SecondaryCreate,
                    onClick = { composeHandler() },
                )
        }

        /** Test hook — override the clock for deterministic time-window verdicts. */
        internal fun overrideNow(provider: () -> Instant) {
            nowProvider = provider
        }

        fun load() {
            if (_state.value is ListOfRowsUiState.Loaded && loadedAtLeastOnce) return
            reload()
        }

        fun refresh() {
            // Refresh requeries the wire (active posts only); wipe the local
            // archive overrides so the UI doesn't show stale optimistic state.
            localArchiveOverrides.clear()
            reload()
        }

        fun selectTab(id: String) {
            if (_selectedTab.value == id) return
            _selectedTab.value = id
            applyState()
        }

        fun loadMoreIfNeeded() = Unit

        private fun reload() {
            val userId = currentUserId()
            if (userId == null) {
                posts = emptyList()
                loadedAtLeastOnce = true
                applyState()
                return
            }
            if (!loadedAtLeastOnce) _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = postsRepo.userPosts(userId)) {
                    is NetworkResult.Success -> {
                        posts = result.data.posts
                        loadedAtLeastOnce = true
                        applyState()
                    }
                    is NetworkResult.Failure -> {
                        if (!loadedAtLeastOnce) {
                            _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                        }
                    }
                }
            }
        }

        private fun currentUserId(): String? = (authRepo.state.value as? AuthRepository.State.SignedIn)?.user?.id

        private fun applyState() {
            val now = nowProvider()
            val projections =
                posts.map { dto ->
                    val archived = isArchived(dto)
                    val tab = if (archived) MyPostsTab.ARCHIVED else MyPostsTab.ACTIVE
                    PostProjection(dto = dto, tab = tab, isArchived = archived)
                }
            val counts = tabCounts(projections)
            _tabs.value =
                listOf(
                    ListOfRowsTab(id = MyPostsTab.ACTIVE, label = "Active", count = counts.active),
                    ListOfRowsTab(id = MyPostsTab.ARCHIVED, label = "Archived", count = counts.archived),
                )

            val tabItems = projections.filter { it.tab == _selectedTab.value }
            val visible =
                _activityFilter.value.apply(
                    items = tabItems,
                    now = now,
                    statusId = { intentFilterId(PulseIntent.fromPostType(it.dto.postType)) },
                    date = { parseInstant(it.dto.createdAt) },
                    value = { null },
                )
            if (visible.isEmpty()) {
                _state.value =
                    if (_activityFilter.value.isActive && tabItems.isNotEmpty()) {
                        filteredEmptyState()
                    } else {
                        emptyStateFor(_selectedTab.value)
                    }
                return
            }
            val rows = visible.map { row(it, now) }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = _selectedTab.value, rows = rows)),
                    hasMore = false,
                )
        }

        private fun filteredEmptyState(): ListOfRowsUiState.Empty =
            ListOfRowsUiState.Empty(
                icon = PantopusIcon.Filter,
                headline = "No posts match your filters",
                subcopy =
                    "Try a different type, date range, or sort — or clear " +
                        "your filters to see everything in this tab.",
                ctaTitle = "Clear filters",
                onCta = { applyFilter(ActivityFilter()) },
            )

        private fun emptyStateFor(tab: String): ListOfRowsUiState.Empty =
            when (tab) {
                MyPostsTab.ACTIVE ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.MessageSquarePlus,
                        headline = "You haven’t posted yet",
                        subcopy =
                            "Ask a question, recommend a spot, or share a local heads-up. " +
                                "Your neighbors will see it on the Pulse.",
                        ctaTitle = "Write a post",
                        onCta = { composeHandler() },
                    )
                MyPostsTab.ARCHIVED ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Archive,
                        headline = "Nothing archived",
                        subcopy =
                            "Archived posts move out of the Pulse but stay on your profile. " +
                                "Use the kebab on any active post to archive it.",
                        ctaTitle = null,
                        onCta = null,
                    )
                else ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.MessageSquarePlus,
                        headline = "Nothing here",
                        subcopy = "",
                        ctaTitle = null,
                        onCta = null,
                    )
            }

        // MARK: - Mutations

        fun requestKebab(dto: MyPostDto) {
            _kebabTarget.value = MyPostsKebabTarget(postId = dto.id, isArchived = isArchived(dto))
        }

        fun cancelKebab() {
            _kebabTarget.value = null
        }

        fun requestDelete(postId: String) {
            _kebabTarget.value = null
            _deleteTarget.value = MyPostsDeleteTarget(postId = postId)
        }

        fun cancelDelete() {
            _deleteTarget.value = null
        }

        /**
         * Optimistically archive a post, then persist via the backend.
         */
        fun archive(postId: String) {
            _kebabTarget.value = null
            val previous = localArchiveOverrides.toMap()
            localArchiveOverrides[postId] = nowProvider().toString()
            applyState()
            viewModelScope.launch {
                when (postsRepo.archivePost(postId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        localArchiveOverrides = previous.toMutableMap()
                        applyState()
                    }
                }
            }
        }

        fun unarchive(postId: String) {
            _kebabTarget.value = null
            val previous = localArchiveOverrides.toMap()
            // Explicit `null` value (with containsKey == true) wins over the
            // wire `archived_at` in [isArchived].
            localArchiveOverrides[postId] = null
            applyState()
            viewModelScope.launch {
                when (postsRepo.unarchivePost(postId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        localArchiveOverrides = previous.toMutableMap()
                        applyState()
                    }
                }
            }
        }

        fun confirmDelete() {
            val target = _deleteTarget.value ?: return
            _deleteTarget.value = null
            val previousPosts = posts
            val previousOverrides = localArchiveOverrides.toMap()
            posts = posts.filterNot { it.id == target.postId }
            localArchiveOverrides.remove(target.postId)
            applyState()
            viewModelScope.launch {
                when (postsRepo.deletePost(target.postId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        posts = previousPosts
                        localArchiveOverrides = previousOverrides.toMutableMap()
                        applyState()
                    }
                }
            }
        }

        // MARK: - Pure projections (test surface)

        data class PostProjection(
            val dto: MyPostDto,
            val tab: String,
            val isArchived: Boolean,
        )

        data class TabCounts(
            val active: Int = 0,
            val archived: Int = 0,
        )

        /**
         * Visibility verdict that merges the wire `archived_at` with the
         * local override map. Returns true when either the wire DTO says
         * archived OR the user has optimistically archived it.
         */
        fun isArchived(dto: MyPostDto): Boolean {
            if (localArchiveOverrides.containsKey(dto.id)) {
                return localArchiveOverrides[dto.id] != null
            }
            return dto.archivedAt != null
        }

        private fun row(
            projection: PostProjection,
            now: Instant,
        ): RowModel {
            val dto = projection.dto
            val intent = PulseIntent.fromPostType(dto.postType)
            val cta =
                if (projection.isArchived) {
                    RowEngagementCta(
                        label = "Restore",
                        icon = PantopusIcon.ArrowsRepeat,
                        accessibilityLabel = "Restore post",
                        onClick = { unarchive(dto.id) },
                    )
                } else {
                    RowEngagementCta(
                        label = "Edit",
                        icon = PantopusIcon.Pencil,
                        accessibilityLabel = "Edit post",
                        onClick = { editPostHandler(dto) },
                    )
                }
            val headerChips = mutableListOf(intentChip(intent, projection.isArchived))
            if (projection.isArchived) headerChips.add(archivedChip())

            return RowModel(
                id = dto.id,
                title = "",
                template = RowTemplate.StatusChip,
                leading = RowLeading.None,
                trailing = RowTrailing.Kebab,
                onTap = { openPostHandler(dto) },
                onSecondary = { requestKebab(dto) },
                body = postBody(dto),
                bodyEmphasis = RowBodyEmphasis.Primary,
                headerChips = headerChips,
                timeMeta = timeMetaLabel(dto, now),
                highlight = if (projection.isArchived) RowHighlight.Archived else null,
                engagement =
                    RowEngagement(
                        items = engagementItems(dto, intent),
                        cta = cta,
                    ),
            )
        }

        private fun defaultTabs() =
            listOf(
                ListOfRowsTab(id = MyPostsTab.ACTIVE, label = "Active", count = 0),
                ListOfRowsTab(id = MyPostsTab.ARCHIVED, label = "Archived", count = 0),
            )

        companion object {
            fun tabCounts(projections: List<PostProjection>): TabCounts =
                projections.fold(TabCounts()) { acc, proj ->
                    if (proj.isArchived) {
                        acc.copy(archived = acc.archived + 1)
                    } else {
                        acc.copy(active = acc.active + 1)
                    }
                }

            fun postBody(dto: MyPostDto): String {
                val content = dto.content
                if (!content.isNullOrEmpty()) return content
                val title = dto.title
                if (!title.isNullOrEmpty()) return title
                return ""
            }

            fun intentChip(
                intent: PulseIntent,
                isArchived: Boolean,
            ): RowChip {
                val palette = paletteFor(intent)
                return RowChip(
                    text = intentLabel(intent),
                    icon = intent.icon,
                    tint =
                        RowChip.Tint.Custom(
                            background = if (isArchived) PantopusColors.appSurfaceSunken else palette.background,
                            foreground = if (isArchived) PantopusColors.appTextSecondary else palette.foreground,
                        ),
                )
            }

            private fun archivedChip(): RowChip =
                RowChip(
                    text = "ARCHIVED",
                    icon = PantopusIcon.Archive,
                    tint =
                        RowChip.Tint.Custom(
                            background = PantopusColors.appSurfaceSunken,
                            foreground = PantopusColors.appTextSecondary,
                        ),
                )

            /** Map a post intent onto its filter chip id. */
            fun intentFilterId(intent: PulseIntent): String =
                when (intent) {
                    PulseIntent.All -> "all"
                    PulseIntent.Ask -> "ask"
                    PulseIntent.Recommend -> "recommend"
                    PulseIntent.Event -> "event"
                    PulseIntent.Lost -> "lost"
                    PulseIntent.Alert -> "alert"
                    PulseIntent.Deal -> "deal"
                    PulseIntent.Announce -> "announce"
                    PulseIntent.NeighborhoodWin -> "neighborhoodWin"
                    PulseIntent.VisitorGuide -> "visitorGuide"
                }

            /** Intent → display label per design (`Lost & Found` not `Lost`). */
            fun intentLabel(intent: PulseIntent): String =
                when (intent) {
                    PulseIntent.All -> "All"
                    PulseIntent.Ask -> "Ask"
                    PulseIntent.Recommend -> "Recommend"
                    PulseIntent.Event -> "Event"
                    PulseIntent.Lost -> "Lost & Found"
                    PulseIntent.Alert -> "Alerts"
                    PulseIntent.Deal -> "Deals"
                    PulseIntent.Announce -> "Announce"
                    PulseIntent.NeighborhoodWin -> "Wins"
                    PulseIntent.VisitorGuide -> "Guide"
                }

            private data class IntentPalette(
                val foreground: androidx.compose.ui.graphics.Color,
                val background: androidx.compose.ui.graphics.Color,
            )

            private fun paletteFor(intent: PulseIntent): IntentPalette =
                when (intent) {
                    PulseIntent.All ->
                        IntentPalette(
                            foreground = PantopusColors.appTextSecondary,
                            background = PantopusColors.appSurfaceSunken,
                        )
                    PulseIntent.Ask ->
                        IntentPalette(
                            foreground = PantopusColors.warning,
                            background = PantopusColors.warningBg,
                        )
                    PulseIntent.Recommend ->
                        IntentPalette(
                            foreground = PantopusColors.success,
                            background = PantopusColors.successBg,
                        )
                    PulseIntent.Event ->
                        IntentPalette(
                            foreground = PantopusColors.business,
                            background = PantopusColors.businessBg,
                        )
                    PulseIntent.Lost ->
                        IntentPalette(
                            foreground = PantopusColors.error,
                            background = PantopusColors.errorBg,
                        )
                    PulseIntent.Alert ->
                        IntentPalette(
                            foreground = PantopusColors.error,
                            background = PantopusColors.errorBg,
                        )
                    PulseIntent.Deal ->
                        IntentPalette(
                            foreground = PantopusColors.success,
                            background = PantopusColors.successBg,
                        )
                    PulseIntent.Announce ->
                        IntentPalette(
                            foreground = PantopusColors.appTextStrong,
                            background = PantopusColors.appSurfaceSunken,
                        )
                    PulseIntent.NeighborhoodWin ->
                        IntentPalette(
                            foreground = PantopusColors.warning,
                            background = PantopusColors.warningBg,
                        )
                    PulseIntent.VisitorGuide ->
                        IntentPalette(
                            foreground = PantopusColors.info,
                            background = PantopusColors.infoBg,
                        )
                }

            fun engagementItems(
                dto: MyPostDto,
                intent: PulseIntent,
            ): List<RowEngagementItem> {
                val replies =
                    RowEngagementItem(
                        id = "replies",
                        icon = PantopusIcon.MessageCircle,
                        label = "${dto.commentCount} ${if (dto.commentCount == 1) "reply" else "replies"}",
                    )
                val likes =
                    RowEngagementItem(
                        id = "likes",
                        icon = PantopusIcon.ThumbsUp,
                        label = "${dto.likeCount} ${if (dto.likeCount == 1) "like" else "likes"}",
                    )
                return when (intent) {
                    PulseIntent.Event ->
                        listOf(
                            RowEngagementItem(
                                id = "going",
                                icon = PantopusIcon.CheckCircle,
                                label = "${dto.likeCount} going",
                            ),
                            replies,
                        )
                    PulseIntent.Recommend ->
                        listOf(
                            RowEngagementItem(
                                id = "helpful",
                                icon = PantopusIcon.ThumbsUp,
                                label = "${dto.likeCount} helpful",
                            ),
                            replies,
                        )
                    PulseIntent.Lost ->
                        listOf(
                            replies,
                            RowEngagementItem(
                                id = "seen",
                                icon = PantopusIcon.Eye,
                                label = "${dto.likeCount} seen",
                            ),
                        )
                    PulseIntent.Ask,
                    PulseIntent.Alert,
                    PulseIntent.Deal,
                    PulseIntent.Announce,
                    PulseIntent.NeighborhoodWin,
                    PulseIntent.VisitorGuide,
                    PulseIntent.All,
                    ->
                        listOf(replies, likes)
                }
            }

            fun timeMetaLabel(
                dto: MyPostDto,
                now: Instant,
            ): String {
                val parts = mutableListOf<String>()
                relativeTime(dto.createdAt, now)?.let { parts.add(it) }
                dto.locationName?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
                return parts.joinToString(" · ")
            }

            fun parseInstant(raw: String?): Instant? {
                if (raw.isNullOrEmpty()) return null
                return runCatching { Instant.parse(raw) }.getOrNull()
            }

            fun relativeTime(
                raw: String?,
                now: Instant,
                zone: ZoneId = ZoneId.systemDefault(),
            ): String? {
                val date = parseInstant(raw) ?: return null
                val seconds = ChronoUnit.SECONDS.between(date, now)
                return when {
                    seconds < 60 -> "now"
                    seconds < 3600 -> "${seconds / 60}m"
                    seconds < 86_400 -> "${seconds / 3600}h"
                    else -> {
                        val today = now.atZone(zone).toLocalDate()
                        val createdDate = date.atZone(zone).toLocalDate()
                        val days = ChronoUnit.DAYS.between(createdDate, today)
                        when {
                            days == 1L -> "Yesterday"
                            days < 7L ->
                                createdDate.dayOfWeek.getDisplayName(
                                    TextStyle.SHORT,
                                    Locale.US,
                                )
                            else ->
                                DateTimeFormatter
                                    .ofPattern("MMM d", Locale.US)
                                    .withZone(zone)
                                    .format(date)
                        }
                    }
                }
            }
        }
    }
