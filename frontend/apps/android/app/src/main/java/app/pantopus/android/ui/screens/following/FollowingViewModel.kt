@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.following

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.following.FollowingRowDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.following.FollowingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import javax.inject.Inject

/** Transient confirmation / error banner payload. */
data class FollowingToast(
    val text: String,
    val isError: Boolean = false,
)

/** 409 — `paid_membership_managed_by_subscription`. */
private const val HTTP_CONFLICT = 409

/**
 * §1A① — "Following" (Beacons you follow). Mirrors the My bids
 * ViewModel + repository shape: a cached row list, a `state` the screen
 * renders from, optimistic row mutations that roll back on failure, and a
 * transient toast. Row actions key off `persona.id` per the backend routes.
 */
@HiltViewModel
class FollowingViewModel
    @Inject
    constructor(
        private val repository: FollowingRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<FollowingUiState>(FollowingUiState.Loading)
        val state: StateFlow<FollowingUiState> = _state.asStateFlow()

        private val _selectedSort = MutableStateFlow(FollowingSort.Activity)
        val selectedSort: StateFlow<FollowingSort> = _selectedSort.asStateFlow()

        private val _actionTarget = MutableStateFlow<FollowingActionTarget?>(null)
        val actionTarget: StateFlow<FollowingActionTarget?> = _actionTarget.asStateFlow()

        private val _toast = MutableStateFlow<FollowingToast?>(null)
        val toast: StateFlow<FollowingToast?> = _toast.asStateFlow()

        /** True while the long-press multi-select mode is active. */
        private val _isSelecting = MutableStateFlow(false)
        val isSelecting: StateFlow<Boolean> = _isSelecting.asStateFlow()

        /** Membership ids currently ticked in multi-select mode. */
        private val _selectedRowIds = MutableStateFlow<Set<String>>(emptySet())
        val selectedRowIds: StateFlow<Set<String>> = _selectedRowIds.asStateFlow()

        /** Non-null while the bulk-unfollow confirm dialog is up. */
        private val _pendingBulkUnfollow = MutableStateFlow<FollowingBulkUnfollowRequest?>(null)
        val pendingBulkUnfollow: StateFlow<FollowingBulkUnfollowRequest?> = _pendingBulkUnfollow.asStateFlow()

        private var nowProvider: () -> Instant = { Instant.now() }
        private var items: List<FollowingRowDto> = emptyList()
        private var loadedAtLeastOnce = false

        fun load() {
            if (loadedAtLeastOnce && _state.value is FollowingUiState.Loaded) return
            fetch()
        }

        fun refresh() = fetch()

        fun selectSort(sort: FollowingSort) {
            if (sort == _selectedSort.value) return
            _selectedSort.value = sort
            _state.value = FollowingUiState.Loading
            fetch()
        }

        private fun fetch() {
            if (!loadedAtLeastOnce) _state.value = FollowingUiState.Loading
            viewModelScope.launch {
                when (val result = repository.list(_selectedSort.value.wire)) {
                    is NetworkResult.Success -> {
                        items = result.data.items
                        loadedAtLeastOnce = true
                        rebuild()
                    }
                    is NetworkResult.Failure -> {
                        if (!loadedAtLeastOnce) {
                            _state.value = FollowingUiState.Error(result.error.displayMessage("Couldn't load followers."))
                        } else {
                            _toast.value = FollowingToast("Couldn't refresh.", isError = true)
                        }
                    }
                }
            }
        }

        private fun rebuild() {
            if (items.isEmpty()) {
                _state.value = FollowingUiState.Empty
                return
            }
            val sections = FollowingProjection.sections(items, nowProvider())
            val unread = items.count { it.mutedUntil == null && (it.unreadCount ?: 0) > 0 }
            _state.value =
                FollowingUiState.Loaded(
                    sections = sections,
                    totalFollowing = items.size,
                    unreadBeacons = unread,
                )
        }

        // region Row action sheet

        fun openActions(row: FollowingRow) {
            _actionTarget.value = row.toActionTarget()
        }

        fun closeActions() {
            _actionTarget.value = null
        }

        fun markSeen(target: FollowingActionTarget) {
            _actionTarget.value = null
            val previous = items
            val seenAt = nowProvider().toString()
            items =
                items.map {
                    if (it.membershipId == target.id) it.copy(unreadCount = 0, lastSeenAt = seenAt) else it
                }
            rebuild()
            viewModelScope.launch {
                if (repository.markSeen(target.personaId) is NetworkResult.Failure) {
                    items = previous
                    rebuild()
                    _toast.value = FollowingToast("Couldn't mark seen.", isError = true)
                }
            }
        }

        fun mute(
            target: FollowingActionTarget,
            days: Int,
        ) {
            _actionTarget.value = null
            val previous = items
            val until = nowProvider().plus(Duration.ofDays(days.toLong())).toString()
            items = items.map { if (it.membershipId == target.id) it.copy(mutedUntil = until) else it }
            rebuild()
            viewModelScope.launch {
                when (val result = repository.mute(target.personaId, days)) {
                    is NetworkResult.Success -> {
                        result.data.mutedUntil?.let { server ->
                            items = items.map { if (it.membershipId == target.id) it.copy(mutedUntil = server) else it }
                            rebuild()
                        }
                        _toast.value = FollowingToast("Muted ${target.displayName}.")
                    }
                    is NetworkResult.Failure -> {
                        items = previous
                        rebuild()
                        _toast.value = FollowingToast("Couldn't update mute.", isError = true)
                    }
                }
            }
        }

        fun unfollow(target: FollowingActionTarget) {
            _actionTarget.value = null
            val previous = items
            items = items.filterNot { it.membershipId == target.id }
            rebuild()
            viewModelScope.launch {
                when (val result = repository.unfollow(target.personaId)) {
                    is NetworkResult.Success ->
                        _toast.value = FollowingToast("Unfollowed ${target.displayName}.")
                    is NetworkResult.Failure -> {
                        items = previous
                        rebuild()
                        _toast.value = FollowingToast(result.error.message, isError = true)
                    }
                }
            }
        }

        fun dismissToast() {
            _toast.value = null
        }

        // endregion

        // region Notification level (inline bell)

        /**
         * Cycle the row's bell All → Highlights → Off → All. Optimistic; rolls
         * back and toasts on failure, mirroring RN's `handleBellCycle`
         * (`pantopus/frontend/apps/mobile/src/app/beacons/following.tsx:121`).
         */
        fun cycleNotificationLevel(row: FollowingRow) {
            if (row.isPaused) return
            applyNotificationLevel(row.id, row.personaId, row.notificationLevel.next)
        }

        /** Set an explicit level from the action sheet's segmented control. */
        fun setNotificationLevel(
            target: FollowingActionTarget,
            level: FollowingNotificationLevel,
        ) {
            _actionTarget.value = target.copy(notificationLevel = level)
            applyNotificationLevel(target.id, target.personaId, level)
        }

        private fun applyNotificationLevel(
            membershipId: String,
            personaId: String,
            level: FollowingNotificationLevel,
        ) {
            val previous = items.firstOrNull { it.membershipId == membershipId }?.notificationLevel
            items = items.map { if (it.membershipId == membershipId) it.copy(notificationLevel = level.wire) else it }
            rebuild()
            viewModelScope.launch {
                when (val result = repository.updateNotificationLevel(personaId, level.wire)) {
                    is NetworkResult.Success -> {
                        result.data.notificationLevel?.let { server ->
                            items =
                                items.map {
                                    if (it.membershipId == membershipId) it.copy(notificationLevel = server) else it
                                }
                            rebuild()
                        }
                        _toast.value = FollowingToast("Notifications: ${level.toastLabel}")
                    }
                    is NetworkResult.Failure -> {
                        items =
                            items.map {
                                if (it.membershipId == membershipId) it.copy(notificationLevel = previous) else it
                            }
                        rebuild()
                        _actionTarget.value =
                            _actionTarget.value?.copy(
                                notificationLevel = FollowingNotificationLevel.from(previous),
                            )
                        _toast.value = FollowingToast("Couldn't change notifications.", isError = true)
                    }
                }
            }
        }

        // endregion

        // region Multi-select + bulk unfollow

        /** Long-press a row: enter select mode with that row ticked. */
        fun beginSelection(row: FollowingRow) {
            _isSelecting.value = true
            _selectedRowIds.value = setOf(row.id)
        }

        /** Tap a row while selecting: toggle its tick. */
        fun toggleSelection(row: FollowingRow) {
            val current = _selectedRowIds.value
            _selectedRowIds.value = if (row.id in current) current - row.id else current + row.id
        }

        /** Cancel — leaves the rows untouched. */
        fun exitSelection() {
            _isSelecting.value = false
            _selectedRowIds.value = emptySet()
        }

        /**
         * Build the confirm-dialog payload for the current selection. Paid
         * memberships are counted separately and skipped, matching RN.
         */
        fun requestBulkUnfollow() {
            val selected = items.filter { it.membershipId in _selectedRowIds.value }
            if (selected.isEmpty()) return
            val unfollowable = selected.filter { (it.paidTier?.rank ?: 0) <= 1 }
            if (unfollowable.isEmpty()) {
                _toast.value = FollowingToast("Paid memberships are managed in Audience.", isError = true)
                return
            }
            _pendingBulkUnfollow.value =
                FollowingBulkUnfollowRequest(
                    membershipIds = unfollowable.map { it.membershipId },
                    personaIds = unfollowable.map { it.persona.id },
                    skippedPaidCount = selected.size - unfollowable.size,
                )
        }

        fun cancelBulkUnfollow() {
            _pendingBulkUnfollow.value = null
        }

        /**
         * Fan out `DELETE /api/personas/:id/follow` over the selection. There is
         * no bulk route server-side — RN's `unfollowMany`
         * (`pantopus/frontend/packages/api/src/endpoints/personas.ts:286`) fans
         * out the same way and buckets results into succeeded / skippedPaid /
         * failed.
         */
        fun confirmBulkUnfollow(request: FollowingBulkUnfollowRequest) {
            _pendingBulkUnfollow.value = null
            val previous = items
            val removing = request.membershipIds.toSet()
            items = items.filterNot { it.membershipId in removing }
            exitSelection()
            rebuild()
            viewModelScope.launch {
                var succeeded = 0
                var skippedPaid = 0
                val failed = mutableListOf<String>()
                request.personaIds.forEachIndexed { index, personaId ->
                    when (val result = repository.unfollow(personaId)) {
                        is NetworkResult.Success -> succeeded += 1
                        is NetworkResult.Failure ->
                            if (isPaidMembershipConflict(result)) {
                                skippedPaid += 1
                            } else {
                                failed += request.membershipIds[index]
                            }
                    }
                }
                if (failed.isNotEmpty()) {
                    val restore = failed.toSet()
                    items = items + previous.filter { it.membershipId in restore }
                    rebuild()
                }
                _toast.value =
                    when {
                        failed.isNotEmpty() ->
                            FollowingToast("${failed.size} couldn't be unfollowed.", isError = true)
                        skippedPaid > 0 ->
                            FollowingToast(
                                "$skippedPaid paid membership${if (skippedPaid == 1) "" else "s"} skipped.",
                            )
                        succeeded > 0 ->
                            FollowingToast(
                                "Unfollowed $succeeded Beacon${if (succeeded == 1) "" else "s"}.",
                            )
                        else -> null
                    }
                // Re-sync from the server to settle any partial state.
                fetch()
            }
        }

        /**
         * The backend answers a paid membership with 409 + code
         * `paid_membership_managed_by_subscription`
         * (`backend/routes/personas.js:1190`).
         */
        private fun isPaidMembershipConflict(result: NetworkResult.Failure): Boolean {
            val error = result.error
            if (error.code == HTTP_CONFLICT) return true
            return error.message.contains("paid membership", ignoreCase = true)
        }

        // endregion

        /** Test seam — pin the clock so projection/mute math is deterministic. */
        internal fun overrideNow(provider: () -> Instant) {
            nowProvider = provider
        }
    }
