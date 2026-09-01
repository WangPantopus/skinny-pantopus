@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.mail_party

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.mailbox.v2.DrawerMail
import app.pantopus.android.data.api.models.mailbox.v2.MailPartySessionDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.mailbox.MailboxPartyRepository
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.homes.invite_owner.ToastPayload
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Session lifecycle as rendered. `GET /party/active` only ever returns
 * `pending` / `active` (`backend/routes/mailboxV2Phase2.js:935`);
 * `completed` / `expired` rows are filtered server-side.
 */
enum class MailPartyStatus(
    val slug: String,
    /** Status-chip copy. Identical on iOS. */
    val label: String,
) {
    Pending("pending", "Waiting to start"),
    Active("active", "In progress"),
    ;

    companion object {
        fun fromRaw(raw: String?): MailPartyStatus = entries.firstOrNull { it.slug == raw } ?: Pending
    }
}

/**
 * The reaction palette. The wire value is the glyph itself — the
 * validator caps `reaction` at 10 characters
 * (`backend/routes/mailboxV2Phase2.js:23`), which every glyph clears.
 */
enum class MailPartyReaction(
    val slug: String,
    /** Sent verbatim as the `reaction` body field. */
    val glyph: String,
    /** Accessibility label — the glyph alone reads poorly. */
    val label: String,
) {
    Celebrate("celebrate", "🎉", "Celebrate"),
    Laugh("laugh", "😂", "Funny"),
    Wow("wow", "😮", "Wow"),
    Love("love", "❤️", "Love"),
    Applause("applause", "👏", "Applause"),
}

/** One live/pending session in the discover list. */
data class MailPartySessionCard(
    /** `MailPartySession.id`. */
    val sessionId: String,
    val mailId: String,
    val homeId: String?,
    val title: String,
    val senderDisplay: String,
    val status: MailPartyStatus,
)

/** A Home-drawer item a party can be started from. */
data class MailPartyStartableItem(
    /** `Mail.id`. */
    val mailId: String,
    val title: String,
    val senderDisplay: String,
)

/** A household member the item can be handed to. */
data class MailPartyMember(
    /** `HomeOccupancy.user_id` — the `assignToUserId` the route wants. */
    val userId: String,
    val name: String,
    val roleLabel: String?,
)

/** The session the user is currently inside. */
data class MailPartyLiveSession(
    val sessionId: String,
    val mailId: String,
    val homeId: String?,
    val title: String,
    val senderDisplay: String,
    val status: MailPartyStatus,
    /** Assign roster. Empty in the [MailPartyLiveUiState.Empty] state. */
    val members: List<MailPartyMember>,
)

/** The reaction just sent, held for [ttlSeconds] so the view can echo it. */
data class MailPartyReactionEcho(
    val id: String,
    val glyph: String,
    val ttlSeconds: Int,
)

/** Discover-frame render state. */
sealed interface MailPartyDiscoverUiState {
    data object Loading : MailPartyDiscoverUiState

    /** No live sessions and nothing in the Home drawer to start one from. */
    data object Empty : MailPartyDiscoverUiState

    data class Loaded(
        val sessions: List<MailPartySessionCard>,
        val startable: List<MailPartyStartableItem>,
    ) : MailPartyDiscoverUiState

    data class Error(val message: String) : MailPartyDiscoverUiState
}

/**
 * Live-session render state. [Empty] still carries the session — the party
 * is real, there is just nobody on the roster to hand the item to.
 */
sealed interface MailPartyLiveUiState {
    data object Loading : MailPartyLiveUiState

    data class Empty(val session: MailPartyLiveSession) : MailPartyLiveUiState

    data class Loaded(val session: MailPartyLiveSession) : MailPartyLiveUiState

    data class Error(val message: String) : MailPartyLiveUiState
}

/**
 * Family Mail Party — the household co-opening surface. Two frames off one
 * view-model:
 *
 *  * Discover — every pending / active session in the household plus the
 *    Home-drawer items a new party can be started from.
 *  * Live session — the joined session: ephemeral reactions and a
 *    hand-it-to roster that assigns the item onto a member's Counter.
 *
 * Routes (`backend/routes/mailboxV2Phase2.js`, mounted at
 * `api/mailbox/v2/p2`, `backend/app.js:316`):
 *   GET  /party/active   (:926), POST /party/create (:741),
 *   POST /party/join     (:816), POST /party/decline (:866),
 *   POST /party/reaction (:875), POST /party/assign  (:887).
 *
 * Two supporting reads, both already shipped: the Home drawer
 * (`mailboxV2.js:280`) for startable items — `/party/create` 400s on
 * anything outside it — and `GET /api/homes/:id/occupants`
 * (`home.js:3705`) for the assign roster.
 *
 * Mirrors iOS `MailPartyViewModel`.
 */
@HiltViewModel
class MailPartyViewModel
    @Inject
    constructor(
        private val partyRepo: MailboxPartyRepository,
        private val mailboxRepo: MailboxRepository,
        private val membersRepo: HomeMembersRepository,
        networkMonitor: NetworkMonitor,
    ) : ViewModel() {
        /** Drives the shared offline strip in the screen chrome. */
        val isOnline: StateFlow<Boolean> = networkMonitor.isOnline

        private val _discover = MutableStateFlow<MailPartyDiscoverUiState>(MailPartyDiscoverUiState.Loading)
        val discover: StateFlow<MailPartyDiscoverUiState> = _discover.asStateFlow()

        /** Non-null while the live-session frame is on screen. */
        private val _live = MutableStateFlow<MailPartyLiveUiState?>(null)
        val live: StateFlow<MailPartyLiveUiState?> = _live.asStateFlow()

        /**
         * A create / join is in flight — every start affordance disables so
         * a double tap can't open two sessions for the same item.
         */
        private val _isStarting = MutableStateFlow(false)
        val isStarting: StateFlow<Boolean> = _isStarting.asStateFlow()

        /** The `assignToUserId` currently being handed off to, if any. */
        private val _assigningMemberId = MutableStateFlow<String?>(null)
        val assigningMemberId: StateFlow<String?> = _assigningMemberId.asStateFlow()

        /** The reaction currently in flight. */
        private val _sendingReaction = MutableStateFlow<MailPartyReaction?>(null)
        val sendingReaction: StateFlow<MailPartyReaction?> = _sendingReaction.asStateFlow()

        /** Last reaction the server accepted, with its ttl. */
        private val _reactionEcho = MutableStateFlow<MailPartyReactionEcho?>(null)
        val reactionEcho: StateFlow<MailPartyReactionEcho?> = _reactionEcho.asStateFlow()

        private val _toast = MutableStateFlow<ToastPayload?>(null)
        val toast: StateFlow<ToastPayload?> = _toast.asStateFlow()

        /** Screen subtitle — "2 happening now" once loaded. */
        val discoverSubtitle: String
            get() {
                val loaded = _discover.value as? MailPartyDiscoverUiState.Loaded
                val count = loaded?.sessions?.size ?: 0
                return if (count == 0) "Open household mail together" else "$count happening now"
            }

        /** The session behind the current live frame, if any. */
        val liveSession: MailPartyLiveSession?
            get() =
                when (val current = _live.value) {
                    is MailPartyLiveUiState.Empty -> current.session
                    is MailPartyLiveUiState.Loaded -> current.session
                    else -> null
                }

        // ── Lifecycle ─────────────────────────────────────────────

        fun load() {
            _discover.value = MailPartyDiscoverUiState.Loading
            fetchDiscover()
        }

        fun refresh() = fetchDiscover()

        fun dismissToast() {
            _toast.value = null
        }

        private fun fetchDiscover() {
            viewModelScope.launch { fetchDiscoverNow() }
        }

        private suspend fun fetchDiscoverNow() {
            val sessions =
                when (val active = partyRepo.activeSessions()) {
                    is NetworkResult.Failure -> {
                        _discover.value =
                            MailPartyDiscoverUiState.Error(active.error.displayMessage(DISCOVER_ERROR))
                        return
                    }

                    is NetworkResult.Success -> active.data.sessions.map { projectCard(it) }
                }
            // `/party/create` 400s on anything outside the Home drawer
            // (`mailboxV2Phase2.js:751`), so the start list is exactly the
            // Home drawer's incoming window.
            val startable =
                when (
                    val home =
                        mailboxRepo.drawer(
                            drawer = "home",
                            tab = "incoming",
                            limit = STARTABLE_LIMIT,
                            offset = 0,
                        )
                ) {
                    is NetworkResult.Failure -> {
                        _discover.value =
                            MailPartyDiscoverUiState.Error(home.error.displayMessage(DISCOVER_ERROR))
                        return
                    }

                    is NetworkResult.Success -> home.data.mail.map(::projectStartable)
                }
            _discover.value =
                if (sessions.isEmpty() && startable.isEmpty()) {
                    MailPartyDiscoverUiState.Empty
                } else {
                    MailPartyDiscoverUiState.Loaded(sessions, startable)
                }
        }

        // ── Discover intents ──────────────────────────────────────

        /** Open a session for a Home-drawer item and step into it. */
        fun startParty(item: MailPartyStartableItem) {
            if (_isStarting.value) return
            _isStarting.value = true
            viewModelScope.launch {
                when (val result = partyRepo.createSession(item.mailId)) {
                    is NetworkResult.Success ->
                        enterSession(
                            projectCard(
                                dto = result.data.session,
                                knownTitle = item.title,
                                knownSender = item.senderDisplay,
                            ),
                        )
                    is NetworkResult.Failure ->
                        _toast.value =
                            ToastPayload(
                                result.error.displayMessage("Couldn't start the party"),
                                isError = true,
                            )
                }
                _isStarting.value = false
            }
        }

        /**
         * Join a session someone else opened. The 90-second pending window
         * is enforced server-side (`mailboxV2Phase2.js:826`) — a late tap
         * surfaces the server's own "Session expired" and the row is dropped.
         */
        fun join(card: MailPartySessionCard) {
            if (_isStarting.value) return
            _isStarting.value = true
            viewModelScope.launch {
                when (val result = partyRepo.joinSession(card.sessionId)) {
                    is NetworkResult.Success ->
                        enterSession(
                            projectCard(
                                dto = result.data.session,
                                knownTitle = card.title,
                                knownSender = card.senderDisplay,
                            ),
                        )
                    is NetworkResult.Failure -> {
                        _toast.value =
                            ToastPayload(
                                result.error.displayMessage("Couldn't join the party"),
                                isError = true,
                            )
                        removeSession(card.sessionId)
                    }
                }
                _isStarting.value = false
            }
        }

        /**
         * Decline the invite and open the item solo — the server's own copy
         * says exactly that (`mailboxV2Phase2.js:870`). [onOpenMail] is the
         * host's push into the mail detail.
         */
        fun decline(
            card: MailPartySessionCard,
            onOpenMail: (String) -> Unit,
        ) {
            viewModelScope.launch {
                when (val result = partyRepo.declineSession(card.sessionId)) {
                    is NetworkResult.Success -> {
                        removeSession(card.sessionId)
                        _toast.value =
                            ToastPayload(
                                result.data.message ?: "Declined. You can still open the item solo.",
                                isError = false,
                            )
                        onOpenMail(card.mailId)
                    }

                    is NetworkResult.Failure ->
                        _toast.value =
                            ToastPayload(
                                result.error.displayMessage("Couldn't decline"),
                                isError = true,
                            )
                }
            }
        }

        // ── Live-session intents ──────────────────────────────────

        /**
         * Fetch the assign roster for the session's home and show the live
         * frame. A session without a `home_id` has no roster to read.
         */
        private suspend fun enterSession(card: MailPartySessionCard) {
            _reactionEcho.value = null
            _live.value = MailPartyLiveUiState.Loading
            val homeId = card.homeId
            if (homeId == null) {
                _live.value = MailPartyLiveUiState.Empty(projectSession(card, emptyList()))
                return
            }
            when (val result = membersRepo.listOccupants(homeId)) {
                is NetworkResult.Success -> {
                    val members = result.data.occupants.filter { it.isActive }.map(::projectMember)
                    val session = projectSession(card, members)
                    _live.value =
                        if (members.isEmpty()) {
                            MailPartyLiveUiState.Empty(session)
                        } else {
                            MailPartyLiveUiState.Loaded(session)
                        }
                }

                is NetworkResult.Failure ->
                    _live.value =
                        MailPartyLiveUiState.Error(
                            result.error.displayMessage("Couldn't open the party."),
                        )
            }
        }

        /** Retry the roster read after an error live frame. */
        fun retryLiveSession() {
            val session = liveSession ?: return
            viewModelScope.launch {
                enterSession(
                    MailPartySessionCard(
                        sessionId = session.sessionId,
                        mailId = session.mailId,
                        homeId = session.homeId,
                        title = session.title,
                        senderDisplay = session.senderDisplay,
                        status = session.status,
                    ),
                )
            }
        }

        /** Leave the live frame and re-read the discover list. */
        fun closeSession() {
            _live.value = null
            _reactionEcho.value = null
            fetchDiscover()
        }

        /**
         * Send an ephemeral reaction. The response carries the ttl the echo
         * chip lives for (`mailboxV2Phase2.js:882`).
         */
        fun send(reaction: MailPartyReaction) {
            val session = liveSession ?: return
            if (_sendingReaction.value != null) return
            _sendingReaction.value = reaction
            viewModelScope.launch {
                when (val result = partyRepo.sendReaction(session.sessionId, reaction.glyph)) {
                    is NetworkResult.Success ->
                        _reactionEcho.value =
                            MailPartyReactionEcho(
                                id = "${session.sessionId}:${reaction.slug}:${result.data.ttl ?: 0}",
                                glyph = result.data.reaction ?: reaction.glyph,
                                ttlSeconds = result.data.ttl ?: 0,
                            )

                    is NetworkResult.Failure ->
                        _toast.value =
                            ToastPayload(
                                result.error.displayMessage("Couldn't send that reaction"),
                                isError = true,
                            )
                }
                _sendingReaction.value = null
            }
        }

        /** The echo's ttl elapsed — clear the chip. */
        fun clearReactionEcho() {
            _reactionEcho.value = null
        }

        /**
         * Hand the item to a household member. This completes the session
         * server-side (`mailboxV2Phase2.js:903`), so the frame closes back
         * to discover on success.
         */
        fun assign(member: MailPartyMember) {
            val session = liveSession ?: return
            if (_assigningMemberId.value != null) return
            _assigningMemberId.value = member.userId
            viewModelScope.launch {
                when (
                    val result =
                        partyRepo.assignItem(
                            sessionId = session.sessionId,
                            mailId = session.mailId,
                            assignToUserId = member.userId,
                        )
                ) {
                    is NetworkResult.Success -> {
                        _toast.value = ToastPayload(result.data.message ?: "Item assigned", isError = false)
                        _live.value = null
                        _reactionEcho.value = null
                        fetchDiscoverNow()
                    }

                    is NetworkResult.Failure ->
                        _toast.value =
                            ToastPayload(
                                result.error.displayMessage("Couldn't hand off this item"),
                                isError = true,
                            )
                }
                _assigningMemberId.value = null
            }
        }

        // ── List maintenance ──────────────────────────────────────

        /**
         * Drop a session from the discover list without a refetch — used
         * when it is declined, or when a join is refused because it expired.
         */
        private fun removeSession(sessionId: String) {
            val current = _discover.value as? MailPartyDiscoverUiState.Loaded ?: return
            val remaining = current.sessions.filterNot { it.sessionId == sessionId }
            _discover.value =
                if (remaining.isEmpty() && current.startable.isEmpty()) {
                    MailPartyDiscoverUiState.Empty
                } else {
                    current.copy(sessions = remaining)
                }
        }

        companion object {
            /** Home-drawer window size for the start list. */
            internal const val STARTABLE_LIMIT = 20

            /** Shared discover-frame failure copy. Identical on iOS. */
            private const val DISCOVER_ERROR = "Couldn't load mail parties."

            /**
             * `/party/active` embeds the joined `Mail` row, but
             * `/party/create` and `/party/join` return the bare
             * `MailPartySession` (`mailboxV2Phase2.js:812` / `:846`) — so
             * those two callers pass the title and sender they already
             * showed the user rather than dropping to the unknown-item copy.
             */
            internal fun projectCard(
                dto: MailPartySessionDto,
                knownTitle: String? = null,
                knownSender: String? = null,
            ): MailPartySessionCard =
                MailPartySessionCard(
                    sessionId = dto.id,
                    mailId = dto.mailId,
                    homeId = dto.homeId,
                    title = dto.mail?.subject.orBlankNull() ?: knownTitle ?: "Household mail",
                    senderDisplay = dto.mail?.senderDisplay.orBlankNull() ?: knownSender ?: "Unknown sender",
                    status = MailPartyStatus.fromRaw(dto.status),
                )

            internal fun projectStartable(mail: DrawerMail): MailPartyStartableItem =
                MailPartyStartableItem(
                    mailId = mail.id,
                    title = mail.displayTitle.orBlankNull() ?: mail.subject.orBlankNull() ?: "Household mail",
                    senderDisplay = mail.senderDisplay.orBlankNull() ?: "Unknown sender",
                )

            internal fun projectMember(dto: OccupantDto): MailPartyMember =
                MailPartyMember(
                    userId = dto.userId,
                    name = dto.displayName.orBlankNull() ?: dto.username.orBlankNull() ?: "Household member",
                    roleLabel = dto.role.orBlankNull()?.let(::prettyRole),
                )

            private fun projectSession(
                card: MailPartySessionCard,
                members: List<MailPartyMember>,
            ): MailPartyLiveSession =
                MailPartyLiveSession(
                    sessionId = card.sessionId,
                    mailId = card.mailId,
                    homeId = card.homeId,
                    title = card.title,
                    senderDisplay = card.senderDisplay,
                    status = card.status,
                    members = members,
                )

            /** `restricted_member` → `Restricted member`. */
            private fun prettyRole(raw: String): String = raw.replace('_', ' ').replaceFirstChar { it.uppercaseChar() }

            private fun String?.orBlankNull(): String? = this?.trim()?.takeIf { it.isNotEmpty() }
        }
    }
