@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions", "LongMethod", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.inbox.newmessage

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.chats.UnifiedConversationDto
import app.pantopus.android.data.api.models.relationships.RelationshipDto
import app.pantopus.android.data.api.models.relationships.RelationshipUserDto
import app.pantopus.android.data.api.models.users.UserSearchResultDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.data.relationships.RelationshipsRepository
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import java.time.Duration
import java.time.Instant
import javax.inject.Inject

/**
 * Backs the New Message contact picker (T6.6b P25). Three sections
 * surface separate data sources:
 *
 * - Connections — `GET /api/relationships?status=accepted` (same source
 *   as the Connections center).
 * - Recent — derived from `GET /api/chat/unified-conversations` (DM
 *   peers, top 10 by `lastMessageAt`).
 * - All verified — search-driven via `GET /api/users/search?q=…` when
 *   the search query reaches the backend's 2-character minimum. With
 *   no query the section is hidden; Connections + Recent stay visible.
 *
 * Tapping a row exposes the selection via [destination]; the host
 * collects it once, pops the picker, and pushes the chat-conversation
 * route in `person(otherUserId)` mode.
 */
@HiltViewModel
class NewMessageViewModel
    @Inject
    constructor(
        private val relationshipsRepo: RelationshipsRepository,
        private val chatRepo: ChatRepository,
        private val profileRepo: ProfileRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<NewMessageUiState>(NewMessageUiState.Loading)
        val state: StateFlow<NewMessageUiState> = _state.asStateFlow()

        private val _searchText = MutableStateFlow("")
        val searchText: StateFlow<String> = _searchText.asStateFlow()

        /** Emits the routing payload when a row is tapped. The host
         *  consumes via [consumeDestination] after navigation. */
        private val _destination = MutableStateFlow<NewMessageDestination?>(null)
        val destination: StateFlow<NewMessageDestination?> = _destination.asStateFlow()

        val emptyHeadline: String = "Search for someone to message"
        val emptyBody: String =
            "You can message anyone with a verified Pantopus account. Search by name, " +
                "or invite someone who isn't on the platform yet."
        val emptySearchHints: List<String> = listOf("A neighbor's name", "Your block", "A local business")

        private var accepted: List<RelationshipDto> = emptyList()
        private var recents: List<UnifiedConversationDto> = emptyList()
        private var verifiedResults: List<UserSearchResultDto> = emptyList()
        private var loadedOnce: Boolean = false
        private var searchJob: Job? = null
        private var searchSequence: Int = 0

        fun load() {
            if (loadedOnce) return
            _state.value = NewMessageUiState.Loading
            viewModelScope.launch { fetchInitial() }
        }

        fun refresh() {
            viewModelScope.launch { fetchInitial() }
        }

        fun updateSearch(value: String) {
            if (_searchText.value == value) return
            _searchText.value = value
            rebuild()
            scheduleSearch(value)
        }

        fun clearSearch() = updateSearch("")

        fun tapRow(row: NewMessageContactRow) {
            _destination.value =
                NewMessageDestination(
                    userId = row.userId,
                    displayName = row.name,
                    initials = row.initials,
                    verified = row.verified,
                    locality = row.locality,
                )
        }

        fun consumeDestination() {
            _destination.value = null
        }

        // MARK: - Fetch

        private suspend fun fetchInitial() {
            val connectionsDeferred =
                viewModelScope.async { relationshipsRepo.list(status = "accepted") }
            val recentsDeferred =
                viewModelScope.async { chatRepo.unifiedConversations(limit = 50) }
            val connectionsRes = connectionsDeferred.await()
            val recentsRes = recentsDeferred.await()
            val connectionsOk =
                when (connectionsRes) {
                    is NetworkResult.Success -> {
                        accepted = connectionsRes.data.relationships
                        true
                    }
                    is NetworkResult.Failure -> {
                        Timber.w("NewMessage connections fetch failed: %s", connectionsRes.error)
                        false
                    }
                }
            val recentsOk =
                when (recentsRes) {
                    is NetworkResult.Success -> {
                        recents =
                            recentsRes.data.conversations
                                .filter { (it.type ?: "conversation") == "conversation" }
                                .take(10)
                        true
                    }
                    is NetworkResult.Failure -> {
                        Timber.w("NewMessage recents fetch failed: %s", recentsRes.error)
                        false
                    }
                }
            if (!connectionsOk && !recentsOk) {
                _state.value = NewMessageUiState.Error("Couldn't load contacts. Try again.")
                return
            }
            loadedOnce = true
            rebuild()
        }

        // MARK: - Search

        private fun scheduleSearch(query: String) {
            searchJob?.cancel()
            val trimmed = query.trim()
            if (trimmed.length < 2) {
                verifiedResults = emptyList()
                rebuild()
                return
            }
            searchSequence += 1
            val seq = searchSequence
            searchJob =
                viewModelScope.launch {
                    delay(280)
                    runSearch(trimmed, seq)
                }
        }

        private suspend fun runSearch(
            query: String,
            sequence: Int,
        ) {
            val result = profileRepo.search(query = query, limit = 20)
            if (sequence != searchSequence) return
            when (result) {
                is NetworkResult.Success -> {
                    verifiedResults = result.data.users
                    rebuild()
                }
                is NetworkResult.Failure -> {
                    Timber.w("User search failed: %s", result.error)
                    verifiedResults = emptyList()
                    rebuild()
                }
            }
        }

        // MARK: - Projection

        private fun rebuild() {
            val connectionsSection = makeConnectionsSection()
            val recentSection = makeRecentSection(excluding = connectionsSection.rows.map { it.userId }.toSet())
            val allVerifiedSection =
                makeAllVerifiedSection(
                    excluding =
                        (connectionsSection.rows + recentSection.rows)
                            .map { it.userId }
                            .toSet(),
                )

            val sections =
                buildList {
                    if (connectionsSection.rows.isNotEmpty()) add(connectionsSection)
                    if (recentSection.rows.isNotEmpty()) add(recentSection)
                    if (allVerifiedSection.rows.isNotEmpty()) add(allVerifiedSection)
                }

            val queryActive = _searchText.value.trim().isNotEmpty()
            if (sections.isEmpty()) {
                _state.value =
                    if (queryActive) NewMessageUiState.Loaded(emptyList()) else NewMessageUiState.Empty
                return
            }
            _state.value = NewMessageUiState.Loaded(sections)
        }

        private fun makeConnectionsSection(): NewMessageSection {
            val needle = normalizedSearch()
            val filtered =
                accepted.filter { rel ->
                    if (needle.isEmpty()) true else searchable(rel.otherUser).contains(needle)
                }
            val rows = filtered.map { rowForConnection(it) }
            return NewMessageSection(id = NewMessageSectionId.Connections, label = "Connections", rows = rows)
        }

        private fun makeRecentSection(excluding: Set<String>): NewMessageSection {
            val needle = normalizedSearch()
            val filtered =
                recents.filter { dto ->
                    val uid = dto.otherParticipantId ?: return@filter false
                    if (uid in excluding) return@filter false
                    if (needle.isEmpty()) return@filter true
                    val name = (dto.otherParticipantName ?: dto.otherParticipantIdentity?.displayName).orEmpty()
                    name.lowercase().contains(needle)
                }
            val rows = filtered.mapNotNull { rowForRecent(it) }
            return NewMessageSection(id = NewMessageSectionId.Recent, label = "Recent", rows = rows)
        }

        private fun makeAllVerifiedSection(excluding: Set<String>): NewMessageSection {
            if (normalizedSearch().isEmpty()) {
                return NewMessageSection(id = NewMessageSectionId.AllVerified, label = "All verified", rows = emptyList())
            }
            val filtered = verifiedResults.filter { it.id !in excluding }
            val rows = filtered.map { rowForVerified(it) }
            return NewMessageSection(id = NewMessageSectionId.AllVerified, label = "All verified", rows = rows)
        }

        private fun normalizedSearch(): String = _searchText.value.trim().lowercase()

        // MARK: - Row mapping (pure projections, internal for tests)

        internal fun rowForConnection(rel: RelationshipDto): NewMessageContactRow {
            val user = rel.otherUser
            val displayName = displayName(user) ?: "Member"
            val initials = initialsFrom(displayName)
            val raw = rel.acceptedAt ?: rel.createdAt
            val sub = formatRelative(raw)?.let { "Connected $it" }
            val subIcon = if (sub != null) PantopusIcon.UserPlus else null
            return NewMessageContactRow(
                id = "connection_${rel.id}",
                userId = user?.id ?: rel.id,
                name = displayName,
                initials = initials,
                locality = localityText(user),
                sub = sub,
                subIcon = subIcon,
                verified = true,
                identity = NewMessageIdentityBadge.Personal,
            )
        }

        internal fun rowForRecent(dto: UnifiedConversationDto): NewMessageContactRow? {
            val userId = dto.otherParticipantId ?: return null
            val displayName =
                (
                    dto.otherParticipantName?.takeIf { it.isNotEmpty() }
                        ?: dto.otherParticipantIdentity?.displayName?.takeIf { it.isNotEmpty() }
                )
                    ?: "Pantopus user"
            val initials = initialsFrom(displayName)
            val verified = dto.otherParticipantIdentity?.verified == true
            val identityKind = dto.otherParticipantIdentity?.identityKind
            val identity =
                when (identityKind) {
                    "business" -> NewMessageIdentityBadge.Business
                    "home" -> NewMessageIdentityBadge.Home
                    else -> NewMessageIdentityBadge.Personal
                }
            val locality = if (verified) "Verified neighbor" else null
            val sub = formatRelative(dto.lastMessageAt)?.let { "Last chat $it" } ?: "Last chat recently"
            return NewMessageContactRow(
                id = "recent_$userId",
                userId = userId,
                name = displayName,
                initials = initials,
                locality = locality,
                sub = sub,
                subIcon = PantopusIcon.MessageCircle,
                verified = verified,
                identity = identity,
            )
        }

        internal fun rowForVerified(dto: UserSearchResultDto): NewMessageContactRow {
            val displayName =
                (dto.name?.takeIf { it.isNotEmpty() } ?: dto.username?.takeIf { it.isNotEmpty() })
                    ?: "Member"
            val initials = initialsFrom(displayName)
            val identity =
                if (dto.accountType == "business") NewMessageIdentityBadge.Business else NewMessageIdentityBadge.Personal
            return NewMessageContactRow(
                id = "verified_${dto.id}",
                userId = dto.id,
                name = displayName,
                initials = initials,
                locality = searchLocality(dto),
                sub = null,
                subIcon = null,
                verified = true,
                identity = identity,
            )
        }

        // MARK: - Helpers

        private fun displayName(user: RelationshipUserDto?): String? {
            if (user == null) return null
            user.name?.takeIf { it.isNotEmpty() }?.let { return it }
            val first = user.firstName?.takeIf { it.isNotEmpty() }
            val last = user.lastName?.takeIf { it.isNotEmpty() }
            return when {
                first != null && last != null -> "$first $last"
                first != null -> first
                else -> user.username?.takeIf { it.isNotEmpty() }
            }
        }

        private fun localityText(user: RelationshipUserDto?): String? {
            if (user == null) return null
            val city = (user.city ?: "").trim()
            val state = (user.state ?: "").trim()
            return when {
                city.isNotEmpty() && state.isNotEmpty() -> "$city, $state"
                city.isNotEmpty() -> city
                state.isNotEmpty() -> state
                else -> null
            }
        }

        private fun searchLocality(dto: UserSearchResultDto): String? {
            val city = (dto.city ?: "").trim()
            val state = (dto.state ?: "").trim()
            return when {
                city.isNotEmpty() && state.isNotEmpty() -> "$city, $state"
                city.isNotEmpty() -> city
                state.isNotEmpty() -> state
                else -> null
            }
        }

        private fun initialsFrom(name: String): String {
            val parts = name.split(" ").take(2)
            val result = parts.mapNotNull { it.firstOrNull()?.toString() }.joinToString("").uppercase()
            return result.ifEmpty { "?" }
        }

        private fun searchable(user: RelationshipUserDto?): String {
            if (user == null) return ""
            return listOfNotNull(displayName(user), user.username, user.city, user.state)
                .joinToString(" ")
                .lowercase()
        }

        private fun formatRelative(raw: String?): String? {
            if (raw.isNullOrEmpty()) return null
            val instant =
                runCatching { Instant.parse(raw) }
                    .getOrNull()
                    ?: return null
            val seconds = Duration.between(instant, Instant.now()).seconds
            return when {
                seconds < 60 -> "just now"
                seconds < 3600 -> "${seconds / 60}m ago"
                seconds < 86_400 -> "${seconds / 3600}h ago"
                seconds < 7 * 86_400 -> "${seconds / 86_400}d ago"
                seconds < 30 * 86_400 -> "${seconds / (7 * 86_400)}w ago"
                else -> "${seconds / (30 * 86_400)}mo ago"
            }
        }
    }
