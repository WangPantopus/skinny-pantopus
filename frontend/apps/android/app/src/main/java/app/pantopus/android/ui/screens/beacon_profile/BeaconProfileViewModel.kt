@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions", "LongParameterList", "ComplexCondition")

package app.pantopus.android.ui.screens.beacon_profile

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.audience.PersonaTierDto
import app.pantopus.android.data.api.models.beacon.BeaconPersonaDto
import app.pantopus.android.data.api.models.beacon.BeaconPersonaResponse
import app.pantopus.android.data.api.models.beacon.BeaconPostDto
import app.pantopus.android.data.api.models.beacon.BeaconViewerDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.beacon.BeaconProfileRepository
import app.pantopus.android.data.broadcast.BroadcastReadRepository
import app.pantopus.android.ui.screens.profile.PublicProfileHeader
import app.pantopus.android.ui.screens.profile.PublicProfilePost
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileStatCell
import app.pantopus.android.ui.screens.shared.media.buildPostMediaItems
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.time.Duration
import java.time.Instant
import java.util.Date
import javax.inject.Inject

/** Nav-arg key for the visitor handle. Absent ⇒ owner ("My Beacon"). */
const val BEACON_HANDLE_KEY = "handle"

/** The tab strip beneath the identity block. */
enum class BeaconProfileTab { Broadcasts, About, Tiers }

/** Visitor follow relationship projected from the persona `viewer`. */
enum class BeaconFollowStatus { None, Pending, Active }

/** One subscription tier on the Tiers tab. */
data class BeaconTier(
    val id: String,
    val rank: Int,
    val name: String,
    val priceLabel: String,
    val detail: String?,
)

/** One labelled link on the About tab. */
data class BeaconLink(
    val label: String,
    val url: String,
)

/** Render-ready payload, mirroring iOS `BeaconProfileContent`. */
data class BeaconProfileContent(
    val personaId: String,
    val channelId: String?,
    val isOwner: Boolean,
    val handle: String,
    val displayName: String,
    val header: PublicProfileHeader,
    val stats: List<ProfileStatCell>,
    val bio: String?,
    val categoryLabel: String?,
    val audienceLabel: String,
    val audienceModeLabel: String?,
    val links: List<BeaconLink>,
    val posts: List<PublicProfilePost>,
    val tiers: List<BeaconTier>,
    val broadcastEnabled: Boolean,
    val shareUrl: String,
    /** Raw follower count, kept alongside the compacted "Beacons" stat so the
     *  optimistic follow/unfollow bump recomputes from the number (not the
     *  display string, which would turn "1.2K" into "13"). */
    val followerCount: Int,
)

/** Observed UI state for the Beacon profile screen. */
sealed interface BeaconProfileUiState {
    data object Loading : BeaconProfileUiState

    data class Loaded(val content: BeaconProfileContent) : BeaconProfileUiState

    /** Owner with no Beacon yet — render the setup invitation. */
    data object Empty : BeaconProfileUiState

    data class Error(val message: String) : BeaconProfileUiState
}

@HiltViewModel
class BeaconProfileViewModel
    @Inject
    constructor(
        private val repo: BeaconProfileRepository,
        private val broadcastReads: BroadcastReadRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val handleArg: String? =
            savedStateHandle.get<String>(BEACON_HANDLE_KEY)?.removePrefix("@")?.takeIf { it.isNotBlank() }

        val isOwner: Boolean = handleArg == null

        private val _state = MutableStateFlow<BeaconProfileUiState>(BeaconProfileUiState.Loading)
        val state: StateFlow<BeaconProfileUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(BeaconProfileTab.Broadcasts)
        val selectedTab: StateFlow<BeaconProfileTab> = _selectedTab.asStateFlow()

        private val _followStatus = MutableStateFlow(BeaconFollowStatus.None)
        val followStatus: StateFlow<BeaconFollowStatus> = _followStatus.asStateFlow()

        private val _notificationsEnabled = MutableStateFlow(false)
        val notificationsEnabled: StateFlow<Boolean> = _notificationsEnabled.asStateFlow()

        private val _followBusy = MutableStateFlow(false)
        val followBusy: StateFlow<Boolean> = _followBusy.asStateFlow()

        private val _toastMessage = MutableStateFlow<String?>(null)
        val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

        private val _showFollowHandshake = MutableStateFlow(false)
        val showFollowHandshake: StateFlow<Boolean> = _showFollowHandshake.asStateFlow()

        private var loadedHandle: String = ""
        private var loadedPersonaId: String = ""

        /**
         * Broadcast ids already reported as read this session, so a
         * pull-to-refresh doesn't double-count. RN keeps the same `Set` in a
         * ref (`src/app/persona/[personaHandle]/index.tsx:61`).
         */
        private val markedBroadcastIds = mutableSetOf<String>()

        fun load() {
            if (_state.value is BeaconProfileUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = BeaconProfileUiState.Loading
            viewModelScope.launch { fetch() }
        }

        fun selectTab(tab: BeaconProfileTab) {
            _selectedTab.value = tab
        }

        fun dismissToast() {
            _toastMessage.value = null
        }

        private val _handshakePreselectedTierRank = MutableStateFlow<Int?>(null)
        val handshakePreselectedTierRank: StateFlow<Int?> = _handshakePreselectedTierRank.asStateFlow()

        /** Visitor unlock on a tier-gated broadcast. */
        fun unlockBroadcast(tierRank: Int?) {
            if (isOwner) return
            _handshakePreselectedTierRank.value = tierRank
            _showFollowHandshake.value = true
        }

        fun clearHandshakeTier() {
            _handshakePreselectedTierRank.value = null
        }

        /** Visitor Follow → route through the privacy handshake wizard. */
        fun follow() {
            if (isOwner || _followBusy.value || _followStatus.value != BeaconFollowStatus.None) return
            _handshakePreselectedTierRank.value = null
            _showFollowHandshake.value = true
        }

        fun setShowFollowHandshake(show: Boolean) {
            _showFollowHandshake.value = show
        }

        fun unfollow() {
            if (isOwner || _followBusy.value || _followStatus.value == BeaconFollowStatus.None || loadedPersonaId.isEmpty()) return
            _followBusy.value = true
            viewModelScope.launch {
                when (repo.unfollow(loadedPersonaId)) {
                    is NetworkResult.Success -> {
                        _followStatus.value = BeaconFollowStatus.None
                        _notificationsEnabled.value = false
                        _toastMessage.value = "Unfollowed"
                        bumpFollowers(-1)
                    }
                    is NetworkResult.Failure -> _toastMessage.value = "Couldn't unfollow."
                }
                _followBusy.value = false
            }
        }

        private suspend fun fetch() {
            val envelopeResult = if (isOwner) repo.me() else repo.persona(handleArg.orEmpty())
            when (envelopeResult) {
                is NetworkResult.Success -> projectLoaded(envelopeResult.data)
                is NetworkResult.Failure ->
                    _state.value = BeaconProfileUiState.Error(friendlyMessage(envelopeResult.error))
            }
        }

        private suspend fun projectLoaded(envelope: BeaconPersonaResponse) {
            val persona = envelope.persona
            if (persona == null) {
                // Owner with no Beacon ⇒ setup; visitor 200-with-null ⇒ not found.
                _state.value = if (isOwner) BeaconProfileUiState.Empty else BeaconProfileUiState.Error("Beacon not found.")
                return
            }
            loadedHandle = persona.handle.orEmpty()
            loadedPersonaId = persona.id
            projectViewer(persona.viewer)

            val posts = if (loadedHandle.isEmpty()) emptyList() else loadPosts(loadedHandle)
            val tiers = if (loadedHandle.isEmpty()) emptyList() else loadTiers(loadedHandle)

            _state.value = BeaconProfileUiState.Loaded(build(persona, envelope.channel?.id, posts, tiers))
            markBroadcastsRead(posts, persona.viewer)
        }

        /**
         * Report every broadcast the viewer just saw as read. Fire-and-forget:
         * the increment feeds the creator's read-count analytics, so a failure
         * must never surface to the fan. The owner's own views are skipped
         * (the backend ignores them anyway) and a locked / tier-gated row is
         * skipped because the viewer never actually read it.
         *
         * Mirrors RN `markBroadcastPostsRead`
         * (`src/app/persona/[personaHandle]/index.tsx:63-72`).
         */
        private fun markBroadcastsRead(
            posts: List<BeaconPostDto>,
            viewer: BeaconViewerDto?,
        ) {
            if (isOwner || viewer?.isOwner == true) return
            val eligible =
                posts.filter { post ->
                    val id = post.id
                    !id.isNullOrEmpty() &&
                        !post.broadcastChannelId.isNullOrEmpty() &&
                        post.locked != true &&
                        markedBroadcastIds.add(id)
                }
            if (eligible.isEmpty()) return
            viewModelScope.launch {
                eligible.forEach { post ->
                    val id = post.id ?: return@forEach
                    if (broadcastReads.markRead(id) is NetworkResult.Failure) {
                        // Let a later visit retry this one.
                        markedBroadcastIds.remove(id)
                    }
                }
            }
        }

        private suspend fun loadPosts(handle: String): List<BeaconPostDto> =
            when (val r = repo.posts(handle)) {
                is NetworkResult.Success -> r.data.posts
                is NetworkResult.Failure -> emptyList()
            }

        private suspend fun loadTiers(handle: String): List<PersonaTierDto> =
            when (val r = repo.tiers(handle)) {
                is NetworkResult.Success -> r.data.tiers
                is NetworkResult.Failure -> emptyList()
            }

        private fun projectViewer(viewer: BeaconViewerDto?) {
            if (viewer == null || viewer.isOwner == true) {
                _followStatus.value = BeaconFollowStatus.None
                _notificationsEnabled.value = false
                return
            }
            _followStatus.value =
                when (viewer.followStatus) {
                    "pending" -> BeaconFollowStatus.Pending
                    "active", "muted" -> BeaconFollowStatus.Active
                    else -> if (viewer.isFollowing == true) BeaconFollowStatus.Active else BeaconFollowStatus.None
                }
            _notificationsEnabled.value =
                _followStatus.value == BeaconFollowStatus.Active && (viewer.notificationLevel ?: "all") != "none"
        }

        private fun build(
            persona: BeaconPersonaDto,
            channelId: String?,
            posts: List<BeaconPostDto>,
            tiers: List<PersonaTierDto>,
        ): BeaconProfileContent {
            val displayName = persona.displayName ?: persona.handle ?: "Beacon"
            val handle = persona.handle.orEmpty()
            val audienceLabel = (persona.audienceLabel ?: "followers").replaceFirstChar { it.uppercase() }
            val isVerified = persona.credential?.status == "verified"
            val header =
                PublicProfileHeader(
                    displayName = displayName,
                    handle = handle.takeIf { it.isNotEmpty() },
                    locality = null,
                    avatarUrl = persona.avatarUrl,
                    isVerified = isVerified,
                    identityBadges = emptyList(),
                    tierLabel = if (isVerified) "Persona · Verified" else "Persona · New",
                    isVerifiedNeighbor = false,
                )
            return BeaconProfileContent(
                personaId = persona.id,
                channelId = channelId,
                isOwner = isOwner,
                handle = handle,
                displayName = displayName,
                header = header,
                stats = buildStats(persona),
                bio = persona.bio,
                categoryLabel = persona.category?.let { titleCase(it) },
                audienceLabel = audienceLabel,
                audienceModeLabel = audienceModeLabel(persona.audienceMode),
                links =
                    (persona.publicLinks ?: emptyList()).mapNotNull { link ->
                        val label = link.label
                        val url = link.url
                        if (label.isNullOrEmpty() || url.isNullOrEmpty()) null else BeaconLink(label, url)
                    },
                posts = posts.map { project(it) },
                tiers = tiers.map { project(it) },
                broadcastEnabled = persona.broadcastEnabled ?: (channelId != null),
                shareUrl = if (handle.isEmpty()) "https://pantopus.com" else "https://pantopus.com/@$handle",
                followerCount = persona.followerCount ?: 0,
            )
        }

        // Two real stats only — the design's third cell ("Member" / "Mo.
        // revenue") has no field on the persona serializer, so it is omitted
        // rather than fabricated.
        private fun buildStats(persona: BeaconPersonaDto): List<ProfileStatCell> =
            listOf(
                ProfileStatCell(id = "beacons", value = compactCount(persona.followerCount ?: 0), label = "Beacons"),
                ProfileStatCell(id = "broadcasts", value = compactCount(persona.postCount ?: 0), label = "Broadcasts"),
            )

        private fun project(post: BeaconPostDto): PublicProfilePost {
            val locked = !isOwner && (post.locked ?: false)
            return PublicProfilePost(
                id = post.id ?: post.hashCode().toString(),
                body = if (post.locked == true) post.teaser.orEmpty() else (post.body ?: post.content).orEmpty(),
                timeAgo = timeAgo(post.createdAt),
                locality = null,
                reactions = post.likeCount ?: post.deliveredCount ?: 0,
                replies = post.commentCount ?: post.readCount ?: 0,
                visibility = visibility(post.visibility, post.targetTierRank),
                isLocked = locked,
                intent = null,
                targetTierRank = post.targetTierRank,
                // A locked row swaps its body for the "Subscribe to unlock" CTA,
                // and the persona posts route ships `media_*` on the wire even
                // then — dropping the attachments here is the only thing that
                // stops the card leaking the paid content it is gating.
                media =
                    if (locked) {
                        emptyList()
                    } else {
                        buildPostMediaItems(
                            urls = post.mediaUrls.orEmpty(),
                            types = post.mediaTypes,
                            thumbnails = post.mediaThumbnails,
                            liveUrls = post.mediaLiveUrls,
                        )
                    },
            )
        }

        private fun project(tier: PersonaTierDto): BeaconTier {
            val cents = tier.priceCents ?: 0
            val price =
                if (cents > 0) {
                    val dollars = cents / 100.0
                    val symbol = if ((tier.currency ?: "usd").uppercase() == "USD") "$" else ""
                    if (dollars % 1.0 == 0.0) "$symbol${dollars.toInt()}/mo" else "$symbol%.2f/mo".format(dollars)
                } else {
                    "Free"
                }
            return BeaconTier(id = tier.id, rank = tier.rank, name = tier.name, priceLabel = price, detail = tier.description)
        }

        // The `/personas/:handle/posts` endpoint returns raw Post rows whose
        // `visibility` enum can never be a tier string (DB CHECK forbids
        // `tier_or_above`/`subscribers`), so `target_tier_rank` is the source
        // of truth — mirrors the RN derivation. The string branch is a
        // defensive fallback for a future broadcast serializer.
        private fun visibility(
            raw: String?,
            rank: Int?,
        ): PublicProfilePost.Visibility {
            if (rank != null && rank > 0) {
                return when (rank) {
                    1 -> PublicProfilePost.Visibility.Bronze
                    2 -> PublicProfilePost.Visibility.Silver
                    else -> PublicProfilePost.Visibility.Gold
                }
            }
            return if (raw == "tier_or_above" || raw == "subscribers") {
                PublicProfilePost.Visibility.Bronze
            } else {
                PublicProfilePost.Visibility.Free
            }
        }

        private fun audienceModeLabel(mode: String?): String? =
            when (mode) {
                "open" -> "Anyone can follow"
                "approval_required" -> "Owner approves followers"
                "invite_only" -> "Invite only"
                "organization_managed" -> "Organization managed"
                else -> null
            }

        private fun titleCase(value: String): String =
            value.split("_", " ").filter { it.isNotEmpty() }.joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }

        private fun compactCount(value: Int): String =
            when {
                value >= 1_000_000 -> "%.1fM".format(value / 1_000_000.0)
                value >= 1_000 -> "%.1fK".format(value / 1_000.0)
                else -> "$value"
            }

        private fun timeAgo(iso: String?): String {
            val instant = parseInstant(iso) ?: return ""
            val seconds = Duration.between(instant, Instant.now()).seconds
            return when {
                seconds < 60 -> "Just now"
                seconds < 3_600 -> "${seconds / 60}m ago"
                seconds < 86_400 -> "${seconds / 3_600}h ago"
                seconds < 172_800 -> "Yesterday"
                seconds < 604_800 -> "${seconds / 86_400}d ago"
                // Localized medium date ("Jun 19, 2026") — parity with iOS's
                // DateFormatter dateStyle = .medium (was ISO yyyy-MM-dd).
                else -> DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date.from(instant))
            }
        }

        private fun parseInstant(iso: String?): Instant? {
            if (iso.isNullOrEmpty()) return null
            return try {
                Instant.parse(iso)
            } catch (_: Throwable) {
                null
            }
        }

        private fun bumpFollowers(delta: Int) {
            val current = _state.value as? BeaconProfileUiState.Loaded ?: return
            val next = (current.content.followerCount + delta).coerceAtLeast(0)
            val updated =
                current.content.stats.map { stat ->
                    if (stat.id != "beacons") stat else stat.copy(value = compactCount(next))
                }
            _state.value = BeaconProfileUiState.Loaded(current.content.copy(followerCount = next, stats = updated))
        }

        private fun friendlyMessage(error: NetworkError): String =
            when (error) {
                NetworkError.NotFound -> "Beacon not found."
                NetworkError.Forbidden -> "This Beacon is private."
                is NetworkError.Transport -> "Check your connection and try again."
                else -> "Something went wrong. Try again."
            }
    }
