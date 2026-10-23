@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.inbox.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.chats.UnifiedConversationDto
import app.pantopus.android.data.api.models.chats.UnifiedConversationsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.chats.ChatBadgeCoordinator
import app.pantopus.android.data.chats.ChatConversationPreferences
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.data.chats.ChatUnreadBadgeMath
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.ui.screens.inbox.conversation.isTopicLaunchAvailable
import app.pantopus.android.ui.screens.root.badgeUnmutedUnreadCount
import app.pantopus.android.ui.screens.root.badgeUnreadCount
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
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

        /** Drives the pull-to-refresh indicator. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        private var allRows: List<ConversationRowContent> = emptyList()
        private var serverTotalUnread: Int = 0
        private var serverUnmutedUnread: Int? = null
        private var badgeRevision = 0L
        private var nextCursor: String? = null
        private var pageGeneration = 0L
        private var pageJob: Job? = null
        private val refreshedKeys = mutableSetOf<String>()
        private val _paging = MutableStateFlow(ChatListPaging())
        val paging: StateFlow<ChatListPaging> = _paging.asStateFlow()
        private var hiddenKeys: Set<String> = emptySet()
        private var mutedKeys: Set<String> = emptySet()
        private val pendingMutes = mutableSetOf<String>()
        private var muteRevision = 0L
        private var visibleGeneration = 0L
        private var messageRevision = 0L
        private val rowRevisions = mutableMapOf<String, Long>()
        private val messageTimes = LinkedHashMap<String, Instant>()
        private var fetchJob: Job? = null
        private var followUpRead = false
        private var followUpForce = false
        private val _actionError = MutableStateFlow<String?>(null)
        val actionError: StateFlow<String?> = _actionError.asStateFlow()

        fun dismissActionError() {
            _actionError.value = null
        }

        /** The pinned assistant row. The empty state shows it too: before a first conversation it is the only way in. */
        val aiRow =
            ConversationRowContent(
                id = "ai_assistant",
                variant = ConversationRowVariant.AiAssistant,
                displayName = "Pantopus AI",
                initials = "AI",
                avatarUrl = null,
                identityChip = null,
                verified = false,
                preview = "Pickup days, alerts, posts and more.",
                timeLabel = "now",
                unread = 0,
                pinned = true,
                topicKinds = emptySet(),
                storageKey = "ai_assistant",
            )

        private var badgeJob: Job? = null
        private var messageJob: Job? = null

        /**
         * Tab entry and every return (Instant Screens): the stored list shows at once and is read again only when
         * it is out of date (30 seconds, or a message sent, read or arrived). Back from a conversation, which
         * covers the list and whose teardown() stopped the socket listeners: listen again, so the conversation
         * just read and the messages that arrived meanwhile show (as on iOS).
         */
        fun load() {
            if (_state.value !is ChatListUiState.Loaded) {
                val known = badgeCoordinator.snapshot.value
                if (known.initialized) {
                    serverTotalUnread = known.serverTotalUnread
                    serverUnmutedUnread = known.serverUnmutedUnread
                }
                repo.conversationsCopy()?.let { show(it, syncMutes = false, updateTotals = !known.initialized) }
            }
            subscribeToSockets()
            fetch(force = false)
        }

        /**
         * Pull-to-refresh and the error frame's Try again: read now. The rows stay while
         * the list is re-read, so it can't go stale if the live connection drops.
         */
        fun refresh() {
            _refreshing.value = true
            fetch(force = true)
        }

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
            val row = allRows.firstOrNull { it.storageKey == storageKey } ?: return
            if (!pendingMutes.add(storageKey)) return
            val generation = visibleGeneration
            val enableNotifications = row.isMuted
            viewModelScope.launch {
                try {
                    val result =
                        if (row.variant is ConversationRowVariant.Group) {
                            repo.setRoomNotifications(row.id, enableNotifications)
                        } else {
                            repo.setConversationNotifications(row.id, enableNotifications)
                        }
                    if (generation != visibleGeneration) return@launch
                    when (result) {
                        is NetworkResult.Success -> {
                            muteRevision++
                            preferences.syncMuted(mapOf(storageKey to !result.data.notificationsEnabled))
                            mutedKeys = preferences.mutedKeys()
                            decorateRowsWithMuteState()
                            applyFilter()
                            publishBadgeSnapshot()
                            fetch(force = true)
                        }
                        is NetworkResult.Failure -> _actionError.value = result.error.message
                    }
                } finally {
                    pendingMutes.remove(storageKey)
                }
            }
        }

        fun teardown() {
            visibleGeneration++
            pageGeneration++
            pageJob?.cancel()
            pageJob = null
            _paging.value = _paging.value.copy(loading = false)
            fetchJob?.cancel()
            fetchJob = null
            followUpRead = false
            followUpForce = false
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

        /** Reads the list through the store; a failed read keeps the rows on screen (the store keeps its copy too). */
        private fun fetch(force: Boolean) {
            if (fetchJob?.isActive == true) {
                followUpRead = true
                followUpForce = followUpForce || force
                return
            }
            val revision = muteRevision
            val badgesAtStart = badgeRevision
            val messagesAtStart = messageRevision
            val generation = visibleGeneration
            fetchJob =
                viewModelScope.launch {
                    try {
                        val stored = repo.conversationsStored(force)
                        if (generation != visibleGeneration) return@launch
                        _refreshing.value = false
                        val response = stored.data
                        when {
                            response != null -> {
                                val live = allRows.filter { (rowRevisions[it.storageKey] ?: 0) > messagesAtStart }
                                show(
                                    response,
                                    syncMutes = stored.failure == null && revision == muteRevision,
                                    liveRows = live,
                                    updateTotals = stored.failure == null && badgesAtStart == badgeRevision,
                                )
                            }
                            _state.value is ChatListUiState.Loaded || _state.value == ChatListUiState.Empty -> Unit
                            else -> _state.value = ChatListUiState.Error(stored.failure?.message ?: "Couldn't load conversations.")
                        }
                    } finally {
                        if (generation == visibleGeneration) {
                            fetchJob = null
                            if (followUpRead) {
                                val forceNext = followUpForce
                                followUpRead = false
                                followUpForce = false
                                fetch(force = forceNext)
                            }
                        }
                    }
                }
        }

        /** Projects a list reply: rows, the unread total (the list's own `totalUnread`) and the tab badge. */
        private fun show(
            response: UnifiedConversationsResponse,
            syncMutes: Boolean = true,
            liveRows: List<ConversationRowContent> = emptyList(),
            updateTotals: Boolean = true,
        ) {
            if (syncMutes) syncMutePreferences(response)
            loadPreferences()
            if (updateTotals) {
                serverTotalUnread = response.totalUnread ?: response.conversations.sumOf { it.totalUnread }
                serverUnmutedUnread = response.totalUnmutedUnread
            }
            pageGeneration++
            pageJob?.cancel()
            pageJob = null
            val fresh = response.conversations.map { project(it, mutedKeys) }
            refreshedKeys.clear()
            refreshedKeys.addAll(fresh.map { it.storageKey })
            nextCursor = response.nextCursor
            _paging.value = ChatListPaging(hasMore = response.hasMore && nextCursor != null)
            val retained = if (_paging.value.hasMore) allRows.filter { it.storageKey !in refreshedKeys } else emptyList()
            allRows = fresh + retained
            liveRows.forEach { live ->
                val fetched = allRows.firstOrNull { it.storageKey == live.storageKey }
                if (fetched != null && messageTime(live.lastMessageAt) >= messageTime(fetched.lastMessageAt)) {
                    if (updateTotals && serverUnmutedUnread == null) serverTotalUnread += live.unread - fetched.unread
                    allRows = allRows.filterNot { it.storageKey == live.storageKey } + live.copy(isMuted = live.storageKey in mutedKeys)
                }
            }
            allRows = allRows.sortedByDescending { messageTime(it.lastMessageAt) }
            rowRevisions.keys.retainAll(allRows.map { it.storageKey }.toSet())
            applyFilter()
            publishBadgeSnapshot()
        }

        private fun syncMutePreferences(response: UnifiedConversationsResponse) {
            val known =
                response.conversations.mapNotNull { dto ->
                    val enabled = dto.notificationsEnabled ?: return@mapNotNull null
                    val key =
                        if (dto.type == "room") {
                            dto.id?.let { ChatConversationPreferences.roomKey(it) }
                        } else {
                            dto.otherParticipantId?.let { ChatConversationPreferences.personKey(it) }
                        } ?: return@mapNotNull null
                    key to !enabled
                }.toMap()
            preferences.syncMuted(known)
        }

        fun loadMore() {
            val cursor = nextCursor ?: return
            if (!_paging.value.hasMore || pageJob?.isActive == true || fetchJob?.isActive == true) return
            val generation = pageGeneration
            val mutesAtStart = muteRevision
            val messagesAtStart = messageRevision
            _paging.value = _paging.value.copy(loading = true, error = null)
            pageJob =
                viewModelScope.launch {
                    when (val result = repo.conversationsPage(before = cursor)) {
                        is NetworkResult.Success -> {
                            if (generation != pageGeneration) return@launch
                            pageJob = null
                            if (mutesAtStart == muteRevision) syncMutePreferences(result.data)
                            loadPreferences()
                            mergePage(result.data, messagesAtStart)
                        }
                        is NetworkResult.Failure -> {
                            if (generation != pageGeneration) return@launch
                            pageJob = null
                            _paging.value = _paging.value.copy(loading = false, error = result.error.message)
                        }
                    }
                }
        }

        private fun mergePage(
            response: UnifiedConversationsResponse,
            messagesAtStart: Long,
        ) {
            val rows = allRows.associateBy { it.storageKey }.toMutableMap()
            response.conversations.map { project(it, mutedKeys) }.forEach { row ->
                refreshedKeys.add(row.storageKey)
                if ((rowRevisions[row.storageKey] ?: 0) <= messagesAtStart) rows[row.storageKey] = row
            }
            val oldCursor = nextCursor
            nextCursor = response.nextCursor
            val hasMore = response.hasMore && nextCursor != null && nextCursor != oldCursor
            _paging.value = ChatListPaging(hasMore = hasMore)
            allRows =
                rows.values.filter {
                    hasMore || it.storageKey in refreshedKeys || (rowRevisions[it.storageKey] ?: 0) > messagesAtStart
                }.sortedByDescending { messageTime(it.lastMessageAt) }
            applyFilter()
            publishBadgeSnapshot()
        }

        private fun publishBadgeSnapshot() {
            badgeCoordinator.publish(serverTotalUnread, allRows, serverUnmutedUnread)
        }

        private fun loadPreferences() {
            hiddenKeys = preferences.hiddenKeys()
            mutedKeys = preferences.mutedKeys()
        }

        private fun updateUnreadByFilter() {
            val adjustedUnread =
                serverUnmutedUnread?.coerceAtLeast(0) ?: ChatUnreadBadgeMath.adjustedTotal(
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
            val filter = _activeFilter.value
            updateUnreadByFilter()
            if (filtered.isEmpty() && filter == ChatFilter.All && !_paging.value.hasMore) {
                _state.value = ChatListUiState.Empty
                return
            }
            // A filter with no matches keeps the AI row and says what it filtered
            // for, instead of claiming there are no conversations at all.
            val combined = listOf(aiRow) + filtered
            _state.value =
                ChatListUiState.Loaded(
                    rows = combined.sortedByDescending { it.pinned },
                    emptyFilter = filter.takeIf { filtered.isEmpty() },
                )
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
                                badgeRevision++
                                serverTotalUnread = total
                                serverUnmutedUnread = json.badgeUnmutedUnreadCount()
                                updateUnreadByFilter()
                                publishBadgeSnapshot()
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
                // A conversation the list doesn't have yet: read it now.
                fetch(force = true)
                return
            }
            val original = allRows[index]
            messageRevision++
            rowRevisions[original.storageKey] = messageRevision
            val unreadFor =
                if (json.has("unread_for")) json.optInt("unread_for") else original.unread + 1
            val preview = json.optString("preview").ifEmpty { original.preview }
            val createdAt = json.optString("created_at").ifEmpty { null }
            val timeLabel = createdAt?.let { relativeTimestamp(it) } ?: "now"
            val newer = messageTime(createdAt) >= messageTime(original.lastMessageAt)
            val updated =
                if (newer) {
                    original.copy(preview = preview, timeLabel = timeLabel, unread = unreadFor, lastMessageAt = createdAt)
                } else {
                    original.copy(unread = unreadFor)
                }
            allRows =
                (listOf(updated) + allRows.filterNot { it.storageKey == updated.storageKey })
                    .sortedByDescending { messageTime(it.lastMessageAt) }
            if (serverUnmutedUnread == null) {
                serverTotalUnread = (serverTotalUnread + unreadFor - original.unread).coerceAtLeast(0)
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
            val verified = dto.otherParticipantIdentity?.isVerified == true
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
                        val type = topic.topicType ?: "general"
                        // Launch cut #3 (Marketplace): no listing topic pills; the
                        // direct-message thread itself stays.
                        if (!isTopicLaunchAvailable(type)) return@mapNotNull null
                        ConversationRowTopic(title = title, topicType = type)
                    },
                gigId = if (isRoom) dto.gigId else null,
                lastMessageAt = dto.lastMessageAt,
            )
        }

        private fun messageTime(value: String?): Instant {
            if (value == null) return Instant.EPOCH
            return messageTimes[value] ?: runCatching { Instant.parse(value.replace("+00:00", "Z")) }
                .getOrDefault(Instant.EPOCH).also {
                    if (messageTimes.size >= 512) messageTimes.remove(messageTimes.keys.first())
                    messageTimes[value] = it
                }
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
