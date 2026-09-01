package app.pantopus.android.ui.screens.root

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.chats.ChatBadgeCoordinator
import app.pantopus.android.data.chats.ChatConversationPreferences
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.data.chats.ChatUnreadBadgeMath
import app.pantopus.android.data.realtime.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch
import org.json.JSONObject
import timber.log.Timber
import javax.inject.Inject

@HiltViewModel
class ChatBadgeViewModel
    @Inject
    constructor(
        private val repo: ChatRepository,
        private val socket: SocketManager,
        private val preferences: ChatConversationPreferences,
        private val badgeCoordinator: ChatBadgeCoordinator,
    ) : ViewModel() {
        private val _unreadMessages = MutableStateFlow(0)
        val unreadMessages: StateFlow<Int> = _unreadMessages.asStateFlow()

        private var serverTotalUnread: Int = 0

        init {
            refresh()
            subscribeToSocket()
            subscribeToListSnapshots()
        }

        fun refresh() {
            viewModelScope.launch {
                val statsResult = repo.stats()
                val conversationsResult = repo.unifiedConversations()
                val stats =
                    (statsResult as? NetworkResult.Success)?.data?.stats ?: run {
                        Timber.w("Chat badge refresh failed: stats unavailable")
                        return@launch
                    }
                serverTotalUnread = stats.totalUnread
                val conversations =
                    (conversationsResult as? NetworkResult.Success)?.data?.conversations.orEmpty()
                val mutedKeys = preferences.mutedKeys()
                val rows =
                    conversations.map { dto ->
                        val isRoom = dto.type == "room"
                        val rowId =
                            if (isRoom) {
                                dto.id ?: dto.gigId ?: dto.homeId ?: "room"
                            } else {
                                dto.otherParticipantId ?: "person"
                            }
                        val storageKey =
                            if (isRoom) {
                                ChatConversationPreferences.roomKey(rowId)
                            } else {
                                ChatConversationPreferences.personKey(rowId)
                            }
                        app.pantopus.android.ui.screens.inbox.chat.ConversationRowContent(
                            id = rowId,
                            variant =
                                if (isRoom) {
                                    app.pantopus.android.ui.screens.inbox.chat.ConversationRowVariant.Group()
                                } else {
                                    app.pantopus.android.ui.screens.inbox.chat.ConversationRowVariant.Dm
                                },
                            displayName = rowId,
                            initials = "?",
                            avatarUrl = null,
                            identityChip = null,
                            verified = false,
                            preview = "",
                            timeLabel = "",
                            unread = dto.totalUnread,
                            pinned = false,
                            topicKinds = emptySet(),
                            storageKey = storageKey,
                            isMuted = storageKey in mutedKeys,
                        )
                    }
                applyAdjustedUnread(rows)
            }
        }

        private fun subscribeToSocket() {
            viewModelScope.launch {
                socket.eventsOf("badge:update").collect { json ->
                    json.badgeUnreadCount()?.let { total ->
                        serverTotalUnread = total
                        applyAdjustedUnread(badgeCoordinator.snapshot.value.rows)
                    }
                }
            }
            viewModelScope.launch {
                socket.connectionState
                    .filter { it == SocketManager.ConnectionState.Connected }
                    .collect { refresh() }
            }
        }

        private fun subscribeToListSnapshots() {
            viewModelScope.launch {
                badgeCoordinator.snapshot.collect { snapshot ->
                    if (snapshot.rows.isNotEmpty()) {
                        serverTotalUnread = snapshot.serverTotalUnread
                        applyAdjustedUnread(snapshot.rows)
                    }
                }
            }
        }

        private fun applyAdjustedUnread(rows: List<app.pantopus.android.ui.screens.inbox.chat.ConversationRowContent>) {
            _unreadMessages.value =
                ChatUnreadBadgeMath.adjustedTotal(
                    serverTotal = serverTotalUnread,
                    rows = rows,
                    mutedKeys = preferences.mutedKeys(),
                )
        }
    }

fun JSONObject.badgeUnreadCount(): Int? =
    when {
        has("unread_messages") -> optInt("unread_messages")
        has("unreadMessages") -> optInt("unreadMessages")
        has("total_unread") -> optInt("total_unread")
        has("totalUnread") -> optInt("totalUnread")
        else -> null
    }
