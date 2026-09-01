@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.businesses.inbox

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businessinbox.BusinessInboxRoomDto
import app.pantopus.android.data.api.models.businessinbox.BusinessMatchedPostDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businessinbox.BusinessInboxRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import javax.inject.Inject

/** Nav-arg key for the owned business UUID (shared with the owner dashboard). */
const val BUSINESS_INBOX_BUSINESS_ID_KEY = "businessId"

/**
 * Drives the business-side inbox. Mirrors RN's `InboxTab` load flow: the
 * active section fetches on selection, each section keeps its own state,
 * and the unread badge comes from the chat route's `totalUnread`.
 *
 * Mirrors iOS `BusinessInboxViewModel.swift`.
 */
@HiltViewModel
class BusinessInboxViewModel
    @Inject
    constructor(
        private val repository: BusinessInboxRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val businessId: String =
            requireNotNull(savedStateHandle[BUSINESS_INBOX_BUSINESS_ID_KEY]) {
                "BusinessInboxViewModel requires a '$BUSINESS_INBOX_BUSINESS_ID_KEY' nav arg."
            }

        private val _section = MutableStateFlow(BusinessInboxSection.Messages)
        val section: StateFlow<BusinessInboxSection> = _section.asStateFlow()

        private val _state = MutableStateFlow<BusinessInboxUiState>(BusinessInboxUiState.Loading)
        val state: StateFlow<BusinessInboxUiState> = _state.asStateFlow()

        /** `totalUnread` from the chat route — renders in the header title. */
        private val _totalUnread = MutableStateFlow(0)
        val totalUnread: StateFlow<Int> = _totalUnread.asStateFlow()

        /** Per-section cache so flipping back doesn't re-blank the list. */
        private var messagesState: BusinessInboxUiState? = null
        private var mentionsState: BusinessInboxUiState? = null

        fun load() {
            viewModelScope.launch { fetch(_section.value) }
        }

        fun refresh() {
            cache(null, _section.value)
            viewModelScope.launch { fetch(_section.value) }
        }

        fun selectSection(next: BusinessInboxSection) {
            if (_section.value == next) return
            _section.value = next
            val cached = cached(next)
            if (cached != null) {
                _state.value = cached
                return
            }
            viewModelScope.launch { fetch(next) }
        }

        private suspend fun fetch(target: BusinessInboxSection) {
            _state.value = BusinessInboxUiState.Loading
            when (target) {
                BusinessInboxSection.Messages -> fetchRooms()
                BusinessInboxSection.Mentions -> fetchMentions()
            }
        }

        private suspend fun fetchRooms() {
            when (val result = repository.rooms(businessId)) {
                is NetworkResult.Success -> {
                    _totalUnread.value = result.data.totalUnread ?: 0
                    val rooms = result.data.rooms.map { projectRoom(it) }
                    apply(
                        if (rooms.isEmpty()) {
                            BusinessInboxUiState.Empty
                        } else {
                            BusinessInboxUiState.LoadedRooms(rooms)
                        },
                        BusinessInboxSection.Messages,
                    )
                }
                is NetworkResult.Failure ->
                    apply(
                        BusinessInboxUiState.Error(message(result.error, "Couldn't load messages.")),
                        BusinessInboxSection.Messages,
                    )
            }
        }

        private suspend fun fetchMentions() {
            when (val result = repository.matchedPosts(businessId)) {
                is NetworkResult.Success -> {
                    val mentions = result.data.posts.map { projectMention(it) }
                    apply(
                        if (mentions.isEmpty()) {
                            BusinessInboxUiState.Empty
                        } else {
                            BusinessInboxUiState.LoadedMentions(mentions)
                        },
                        BusinessInboxSection.Mentions,
                    )
                }
                is NetworkResult.Failure ->
                    apply(
                        BusinessInboxUiState.Error(message(result.error, "Couldn't load mentions.")),
                        BusinessInboxSection.Mentions,
                    )
            }
        }

        private fun apply(
            next: BusinessInboxUiState,
            target: BusinessInboxSection,
        ) {
            cache(next, target)
            if (_section.value == target) _state.value = next
        }

        private fun cached(target: BusinessInboxSection): BusinessInboxUiState? =
            when (target) {
                BusinessInboxSection.Messages -> messagesState
                BusinessInboxSection.Mentions -> mentionsState
            }

        private fun cache(
            value: BusinessInboxUiState?,
            target: BusinessInboxSection,
        ) {
            when (target) {
                BusinessInboxSection.Messages -> messagesState = value
                BusinessInboxSection.Mentions -> mentionsState = value
            }
        }

        private fun message(
            error: NetworkError,
            fallback: String,
        ): String =
            when (error) {
                NetworkError.Forbidden -> "You don't have access to this business inbox."
                else -> error.message.ifBlank { fallback }
            }

        companion object {
            /** Pure projection of a room row (exposed for unit tests). */
            fun projectRoom(dto: BusinessInboxRoomDto): BusinessInboxRoom {
                val handle = dto.otherParticipantUsername.orEmpty().trim()
                val name =
                    dto.otherParticipantName?.takeIf { it.isNotEmpty() }
                        ?: dto.roomName?.takeIf { it.isNotEmpty() }
                        ?: if (handle.isEmpty()) "Conversation" else "@$handle"
                return BusinessInboxRoom(
                    id = dto.id,
                    title = name,
                    handle = handle,
                    preview = dto.lastMessagePreview.orEmpty(),
                    timeAgo = relativeTime(dto.lastMessageAt),
                    unreadCount = (dto.unreadCount ?: 0).coerceAtLeast(0),
                )
            }

            /** Pure projection of a matched-post row (exposed for unit tests). */
            fun projectMention(dto: BusinessMatchedPostDto): BusinessInboxMention {
                val likes = dto.likeCount ?: 0
                val comments = dto.commentCount ?: 0
                val parts = mutableListOf<String>()
                if (likes > 0) parts += "$likes like${if (likes == 1) "" else "s"}"
                if (comments > 0) parts += "$comments comment${if (comments == 1) "" else "s"}"
                return BusinessInboxMention(
                    id = dto.id,
                    authorName =
                        dto.creator?.name?.takeIf { it.isNotEmpty() }
                            ?: dto.creator?.username?.takeIf { it.isNotEmpty() }
                            ?: "Someone",
                    avatarUrl = dto.creator?.profilePictureUrl,
                    body = dto.title?.takeIf { it.isNotEmpty() } ?: dto.content.orEmpty(),
                    timeAgo = relativeTime(dto.createdAt),
                    engagement = parts.joinToString(" · "),
                )
            }

            /** "2h ago" / "3d ago"; empty when missing or unparseable. */
            fun relativeTime(iso: String?): String {
                if (iso.isNullOrEmpty()) return ""
                val instant =
                    try {
                        Instant.parse(iso)
                    } catch (_: Throwable) {
                        return ""
                    }
                val seconds = Duration.between(instant, Instant.now()).seconds
                return when {
                    seconds < 60 -> "just now"
                    seconds < 3_600 -> "${seconds / 60}m ago"
                    seconds < 86_400 -> "${seconds / 3_600}h ago"
                    seconds < 604_800 -> "${seconds / 86_400}d ago"
                    else -> "${seconds / 604_800}w ago"
                }
            }
        }
    }
