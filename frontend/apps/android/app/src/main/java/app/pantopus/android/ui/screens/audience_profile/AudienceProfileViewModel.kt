@file:Suppress("PackageNaming", "LongMethod", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.audience_profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.audience.AudienceCountsDto
import app.pantopus.android.data.api.models.audience.AudienceListResponse
import app.pantopus.android.data.api.models.audience.FanDto
import app.pantopus.android.data.api.models.audience.MembershipStatsCountsDto
import app.pantopus.android.data.api.models.audience.PersonaPostDto
import app.pantopus.android.data.api.models.audience.PersonaSummaryDto
import app.pantopus.android.data.api.models.audience.PersonaThreadDto
import app.pantopus.android.data.api.models.audience.PersonaTierDto
import app.pantopus.android.data.api.models.audience.PublishUpdateBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.audience.AudienceProfileRepository
import app.pantopus.android.ui.screens.audience_profile.broadcast_detail.BroadcastDetailSeedCache
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import javax.inject.Inject

/**
 * Backs the T3.3 Public Profile management screen — three tabs and
 * the Updates composer that POSTs to
 * `/api/broadcast/channels/:id/messages`. Mirrors iOS exactly:
 * sequential GETs (deterministic order in tests), `.empty` when the
 * persona is null, optimistic-clear of the composer on POST success.
 */
@HiltViewModel
class AudienceProfileViewModel
    @Inject
    constructor(
        private val repository: AudienceProfileRepository,
        private val broadcastSeedCache: BroadcastDetailSeedCache,
    ) : ViewModel() {
        private val _state = MutableStateFlow<AudienceProfileUiState>(AudienceProfileUiState.Loading)
        val state: StateFlow<AudienceProfileUiState> = _state.asStateFlow()

        private val _activeTab = MutableStateFlow(AudienceProfileTab.Updates)
        val activeTab: StateFlow<AudienceProfileTab> = _activeTab.asStateFlow()

        private val _selectedTierRank = MutableStateFlow<Int?>(null)
        val selectedTierRank: StateFlow<Int?> = _selectedTierRank.asStateFlow()

        private val _followerSearchText = MutableStateFlow("")
        val followerSearchText: StateFlow<String> = _followerSearchText.asStateFlow()

        private val _followerSort = MutableStateFlow(FollowerSort.NewestActive)
        val followerSort: StateFlow<FollowerSort> = _followerSort.asStateFlow()

        private val _activeThreadFilter = MutableStateFlow(ThreadsFilter.All)
        val activeThreadFilter: StateFlow<ThreadsFilter> = _activeThreadFilter.asStateFlow()

        private val _composer = MutableStateFlow(UpdateComposerState())
        val composer: StateFlow<UpdateComposerState> = _composer.asStateFlow()

        private var personaId: String? = null
        private var personaHandle: String? = null
        private var channelId: String? = null

        /** Exposed so the host can route the full Compose Broadcast surface. */
        val composePersonaId: String?
            get() = personaId

        fun load() {
            _state.value = AudienceProfileUiState.Loading
            _composer.value = _composer.value.copy(error = null)
            viewModelScope.launch {
                runCatching { fetchAndProject() }
                    .onFailure {
                        _state.value = AudienceProfileUiState.Error("Couldn't load Public Profile.")
                    }
            }
        }

        private suspend fun fetchAndProject() {
            val me =
                when (val r = repository.me()) {
                    is NetworkResult.Success -> r.data
                    is NetworkResult.Failure -> {
                        _state.value = AudienceProfileUiState.Error("Couldn't load Public Profile.")
                        return
                    }
                }
            val persona = me.persona
            val handle = persona?.handle
            if (persona == null || handle == null) {
                _state.value =
                    AudienceProfileUiState.Empty(
                        "Set up payments, invite your first followers, and send a broadcast when you're ready.",
                    )
                return
            }
            personaId = persona.id
            personaHandle = handle
            channelId = me.channel?.id

            val audience = unwrap(repository.audience()) ?: return
            val posts = unwrap(repository.posts(handle)) ?: return
            val tiers = unwrap(repository.tiers(handle)) ?: return
            val stats = unwrap(repository.membershipStats(persona.id)) ?: return
            val threads = unwrap(repository.threads(persona.id)) ?: return

            _state.value =
                AudienceProfileUiState.Loaded(
                    project(
                        persona = persona,
                        audience = audience,
                        posts = posts.posts,
                        tiers = tiers.tiers,
                        stats = stats.counts,
                        threads = threads.threads,
                        channelId = channelId,
                    ),
                )
        }

        private fun <T> unwrap(result: NetworkResult<T>): T? =
            when (result) {
                is NetworkResult.Success -> result.data
                is NetworkResult.Failure -> {
                    _state.value = AudienceProfileUiState.Error("Couldn't load Public Profile.")
                    null
                }
            }

        fun selectTab(tab: AudienceProfileTab) {
            _activeTab.value = tab
        }

        /** Cache the tapped update + tier ladder so
         *  [app.pantopus.android.ui.screens.audience_profile.broadcast_detail.BroadcastDetailViewModel]
         *  can pick them up after the navigation hop. */
        fun cacheBroadcastSeed(
            card: UpdateCardContent,
            tiers: List<TierBreakdownContent.TierSegment>,
        ) {
            broadcastSeedCache.cache(
                BroadcastDetailSeedCache.Seed(
                    broadcastId = card.id,
                    card = card,
                    tiers = tiers,
                ),
            )
        }

        fun selectTierFilter(rank: Int?) {
            _selectedTierRank.value = rank
        }

        fun onFollowerSearchText(text: String) {
            _followerSearchText.value = text
        }

        fun selectFollowerSort(sort: FollowerSort) {
            _followerSort.value = sort
        }

        fun selectThreadFilter(filter: ThreadsFilter) {
            _activeThreadFilter.value = filter
        }

        fun onComposerText(text: String) {
            _composer.value = _composer.value.copy(text = text)
        }

        fun onComposerVisibility(visibility: UpdateVisibility) {
            val current = _composer.value
            _composer.value =
                current.copy(
                    visibility = visibility,
                    targetTierRank = if (visibility == UpdateVisibility.TierOrAbove) current.targetTierRank else null,
                )
        }

        fun onComposerTier(rank: Int?) {
            _composer.value = _composer.value.copy(targetTierRank = rank)
        }

        /** POST the composer's body to the persona's broadcast channel.
         *  On success the composer text clears and `load()` reruns. */
        fun submitUpdate() {
            val snapshot = _composer.value
            if (!snapshot.canSubmit) return
            val ch = channelId ?: return
            _composer.value = snapshot.copy(isSubmitting = true, error = null)
            val body =
                PublishUpdateBody(
                    body = snapshot.text.trim(),
                    visibility = snapshot.visibility.wire,
                    targetTierRank = if (snapshot.visibility == UpdateVisibility.TierOrAbove) snapshot.targetTierRank else null,
                )
            viewModelScope.launch {
                when (repository.publishUpdate(ch, body)) {
                    is NetworkResult.Success -> {
                        _composer.value =
                            UpdateComposerState(
                                visibility = snapshot.visibility,
                                targetTierRank = snapshot.targetTierRank,
                            )
                        load()
                    }
                    is NetworkResult.Failure -> {
                        _composer.value = snapshot.copy(isSubmitting = false, error = "Couldn't post update.")
                    }
                }
            }
        }

        /**
         * Followers narrowed by [selectedTierRank], then by
         * [followerSearchText] (display name + handle, case-insensitive),
         * then ordered by [followerSort]. The default sort
         * [FollowerSort.NewestActive] preserves the natural API order —
         * the backend already serves most-recently-active first.
         */
        fun visibleFollowers(): List<FollowerRowContent> {
            val current = _state.value as? AudienceProfileUiState.Loaded ?: return emptyList()
            val rank = _selectedTierRank.value
            var rows = current.content.followers
            if (rank != null) rows = rows.filter { it.tierRank == rank }
            val query = _followerSearchText.value.trim().lowercase()
            if (query.isNotEmpty()) {
                rows =
                    rows.filter {
                        it.displayName.lowercase().contains(query) ||
                            it.handle.lowercase().contains(query)
                    }
            }
            return sortFollowers(rows, _followerSort.value)
        }

        /** Threads filtered by `activeThreadFilter`. */
        fun visibleThreads(): List<ThreadRowContent> {
            val current = _state.value as? AudienceProfileUiState.Loaded ?: return emptyList()
            val filter = _activeThreadFilter.value
            return current.content.threads.filter { matchesThreadFilter(it, filter) }
        }

        companion object {
            /**
             * Pure sort over the supplied [rows]. Stable across equal keys
             * because we tag each row with its original index and use it as
             * the final tie-break.
             */
            internal fun sortFollowers(
                rows: List<FollowerRowContent>,
                sort: FollowerSort,
            ): List<FollowerRowContent> {
                if (sort == FollowerSort.NewestActive) return rows
                val indexed = rows.withIndex().toList()
                val comparator: Comparator<IndexedValue<FollowerRowContent>> =
                    when (sort) {
                        FollowerSort.NewestActive ->
                            compareBy<IndexedValue<FollowerRowContent>> { it.index }
                        FollowerSort.HighestTier ->
                            compareByDescending<IndexedValue<FollowerRowContent>> { it.value.tierRank }
                                .thenBy { it.index }
                        FollowerSort.RecentlyJoined ->
                            compareBy<IndexedValue<FollowerRowContent>> { it.value.tenureMonths ?: Int.MAX_VALUE }
                                .thenBy { it.index }
                        FollowerSort.MostEngaged ->
                            compareByDescending<IndexedValue<FollowerRowContent>> { it.value.tierRank }
                                .thenByDescending { it.value.tenureMonths ?: -1 }
                                .thenBy { it.index }
                    }
                return indexed.sortedWith(comparator).map { it.value }
            }

            internal fun project(
                persona: PersonaSummaryDto,
                audience: AudienceListResponse,
                posts: List<PersonaPostDto>,
                tiers: List<PersonaTierDto>,
                stats: MembershipStatsCountsDto,
                threads: List<PersonaThreadDto>,
                channelId: String?,
            ): AudienceProfileLoaded {
                val header =
                    AudienceHeaderContent(
                        displayName = persona.displayName ?: persona.handle ?: "Public Profile",
                        handle = persona.handle?.let { "@$it" },
                        followerCount = audience.counts.totalActive ?: persona.followerCount ?: 0,
                        newThisWeek = audience.counts.pending ?: 0,
                        postCount = persona.postCount ?: posts.size,
                    )
                val updates = posts.mapNotNull(::updateCard)
                val analytics = analyticsCells(stats)
                val breakdown = tierBreakdown(audience.counts, tiers)
                val chips = tierChips(audience.counts, tiers)
                val followers = audience.items.mapNotNull(::followerRow)
                val threadRows = threads.mapNotNull(::threadRow)
                val threadsChips = threadsFilterChips(threadRows)
                return AudienceProfileLoaded(
                    header = header,
                    updates = updates,
                    analyticsCells = analytics,
                    tierBreakdown = breakdown,
                    tierChips = chips,
                    followers = followers,
                    threads = threadRows,
                    threadsFilterChips = threadsChips,
                    channelId = channelId,
                )
            }

            internal fun threadsFilterChips(threads: List<ThreadRowContent>): List<ThreadsFilterChipContent> {
                val total = threads.size
                val unread = threads.count { it.unreadCount > 0 }
                val bronzePlus = threads.count { it.tierRank >= 2 }
                return listOf(
                    ThreadsFilterChipContent(
                        id = ThreadsFilter.All.key,
                        filter = ThreadsFilter.All,
                        label = ThreadsFilter.All.title,
                        count = total,
                    ),
                    ThreadsFilterChipContent(
                        id = ThreadsFilter.Unread.key,
                        filter = ThreadsFilter.Unread,
                        label = ThreadsFilter.Unread.title,
                        count = unread,
                    ),
                    ThreadsFilterChipContent(
                        id = ThreadsFilter.BronzePlus.key,
                        filter = ThreadsFilter.BronzePlus,
                        label = ThreadsFilter.BronzePlus.title,
                        count = bronzePlus,
                    ),
                    ThreadsFilterChipContent(
                        id = ThreadsFilter.Flagged.key,
                        filter = ThreadsFilter.Flagged,
                        label = ThreadsFilter.Flagged.title,
                        count = null,
                    ),
                )
            }

            internal fun matchesThreadFilter(
                row: ThreadRowContent,
                filter: ThreadsFilter,
            ): Boolean =
                when (filter) {
                    ThreadsFilter.All -> true
                    ThreadsFilter.Unread -> row.unreadCount > 0
                    ThreadsFilter.BronzePlus -> row.tierRank >= 2
                    ThreadsFilter.Flagged -> row.flagged
                }

            private fun updateCard(dto: PersonaPostDto): UpdateCardContent =
                UpdateCardContent(
                    id = dto.id,
                    body = dto.body.orEmpty(),
                    timeAgo = timeAgo(dto.createdAt),
                    visibility = UpdateVisibility.fromWire(dto.visibility),
                    targetTierRank = dto.targetTierRank,
                    deliveredCount = dto.deliveredCount ?: 0,
                    readCount = dto.readCount ?: 0,
                )

            private fun analyticsCells(stats: MembershipStatsCountsDto): List<AnalyticsCellContent> =
                listOf(
                    AnalyticsCellContent(id = "followers", label = "Followers", value = "${stats.followers ?: 0}"),
                    AnalyticsCellContent(id = "members", label = "Members", value = "${stats.members ?: 0}"),
                    AnalyticsCellContent(id = "insiders", label = "Insiders", value = "${stats.insiders ?: 0}"),
                    AnalyticsCellContent(id = "direct", label = "Direct", value = "${stats.direct ?: 0}"),
                )

            private fun tierBreakdown(
                counts: AudienceCountsDto,
                tiers: List<PersonaTierDto>,
            ): TierBreakdownContent {
                val byTier = counts.byTier.orEmpty()
                val sorted = tiers.sortedBy { it.rank }
                val segments =
                    sorted.map { tier ->
                        TierBreakdownContent.TierSegment(
                            id = tier.id,
                            rank = tier.rank,
                            name = tier.name,
                            count = byTier[tier.rank.toString()] ?: 0,
                        )
                    }
                val total = segments.sumOf { it.count }
                return TierBreakdownContent(total = total, segments = segments)
            }

            private fun tierChips(
                counts: AudienceCountsDto,
                tiers: List<PersonaTierDto>,
            ): List<TierChipContent> {
                val byTier = counts.byTier.orEmpty()
                val total = counts.totalActive ?: 0
                val all = TierChipContent(id = "all", rank = null, label = "All", count = total)
                val perTier =
                    tiers.sortedBy { it.rank }.map { tier ->
                        TierChipContent(
                            id = "tier_${tier.rank}",
                            rank = tier.rank,
                            label = tier.name,
                            count = byTier[tier.rank.toString()] ?: 0,
                        )
                    }
                return listOf(all) + perTier
            }

            private fun followerRow(dto: FanDto): FollowerRowContent? {
                val handle = dto.fanHandle ?: return null
                val rank = dto.tier?.rank ?: 1
                val tierName = dto.tier?.name ?: "Follower"
                val tenure =
                    dto.tenureMonths?.let { months ->
                        when {
                            months <= 0 -> "Just joined"
                            months == 1 -> "1 mo."
                            else -> "$months mo."
                        }
                    }
                return FollowerRowContent(
                    id = dto.id,
                    displayName = dto.fanDisplayName ?: handle,
                    handle = "@$handle",
                    avatarUrl = dto.fanAvatarUrl,
                    tierName = tierName,
                    tierRank = rank,
                    tenureLabel = tenure,
                    tenureMonths = dto.tenureMonths,
                    joinedMonth = dto.joinedMonth,
                    verifiedLocal = dto.verifiedLocal == true,
                )
            }

            private fun threadRow(dto: PersonaThreadDto): ThreadRowContent {
                val handle = dto.fanHandle.orEmpty()
                return ThreadRowContent(
                    id = dto.id,
                    displayName = dto.fanDisplayName ?: handle.ifEmpty { "Follower" },
                    handle = if (handle.isEmpty()) "" else "@$handle",
                    avatarUrl = dto.fanAvatarUrl,
                    tierName = dto.tier?.name,
                    tierRank = dto.tier?.rank ?: 1,
                    preview = dto.lastMessagePreview.orEmpty(),
                    timeAgo = timeAgo(dto.lastMessageAt),
                    unreadCount = dto.unreadCount ?: 0,
                    flagged = dto.flagged ?: false,
                )
            }

            private fun timeAgo(iso: String?): String {
                if (iso.isNullOrBlank()) return ""
                val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return ""
                val secs = Duration.between(instant, Instant.now()).seconds.coerceAtLeast(0)
                val mins = secs / 60
                if (mins < 1) return "Just now"
                if (mins < 60) return "${mins}m ago"
                val hrs = mins / 60
                if (hrs < 24) return "${hrs}h ago"
                val days = hrs / 24
                if (days < 7) return "${days}d ago"
                return "${days / 7}w ago"
            }
        }
    }
