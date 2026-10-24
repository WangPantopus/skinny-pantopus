@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.inbox.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.chats.ChatSearchResponse
import app.pantopus.android.data.api.models.chats.UnifiedConversationDto
import app.pantopus.android.data.api.models.chats.resolvedText
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.ui.screens.inbox.chat.ConversationIdentityChip
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Debounced server search covers all accessible history without indexing each conversation on the phone. */
@HiltViewModel
class ChatSearchViewModel
    @Inject
    constructor(private val repo: ChatRepository) : ViewModel() {
        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()
        private val _results = MutableStateFlow<List<ChatSearchResult>>(emptyList())
        val results: StateFlow<List<ChatSearchResult>> = _results.asStateFlow()
        private val _isLoading = MutableStateFlow(false)
        val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
        private val _hasMore = MutableStateFlow(false)
        val hasMore: StateFlow<Boolean> = _hasMore.asStateFlow()
        private val _error = MutableStateFlow<String?>(null)
        val error: StateFlow<String?> = _error.asStateFlow()
        private var searchJob: Job? = null
        private var generation = 0L
        private var namesCursor: String? = null
        private var messagesCursor: String? = null
        private var namesRemaining = true
        private var messagesRemaining = true
        private val nameResults = linkedMapOf<String, ChatSearchResult>()
        private val messageResults = linkedMapOf<String, ChatSearchResult>()

        fun load() = Unit

        fun setQuery(value: String) {
            if (_query.value == value) return
            _query.value = value.take(200)
            generation++
            searchJob?.cancel()
            searchJob = null
            namesCursor = null
            messagesCursor = null
            namesRemaining = true
            messagesRemaining = true
            nameResults.clear()
            messageResults.clear()
            _results.value = emptyList()
            _error.value = null
            _hasMore.value = false
            _isLoading.value = _query.value.isNotBlank()
            if (_query.value.isBlank()) return
            val current = generation
            searchJob =
                viewModelScope.launch {
                    delay(250)
                    searchPage(current)
                }
        }

        fun loadMore() {
            if (searchJob?.isActive == true || _query.value.isBlank()) return
            if (!namesRemaining && !messagesRemaining) return
            val current = generation
            searchJob = viewModelScope.launch { searchPage(current) }
        }

        private suspend fun searchPage(current: Long) =
            coroutineScope {
                _isLoading.value = true
                _error.value = null
                val text = _query.value.trim()
                val names = async { if (namesRemaining) repo.conversationsPage(namesCursor, text) else null }
                val messages = async { if (messagesRemaining) repo.searchMessages(text, messagesCursor) else null }
                val named = names.await()
                val matched = messages.await()
                if (generation != current) return@coroutineScope
                when (named) {
                    is NetworkResult.Success -> {
                        named.data.conversations.map(::meta).forEach { nameResults[conversationKey(it)] = it }
                        namesRemaining = hasNext(named.data.hasMore, named.data.nextCursor, namesCursor)
                        namesCursor = named.data.nextCursor
                    }
                    is NetworkResult.Failure -> _error.value = named.error.message
                    null -> Unit
                }
                when (matched) {
                    is NetworkResult.Success -> {
                        projectMatches(matched.data, text).forEach { messageResults[requireNotNull(it.matchedMessageId)] = it }
                        messagesRemaining = hasNext(matched.data.hasMore, matched.data.nextCursor, messagesCursor)
                        messagesCursor = matched.data.nextCursor
                    }
                    is NetworkResult.Failure -> _error.value = matched.error.message
                    null -> Unit
                }
                val matchedConversations = messageResults.values.map(::conversationKey).toSet()
                _results.value = messageResults.values.toList() + nameResults.filterKeys { it !in matchedConversations }.values
                _hasMore.value = namesRemaining || messagesRemaining
                _isLoading.value = false
                searchJob = null
            }

        private fun hasNext(
            more: Boolean,
            next: String?,
            previous: String?,
        ): Boolean = more && next != null && next != previous

        private fun conversationKey(result: ChatSearchResult): String = "${result.kind}:${result.conversationId}"

        private fun projectMatches(
            response: ChatSearchResponse,
            query: String,
        ): List<ChatSearchResult> =
            response.messages.mapNotNull { message ->
                val context = response.roomContexts[message.roomId] ?: return@mapNotNull null
                ChatSearchResult(
                    conversationId = context.conversationId,
                    kind = if (context.kind == "room") ChatSearchResultKind.Group else ChatSearchResultKind.Dm,
                    displayName = context.name,
                    initials = initials(context.name),
                    identityChip =
                        when (context.identity?.identityKind) {
                            "business" -> ConversationIdentityChip.Business
                            "home" -> ConversationIdentityChip.Home
                            else -> null
                        },
                    verified = context.identity?.isVerified == true,
                    snippet = ChatSearchText.snippet(message.resolvedText, query),
                    matchedMessageId = message.id,
                    query = query,
                )
            }

        // MARK: - Projection

        private fun meta(dto: UnifiedConversationDto): ChatSearchResult {
            val isRoom = dto.type == "room"
            val name = displayName(dto, isRoom)
            return ChatSearchResult(
                conversationId = conversationId(dto, isRoom, name),
                kind = if (isRoom) ChatSearchResultKind.Group else ChatSearchResultKind.Dm,
                displayName = name,
                initials = initials(name),
                identityChip = identityChip(dto, isRoom),
                verified = dto.otherParticipantIdentity?.isVerified == true,
                snippet = lastPreview(dto, isRoom),
                matchedMessageId = null,
                query = _query.value.trim(),
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
