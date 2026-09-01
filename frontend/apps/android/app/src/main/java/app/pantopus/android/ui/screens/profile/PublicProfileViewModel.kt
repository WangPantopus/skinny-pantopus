@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.profile

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.posts.MyPostDto
import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.blocks.BlocksRepository
import app.pantopus.android.data.connections.ConnectionsRepository
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.data.relationships.RelationshipsRepository
import app.pantopus.android.data.social.UserSocialRepository
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileReviewCard
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileStatCell
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileTab
import app.pantopus.android.ui.screens.shared.content_detail.bodies.StatsTabsContent
import app.pantopus.android.ui.screens.shared.content_detail.headers.IdentityPillarBadge
import app.pantopus.android.ui.screens.shared.content_detail.headers.IdentityPillarVerificationState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
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
 * A21.2 — the tab strip on the Local Beacon profile archetype. Separate
 * from [ProfileTab] so the persona path keeps its own body untouched.
 *
 * Posts · About are the designed pair; Portfolio · Gigs · Reviews carry
 * the marketplace surfaces a verified neighbour actually has —
 * `GET /api/files/portfolio/{userId}` (`backend/routes/files.js:526`),
 * `GET /api/gigs?user_id=…` (`backend/routes/gigs.js:2089`) and
 * `GET /api/reviews/user/{userId}` (`backend/routes/reviews.js:149`).
 */
enum class LocalProfileTab(val label: String) {
    Posts("Posts"),
    About("About"),
    Portfolio("Portfolio"),
    Gigs("Gigs"),
    Reviews("Reviews"),
}

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
)

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

        fun load() {
            if (_state.value is PublicProfileUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = PublicProfileUiState.Loading
            viewModelScope.launch { fetch() }
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
         */
        fun showsConnectAction(): Boolean = _canFollow.value && _connection.value != ProfileConnection.Blocked

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
        fun connect() {
            if (_connectState.value is PublicProfileActionState.InFlight) return
            when (_connection.value) {
                ProfileConnection.None -> sendConnectionRequest()
                ProfileConnection.PendingReceived -> acceptConnectionRequest()
                ProfileConnection.Connected -> _showDisconnectConfirm.value = true
                ProfileConnection.PendingSent, ProfileConnection.Blocked -> Unit
            }
        }

        /** `POST api/relationships/requests` (relationships.js:67). */
        private fun sendConnectionRequest() {
            _connectState.value = PublicProfileActionState.InFlight
            viewModelScope.launch {
                when (val result = relationships.sendRequest(userId)) {
                    is NetworkResult.Success -> {
                        _connectState.value = PublicProfileActionState.Succeeded
                        _connection.value = ProfileConnection.PendingSent
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

        /**
         * Accept the inbound request. The relationship id isn't on the
         * profile payload, so resolve it from
         * `GET api/relationships/requests/pending` (relationships.js:669)
         * first — exactly what RN does before calling accept.
         */
        private fun acceptConnectionRequest() {
            _connectState.value = PublicProfileActionState.InFlight
            viewModelScope.launch {
                when (val pending = relationships.pendingRequests()) {
                    is NetworkResult.Failure -> failConnect(pending.error)
                    is NetworkResult.Success -> {
                        val match = pending.data.requests.firstOrNull { it.requester?.id == userId }
                        if (match == null) {
                            _connectState.value = PublicProfileActionState.Idle
                            // The row moved (withdrawn / already handled) —
                            // re-read the edge rather than leave the button lying.
                            loadRelationship(userId)
                            _toastMessage.value = "That request is no longer pending."
                            return@launch
                        }
                        when (val accepted = relationships.accept(match.id)) {
                            is NetworkResult.Success -> {
                                _connectState.value = PublicProfileActionState.Succeeded
                                _connection.value = ProfileConnection.Connected
                                _toastMessage.value = "Connected"
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
                            loadRelationship(userId)
                            _toastMessage.value = "You're not connected to this neighbor."
                            return@launch
                        }
                        when (val removed = connections.disconnect(match.id)) {
                            is NetworkResult.Success -> {
                                _connectState.value = PublicProfileActionState.Idle
                                _connection.value = ProfileConnection.None
                                _toastMessage.value = "Connection removed"
                            }
                            is NetworkResult.Failure -> failConnect(removed.error)
                        }
                    }
                }
            }
        }

        /** Dismiss the confirm without disconnecting. */
        fun cancelDisconnect() {
            _showDisconnectConfirm.value = false
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
         * UUIDs resolve by id; handles resolve by username. Mirrors RN's
         * `fetchPublicProfileByIdentifier` (`src/app/user/[id].tsx:53-58`).
         */
        private suspend fun loadProfile(): NetworkResult<PublicProfileDto> {
            val identifier = routeIdentifier.trim()
            return if (UserSocialRepository.isUuid(identifier)) {
                repo.publicProfile(identifier)
            } else {
                social.publicProfileByUsername(identifier)
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
                }
                // A failed relationship probe must not fail the profile —
                // the buttons just stay in their resting pose.
                is NetworkResult.Failure -> Unit
            }
        }

        private suspend fun fetch() {
            when (val result = loadProfile()) {
                is NetworkResult.Success -> {
                    val profile = result.data
                    userId = profile.id
                    val kind = derivedKind(profile)
                    // A21.2 — the Local archetype renders a real neighbourhood
                    // post feed, so pull the author's posts the way the RN
                    // `PostsTab` does (`GET /api/posts/user/:id`). Persona
                    // profiles keep an empty list on purpose: that endpoint
                    // returns plain posts, not tier-gated broadcasts, and
                    // feeding them into the broadcast card would invent a
                    // visibility chip the API never sent.
                    val feed =
                        if (kind == PublicProfileKind.Local) loadUserPosts(profile.id) else emptyList()
                    _state.value = PublicProfileUiState.Loaded(build(profile, kind, feed))
                    loadRelationship(profile.id)
                }
                is NetworkResult.Failure -> {
                    _state.value = PublicProfileUiState.Error(friendlyMessage(result.error))
                }
            }
        }

        /**
         * A21.2 — the Local profile's post feed. Mirrors the RN
         * `components/profile/PostsTab` fetch. Failures degrade to an empty
         * feed (which renders the design's "Quiet for now" state) rather
         * than failing the whole profile.
         */
        private suspend fun loadUserPosts(id: String): List<PublicProfilePost> =
            when (val result = posts.userPosts(id)) {
                is NetworkResult.Success -> result.data.posts.map { project(it) }
                is NetworkResult.Failure -> emptyList()
            }

        private fun project(post: MyPostDto): PublicProfilePost =
            PublicProfilePost(
                id = post.id,
                body = post.content?.takeIf { it.isNotEmpty() } ?: post.title.orEmpty(),
                timeAgo = relativeTimestamp(post.createdAt),
                locality = post.locationName,
                reactions = post.likeCount,
                replies = post.commentCount,
                visibility = null,
                isLocked = false,
                targetTierRank = null,
                intent = intentForPostType(post.postType),
            )

        private fun build(
            profile: PublicProfileDto,
            kind: PublicProfileKind,
            feed: List<PublicProfilePost>,
        ): PublicProfileContent {
            val header =
                PublicProfileHeader(
                    displayName = profile.displayName,
                    handle = profile.username.takeIf { it.isNotEmpty() },
                    locality = profile.locality,
                    avatarUrl = profile.profilePictureUrl ?: profile.avatarUrl,
                    isVerified = profile.verified == true,
                    identityBadges = buildBadges(profile),
                    tierLabel = if (kind == PublicProfileKind.Persona) "Persona · Verified" else null,
                    isVerifiedNeighbor = kind == PublicProfileKind.Local,
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
            )
        }

        /**
         * Header stat cells — reviews / rating / gigs, whichever the DTO
         * actually carries, falling back to a single placeholder cell so the
         * strip never renders empty.
         */
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
                gigsCompleted > 0 ->
                    stats += ProfileStatCell(id = "gigs", value = "$gigsCompleted", label = "Gigs")
                gigsPosted > 0 ->
                    stats += ProfileStatCell(id = "gigs", value = "$gigsPosted", label = "Gigs")
            }
            if (stats.isEmpty()) {
                stats += ProfileStatCell(id = "placeholder", value = "—", label = "Activity")
            }
            return stats
        }

        private fun buildReviewCards(profile: PublicProfileDto): List<ProfileReviewCard> =
            profile.reviews.map { r ->
                ProfileReviewCard(
                    id = r.id ?: UUID.randomUUID().toString(),
                    reviewerName = r.reviewerName ?: "Anonymous",
                    reviewerAvatarUrl = r.reviewerAvatar,
                    rating = r.rating.coerceIn(0, MAX_REVIEW_RATING),
                    body = r.content.orEmpty(),
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
                    NeighborStat(
                        id = "response",
                        value = if (isNew) "New" else "~45m",
                        label = "Response",
                        valueColor = if (isNew) PantopusColors.primary600 else PantopusColors.appText,
                    ),
                )

            val firstName = profile.displayName.split(" ").firstOrNull() ?: profile.displayName
            val welcome =
                if (isNew) {
                    NeighborWelcome(
                        title = "Be the welcome wagon",
                        body =
                            "$firstName just moved in. A quick hello goes a long way — " +
                                "and first messages from verified neighbors travel fast.",
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
                        isVerified = profile.verified == true,
                        identity = if (isNew) NeighborIdentity.Fresh else NeighborIdentity.Personal,
                        kicker = neighborSince(profile.createdAt, isNew),
                    ),
                stats = stats,
                bio = profile.bio,
                skills = profile.skills,
                verifications = neighborVerifications(profile, isNew),
                reviews = reviews,
                reviewCount = reviewCount,
                mutuals = if (isNew) neighborMutuals(profile) else null,
                welcome = welcome,
                posts = feed,
                isNewNeighbor = isNew,
                primaryCtaLabel = if (isNew) "Say hi" else "Message",
            )
        }

        private fun neighborVerifications(
            profile: PublicProfileDto,
            isNew: Boolean,
        ): List<NeighborVerification> {
            val tile = if (isNew) NeighborVerification.Tile.Success else NeighborVerification.Tile.Primary
            val trailing: NeighborVerification.Trailing =
                if (isNew) NeighborVerification.Trailing.Status("Recent") else NeighborVerification.Trailing.Check
            val items = mutableListOf<NeighborVerification>()
            if (hasHomeResidency(profile)) {
                items += NeighborVerification("address", PantopusIcon.Home, "Address", "Verified · postcard", tile, trailing)
            }
            if (profile.verified == true) {
                items += NeighborVerification("identity", PantopusIcon.BadgeCheck, "Identity", "Government ID", tile, trailing)
            }
            val emailMeta = if (profile.username.isEmpty()) "Confirmed" else "${profile.username}@…"
            items += NeighborVerification("email", PantopusIcon.Mail, "Email", emailMeta, tile, trailing)
            return items
        }

        private fun neighborMutuals(profile: PublicProfileDto): NeighborMutuals {
            val seed = profile.id.sumOf { it.code }
            val names =
                listOf(
                    listOf("Jamal", "Ravi", "Lena", "Amina"),
                    listOf("Maya", "Chen", "Priya", "Owen"),
                    listOf("Noah", "Iris", "Sam", "Leah"),
                )[seed % 3]
            return NeighborMutuals(
                count = names.size,
                names = names.joinToString(", "),
                initials = names.map { it.take(1) },
            )
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

        /**
         * P6.5 — Kind heuristic. A profile with a verified residency
         * blob is a Local (verified neighbor) profile; everyone else is
         * treated as a Persona (creator) profile. Backend doesn't ship
         * an explicit creator/local discriminator yet — this signal is
         * the closest stable proxy.
         */
        private fun derivedKind(profile: PublicProfileDto): PublicProfileKind =
            if (hasHomeResidency(profile)) PublicProfileKind.Local else PublicProfileKind.Persona

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

        private fun friendlyMessage(error: NetworkError): String =
            when (error) {
                NetworkError.NotFound -> "We couldn't find this profile."
                NetworkError.Forbidden -> "This profile is private."
                is NetworkError.Transport -> "Check your connection and try again."
                else -> "Something went wrong. Try again."
            }

        private companion object {
            /** Reviews are 1–5 stars; anything the API returns is clamped to it. */
            const val MAX_REVIEW_RATING = 5

            /**
             * Maps the backend `post_type` onto the design's intent chip.
             * Types with no honest counterpart (general, recommendation,
             * lost & found, local update…) render with no chip rather than
             * borrowing a misleading label. Mirrors iOS
             * `PublicProfileViewModel.intent(forPostType:)`.
             */
            fun intentForPostType(type: String?): PublicProfilePost.Intent? =
                when (type.orEmpty()) {
                    "service_offer", "deal" -> PublicProfilePost.Intent.Offer
                    "alert", "heads_up" -> PublicProfilePost.Intent.Alert
                    "event" -> PublicProfilePost.Intent.Event
                    "ask_local", "ask" -> PublicProfilePost.Intent.Ask
                    else -> null
                }

            /**
             * Shown instead of silently no-op'ing when this profile carries no
             * resolvable Beacon handle. Mirrors the iOS string exactly.
             */
            const val HANDSHAKE_UNAVAILABLE_MESSAGE = "Following isn't available from this profile yet."
        }
    }
