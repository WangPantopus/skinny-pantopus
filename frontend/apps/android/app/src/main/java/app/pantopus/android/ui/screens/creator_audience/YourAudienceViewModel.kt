@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.creator_audience

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.audience.AudienceListResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.audience.AudienceProfileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * A22.2 "Your audience". Fetches `/me/audience`, projects pending requests
 * + tier-grouped active members, and runs approve / decline / remove
 * against `PATCH /me/audience/:membershipId`. Same VM pattern as My Bids —
 * one `state` flow plus fine-grained signals.
 */
@HiltViewModel
class YourAudienceViewModel
    @Inject
    constructor(
        private val repository: AudienceProfileRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<YourAudienceUiState>(YourAudienceUiState.Loading)
        val state: StateFlow<YourAudienceUiState> = _state.asStateFlow()

        private val _filter = MutableStateFlow<AudienceFilter>(AudienceFilter.All)
        val filter: StateFlow<AudienceFilter> = _filter.asStateFlow()

        private val _counts = MutableStateFlow(AudienceCounts())
        val counts: StateFlow<AudienceCounts> = _counts.asStateFlow()

        private val _tierNames = MutableStateFlow<Map<Int, String>>(emptyMap())
        val tierNames: StateFlow<Map<Int, String>> = _tierNames.asStateFlow()

        private val _overflowTarget = MutableStateFlow<AudienceMember?>(null)
        val overflowTarget: StateFlow<AudienceMember?> = _overflowTarget.asStateFlow()

        /** Member awaiting the destructive block confirmation. */
        private val _blockTarget = MutableStateFlow<AudienceMember?>(null)
        val blockTarget: StateFlow<AudienceMember?> = _blockTarget.asStateFlow()

        private val _sort = MutableStateFlow(AudienceSort.Recent)
        val sort: StateFlow<AudienceSort> = _sort.asStateFlow()

        /** True while a follow-on page is in flight (drives the list footer). */
        private val _isLoadingMore = MutableStateFlow(false)
        val isLoadingMore: StateFlow<Boolean> = _isLoadingMore.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        /**
         * Destructive action currently inside its 5-second undo window. While
         * non-null the row is already gone from the list but no `PATCH` has
         * been sent yet.
         */
        private val _pendingUndo = MutableStateFlow<PendingAudienceUndo?>(null)
        val pendingUndo: StateFlow<PendingAudienceUndo?> = _pendingUndo.asStateFlow()

        /** Timer that commits a destructive action once the window closes. */
        private var undoJob: Job? = null

        /** Pre-removal snapshot restored by Undo (and by a failed commit). */
        private var undoSnapshot: UndoSnapshot? = null

        /** The action the undo window is holding. */
        private var queuedAction: Pair<AudienceMemberAction, AudienceMember>? = null

        private data class UndoSnapshot(
            val members: List<AudienceMember>,
            val counts: AudienceCounts,
            val state: YourAudienceUiState,
        )

        private var loadedAtLeastOnce = false

        /** Every row fetched so far for the current filter+sort, in server
         *  order. Pages append here; tier grouping is re-derived from it. */
        private var members: List<AudienceMember> = emptyList()

        /** Offset the next page starts at, or null when exhausted. */
        private var nextOffset: Int? = null

        /** Owning Beacon id, echoed on every page. Needed by the block
         *  action, which goes through `/personas/:id/followers/…`. */
        private var personaId: String? = null

        // MARK: - Loading

        fun load() = fetch()

        fun refresh() = fetch()

        fun selectFilter(filter: AudienceFilter) {
            if (_filter.value == filter) return
            _filter.value = filter
            fetch()
        }

        /** Header sort control — cycles recent → tenure → tier → alpha and
         *  re-fetches from offset 0 with the new `sort`. */
        fun cycleSort() {
            val next = _sort.value.next()
            _sort.value = next
            _toast.value = "Sort: ${next.label}"
            fetch()
        }

        /** True while the server says another page exists at `nextOffset`. */
        val hasMore: Boolean get() = nextOffset != null

        /**
         * Called when the list scrolls to its end. Fetches the next page when
         * the server reported one; no-ops otherwise (mirrors RN's
         * `onEndReached` → `fetchNextPage` guard).
         */
        fun loadMore() {
            val offset = nextOffset ?: return
            if (_isLoadingMore.value) return
            _isLoadingMore.value = true
            viewModelScope.launch {
                loadAudience(offset = offset, reset = false)
                _isLoadingMore.value = false
            }
        }

        private fun fetch() {
            if (!loadedAtLeastOnce) {
                _state.value = YourAudienceUiState.Loading
            }
            viewModelScope.launch { loadAudience() }
        }

        private suspend fun loadAudience(
            offset: Int = 0,
            reset: Boolean = true,
        ) {
            val result =
                repository.audienceMembers(
                    status = _filter.value.statusParam,
                    tierRank = _filter.value.tierRankParam,
                    sort = _sort.value.wire,
                    limit = PAGE_SIZE,
                    offset = offset,
                )
            when (result) {
                is NetworkResult.Success -> {
                    loadedAtLeastOnce = true
                    apply(result.data, reset)
                }
                is NetworkResult.Failure -> {
                    val message = result.error.message
                    if (loadedAtLeastOnce) {
                        _toast.value = message
                    } else {
                        _state.value = YourAudienceUiState.Error(message)
                    }
                }
            }
        }

        private fun apply(
            response: AudienceListResponse,
            reset: Boolean,
        ) {
            val counts = AudienceCounts.from(response.counts)
            _counts.value = counts
            personaId = response.persona?.id ?: personaId

            val page = response.items.mapNotNull { it.toAudienceMember() }
            val mergedNames = _tierNames.value.toMutableMap()
            page.forEach { if (it.tierName.isNotEmpty()) mergedNames[it.tierRank] = it.tierName }
            _tierNames.value = mergedNames

            members =
                if (reset) {
                    page
                } else {
                    val known = members.mapTo(mutableSetOf()) { it.membershipId }
                    members + page.filterNot { known.contains(it.membershipId) }
                }

            // An empty page means the cursor is spent even if the server still
            // advertised hasMore — never loop on an empty page.
            nextOffset = if (page.isEmpty()) null else response.pagination?.nextOffset

            // Full-empty keys off the unfiltered counts, not the current page.
            if (counts.totalActive == 0 && counts.pending == 0) {
                _state.value = YourAudienceUiState.Empty
                return
            }

            val pending = members.filter { it.isPending }
            val groups = groupMembersByTier(members.filterNot { it.isPending }, mergedNames)
            _state.value = YourAudienceUiState.Loaded(AudienceLoaded(counts, pending, groups))
        }

        // MARK: - Overflow / toast

        fun openOverflow(member: AudienceMember) {
            _overflowTarget.value = member
        }

        fun dismissOverflow() {
            _overflowTarget.value = null
        }

        fun consumeToast() {
            _toast.value = null
        }

        // MARK: - Actions

        fun approve(member: AudienceMember) = performAction(AudienceMemberAction.Approve, member)

        fun decline(member: AudienceMember) = beginDestructive(AudienceMemberAction.Decline, member)

        fun remove(member: AudienceMember) {
            _overflowTarget.value = null
            beginDestructive(AudienceMemberAction.Remove, member)
        }

        // MARK: - Destructive actions (optimistic + undo window)

        /**
         * RN's destructive path: drop the row immediately, raise a 5-second
         * "Tap to undo" toast, and only fire the `PATCH` once the window
         * closes (`src/app/audience/members.tsx:95-121`). A second destructive
         * tap commits the first one rather than dropping it on the floor.
         */
        private fun beginDestructive(
            action: AudienceMemberAction,
            member: AudienceMember,
        ) {
            viewModelScope.launch {
                flushPendingUndo()

                undoSnapshot = UndoSnapshot(members, _counts.value, _state.value)
                queuedAction = action to member
                removeRowOptimistically(member)
                _pendingUndo.value =
                    PendingAudienceUndo(
                        membershipId = member.membershipId,
                        message = "${destructiveVerb(action)} ${member.handle} · Tap to undo",
                    )

                undoJob =
                    viewModelScope.launch {
                        delay(UNDO_WINDOW_MS)
                        commitQueuedAction()
                    }
            }
        }

        /** Undo tap — restores the row and never sends the request. */
        fun undoPendingAction() {
            if (_pendingUndo.value == null) return
            undoJob?.cancel()
            undoJob = null
            queuedAction = null
            _pendingUndo.value = null
            restoreSnapshot()
        }

        /** Commit whatever the undo window is holding, right now. */
        private suspend fun flushPendingUndo() {
            if (queuedAction == null) return
            undoJob?.cancel()
            undoJob = null
            commitQueuedAction()
        }

        private suspend fun commitQueuedAction() {
            val queued = queuedAction ?: return
            queuedAction = null
            _pendingUndo.value = null
            undoJob = null
            when (repository.audienceMemberAction(queued.second.membershipId, queued.first.wire)) {
                is NetworkResult.Success -> {
                    undoSnapshot = null
                    // Re-fetch for authoritative counts + grouping.
                    loadAudience()
                }
                is NetworkResult.Failure -> {
                    // RN restores the row and shows a fixed retry message.
                    restoreSnapshot()
                    _toast.value = "Could not complete action. Try again."
                }
            }
        }

        /**
         * Drop the row from the local page and decrement the matching count
         * so the chips and the nav count line stay honest during the window.
         */
        private fun removeRowOptimistically(member: AudienceMember) {
            members = members.filterNot { it.membershipId == member.membershipId }
            val previous = _counts.value
            val next =
                if (member.isPending) {
                    previous.copy(pending = (previous.pending - 1).coerceAtLeast(0))
                } else {
                    val byTier = previous.byTier.toMutableMap()
                    byTier[member.tierRank] =
                        ((byTier[member.tierRank] ?: 1) - 1).coerceAtLeast(0)
                    previous.copy(
                        totalActive = (previous.totalActive - 1).coerceAtLeast(0),
                        byTier = byTier,
                    )
                }
            _counts.value = next
            if (next.totalActive == 0 && next.pending == 0) {
                _state.value = YourAudienceUiState.Empty
                return
            }
            _state.value =
                YourAudienceUiState.Loaded(
                    AudienceLoaded(
                        counts = next,
                        pending = members.filter { it.isPending },
                        tierGroups =
                            groupMembersByTier(
                                members.filterNot { it.isPending },
                                _tierNames.value,
                            ),
                    ),
                )
        }

        private fun restoreSnapshot() {
            val snapshot = undoSnapshot ?: return
            members = snapshot.members
            _counts.value = snapshot.counts
            _state.value = snapshot.state
            undoSnapshot = null
        }

        private fun destructiveVerb(action: AudienceMemberAction): String =
            if (action == AudienceMemberAction.Decline) "Declined" else "Removed"

        /** Overflow → Mute. Reversible: the member stays subscribed but stops
         *  receiving broadcasts (RN
         *  `src/components/audience/AudienceMemberSheet.tsx:89-98`). */
        fun mute(member: AudienceMember) {
            _overflowTarget.value = null
            performAction(AudienceMemberAction.Mute, member)
        }

        /** Overflow → Unmute. Restores broadcast delivery. */
        fun unmute(member: AudienceMember) {
            _overflowTarget.value = null
            performAction(AudienceMemberAction.Unmute, member)
        }

        /** Overflow → Block. Opens the destructive confirm; the PATCH only
         *  fires from [confirmBlock]. */
        fun requestBlock(member: AudienceMember) {
            _overflowTarget.value = null
            _blockTarget.value = member
        }

        fun dismissBlock() {
            _blockTarget.value = null
        }

        /** Commits the block via
         *  `PATCH /personas/:id/followers/:membershipId { status: "blocked" }`
         *  — the `/me/audience` action verbs have no block. */
        fun confirmBlock(member: AudienceMember) {
            _blockTarget.value = null
            val owner = personaId
            if (owner == null) {
                _toast.value = "Couldn't block ${member.displayName} — reload and try again."
                return
            }
            viewModelScope.launch {
                val result = repository.updateFollowerStatus(owner, member.membershipId, "blocked")
                when (result) {
                    is NetworkResult.Success -> {
                        _toast.value = "Blocked ${member.displayName}."
                        loadAudience()
                    }
                    is NetworkResult.Failure -> {
                        _toast.value = result.error.message
                    }
                }
            }
        }

        /** Confirm-dialog body. Mirrors RN's copy
         *  (`src/app/identity/persona.tsx:600-604`). */
        fun blockConfirmationMessage(member: AudienceMember): String =
            "Block ${member.displayName} from this Beacon? " +
                "They will lose access to follower-only updates."

        /** Overflow → Message. The creator serializer exposes no user id, so
         *  a direct thread can't be opened from here yet. */
        fun message(member: AudienceMember) {
            _overflowTarget.value = null
            _toast.value = "Messaging ${member.displayName} is coming soon."
        }

        /** Overflow → Change tier. Tier moves aren't wired on mobile yet. */
        fun changeTier(member: AudienceMember) {
            _overflowTarget.value = null
            _toast.value = "Changing tiers for ${member.displayName} is coming soon."
        }

        /** Empty-state CTA — sharing the Beacon link isn't wired yet. */
        fun shareBeacon() {
            _toast.value = "Sharing your Beacon is coming soon."
        }

        private fun performAction(
            action: AudienceMemberAction,
            member: AudienceMember,
        ) {
            viewModelScope.launch {
                when (val result = repository.audienceMemberAction(member.membershipId, action.wire)) {
                    is NetworkResult.Success -> {
                        _toast.value = confirmation(action, member)
                        // Re-fetch for authoritative counts + grouping.
                        loadAudience()
                    }
                    is NetworkResult.Failure -> {
                        _toast.value = result.error.message
                    }
                }
            }
        }

        private fun confirmation(
            action: AudienceMemberAction,
            member: AudienceMember,
        ): String =
            when (action) {
                AudienceMemberAction.Approve -> "Approved ${member.displayName}."
                AudienceMemberAction.Decline -> "Declined ${member.displayName}."
                AudienceMemberAction.Remove -> "Removed ${member.displayName}."
                AudienceMemberAction.Mute -> "Muted ${member.displayName}."
                AudienceMemberAction.Unmute -> "Unmuted ${member.displayName}."
            }

        companion object {
            /** Page size. Matches RN's `PAGE_SIZE`
             *  (`src/hooks/usePersonaAudienceList.ts:11`). */
            const val PAGE_SIZE = 50

            /** Undo window before the destructive `PATCH` fires. RN shows a
             *  5000ms toast and commits at 5100ms
             *  (`src/app/audience/members.tsx:104-119`). */
            const val UNDO_WINDOW_MS = 5_100L
        }
    }
