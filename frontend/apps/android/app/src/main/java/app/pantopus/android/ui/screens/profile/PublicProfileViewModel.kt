@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions", "LargeClass")

package app.pantopus.android.ui.screens.profile

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.feed.FeedPost
import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.refusesStoredCopy
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.blocks.BlocksRepository
import app.pantopus.android.data.connections.ConnectionsRepository
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.data.profile.ProfileTabsRepository
import app.pantopus.android.data.relationships.RelationshipsRepository
import app.pantopus.android.data.social.UserSocialRepository
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileReviewCard
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileStatCell
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileTab
import app.pantopus.android.ui.screens.shared.content_detail.bodies.StatsTabsContent
import app.pantopus.android.ui.screens.shared.content_detail.headers.IdentityPillarBadge
import app.pantopus.android.ui.screens.shared.content_detail.headers.IdentityPillarVerificationState
import app.pantopus.android.ui.screens.shared.media.PostMediaItem
import app.pantopus.android.ui.screens.shared.media.buildPostMediaItems
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.util.UUID
import javax.inject.Inject

/** Nav-arg key for the user ID. */
const val PUBLIC_PROFILE_USER_ID_KEY = "userId"

/**
 * P6.5 — Profile-kind discriminator that swaps the chrome between the
 * Persona (creator) and Local (verified neighbor) variants. Persona is
 * the default; the VM bumps it to [Local] when the loaded profile
 * carries a verified residency.
 */
enum class PublicProfileKind { Persona, Local }

/**
 * The tabs on a person's profile (PRF, 2026-11-01): Posts · About, plus Work only when there is work to show.
 * Separate from [ProfileTab] so the persona path keeps its own body untouched.
 *
 * Work gathers the portfolio (`GET /api/files/portfolio/{userId}`, `backend/routes/files.js:526`), the reviews
 * (`GET /api/reviews/user/{userId}`, `backend/routes/reviews.js:149`) and, while Open Gigs is on, the gigs
 * (`GET /api/gigs?user_id=…`, `backend/routes/gigs.js:2089`) that used to be three tabs, empty ones included.
 */
enum class LocalProfileTab(val label: String) {
    Posts("Posts"),
    About("About"),
    Work("Work"),
}

/**
 * The trust line under the name ("Verified neighbor · Vancouver · Joined Oct 2026"). It states only what the
 * profile read returned: [verifiedNeighbor] for a verified home, [city] when the person's area setting lets this
 * viewer see it, and when they joined.
 */
data class ProfileTrust(
    val verifiedNeighbor: Boolean = false,
    val city: String? = null,
    /** "Joined Oct 2026", or "Joined this week"; null when the read had no join date. */
    val joined: String? = null,
    /** Joined in the last 14 days: an empty Posts tab says "<name> just joined". */
    val joinedRecently: Boolean = false,
)

/** What the Work tab holds; the tab shows only when one of these has something. */
data class ProfileWork(
    val portfolioCount: Int = 0,
    val reviewCount: Int = 0,
    /** Gigs count only while Open Gigs is on (launch cut #4). */
    val gigCount: Int = 0,
) {
    val hasWork: Boolean get() = portfolioCount > 0 || reviewCount > 0 || gigCount > 0
}

/** One of the person's links on About: [label] ("Website"), [display] (the address without its scheme) and [url]. */
data class ProfileLink(
    val label: String,
    val display: String,
    val url: String,
)

/**
 * One post rendered beneath the stats/tabs body. Persona profiles
 * carry creator-economy broadcasts (with tier visibility and the
 * optional locked-paywall overlay); Local profiles carry Pulse-style
 * neighborhood posts (with an intent chip — Offer / Alert / Event).
 */
data class PublicProfilePost(
    val id: String,
    val body: String,
    val timeAgo: String,
    val locality: String? = null,
    val reactions: Int = 0,
    val replies: Int = 0,
    /** Persona-only — `null` on Local posts. */
    val visibility: Visibility? = null,
    /** Persona-only — `true` when this broadcast is gated. */
    val isLocked: Boolean = false,
    /** Persona-only — tier rank required to unlock. */
    val targetTierRank: Int? = null,
    /** Local-only — `null` on Persona broadcasts. */
    val intent: Intent? = null,
    /**
     * Attachments built from the post's slot-aligned `media_*` arrays, same
     * treatment as the Pulse feed (Live Photo slots carry a companion clip).
     * Empty on a locked broadcast — the persona posts route does not strip
     * media server-side, so suppressing it here is what keeps paid content
     * behind the paywall.
     */
    val media: List<PostMediaItem> = emptyList(),
) {
    enum class Visibility { Free, Bronze, Silver, Gold }

    enum class Intent { Offer, Alert, Event, Ask }
}

/** Header surface for the public profile. */
data class PublicProfileHeader(
    val displayName: String,
    val handle: String?,
    val locality: String?,
    val avatarUrl: String?,
    val isVerified: Boolean,
    val identityBadges: List<IdentityPillarBadge>,
    /** P6.5 — Gold "Persona · Verified" chip on Persona profiles. */
    val tierLabel: String? = null,
    /** P6.5 — Green "Verified neighbor" shield chip on Local profiles. */
    val isVerifiedNeighbor: Boolean = false,
    /** False when [displayName] is the stand-in for someone with no name: the avatar shows no initials. */
    val hasName: Boolean = true,
    /** The bold line under the name; null hides it. */
    val tagline: String? = null,
    val trust: ProfileTrust = ProfileTrust(),
    /** The account id: it picks the initials color, the same on every app ([profileAvatarTint]). */
    val avatarSeed: String = "",
) {
    /** What the avatar's initials come from: the name, or "" (a plain avatar) for someone with no name. */
    val avatarName: String?
        get() = if (hasName) null else ""
}

/** Render-ready payload emitted by [PublicProfileViewModel]. */
data class PublicProfileContent(
    val profile: PublicProfileDto,
    val kind: PublicProfileKind,
    val header: PublicProfileHeader,
    val stats: StatsTabsContent,
    val posts: List<PublicProfilePost> = emptyList(),
    /**
     * B.2 (A10.5) — populated for [PublicProfileKind.Local]; drives the
     * canonical neighbor layout. `null` for Persona.
     */
    val neighbor: NeighborProfileContent? = null,
    val isOwner: Boolean = false,
    val personaHandle: String? = null,
    val work: ProfileWork = ProfileWork(),
    val links: List<ProfileLink> = emptyList(),
)

/** Observed UI state for the Public profile screen. */
sealed interface PublicProfileUiState {
    data object Loading : PublicProfileUiState

    data class Loaded(val content: PublicProfileContent) : PublicProfileUiState

    data class Error(val message: String) : PublicProfileUiState
}

/** In-flight state for an action button (Connect, Block). */
sealed interface PublicProfileActionState {
    data object Idle : PublicProfileActionState

    data object InFlight : PublicProfileActionState

    data object Succeeded : PublicProfileActionState

    data class Failed(val message: String) : PublicProfileActionState
}

/**
 * The viewer↔profile connection edge, as reported by
 * `GET api/users/:id/relationship`
 * (`backend/routes/users.js:3685` → `visibilityPolicy.getRelationshipStatus`,
 * `backend/utils/visibilityPolicy.js:37`). Drives the Connect control's
 * label and what tapping it does — RN's `connectionState`
 * (`pantopus/frontend/apps/mobile/src/app/user/[id].tsx:80,203-221,392`).
 * Mirrors iOS `ProfileConnection`.
 */
enum class ProfileConnection(
    val apiValue: String,
) {
    None("none"),
    PendingSent("pending_sent"),
    PendingReceived("pending_received"),
    Connected("connected"),
    Blocked("blocked"),
    ;

    /** Connect-button copy. Mirrors RN `getConnectLabel`. */
    val label: String
        get() =
            when (this) {
                Connected -> "Connected"
                PendingSent -> "Requested"
                PendingReceived -> "Accept"
                None, Blocked -> "Connect"
            }

    /**
     * RN disables the button only while a request is outstanding
     * (`disabled={actionLoading || connectionState === 'pending_sent'}`).
     */
    val isActionable: Boolean
        get() = this != PendingSent

    /** TalkBack copy — mirrored as the iOS `accessibilityLabel`. */
    val accessibilityLabel: String
        get() =
            when (this) {
                Connected -> "Connected. Tap to remove this connection"
                PendingSent -> "Connection requested"
                PendingReceived -> "Accept connection request"
                None, Blocked -> "Connect"
            }

    companion object {
        /**
         * Decode the server's string, defaulting anything unrecognised to
         * [None] — the same fallback RN applies (`rel.relationship || 'none'`).
         */
        fun fromApi(value: String?): ProfileConnection = entries.firstOrNull { it.apiValue == value?.lowercase() } ?: None
    }
}

/**
 * Loads the public profile and exposes a stable tab + toast surface.
 *
 * T3 — the nav arg may be a UUID *or* a handle (`pantopus://u/mariak`,
 * `https://pantopus.com/u/mariak`), because `DeepLinkRouter` maps
 * `u/:handle` and `user/:handle` onto the same destination. We branch
 * exactly like RN (`src/app/user/[id].tsx:27,53-58`): UUIDs resolve via
 * `GET /api/users/id/:id`, handles via
 * `GET /api/users/username/:username`. Both routes return the same body,
 * and every follow-up call (relationship, follow, connect, block, posts)
 * uses the *resolved* `profile.id`, never the raw nav arg.
 */
@HiltViewModel
class PublicProfileViewModel
    @Inject
    constructor(
        private val repo: ProfileRepository,
        private val social: UserSocialRepository,
        private val relationships: RelationshipsRepository,
        /** Owns the disconnect half of `/api/relationships` (S5 split). */
        private val connections: ConnectionsRepository,
        private val blocks: BlocksRepository,
        private val authRepository: AuthRepository,
        private val posts: PostsRepository,
        /** The portfolio read decides whether the Work tab shows. */
        private val profileTabs: ProfileTabsRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        /** The raw nav arg — may be a UUID or a `@handle`. */
        private val routeIdentifier: String =
            requireNotNull(savedStateHandle[PUBLIC_PROFILE_USER_ID_KEY]) {
                "PublicProfileViewModel requires a '$PUBLIC_PROFILE_USER_ID_KEY' nav arg."
            }

        /**
         * The resolved `User.id`, known only once the profile loads. Every
         * user-scoped mutation must use this, never [routeIdentifier].
         */
        private var userId: String = routeIdentifier
        private var profileKind: PublicProfileKind = PublicProfileKind.Persona

        private val _state = MutableStateFlow<PublicProfileUiState>(PublicProfileUiState.Loading)
        val state: StateFlow<PublicProfileUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(ProfileTab.About)
        val selectedTab: StateFlow<ProfileTab> = _selectedTab.asStateFlow()

        // B.2 (A10.5) — selected tab for the canonical neighbor layout
        // (About · Reviews · Verifications · Posts). Separate from
        // [selectedTab] so the persona path is untouched.
        private val _selectedNeighborTab = MutableStateFlow(NeighborProfileTab.About)
        val selectedNeighborTab: StateFlow<NeighborProfileTab> = _selectedNeighborTab.asStateFlow()

        // A21.2 — selected tab on the Local Beacon profile archetype
        // (Posts · About). Switching is local; no refetch.
        private val _selectedLocalTab = MutableStateFlow(LocalProfileTab.Posts)
        val selectedLocalTab: StateFlow<LocalProfileTab> = _selectedLocalTab.asStateFlow()

        private val _toastMessage = MutableStateFlow<String?>(null)
        val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

        private val _connectState =
            MutableStateFlow<PublicProfileActionState>(PublicProfileActionState.Idle)
        val connectState: StateFlow<PublicProfileActionState> = _connectState.asStateFlow()

        /**
         * The existing connection edge, seeded by
         * `GET api/users/:id/relationship` on load and kept current after
         * every connect / accept / disconnect. Without it the Connect
         * control is one-way; with it the button reads Connect / Requested /
         * Accept / Connected exactly like RN.
         */
        private val _connection = MutableStateFlow(ProfileConnection.None)
        val connection: StateFlow<ProfileConnection> = _connection.asStateFlow()

        /**
         * Drives the "Remove connection?" confirm. RN's Connections centre
         * gates the same `DELETE /api/relationships/:id` behind an alert
         * (`src/app/connections.tsx:69-77`).
         */
        private val _showDisconnectConfirm = MutableStateFlow(false)
        val showDisconnectConfirm: StateFlow<Boolean> = _showDisconnectConfirm.asStateFlow()

        private val _blockState =
            MutableStateFlow<PublicProfileActionState>(PublicProfileActionState.Idle)
        val blockState: StateFlow<PublicProfileActionState> = _blockState.asStateFlow()

        /** True while this account's own block (`UserBlock`) of the person is in place: the overflow offers Unblock. */
        private val _isBlockedByViewer = MutableStateFlow(false)
        val isBlockedByViewer: StateFlow<Boolean> = _isBlockedByViewer.asStateFlow()

        private val _showOverflow = MutableStateFlow(false)
        val showOverflow: StateFlow<Boolean> = _showOverflow.asStateFlow()

        /**
         * T3 — plain follow graph (`api/users/:id/follow`), distinct from the
         * persona privacy handshake. `true` once the viewer follows this user.
         */
        private val _isFollowing = MutableStateFlow(false)
        val isFollowing: StateFlow<Boolean> = _isFollowing.asStateFlow()

        /** In-flight guard for the follow/unfollow toggle. */
        private val _isFollowInFlight = MutableStateFlow(false)
        val isFollowInFlight: StateFlow<Boolean> = _isFollowInFlight.asStateFlow()

        /**
         * `true` when a Follow affordance should render at all — someone
         * else's profile, viewed by a signed-in user. Mirrors RN, which hides
         * the whole action row on your own profile
         * (`src/app/user/[id].tsx:522`).
         */
        private val _canFollow = MutableStateFlow(false)
        val canFollow: StateFlow<Boolean> = _canFollow.asStateFlow()

        /**
         * `true` once `GET api/users/:id/relationship` has answered. Follow
         * and Connect stay hidden until then and after a failed read, so a
         * failure can't offer "Connect" or "Follow" to someone the viewer is
         * already connected to or follows.
         */
        private val _relationshipLoaded = MutableStateFlow(false)
        val relationshipLoaded: StateFlow<Boolean> = _relationshipLoaded.asStateFlow()

        /** The relationship read failed: Message shows alone (no Connect), rather than a placeholder that never fills. */
        private val _relationshipFailed = MutableStateFlow(false)
        val relationshipFailed: StateFlow<Boolean> = _relationshipFailed.asStateFlow()

        /**
         * `true` when the Local post feed couldn't load. The feed then offers
         * Try again instead of the "Quiet for now" empty state.
         */
        private val _postsLoadFailed = MutableStateFlow(false)
        val postsLoadFailed: StateFlow<Boolean> = _postsLoadFailed.asStateFlow()

        /**
         * The Local profile's posts drawn as Pulse cards: photos and videos, tappable links,
         * Helpful, Save, Repost, share and report.
         */
        val postCards =
            ProfilePostCards(
                scope = viewModelScope,
                posts = posts,
                viewerId = { (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id },
                onToast = { _toastMessage.value = it },
            )

        /** Drives the "Unfollow …?" confirm, so one tap on Following never unfollows. */
        private val _showUnfollowConfirm = MutableStateFlow(false)
        val showUnfollowConfirm: StateFlow<Boolean> = _showUnfollowConfirm.asStateFlow()

        /** The Connect sheet: what connecting means, an optional note, and "Just follow" instead. */
        private val _showConnectSheet = MutableStateFlow(false)
        val showConnectSheet: StateFlow<Boolean> = _showConnectSheet.asStateFlow()

        /** True while the person's posts are read and none are on screen yet: Posts shows placeholders, not "No posts yet". */
        private val _postsLoading = MutableStateFlow(false)
        val postsLoading: StateFlow<Boolean> = _postsLoading.asStateFlow()

        /** Drives "Withdraw your request?": tapping Requested asks before it takes the request back. */
        private val _showWithdrawConfirm = MutableStateFlow(false)
        val showWithdrawConfirm: StateFlow<Boolean> = _showWithdrawConfirm.asStateFlow()

        /** Portfolio items from the last read; null until it answers (or after it failed), so Work stays hidden. */
        private var portfolioCount: Int? = null

        private var loading = false
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        fun load() = startRead(force = false)

        fun refresh() = startRead(force = true)

        private fun startRead(force: Boolean) {
            if (loading) return
            loading = true
            _refreshing.value = force && _state.value is PublicProfileUiState.Loaded
            if (_state.value !is PublicProfileUiState.Loaded) {
                profileCopy().data?.let { profile ->
                    userId = profile.id
                    profileKind = derivedKind(profile)
                    val rows =
                        if (profileKind == PublicProfileKind.Local) {
                            posts.profilePostsCopy(profile.id).data?.posts.orEmpty()
                        } else {
                            emptyList()
                        }
                    postCards.show(rows, postCards.actionRevision)
                    _state.value = PublicProfileUiState.Loaded(build(profile, profileKind, rows.map(::project)))
                }
            }
            viewModelScope.launch {
                try {
                    fetch(force)
                } finally {
                    loading = false
                    _refreshing.value = false
                }
            }
        }

        private fun profileIdentifier(): String = userId.takeIf { UserSocialRepository.isUuid(it) } ?: routeIdentifier.trim()

        private fun profileCopy() =
            profileIdentifier().let { identifier ->
                if (UserSocialRepository.isUuid(identifier)) repo.publicProfileCopy(identifier) else social.publicProfileCopy(identifier)
            }

        fun selectTab(tab: ProfileTab) {
            _selectedTab.value = tab
        }

        fun selectNeighborTab(tab: NeighborProfileTab) {
            _selectedNeighborTab.value = tab
        }

        fun selectLocalTab(tab: LocalProfileTab) {
            _selectedLocalTab.value = tab
        }

        fun dismissToast() {
            _toastMessage.value = null
        }

        /** Surface a transient toast — used by the Report sheet success path. */
        fun showToast(message: String) {
            _toastMessage.value = message
        }

        fun setShowOverflow(show: Boolean) {
            _showOverflow.value = show
        }

        private val _showFollowHandshake = MutableStateFlow(false)
        val showFollowHandshake: StateFlow<Boolean> = _showFollowHandshake.asStateFlow()

        private val _handshakePreselectedTierRank = MutableStateFlow<Int?>(null)
        val handshakePreselectedTierRank: StateFlow<Int?> = _handshakePreselectedTierRank.asStateFlow()

        fun setShowFollowHandshake(show: Boolean) {
            _showFollowHandshake.value = show
        }

        fun clearHandshakeTier() {
            _handshakePreselectedTierRank.value = null
        }

        /**
         * Follow entry point behind every Follow affordance.
         *
         * A Beacon (persona with a resolvable handle) keeps the privacy
         * handshake wizard — that flow owns tier selection and Stripe
         * Checkout, so there is no in-flight pose to track for it. Everyone
         * else (ordinary neighbours, personas with no Beacon bridge) now
         * takes the plain `api/users/:id/follow` path instead of the old
         * dead-end toast. Mirrors RN, whose profile screen only ever calls
         * `followUser`/`unfollowUser` (`src/app/user/[id].tsx:184-199`), and
         * iOS `PublicProfileViewModel.follow()`.
         */
        fun follow() {
            if (canOpenHandshake()) {
                _handshakePreselectedTierRank.value = null
                _showFollowHandshake.value = true
                return
            }
            toggleFollow()
        }

        /**
         * T3 — plain follow / unfollow for an ordinary neighbour.
         * `POST` / `DELETE api/users/:id/follow`
         * (`backend/routes/users.js:3520` / `:3593`). Awaited, not optimistic,
         * so a rejected follow (blocked, curator account) can't leave the
         * button lying.
         */
        fun toggleFollow() {
            if (!_canFollow.value || _isFollowInFlight.value) return
            _isFollowInFlight.value = true
            val wasFollowing = _isFollowing.value
            viewModelScope.launch {
                val result = if (wasFollowing) social.unfollow(userId) else social.follow(userId)
                when (result) {
                    is NetworkResult.Success -> {
                        _isFollowing.value = result.data.following ?: !wasFollowing
                        _toastMessage.value = if (_isFollowing.value) "Following" else "Unfollowed"
                    }
                    is NetworkResult.Failure -> {
                        _toastMessage.value = followFailureMessage(result.error, wasFollowing)
                    }
                }
                _isFollowInFlight.value = false
            }
        }

        /** Following asks before it unfollows, as Connected does before it disconnects. */
        fun requestUnfollow() {
            _showUnfollowConfirm.value = true
        }

        fun cancelUnfollow() {
            _showUnfollowConfirm.value = false
        }

        /** The Unfollow button of the "Unfollow …?" confirm: it only ever unfollows. */
        fun unfollow() {
            _showUnfollowConfirm.value = false
            if (_isFollowing.value) toggleFollow()
        }

        /** Unlock a tier-gated broadcast on a Persona profile. */
        fun unlockBroadcast(tierRank: Int?) {
            if (!canOpenHandshake()) {
                _toastMessage.value = HANDSHAKE_UNAVAILABLE_MESSAGE
                return
            }
            _handshakePreselectedTierRank.value = tierRank
            _showFollowHandshake.value = true
        }

        fun loadedPersonaHandle(): String {
            val loaded = _state.value as? PublicProfileUiState.Loaded ?: return ""
            return loaded.content.personaHandle.orEmpty()
        }

        private fun canOpenHandshake(): Boolean {
            val loaded = _state.value as? PublicProfileUiState.Loaded ?: return false
            val content = loaded.content
            return content.kind == PublicProfileKind.Persona &&
                !content.isOwner &&
                !content.personaHandle.isNullOrBlank()
        }

        // MARK: - Connect control (relationship-aware)

        /**
         * The control is hidden entirely on your own profile, for a
         * signed-out viewer, and once the edge is `blocked` — RN drops the
         * whole action row in those cases (`src/app/user/[id].tsx:522-523`).
         * It also waits for the relationship read, so a failed read never
         * shows "Connect".
         */
        fun showsConnectAction(): Boolean = _canFollow.value && _relationshipLoaded.value && _connection.value != ProfileConnection.Blocked

        /** Tapping is a no-op while a request is outstanding or in flight. */
        fun isConnectEnabled(): Boolean = _connection.value.isActionable && _connectState.value !is PublicProfileActionState.InFlight

        /**
         * The Connect affordance. What it does depends on the edge the
         * server reported, mirroring RN's `handleConnect`
         * (`src/app/user/[id].tsx:201-224`):
         *
         *  - `none` → `POST api/relationships/requests`
         *  - `pending_received` → resolve the inbound row, then
         *    `POST api/relationships/:id/accept`
         *  - `connected` → raise the disconnect confirm, which then calls
         *    `DELETE api/relationships/:id`
         *  - `pending_sent` / `blocked` → inert
         */
        fun connect(note: String? = null) {
            if (_connectState.value is PublicProfileActionState.InFlight) return
            when (_connection.value) {
                ProfileConnection.None -> sendConnectionRequest(note)
                ProfileConnection.PendingReceived -> acceptConnectionRequest()
                ProfileConnection.Connected -> _showDisconnectConfirm.value = true
                ProfileConnection.PendingSent, ProfileConnection.Blocked -> Unit
            }
        }

        /** The header's Connect opens the sheet that explains it first; the sheet's Send request sends it. */
        fun openConnectSheet() {
            if (_connection.value != ProfileConnection.None || !showsConnectAction()) return
            if (_connectState.value is PublicProfileActionState.Failed) _connectState.value = PublicProfileActionState.Idle
            _showConnectSheet.value = true
        }

        fun dismissConnectSheet() {
            _showConnectSheet.value = false
        }

        /** The sheet's Send request. A note (at most 500 characters) reaches them only as the notification's text. */
        fun sendRequestFromSheet(note: String) {
            connect(note.trim().take(CONNECT_NOTE_MAX).takeIf { it.isNotEmpty() })
        }

        /** The sheet's "Just follow …": their public posts come to Pulse, no request. */
        fun followFromSheet() {
            _showConnectSheet.value = false
            if (!_isFollowing.value) toggleFollow()
        }

        /** `POST api/relationships/requests` (relationships.js:193). The sheet stays open on a failure, keeping the note. */
        private fun sendConnectionRequest(note: String?) {
            _connectState.value = PublicProfileActionState.InFlight
            viewModelScope.launch {
                when (val result = relationships.sendRequest(userId, note)) {
                    is NetworkResult.Success -> {
                        _connectState.value = PublicProfileActionState.Succeeded
                        _connection.value = ProfileConnection.PendingSent
                        _showConnectSheet.value = false
                        _toastMessage.value = "Connection request sent"
                    }
                    is NetworkResult.Failure -> {
                        val message = friendlyMessage(result.error)
                        _connectState.value = PublicProfileActionState.Failed(message)
                        _toastMessage.value = message
                    }
                }
            }
        }

        /** Requested asks before it takes the request back. */
        fun requestWithdraw() {
            if (_connection.value == ProfileConnection.PendingSent) _showWithdrawConfirm.value = true
        }

        fun cancelWithdraw() {
            _showWithdrawConfirm.value = false
        }

        /**
         * Take back the request this viewer sent: find it in `GET api/relationships/requests/sent`
         * (relationships.js:914), then `DELETE api/relationships/:id` (relationships.js:779), which either side may do.
         */
        fun withdrawRequest() {
            _showWithdrawConfirm.value = false
            if (_connection.value != ProfileConnection.PendingSent) return
            if (_connectState.value is PublicProfileActionState.InFlight) return
            _connectState.value = PublicProfileActionState.InFlight
            viewModelScope.launch {
                when (val sent = connections.sentRequests(force = true)) {
                    is NetworkResult.Failure -> failConnect(sent.error)
                    is NetworkResult.Success -> {
                        val match = sent.data.requests.firstOrNull { it.addressee?.id == userId }
                        if (match == null) {
                            _connectState.value = PublicProfileActionState.Idle
                            reloadAfterConnectionChange()
                            _toastMessage.value = "That request is no longer pending."
                            return@launch
                        }
                        when (val removed = connections.disconnect(match.id)) {
                            is NetworkResult.Success -> {
                                _connectState.value = PublicProfileActionState.Idle
                                _connection.value = ProfileConnection.None
                                _toastMessage.value = "Request withdrawn"
                            }
                            is NetworkResult.Failure -> failConnect(removed.error)
                        }
                    }
                }
            }
        }

        /**
         * The banner's Not now: decline their request (`POST api/relationships/:id/reject`, relationships.js:471,
         * which deletes it, so they can ask again later).
         */
        fun declineRequest() {
            if (_connection.value != ProfileConnection.PendingReceived) return
            if (_connectState.value is PublicProfileActionState.InFlight) return
            _connectState.value = PublicProfileActionState.InFlight
            viewModelScope.launch {
                when (val pending = relationships.pendingRequests(force = true)) {
                    is NetworkResult.Failure -> failConnect(pending.error)
                    is NetworkResult.Success -> {
                        val match = pending.data.requests.firstOrNull { it.requester?.id == userId }
                        if (match == null) {
                            _connectState.value = PublicProfileActionState.Idle
                            reloadAfterConnectionChange()
                            _toastMessage.value = "That request is no longer pending."
                            return@launch
                        }
                        when (val declined = relationships.reject(match.id)) {
                            is NetworkResult.Success -> {
                                _connectState.value = PublicProfileActionState.Idle
                                _connection.value = ProfileConnection.None
                                _toastMessage.value = "Request declined"
                            }
                            is NetworkResult.Failure -> failConnect(declined.error)
                        }
                    }
                }
            }
        }

        /**
         * Accept the inbound request. The relationship id isn't on the
         * profile payload, so resolve it from
         * `GET api/relationships/requests/pending` (relationships.js:890)
         * first — exactly what RN does before calling accept. Read fresh: a request that arrived while this
         * screen was open isn't in an earlier copy.
         */
        private fun acceptConnectionRequest() {
            _connectState.value = PublicProfileActionState.InFlight
            viewModelScope.launch {
                when (val pending = relationships.pendingRequests(force = true)) {
                    is NetworkResult.Failure -> failConnect(pending.error)
                    is NetworkResult.Success -> {
                        val match = pending.data.requests.firstOrNull { it.requester?.id == userId }
                        if (match == null) {
                            _connectState.value = PublicProfileActionState.Idle
                            // The row moved (withdrawn / already handled) —
                            // re-read the edge rather than leave the button lying.
                            reloadAfterConnectionChange()
                            _toastMessage.value = "That request is no longer pending."
                            return@launch
                        }
                        when (val accepted = relationships.accept(match.id)) {
                            is NetworkResult.Success -> {
                                _connectState.value = PublicProfileActionState.Succeeded
                                _connection.value = ProfileConnection.Connected
                                _toastMessage.value = "Connected"
                                reloadAfterConnectionChange()
                            }
                            is NetworkResult.Failure -> failConnect(accepted.error)
                        }
                    }
                }
            }
        }

        /**
         * Confirmed disconnect. Resolves the accepted row from
         * `GET api/relationships?status=accepted` (relationships.js:622) and
         * deletes it (`DELETE api/relationships/:id`, relationships.js:578).
         */
        fun disconnect() {
            _showDisconnectConfirm.value = false
            if (_connection.value != ProfileConnection.Connected) return
            if (_connectState.value is PublicProfileActionState.InFlight) return
            _connectState.value = PublicProfileActionState.InFlight
            viewModelScope.launch {
                when (val list = relationships.list(status = "accepted")) {
                    is NetworkResult.Failure -> failConnect(list.error)
                    is NetworkResult.Success -> {
                        val match = list.data.relationships.firstOrNull { it.otherUser?.id == userId }
                        if (match == null) {
                            _connectState.value = PublicProfileActionState.Idle
                            reloadAfterConnectionChange()
                            _toastMessage.value = "You're not connected to this neighbor."
                            return@launch
                        }
                        when (val removed = connections.disconnect(match.id)) {
                            is NetworkResult.Success -> {
                                _connectState.value = PublicProfileActionState.Idle
                                _connection.value = ProfileConnection.None
                                _toastMessage.value = "Connection removed"
                                reloadAfterConnectionChange()
                            }
                            is NetworkResult.Failure -> failConnect(removed.error)
                        }
                    }
                }
            }
        }

        /** Connected ▾ → Disconnect asks first. */
        fun requestDisconnect() {
            if (_connection.value == ProfileConnection.Connected) _showDisconnectConfirm.value = true
        }

        /** Dismiss the confirm without disconnecting. */
        fun cancelDisconnect() {
            _showDisconnectConfirm.value = false
        }

        /** Drop the old audience's posts before refreshing, including when the new read fails. */
        private suspend fun reloadAfterConnectionChange() {
            repo.forgetPublicProfile(userId)
            if (!UserSocialRepository.isUuid(routeIdentifier)) social.forgetPublicProfile(routeIdentifier)
            posts.forgetProfilePosts(userId)
            postCards.show(emptyList(), postCards.actionRevision)
            _relationshipLoaded.value = false
            _state.value = PublicProfileUiState.Loading
            fetch(force = true)
        }

        private fun failConnect(error: NetworkError) {
            val message = friendlyMessage(error)
            _connectState.value = PublicProfileActionState.Failed(message)
            _toastMessage.value = message
        }

        /** Block this user via `POST /api/users/:userId/block`. */
        fun block() {
            if (_blockState.value is PublicProfileActionState.InFlight) return
            _blockState.value = PublicProfileActionState.InFlight
            viewModelScope.launch {
                when (val result = blocks.block(userId)) {
                    is NetworkResult.Success -> {
                        _blockState.value = PublicProfileActionState.Succeeded
                        // RN flips `connectionState` to 'blocked' on the same
                        // success, which drops the Connect / Follow row
                        // (`src/app/user/[id].tsx:322`).
                        _connection.value = ProfileConnection.Blocked
                        _isBlockedByViewer.value = true
                        _toastMessage.value = "User blocked"
                    }
                    is NetworkResult.Failure -> {
                        val message = friendlyMessage(result.error)
                        _blockState.value = PublicProfileActionState.Failed(message)
                        _toastMessage.value = message
                    }
                }
            }
        }

        /**
         * Lift this account's own block (`DELETE /api/users/:userId/block`), as Settings → Blocked users
         * does, then load the profile again so posts, Follow and Connect come back.
         */
        fun unblock() {
            if (_blockState.value is PublicProfileActionState.InFlight) return
            _blockState.value = PublicProfileActionState.InFlight
            viewModelScope.launch {
                when (val result = blocks.unblock(userId)) {
                    is NetworkResult.Success -> {
                        _blockState.value = PublicProfileActionState.Idle
                        _isBlockedByViewer.value = false
                        _connection.value = ProfileConnection.None
                        _toastMessage.value = "User unblocked"
                        fetch()
                    }
                    is NetworkResult.Failure -> {
                        val message = friendlyMessage(result.error)
                        _blockState.value = PublicProfileActionState.Failed(message)
                        _toastMessage.value = message
                    }
                }
            }
        }

        /**
         * UUIDs resolve by id; handles resolve by username. Mirrors RN's
         * `fetchPublicProfileByIdentifier` (`src/app/user/[id].tsx:53-58`).
         */
        private suspend fun loadProfile(force: Boolean): NetworkResult<PublicProfileDto> {
            // Once loaded, a refresh goes by id: the owner may have just changed the username the route used.
            val identifier = profileIdentifier()
            return if (UserSocialRepository.isUuid(identifier)) {
                repo.publicProfile(identifier, force)
            } else {
                social.publicProfileByUsername(identifier, force)
            }
        }

        /**
         * `GET api/users/:id/relationship` — seeds the Follow and Connect
         * poses. Requires auth, so a signed-out viewer just gets the resting
         * state (and no Follow affordance).
         */
        private suspend fun loadRelationship(profileId: String) {
            val signedInId = (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id
            _canFollow.value = signedInId != null && signedInId != profileId
            if (!_canFollow.value) {
                _isFollowing.value = false
                return
            }
            _relationshipFailed.value = false

            // Personal UserBlock rows are deliberately distinct from the
            // Relationship graph: GET /:id/relationship reports only the
            // latter. The local-neighbor Follow/Connect row is the scope that
            // uses personal block visibility; Persona and Relationship
            // affordances retain their established independent policy.
            if (profileKind == PublicProfileKind.Local) {
                // Resolve the existing personal block list first so a fresh
                // profile navigation cannot restore Follow/Connect for a
                // user this account has already blocked. A failed read fails
                // closed by leaving the profile non-actionable; it must never
                // turn an unavailable authorization check into an affordance.
                when (val blockedResult = blocks.blocked()) {
                    is NetworkResult.Success -> {
                        _isBlockedByViewer.value = blockedResult.data.blocked.any { it.userId == profileId }
                        if (_isBlockedByViewer.value) {
                            _canFollow.value = false
                            _isFollowing.value = false
                            _connection.value = ProfileConnection.Blocked
                            return
                        }
                    }
                    is NetworkResult.Failure -> {
                        _canFollow.value = false
                        _isFollowing.value = false
                        _relationshipFailed.value = true
                        _toastMessage.value = "Couldn't verify block status. Actions are unavailable."
                        return
                    }
                }
            }

            when (val result = social.relationship(profileId)) {
                is NetworkResult.Success -> {
                    _isFollowing.value = result.data.following == true
                    val connection = ProfileConnection.fromApi(result.data.relationship)
                    _connection.value = connection
                    _connectState.value =
                        when (connection) {
                            ProfileConnection.PendingSent, ProfileConnection.Connected ->
                                PublicProfileActionState.Succeeded
                            ProfileConnection.None,
                            ProfileConnection.PendingReceived,
                            ProfileConnection.Blocked,
                            -> PublicProfileActionState.Idle
                        }
                    _relationshipLoaded.value = true
                }
                // A failed relationship probe must not fail the profile, but
                // Follow and Connect stay hidden rather than guessing the edge.
                is NetworkResult.Failure -> {
                    _relationshipLoaded.value = false
                    _relationshipFailed.value = true
                    _toastMessage.value = "Couldn't load connection status. Try again later."
                }
            }
        }

        private suspend fun fetch(force: Boolean = true) {
            val result = loadProfile(force)
            val copy = profileCopy()
            _refreshNotice.value = if (copy.showsRefreshFailure(StoreKind.PEOPLE)) RefreshNotice(copy.fetchedAt, ::refresh) else null
            when (result) {
                is NetworkResult.Success -> {
                    val profile = result.data
                    userId = profile.id
                    val kind = derivedKind(profile)
                    profileKind = kind
                    // A21.2 — the Local archetype renders a real neighbourhood
                    // post feed, so pull the author's posts the way the RN
                    // `PostsTab` does (`GET /api/posts/user/:id`). Persona
                    // profiles keep an empty list on purpose: that endpoint
                    // returns plain posts, not tier-gated broadcasts, and
                    // feeding them into the broadcast card would invent a
                    // visibility chip the API never sent.
                    val previous = (_state.value as? PublicProfileUiState.Loaded)?.content?.takeIf { it.profile.id == profile.id }
                    val firstFrame =
                        if (kind == PublicProfileKind.Local) {
                            previous?.posts ?: posts.profilePostsCopy(profile.id).data?.posts.orEmpty().also {
                                postCards.show(it, postCards.actionRevision)
                            }.map(::project)
                        } else {
                            emptyList()
                        }
                    _state.value = PublicProfileUiState.Loaded(build(profile, kind, firstFrame))
                    coroutineScope {
                        // The relationship decides the header's buttons: read it beside the posts, not after them.
                        val relationship = async { loadRelationship(profile.id) }
                        val feed =
                            if (kind == PublicProfileKind.Local) {
                                _postsLoading.value = postCards.cards.value.isEmpty()
                                try {
                                    loadUserPosts(profile.id, force)
                                } finally {
                                    _postsLoading.value = false
                                }
                            } else {
                                emptyList()
                            }
                        _state.value = PublicProfileUiState.Loaded(build(profile, kind, feed))
                        relationship.await()
                    }
                    loadWork(profile, kind)
                }
                is NetworkResult.Failure -> {
                    if (_state.value !is PublicProfileUiState.Loaded ||
                        result.error.refusesStoredCopy
                    ) {
                        _canFollow.value = false
                        _relationshipLoaded.value = false
                        _state.value = PublicProfileUiState.Error(friendlyMessage(result.error))
                    }
                }
            }
        }

        /** The portfolio read decides whether Work shows; a failed read leaves Work to the reviews alone. */
        private suspend fun loadWork(
            profile: PublicProfileDto,
            kind: PublicProfileKind,
        ) {
            if (kind != PublicProfileKind.Local) return
            val result = profileTabs.portfolio(profile.id, isOwnProfile = signedInId() == profile.id)
            portfolioCount = (result as? NetworkResult.Success)?.data?.files?.size
            val loaded = (_state.value as? PublicProfileUiState.Loaded)?.content?.takeIf { it.profile.id == profile.id } ?: return
            _state.value = PublicProfileUiState.Loaded(loaded.copy(work = workFor(profile)))
        }

        private fun workFor(profile: PublicProfileDto): ProfileWork =
            ProfileWork(
                portfolioCount = portfolioCount ?: 0,
                reviewCount = profile.reviewCount ?: profile.reviews.size,
                gigCount = if (LaunchFeatures.openGigs) profile.gigsPosted ?: 0 else 0,
            )

        private fun signedInId(): String? = (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id

        /**
         * A21.2 — the Local profile's post feed. Mirrors the RN
         * `components/profile/PostsTab` fetch. A failure doesn't fail the
         * whole profile: the feed stays empty and [postsLoadFailed] makes it
         * offer Try again rather than the design's "Quiet for now" state.
         */
        private suspend fun loadUserPosts(
            id: String,
            force: Boolean,
        ): List<PublicProfilePost> {
            val readRevision = postCards.actionRevision
            return when (val result = posts.profilePosts(id, force = force)) {
                is NetworkResult.Success -> {
                    _postsLoadFailed.value = false
                    postCards.show(result.data.posts, readRevision)
                    result.data.posts.map { project(it) }
                }
                is NetworkResult.Failure -> {
                    _postsLoadFailed.value = true
                    if (result.error.refusesStoredCopy) {
                        postCards.show(emptyList(), readRevision)
                        emptyList()
                    } else {
                        (_state.value as? PublicProfileUiState.Loaded)?.content?.posts.orEmpty()
                    }
                }
            }
        }

        private fun build(
            profile: PublicProfileDto,
            kind: PublicProfileKind,
            feed: List<PublicProfilePost>,
        ): PublicProfileContent {
            val header =
                PublicProfileHeader(
                    displayName = profile.displayName,
                    // A made-up username is never shown as "@…" or in "Report @…".
                    handle = profile.chosenUsername,
                    locality = profile.locality,
                    avatarUrl = profile.profilePictureUrl ?: profile.avatarUrl,
                    // No avatar check: `verified` is the account email flag that
                    // sign-in sets, and a check reads as identity verification.
                    isVerified = false,
                    identityBadges = buildBadges(profile),
                    // No server field verifies a persona, so the chip names the kind only.
                    // Launch cuts #1/#2 (Beacon + Personas): no "Persona" chip while personas are hidden.
                    tierLabel =
                        if (kind == PublicProfileKind.Persona && LaunchFeatures.beacon && LaunchFeatures.personas) "Persona" else null,
                    // The chip needs the verified home itself: unverified people get the
                    // neighbor layout too while creators are cut.
                    isVerifiedNeighbor = hasHomeResidency(profile),
                    hasName = profile.hasName,
                    tagline = profile.tagline?.trim()?.takeIf { it.isNotEmpty() },
                    trust = profileTrust(profile),
                    avatarSeed = profile.id,
                )
            val stats = buildStatCells(profile)
            val reviewCards = buildReviewCards(profile)

            val neighbor =
                if (kind == PublicProfileKind.Local) buildNeighbor(profile, reviewCards, feed) else null
            val signedInId = (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id
            val isOwner = signedInId != null && signedInId == profile.id
            // A Beacon (`PublicPersona.handle`) lives in a different namespace
            // from `User.username` — persona handles are generated
            // independently (`identityProfiles.generateUniqueAudienceHandle`)
            // and the persona serializer deliberately never exposes the owning
            // user. Passing the username here would hand the privacy handshake
            // a handle that can resolve to a *different* creator's Beacon, so
            // it stays null until `GET /api/users/id/:id` carries an approved
            // Beacon bridge.
            val personaHandle: String? = null

            return PublicProfileContent(
                profile = profile,
                kind = kind,
                header = header,
                stats =
                    StatsTabsContent(
                        stats = stats,
                        bio = profile.bio,
                        skills = profile.skills,
                        reviews = reviewCards,
                    ),
                posts = feed,
                neighbor = neighbor,
                isOwner = isOwner,
                personaHandle = personaHandle,
                work = workFor(profile),
                links = profileLinks(profile.socialLinks),
            )
        }

        private companion object {
            /**
             * Shown instead of silently no-op'ing when this profile carries no
             * resolvable Beacon handle. Mirrors the iOS string exactly.
             */
            const val HANDSHAKE_UNAVAILABLE_MESSAGE = "Following isn't available from this profile yet."
        }
    }

/** The longest note `POST /api/relationships/requests` takes (its Joi schema, relationships.js). */
const val CONNECT_NOTE_MAX = 500

/** Joined within this many days: an empty Posts tab says "<name> just joined". */
private const val JUST_JOINED_DAYS = 14

private const val THIS_WEEK_DAYS = 7

private val JOINED_MONTH: java.time.format.DateTimeFormatter =
    java.time.format.DateTimeFormatter.ofPattern("MMM yyyy", java.util.Locale.US)

/**
 * What the trust line may say about this person, from the profile read alone: "Verified neighbor" only for a
 * verified home, the city only when the read returns it (the home's city for a verified neighbor, else the
 * profile's), and when they joined.
 */
internal fun profileTrust(
    profile: PublicProfileDto,
    now: Instant = Instant.now(),
): ProfileTrust {
    val verified = hasHomeResidency(profile)
    val homeCity = (profile.residency?.get("city") as? String)?.trim()?.takeIf { verified && it.isNotEmpty() }
    val joinedAt = profile.createdAt?.let { runCatching { Instant.parse(it) }.getOrNull() }
    val days = joinedAt?.let { Duration.between(it, now).toDays().coerceAtLeast(0) }
    val joined =
        when {
            joinedAt == null || days == null -> null
            days < THIS_WEEK_DAYS -> "Joined this week"
            else -> "Joined ${JOINED_MONTH.format(joinedAt.atZone(java.time.ZoneId.systemDefault()))}"
        }
    return ProfileTrust(
        verifiedNeighbor = verified,
        city = homeCity ?: profile.city?.trim()?.takeIf { it.isNotEmpty() },
        joined = joined,
        joinedRecently = days != null && days < JUST_JOINED_DAYS,
    )
}

private val LINK_LABELS =
    listOf(
        "website" to "Website",
        "instagram" to "Instagram",
        "facebook" to "Facebook",
        "linkedin" to "LinkedIn",
        "twitter" to "X (Twitter)",
    )

/**
 * The person's links for About, in a fixed order. The editor takes only web addresses; anything that isn't an
 * http(s) address once a missing scheme is added is left out rather than opened.
 */
internal fun profileLinks(socialLinks: Map<String, Any?>?): List<ProfileLink> =
    LINK_LABELS.mapNotNull { (key, label) ->
        val raw = (socialLinks?.get(key) as? String)?.trim()?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
        val url = if (raw.contains("://")) raw else "https://$raw"
        val uri = runCatching { java.net.URI(url) }.getOrNull()
        val scheme = uri?.scheme?.lowercase()
        if ((scheme != "http" && scheme != "https") || uri?.host.isNullOrBlank()) return@mapNotNull null
        ProfileLink(
            label = label,
            display = url.substringAfter("://").removePrefix("www.").trimEnd('/'),
            url = url,
        )
    }

// Pure helpers of the profile projection (outside the view model, which detekt keeps small).

/**
 * The backend sends readable copy on the 400/403 rejections
 * ("You are already following this user", "Cannot follow curator
 * accounts"); surface it rather than a generic failure.
 */
private fun followFailureMessage(
    error: NetworkError,
    wasFollowing: Boolean,
): String {
    val fallback = if (wasFollowing) "Couldn't unfollow." else "Couldn't follow."
    return when (error) {
        is NetworkError.Transport -> "Check your connection and try again."
        NetworkError.Forbidden -> "You can't follow this profile."
        else -> error.message.ifBlank { fallback }
    }
}

private fun friendlyMessage(error: NetworkError): String =
    when (error) {
        NetworkError.NotFound -> "We couldn't find this profile."
        NetworkError.Forbidden -> "This profile is private."
        is NetworkError.Transport -> "Check your connection and try again."
        else -> "Something went wrong. Try again."
    }

/** Reviews are 1–5 stars; anything the API returns is clamped to it. */
private const val MAX_REVIEW_RATING = 5

/**
 * Maps the backend `post_type` onto the design's intent chip.
 * Types with no honest counterpart (general, recommendation,
 * lost & found, local update…) render with no chip rather than
 * borrowing a misleading label. Mirrors iOS
 * `PublicProfileViewModel.intent(forPostType:)`.
 */
private fun intentForPostType(type: String?): PublicProfilePost.Intent? =
    when (type.orEmpty()) {
        "service_offer", "deal" -> PublicProfilePost.Intent.Offer
        "alert", "heads_up" -> PublicProfilePost.Intent.Alert
        "event" -> PublicProfilePost.Intent.Event
        "ask_local", "ask" -> PublicProfilePost.Intent.Ask
        else -> null
    }

private fun project(post: FeedPost): PublicProfilePost =
    PublicProfilePost(
        id = post.id,
        body = post.content?.takeIf { it.isNotEmpty() } ?: post.title.orEmpty(),
        media =
            buildPostMediaItems(
                urls = post.mediaUrls,
                types = post.mediaTypes,
                thumbnails = post.mediaThumbnails,
                liveUrls = post.mediaLiveUrls,
            ),
        timeAgo = relativeTimestamp(post.createdAt),
        locality = post.locationName,
        reactions = post.likeCount,
        replies = post.commentCount,
        visibility = null,
        isLocked = false,
        targetTierRank = null,
        intent = intentForPostType(post.postType),
    )

private fun buildReviewCards(profile: PublicProfileDto): List<ProfileReviewCard> =
    profile.reviews.map { r ->
        ProfileReviewCard(
            id = r.id ?: UUID.randomUUID().toString(),
            reviewerName = r.reviewerName ?: "Anonymous",
            reviewerAvatarUrl = r.reviewerAvatar,
            rating = r.rating.coerceIn(0, MAX_REVIEW_RATING),
            body = (r.comment ?: r.content).orEmpty(),
            timestamp = relativeTimestamp(r.createdAt),
        )
    }

/**
 * B.2 (A10.5) — project the live profile onto the canonical
 * neighbor content. Fields the public DTO can't carry (ledger
 * detail, mutual neighbors, response time) are synthesised; the
 * empty-review path drives the new-neighbor degraded frame.
 */
private fun buildNeighbor(
    profile: PublicProfileDto,
    reviews: List<ProfileReviewCard>,
    feed: List<PublicProfilePost>,
): NeighborProfileContent {
    val reviewCount = profile.reviewCount ?: reviews.size
    val isNew = reviewCount == 0
    val rating = profile.averageRating ?: 0.0
    val jobs = profile.gigsCompleted ?: 0

    val stats =
        listOf(
            NeighborStat(
                id = "rating",
                value = if (rating > 0) "%.1f".format(rating) else "—",
                label = if (reviewCount > 0) "$reviewCount reviews" else "No reviews yet",
                icon = PantopusIcon.Star,
                valueColor = if (reviewCount > 0) PantopusColors.appText else PantopusColors.appTextMuted,
                iconColor = if (reviewCount > 0) PantopusColors.warning else PantopusColors.appTextMuted,
            ),
            NeighborStat(id = "jobs", value = "$jobs", label = "Jobs done"),
            // No response-time data exists yet; "—" until it does.
            NeighborStat(
                id = "response",
                value = if (isNew) "New" else "—",
                label = "Response",
                valueColor = if (isNew) PantopusColors.primary600 else PantopusColors.appText,
            ),
        )

    val firstName = profile.displayName.split(" ").firstOrNull() ?: profile.displayName
    val welcome =
        if (isNew) {
            NeighborWelcome(
                title = "Be the welcome wagon",
                body = "$firstName just moved in. A quick hello goes a long way.",
            )
        } else {
            null
        }

    return NeighborProfileContent(
        hero =
            NeighborHero(
                name = profile.displayName,
                locality = profile.locality,
                avatarUrl = profile.profilePictureUrl ?: profile.avatarUrl,
                // No avatar check (see the header above).
                isVerified = false,
                identity = if (isNew) NeighborIdentity.Fresh else NeighborIdentity.Personal,
                kicker = neighborSince(profile.createdAt, isNew),
            ),
        stats = stats,
        bio = profile.bio,
        skills = profile.skills,
        verifications = neighborVerifications(profile, isNew),
        reviews = reviews,
        reviewCount = reviewCount,
        // No mutual-neighbor data comes from the server, so no strip.
        mutuals = null,
        welcome = welcome,
        posts = feed,
        isNewNeighbor = isNew,
        primaryCtaLabel = if (isNew) "Say hi" else "Message",
    )
}

/**
 * P6.5 — Kind heuristic. A profile with a verified residency
 * blob is a Local (verified neighbor) profile; everyone else is
 * treated as a Persona (creator) profile. Backend doesn't ship
 * an explicit creator/local discriminator yet — this signal is
 * the closest stable proxy. While the creator side is cut for
 * launch (Beacon + Personas) nobody is a creator: every person
 * gets the neighbor layout, verified or not.
 */
private fun derivedKind(profile: PublicProfileDto): PublicProfileKind =
    when {
        !(LaunchFeatures.beacon && LaunchFeatures.personas) -> PublicProfileKind.Local
        hasHomeResidency(profile) -> PublicProfileKind.Local
        else -> PublicProfileKind.Persona
    }

private fun buildBadges(profile: PublicProfileDto): List<IdentityPillarBadge> {
    val verified = profile.verified == true
    val homeState =
        if (hasHomeResidency(profile)) {
            IdentityPillarVerificationState.Verified
        } else {
            IdentityPillarVerificationState.Unverified
        }
    val businessState =
        if (profile.accountType == "business") {
            IdentityPillarVerificationState.Verified
        } else {
            IdentityPillarVerificationState.Unverified
        }
    return listOf(
        IdentityPillarBadge(
            pillar = IdentityPillar.Personal,
            state = if (verified) IdentityPillarVerificationState.Verified else IdentityPillarVerificationState.Unverified,
        ),
        IdentityPillarBadge(
            pillar = IdentityPillar.Home,
            state = homeState,
        ),
        IdentityPillarBadge(
            pillar = IdentityPillar.Business,
            state = businessState,
        ),
    )
}

private fun hasHomeResidency(profile: PublicProfileDto): Boolean {
    val r = profile.residency ?: return false
    val verifiedValue = r["verified"]
    if (verifiedValue is Boolean) return verifiedValue
    return r.isNotEmpty()
}

private fun relativeTimestamp(iso: String?): String {
    if (iso.isNullOrEmpty()) return ""
    val instant =
        try {
            Instant.parse(iso)
        } catch (_: Throwable) {
            return ""
        }
    val seconds = Duration.between(instant, Instant.now()).seconds
    return when {
        seconds < 60 -> "Just now"
        seconds < 3_600 -> "${seconds / 60}m ago"
        seconds < 86_400 -> "${seconds / 3_600}h ago"
        seconds < 604_800 -> "${seconds / 86_400}d ago"
        else -> instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString()
    }
}

/** Header stat cells from the existing DTO; an empty result hides the strip. */
private fun buildStatCells(profile: PublicProfileDto): List<ProfileStatCell> {
    val stats = mutableListOf<ProfileStatCell>()
    val reviewCount = profile.reviewCount ?: 0
    if (reviewCount > 0 || profile.reviews.isNotEmpty()) {
        stats +=
            ProfileStatCell(
                id = "reviews",
                value = "${profile.reviewCount ?: profile.reviews.size}",
                label = "Reviews",
            )
    }
    val rating = profile.averageRating ?: 0.0
    if (rating > 0) {
        stats +=
            ProfileStatCell(
                id = "rating",
                value = "%.1f".format(rating),
                label = "Rating",
            )
    }
    val gigsCompleted = profile.gigsCompleted ?: 0
    val gigsPosted = profile.gigsPosted ?: 0
    when {
        // Launch cut #4 (Open Gigs): no gig count, like the hidden Gigs tab.
        !LaunchFeatures.openGigs -> Unit
        gigsCompleted > 0 ->
            stats += ProfileStatCell(id = "gigs", value = "$gigsCompleted", label = "Gigs")
        gigsPosted > 0 ->
            stats += ProfileStatCell(id = "gigs", value = "$gigsPosted", label = "Gigs")
    }
    // No reviews or rating yet: no stats row (BeaconIdentityBlock hides an empty one)
    // rather than a "— Activity" cell that reads as a broken stat.
    return stats
}

private fun neighborVerifications(
    profile: PublicProfileDto,
    isNew: Boolean,
): List<NeighborVerification> {
    val tile = if (isNew) NeighborVerification.Tile.Success else NeighborVerification.Tile.Primary
    val trailing: NeighborVerification.Trailing =
        if (isNew) NeighborVerification.Trailing.Status("Recent") else NeighborVerification.Trailing.Check
    // Only what the payload shows: verified residency (method unknown) and
    // the account's confirmed email. No server field records an ID check.
    val items = mutableListOf<NeighborVerification>()
    if (hasHomeResidency(profile)) {
        items += NeighborVerification("address", PantopusIcon.Home, "Address", "Verified", tile, trailing)
    }
    if (profile.verified == true) {
        items += NeighborVerification("email", PantopusIcon.Mail, "Email", "Confirmed", tile, trailing)
    }
    return items
}

private fun neighborSince(
    iso: String?,
    isNew: Boolean,
): String? {
    if (iso.isNullOrEmpty()) return if (isNew) "New here" else null
    val instant =
        try {
            Instant.parse(iso)
        } catch (_: Throwable) {
            return if (isNew) "New here" else null
        }
    val days = Duration.between(instant, Instant.now()).toDays()
    if (days < 14) return "Joined ${days.coerceAtLeast(0)} days ago"
    val year = instant.atZone(java.time.ZoneId.systemDefault()).year
    return "Neighbor since $year"
}
