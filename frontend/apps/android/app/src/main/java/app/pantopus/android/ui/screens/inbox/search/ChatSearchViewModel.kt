@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.inbox.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.chats.ChatMessageDto
import app.pantopus.android.data.api.models.chats.UnifiedConversationDto
import app.pantopus.android.data.api.models.chats.resolvedText
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.ui.screens.inbox.chat.ConversationIdentityChip
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Backs the Chat Search surface. The backend exposes no message-search
 * endpoint, so search runs client-side: on first appearance we fetch the
 * unified conversation list and, in parallel, the most-recent page of
 * messages per conversation, then build an in-memory index. Every
 * keystroke filters that index locally — instant, no per-keystroke
 * network.
 *
 * Indexing the same most-recent page the conversation screen loads on open
 * guarantees any matched message id is present in the conversation's first
 * page, so "scroll to the matching message" always resolves.
 */
@HiltViewModel
class ChatSearchViewModel
    @Inject
    constructor(
        private val repo: ChatRepository,
    ) : ViewModel() {
        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _results = MutableStateFlow<List<ChatSearchResult>>(emptyList())
        val results: StateFlow<List<ChatSearchResult>> = _results.asStateFlow()

        private val _isLoading = MutableStateFlow(true)
        val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

        private var index: List<IndexedConversation> = emptyList()
        private var didLoad = false

        fun load() {
            if (didLoad) return
            didLoad = true
            viewModelScope.launch {
                buildIndex()
                _isLoading.value = false
                recompute()
            }
        }

        fun setQuery(value: String) {
            _query.value = value
            recompute()
        }

        // MARK: - Filtering

        private fun recompute() {
            val trimmed = _query.value.trim()
            if (trimmed.isEmpty()) {
                _results.value = emptyList()
                return
            }
            // Index not ready — leave results empty so the shell keeps
            // shimmering instead of flashing "no matches".
            if (_isLoading.value) return
            _results.value = search(trimmed)
        }

        private fun search(query: String): List<ChatSearchResult> {
            val out = mutableListOf<ChatSearchResult>()
            for (entry in index) {
                val nameMatches = ChatSearchText.matches(entry.displayName, query)
                // Messages arrive newest-first, so the first match is the
                // most recent one — the message we scroll to.
                val bodyMatch =
                    entry.messages.firstOrNull { message ->
                        val text = message.resolvedText
                        !text.isNullOrEmpty() && ChatSearchText.matches(text, query)
                    }
                val bodyText = bodyMatch?.resolvedText

                val snippet: String
                val matchedMessageId: String?
                when {
                    bodyMatch != null && bodyText != null -> {
                        snippet = ChatSearchText.snippet(bodyText, query)
                        matchedMessageId = bodyMatch.id
                    }
                    nameMatches -> {
                        snippet = entry.lastPreview
                        matchedMessageId = null
                    }
                    else -> continue
                }

                out.add(
                    ChatSearchResult(
                        conversationId = entry.id,
                        kind = entry.kind,
                        displayName = entry.displayName,
                        initials = entry.initials,
                        identityChip = entry.identityChip,
                        verified = entry.verified,
                        snippet = snippet,
                        matchedMessageId = matchedMessageId,
                        query = query,
                    ),
                )
            }
            return out
        }

        // MARK: - Index

        private suspend fun buildIndex() {
            val response =
                (repo.unifiedConversations() as? NetworkResult.Success)?.data ?: run {
                    index = emptyList()
                    return
                }
            val conversations = response.conversations.map(::meta)
            val messagesById =
                coroutineScope {
                    conversations
                        .map { conversation -> async { conversation.id to fetchMessages(conversation) } }
                        .map { it.await() }
                }.toMap()
            index = conversations.map { it.copy(messages = messagesById[it.id] ?: emptyList()) }
        }

        private suspend fun fetchMessages(conversation: IndexedConversation): List<ChatMessageDto> {
            val result =
                if (conversation.kind == ChatSearchResultKind.Group) {
                    repo.roomMessages(conversation.id)
                } else {
                    repo.conversationMessages(conversation.id)
                }
            return (result as? NetworkResult.Success)?.data?.messages ?: emptyList()
        }

        // MARK: - Projection

        private fun meta(dto: UnifiedConversationDto): IndexedConversation {
            val isRoom = dto.type == "room"
            val name = displayName(dto, isRoom)
            return IndexedConversation(
                id = conversationId(dto, isRoom, name),
                kind = if (isRoom) ChatSearchResultKind.Group else ChatSearchResultKind.Dm,
                displayName = name,
                initials = initials(name),
                identityChip = identityChip(dto, isRoom),
                verified = dto.otherParticipantIdentity?.verified == true,
                lastPreview = lastPreview(dto, isRoom),
            )
        }

        private fun displayName(
            dto: UnifiedConversationDto,
            isRoom: Boolean,
        ): String =
            if (isRoom) {
                dto.roomName ?: "Group"
            } else {
                dto.otherParticipantName ?: dto.otherParticipantIdentity?.displayName ?: "Pantopus user"
            }

        private fun conversationId(
            dto: UnifiedConversationDto,
            isRoom: Boolean,
            name: String,
        ): String = if (isRoom) (dto.id ?: dto.gigId ?: dto.homeId ?: name) else (dto.otherParticipantId ?: name)

        private fun identityChip(
            dto: UnifiedConversationDto,
            isRoom: Boolean,
        ): ConversationIdentityChip? {
            val identityKind = dto.otherParticipantIdentity?.identityKind
            return when {
                !isRoom && identityKind == "business" -> ConversationIdentityChip.Business
                !isRoom && identityKind == "home" -> ConversationIdentityChip.Home
                isRoom && dto.roomType == "home" -> ConversationIdentityChip.Home
                else -> null
            }
        }

        private fun lastPreview(
            dto: UnifiedConversationDto,
            isRoom: Boolean,
        ): String = dto.lastMessagePreview ?: if (isRoom) "No messages yet" else "Start the conversation"

        private fun initials(name: String): String {
            val parts = name.split(" ").take(2)
            val result = parts.mapNotNull { it.firstOrNull()?.toString() }.joinToString("").uppercase()
            return result.ifEmpty { "?" }
        }
    }

/** One conversation's searchable record — identity metadata plus the
 *  most-recent page of messages. */
private data class IndexedConversation(
    val id: String,
    val kind: ChatSearchResultKind,
    val displayName: String,
    val initials: String,
    val identityChip: ConversationIdentityChip?,
    val verified: Boolean,
    val lastPreview: String,
    val messages: List<ChatMessageDto> = emptyList(),
)
