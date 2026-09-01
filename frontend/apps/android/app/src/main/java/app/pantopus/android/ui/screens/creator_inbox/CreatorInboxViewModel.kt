@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.creator_inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.audience.PersonaThreadDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.audience.AudienceProfileRepository
import app.pantopus.android.data.personadm.PersonaDmRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import javax.inject.Inject

/**
 * Backs the P1.2 Creator Inbox screen. Loads the owner persona +
 * followers DM threads from the same endpoints the Audience Profile
 * Threads tab uses (`/api/personas/me` + `/api/personas/:id/dms/threads`)
 * and projects them into filter-aware row models. Filter chip counts
 * derive from the loaded thread list so they always match what the
 * user sees.
 *
 * Row taps route into `PersonaDmThreadScreen` by (personaId, threadId).
 * They do NOT push generic chat: the persona-DM serializer carries no
 * `user_id` for either side, so there is no counterparty user id to route on
 * (`backend/routes/personaDms.js:56`).
 */
@HiltViewModel
class CreatorInboxViewModel
    @Inject
    constructor(
        private val repository: AudienceProfileRepository,
        private val dmRepository: PersonaDmRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<CreatorInboxUiState>(CreatorInboxUiState.Loading)
        val state: StateFlow<CreatorInboxUiState> = _state.asStateFlow()

        private val _activeFilter = MutableStateFlow(CreatorInboxFilter.All)
        val activeFilter: StateFlow<CreatorInboxFilter> = _activeFilter.asStateFlow()

        private var threads: List<PersonaThreadDto> = emptyList()

        /**
         * Persona whose inbox this is — the `:id` path segment every
         * `/api/personas/:id/dms/…` call from a row needs.
         */
        private var personaId: String = ""
        private var header: CreatorInboxHeader =
            CreatorInboxHeader(title = "Creator inbox", handle = null, isCrossPersona = false)

        fun load() {
            _state.value = CreatorInboxUiState.Loading
            viewModelScope.launch {
                runCatching { fetchAndProject() }
                    .onFailure {
                        _state.value = CreatorInboxUiState.Error("Couldn't load your inbox.")
                    }
            }
        }

        fun refresh() = load()

        fun selectFilter(filter: CreatorInboxFilter) {
            _activeFilter.value = filter
            rebuild()
        }

        /**
         * Resolve a row into the persona-DM thread push.
         *
         * The row id IS the `PersonaDmThread` id — persona DMs carry no
         * counterparty user id, so there is nothing to fall back to and
         * nothing that could masquerade as one.
         */
        fun threadDestination(row: CreatorInboxRowContent): ThreadDestination =
            ThreadDestination(
                personaId = row.personaId.ifEmpty { personaId },
                threadId = row.id,
                displayName = row.displayName.ifEmpty { row.handle },
                initials = row.initials,
                verified = row.verifiedLocal,
            )

        private suspend fun fetchAndProject() {
            val me =
                when (val r = repository.me()) {
                    is NetworkResult.Success -> r.data
                    is NetworkResult.Failure -> {
                        _state.value = CreatorInboxUiState.Error("Couldn't load your inbox.")
                        return
                    }
                }
            val persona = me.persona
            val handle = persona?.handle
            if (persona == null || handle == null) {
                val emptyHeader =
                    CreatorInboxHeader(title = "Creator inbox", handle = null, isCrossPersona = false)
                header = emptyHeader
                _state.value = CreatorInboxUiState.Empty(emptyHeader)
                return
            }
            header =
                CreatorInboxHeader(
                    title = "Creator inbox",
                    handle = "@$handle",
                    isCrossPersona = false,
                )
            personaId = persona.id
            val resp =
                when (val r = dmRepository.threads(persona.id)) {
                    is NetworkResult.Success -> r.data
                    is NetworkResult.Failure -> {
                        _state.value = CreatorInboxUiState.Error("Couldn't load your inbox.")
                        return
                    }
                }
            threads = resp.threads
            rebuild()
        }

        private fun rebuild() {
            if (threads.isEmpty()) {
                _state.value = CreatorInboxUiState.Empty(header)
                return
            }
            val rows = threads.map { row(it, personaId) }
            val counts =
                CreatorInboxCounts(
                    total = rows.size,
                    unread = rows.count { it.unread },
                    flagged = rows.count { it.flagged },
                )
            val chips = chips(rows = rows, counts = counts)
            val filter = _activeFilter.value
            val filtered = rows.filter { matches(it, filter) }
            _state.value =
                CreatorInboxUiState.Loaded(
                    CreatorInboxLoaded(
                        header = header,
                        rows = filtered,
                        counts = counts,
                        chips = chips,
                    ),
                )
        }

        companion object {
            internal fun chips(
                rows: List<CreatorInboxRowContent>,
                counts: CreatorInboxCounts,
            ): List<CreatorInboxChipContent> {
                val bronzePlus = rows.count { it.tierRank >= 2 }
                return listOf(
                    CreatorInboxChipContent(
                        id = CreatorInboxFilter.All.key,
                        filter = CreatorInboxFilter.All,
                        label = CreatorInboxFilter.All.title,
                        count = counts.total,
                    ),
                    CreatorInboxChipContent(
                        id = CreatorInboxFilter.Unread.key,
                        filter = CreatorInboxFilter.Unread,
                        label = CreatorInboxFilter.Unread.title,
                        count = counts.unread,
                    ),
                    CreatorInboxChipContent(
                        id = CreatorInboxFilter.BronzePlus.key,
                        filter = CreatorInboxFilter.BronzePlus,
                        label = CreatorInboxFilter.BronzePlus.title,
                        count = bronzePlus,
                    ),
                    CreatorInboxChipContent(
                        id = CreatorInboxFilter.Flagged.key,
                        filter = CreatorInboxFilter.Flagged,
                        label = CreatorInboxFilter.Flagged.title,
                        count = counts.flagged,
                    ),
                )
            }

            internal fun matches(
                row: CreatorInboxRowContent,
                filter: CreatorInboxFilter,
            ): Boolean =
                when (filter) {
                    CreatorInboxFilter.All -> true
                    CreatorInboxFilter.Unread -> row.unread
                    CreatorInboxFilter.BronzePlus -> row.tierRank >= 2
                    CreatorInboxFilter.Flagged -> row.flagged
                }

            internal fun row(
                dto: PersonaThreadDto,
                personaId: String,
            ): CreatorInboxRowContent {
                val handle = dto.fanHandle.orEmpty()
                val displayName = dto.fanDisplayName ?: handle.ifEmpty { "Follower" }
                return CreatorInboxRowContent(
                    id = dto.id,
                    displayName = displayName,
                    handle = if (handle.isEmpty()) "" else "@$handle",
                    initials = initials(displayName, handle),
                    avatarUrl = dto.fanAvatarUrl,
                    tierName = dto.tier?.name,
                    tierRank = dto.tier?.rank ?: 1,
                    preview = dto.lastMessagePreview.orEmpty(),
                    timeAgo = timeAgo(dto.lastMessageAt),
                    unread = (dto.unreadCount ?: 0) > 0,
                    flagged = dto.flagged ?: false,
                    verifiedLocal = dto.verifiedLocal ?: false,
                    counterpartyUserId = dto.counterpartyUserId,
                    personaChip = null,
                    personaId = personaId,
                    membershipId = dto.membershipId,
                )
            }

            internal fun initials(
                name: String,
                handle: String,
            ): String {
                val source = name.ifEmpty { handle }
                val parts = source.split(" ").filter { it.isNotEmpty() }.take(2)
                val letters = parts.mapNotNull { it.firstOrNull()?.toString() }.joinToString("").uppercase()
                if (letters.isNotEmpty()) return letters
                return source.take(2).uppercase()
            }

            internal fun timeAgo(iso: String?): String {
                val instant =
                    iso
                        ?.takeUnless(String::isBlank)
                        ?.let { runCatching { Instant.parse(it) }.getOrNull() }
                return instant?.let(::relativeTimeAgo).orEmpty()
            }

            private fun relativeTimeAgo(instant: Instant): String {
                val secs = Duration.between(instant, Instant.now()).seconds.coerceAtLeast(0)
                val mins = secs / 60
                val hrs = mins / 60
                val days = hrs / 24
                return when {
                    mins < 1 -> "Just now"
                    mins < 60 -> "${mins}m"
                    hrs < 24 -> "${hrs}h"
                    days == 1L -> "Yesterday"
                    days < 7 -> "${days}d"
                    else -> "${days / 7}w"
                }
            }
        }

        /** Routing payload handed back to the host so it can build the
         *  persona-DM thread route without re-introspecting the row.
         *  Mirrors iOS `CreatorInboxThreadDestination`. */
        data class ThreadDestination(
            val personaId: String,
            val threadId: String,
            val displayName: String,
            val initials: String,
            val verified: Boolean,
        )
    }
