@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.inbox.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.chats.UnifiedConversationDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.chats.ChatBadgeCoordinator
import app.pantopus.android.data.chats.ChatConversationPreferences
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.data.chats.ChatUnreadBadgeMath
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.ui.screens.root.badgeUnreadCount
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import timber.log.Timber
import java.time.Duration
import java.time.Instant
import javax.inject.Inject

@HiltViewModel
class ChatListViewModel
    @Inject
    constructor(
        private val repo: ChatRepository,
        private val socket: SocketManager,
        private val preferences: ChatConversationPreferences,
        private val badgeCoordinator: ChatBadgeCoordinator,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ChatListUiState>(ChatListUiState.Loading)
        val state: StateFlow<ChatListUiState> = _state.asStateFlow()

        private val _activeFilter = MutableStateFlow(ChatFilter.All)
        val activeFilter: StateFlow<ChatFilter> = _activeFilter.asStateFlow()

        private val _unreadByFilter = MutableStateFlow<Map<ChatFilter, Int>>(emptyMap())
        val unreadByFilter: StateFlow<Map<ChatFilter, Int>> = _unreadByFilter.asStateFlow()

        private var allRows: List<ConversationRowContent> = emptyList()
        private var serverTotalUnread: Int = 0
        private var hiddenKeys: Set<String> = emptySet()
        private var mutedKeys: Set<String> = emptySet()
        private val aiRow =
            ConversationRowContent(
                id = "ai_assistant",
                variant = ConversationRowVariant.AiAssistant,
                displayName = "Pantopus AI",
                initials = "AI",
                avatarUrl = null,
                identityChip = null,
                verified = false,
                preview = "Summaries, drafts, neighborhood help.",
                timeLabel = "now",
                unread = 0,
                pinned = true,
                topicKinds = emptySet(),
                storageKey = "ai_assistant",
            )

        private var badgeJob: Job? = null
        private var messageJob: Job? = null

        fun load() {
            if (_state.value is ChatListUiState.Loaded) return
            fetch()
            subscribeToSockets()
        }

        fun refresh() = fetch()

        fun selectFilter(filter: ChatFilter) {
            if (_activeFilter.value == filter) return
            _activeFilter.value = filter
            applyFilter()
        }

        fun hideConversation(storageKey: String) {
            if (storageKey == aiRow.storageKey) return
            val unreadBaseline = allRows.firstOrNull { it.storageKey == storageKey }?.unread ?: 0
            preferences.hide(storageKey, unreadBaseline)
            hiddenKeys = preferences.hiddenKeys()
            applyFilter()
            publishBadgeSnapshot()
        }

        fun toggleMute(storageKey: String) {
            if (storageKey == aiRow.storageKey) return
            preferences.toggleMute(storageKey)
            mutedKeys = preferences.mutedKeys()
            decorateRowsWithMuteState()
            applyFilter()
            publishBadgeSnapshot()
        }

        fun teardown() {
            badgeJob?.cancel()
            messageJob?.cancel()
            badgeJob = null
            messageJob = null
        }

        override fun onCleared() {
            super.onCleared()
            teardown()
        }

        // MARK: - Fetch

        private fun fetch() {
            viewModelScope.launch {
                val conversationsDeferred = async { repo.unifiedConversations() }
                val statsDeferred = async { repo.stats() }
                val conversationsResult = conversationsDeferred.await()
                val statsResult = statsDeferred.await()

                val response =
                    (conversationsResult as? NetworkResult.Success)?.data
                        ?: run {
                            val message =
                                (conversationsResult as? NetworkResult.Failure)
                                    ?.error?.message
                                    ?: "Couldn't load conversations."
                            _state.value = ChatListUiState.Error(message)
                            return@launch
                        }
                val stats = (statsResult as? NetworkResult.Success)?.data?.stats
                loadPreferences()
                serverTotalUnread =
                    stats?.totalUnread ?: response.totalUnread ?: response.conversations.sumOf { it.totalUnread }
                allRows = response.conversations.map { project(it, mutedKeys) }
                applyFilter()
                publishBadgeSnapshot()
            }
        }

        private fun publishBadgeSnapshot() {
            badgeCoordinator.publish(serverTotalUnread, allRows)
        }

        private fun loadPreferences() {
            hiddenKeys = preferences.hiddenKeys()
            mutedKeys = preferences.mutedKeys()
        }

        private fun updateUnreadByFilter() {
            val adjustedUnread =
                ChatUnreadBadgeMath.adjustedTotal(
                    serverTotal = serverTotalUnread,
                    rows = allRows,
                    mutedKeys = mutedKeys,
                )
            _unreadByFilter.value =
                mapOf(
                    ChatFilter.All to 0,
                    ChatFilter.Unread to adjustedUnread,
                    ChatFilter.Gigs to allRows.count { it.topicKinds.contains("gig") },
                    ChatFilter.Market to allRows.count { it.topicKinds.contains("marketplace") },
                )
        }

        private fun applyFilter() {
            autoUnhideConversationsWithUnread()
            val visibleRows = allRows.filter { it.storageKey !in hiddenKeys }
            val filtered =
                when (_activeFilter.value) {
                    ChatFilter.All -> visibleRows
                    ChatFilter.Unread -> visibleRows.filter { it.unread > 0 }
                    ChatFilter.Gigs -> visibleRows.filter { it.topicKinds.contains("gig") }
                    ChatFilter.Market -> visibleRows.filter { it.topicKinds.contains("marketplace") }
                }
            if (filtered.isEmpty()) {
                _state.value = ChatListUiState.Empty
                return
            }
            val combined = listOf(aiRow) + filtered
            _state.value =
                ChatListUiState.Loaded(rows = combined.sortedByDescending { it.pinned })
            updateUnreadByFilter()
        }

        private fun autoUnhideConversationsWithUnread() {
            val toUnhide =
                allRows
                    .filter { preferences.shouldAutoUnhide(it.storageKey, it.unread) }
                    .map { it.storageKey }
            if (toUnhide.isEmpty()) return
            preferences.unhide(toUnhide)
            hiddenKeys = preferences.hiddenKeys()
        }

        private fun decorateRowsWithMuteState() {
            allRows =
                allRows.map { row ->
                    row.copy(isMuted = row.storageKey in mutedKeys)
                }
        }

        // MARK: - Realtime

        private fun subscribeToSockets() {
            if (badgeJob == null) {
                badgeJob =
                    viewModelScope.launch {
                        socket.eventsOf("badge:update").collect { json ->
                            json.badgeUnreadCount()?.let { total ->
                                serverTotalUnread = total
                                updateUnreadByFilter()
                            }
                        }
                    }
            }
            if (messageJob == null) {
                messageJob =
                    viewModelScope.launch {
                        socket.eventsOf("message:new").collect { json ->
                            handleMessage(json)
                        }
                    }
            }
        }

        private fun handleMessage(json: JSONObject) {
            val otherUserId = json.optString("other_user_id").takeIf { it.isNotEmpty() }
            val roomId = json.optString("room_id").takeIf { it.isNotEmpty() }
            val targetId = otherUserId ?: roomId ?: return
            val index = allRows.indexOfFirst { it.id == targetId }
            if (index < 0) {
                fetch()
                return
            }
            val original = allRows[index]
            val unreadFor =
                if (json.has("unread_for")) json.optInt("unread_for") else original.unread + 1
            val preview = json.optString("preview").ifEmpty { original.preview }
            val createdAt = json.optString("created_at").ifEmpty { null }
            val timeLabel = createdAt?.let { relativeTimestamp(it) } ?: "now"
            val updated = original.copy(preview = preview, timeLabel = timeLabel, unread = unreadFor)
            allRows = allRows.toMutableList().also { it[index] = updated }
            if (unreadFor > original.unread) {
                serverTotalUnread += unreadFor - original.unread
            }
            applyFilter()
            publishBadgeSnapshot()
        }

        // MARK: - Projection

        private fun project(
            dto: UnifiedConversationDto,
            mutedKeys: Set<String>,
        ): ConversationRowContent {
            val isRoom = dto.type == "room"
            val name =
                if (isRoom) {
                    dto.roomName ?: "Group"
                } else {
                    dto.otherParticipantName ?: dto.otherParticipantIdentity?.displayName ?: "Pantopus user"
                }
            val rowId =
                if (isRoom) (dto.id ?: dto.gigId ?: dto.homeId ?: name) else (dto.otherParticipantId ?: name)
            val identityKind = dto.otherParticipantIdentity?.identityKind
            val identityChip =
                when {
                    !isRoom && identityKind == "business" -> ConversationIdentityChip.Business
                    !isRoom && identityKind == "home" -> ConversationIdentityChip.Home
                    isRoom && dto.roomType == "home" -> ConversationIdentityChip.Home
                    else -> null
                }
            val variant: ConversationRowVariant =
                if (isRoom) ConversationRowVariant.Group() else ConversationRowVariant.Dm
            val verified = dto.otherParticipantIdentity?.verified == true
            val preview =
                dto.lastMessagePreview ?: if (isRoom) "No messages yet" else "Start the conversation"
            val timeLabel = dto.lastMessageAt?.let { relativeTimestamp(it) } ?: ""
            val storageKey =
                if (isRoom) {
                    ChatConversationPreferences.roomKey(rowId)
                } else {
                    ChatConversationPreferences.personKey(rowId)
                }
            return ConversationRowContent(
                id = rowId,
                variant = variant,
                displayName = name,
                initials = initials(name),
                avatarUrl = dto.otherParticipantAvatar,
                identityChip = identityChip,
                verified = verified,
                preview = preview,
                timeLabel = timeLabel,
                unread = dto.totalUnread,
                pinned = false,
                topicKinds = dto.topics?.mapNotNull { it.topicType }?.toSet() ?: emptySet(),
                storageKey = storageKey,
                isMuted = storageKey in mutedKeys,
                topics =
                    dto.topics.orEmpty().mapNotNull { topic ->
                        val title = topic.title?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
                        ConversationRowTopic(title = title, topicType = topic.topicType ?: "general")
                    },
                gigId = if (isRoom) dto.gigId else null,
            )
        }

        private fun initials(name: String): String {
            val parts = name.split(" ").take(2)
            val result = parts.mapNotNull { it.firstOrNull()?.toString() }.joinToString("").uppercase()
            return result.ifEmpty { "?" }
        }

        private fun relativeTimestamp(iso: String): String =
            runCatching {
                val instant = Instant.parse(iso)
                val seconds = Duration.between(instant, Instant.now()).seconds
                when {
                    seconds < 60 -> "now"
                    seconds < 3_600 -> "${seconds / 60}m"
                    seconds < 86_400 -> "${seconds / 3_600}h"
                    seconds < 604_800 -> "${seconds / 86_400}d"
                    else -> "${seconds / 604_800}w"
                }
            }.getOrElse {
                Timber.w("Couldn't parse chat timestamp: $iso")
                ""
            }

        /** Compose-friendly icon for the chat assistant avatar. */
        val assistantIcon: PantopusIcon = PantopusIcon.Info
    }
