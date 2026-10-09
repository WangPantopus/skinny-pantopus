@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.owners

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.identity.MadeUpUsername
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.OwnerDto
import app.pantopus.android.data.api.models.homes.OwnersResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomeOwnersRepository
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.screens.homes.HomeCopyGateFactory
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBackground
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBadgeSize
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav arg key for the home id consumed via [SavedStateHandle]. */
const val OWNERS_LIST_HOME_ID_KEY = "homeId"

private const val SUBJECT_ID_DISPLAY_SUFFIX_LENGTH = 4

/**
 * Surfaced to the screen so it can present sheets / confirms in response
 * to row interactions without the VM holding view state.
 */
sealed interface OwnersListEvent {
    data object OpenInvite : OwnersListEvent

    data class ConfirmRemove(
        val ownerId: String,
        val displayName: String,
    ) : OwnersListEvent

    /**
     * H6 — open the per-home owner claim-review surface
     * (`HomeClaimReviewScreen`). Fired by the top-bar gavel.
     */
    data object OpenClaimReview : OwnersListEvent
}

/**
 * P15 / T6.3g — Drives the Owners list. Reads
 * `GET /api/homes/:id/owners` and projects each [OwnerDto] onto a
 * [RowModel] using the avatar-first shape: 40dp `AvatarWithBadge`
 * leading + name + role subtitle + verbose proof body + optional "You"
 * chip + kebab trailing. FAB opens the existing Invite Owner form.
 *
 * Mirrors iOS [OwnersListViewModel] field-for-field.
 */
@HiltViewModel
class OwnersListViewModel
    @Inject
    constructor(
        private val repo: HomeOwnersRepository,
        private val adminRepo: HomeAdminRepository,
        authRepository: AuthRepository,
        gates: HomeCopyGateFactory,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val homeId: String = savedStateHandle[OWNERS_LIST_HOME_ID_KEY] ?: ""

        /** Founder decision 3: who may see this screen from the store's copy, and what leaves with the screen. */
        private val gate = gates.create(homeId, listOf(HomeStoreKeys.owners(homeId), HomeStoreKeys.me(homeId)))
        private var readGeneration = 0L

        /** Pull to refresh is reading while the rows stay (Instant Screens): the pull indicator only. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        /** The quiet "Couldn't refresh. Showing 3:42 PM." line when a read fails on a copy past its max shown age. */
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        /** Drives the "You" chip on the viewer's own row. Resolved
         *  eagerly from [AuthRepository] state at construction. */
        val currentUserId: String? =
            (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _pendingEvent = MutableStateFlow<OwnersListEvent?>(null)
        val pendingEvent: StateFlow<OwnersListEvent?> = _pendingEvent.asStateFlow()

        private val _removalError = MutableStateFlow<String?>(null)
        val removalError: StateFlow<String?> = _removalError.asStateFlow()

        private val _access = MutableStateFlow<HomeAccessDto?>(null)
        val access: StateFlow<HomeAccessDto?> = _access.asStateFlow()

        private val canManageOwnership: Boolean
            get() = _access.value?.can("ownership.manage") == true

        /** Cached roster — preserves backend ordering and drives
         *  optimistic-remove rollback. */
        private var owners: List<OwnerDto> = emptyList()

        /**
         * Screen entry and every return (Instant Screens): owners see the stored roster at once, and the store
         * answers a fresh copy without a request or revalidates an older one quietly.
         */
        fun load() {
            if (_access.value == null && gate.showsCopy) showStoredCopy()
            reload(force = false)
        }

        /** Pull-to-refresh / retry: read now. */
        fun refresh() {
            _refreshing.value = _access.value != null
            reload(force = true)
        }

        override fun onCleared() {
            gate.leave()
        }

        /** Backend doesn't paginate /owners. */
        fun loadMoreIfNeeded() = Unit

        /** Screen calls this after dispatching a pending event. */
        fun acknowledgeEvent() {
            _pendingEvent.value = null
        }

        /** Fired by the FAB / empty CTA. */
        fun requestInvite() {
            if (!canManageOwnership) return
            _pendingEvent.value = OwnersListEvent.OpenInvite
        }

        /** Fired by the top-bar gavel. */
        fun requestClaimReview() {
            _pendingEvent.value = OwnersListEvent.OpenClaimReview
        }

        /**
         * H6 — entry point to the per-home claim-review surface
         * (`HomeClaimReviewScreen`). Deliberately un-badged: counting
         * pending claims would mean two extra owner-scoped reads on every
         * roster load, and the review screen already shows per-tab counts.
         * Mirrors iOS `OwnersListViewModel.topBarAction`.
         */
        val topBarAction: TopBarAction =
            TopBarAction(
                icon = PantopusIcon.Gavel,
                contentDescription = "Review claims on this home",
                onClick = ::requestClaimReview,
            )

        /** FAB payload — 52dp secondary-create + user-plus glyph +
         *  home-green tint to match the home-pillar identity. */
        val fab: FabAction?
            get() =
                if (canManageOwnership) {
                    FabAction(
                        icon = PantopusIcon.UserPlus,
                        contentDescription = "Invite an owner",
                        variant = FabVariant.SecondaryCreate,
                        tint = FabTint.Home,
                        onClick = ::requestInvite,
                    )
                } else {
                    null
                }

        /** Look up a cached owner by id. */
        fun cachedOwner(id: String): OwnerDto? = owners.firstOrNull { it.id == id }

        fun acknowledgeRemovalError() {
            _removalError.value = null
        }

        /**
         * Apply the result of the Invite Owner flow — the backend returns
         * a new claim id rather than a hydrated owner row, so the
         * simplest correct behaviour is to refetch so the new pending
         * row appears in the right order.
         */
        fun handleInviteCompleted() = reload(force = true)

        /** Optimistic remove + rollback on failure. */
        fun removeOwner(ownerId: String) {
            if (!canManageOwnership) return
            val previous = owners
            if (previous.none { it.id == ownerId }) return
            _removalError.value = null
            owners = previous.filter { it.id != ownerId }
            applyState()
            viewModelScope.launch {
                when (repo.remove(homeId, ownerId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        owners = previous
                        applyState()
                        _removalError.value =
                            "We couldn't confirm the owner removal. " +
                            "Refresh owners to check the current access before trying again."
                    }
                }
            }
        }

        private fun showStoredCopy() {
            val stored = repo.storedList(homeId) ?: return
            val access = adminRepo.storedMyAccess(homeId) ?: return
            _access.value = access
            owners = stored.owners
            applyState()
        }

        private fun reload(force: Boolean) {
            val generation = ++readGeneration
            if (_access.value == null) _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                val fromCopy = gate.showsCopy && !force
                var reads = readAll(fromCopy)
                // Household access ended meanwhile: whatever came from a copy is read again now.
                if (fromCopy && !gate.showsCopy) reads = readAll(fromCopy = false)
                if (generation != readGeneration) return@launch
                _refreshing.value = false
                publish(reads.first, reads.second)
            }
        }

        /** The roster and the viewer's access, read side by side with the access re-check. */
        private suspend fun readAll(fromCopy: Boolean): Pair<Stored<OwnersResponse>, Stored<HomeAccessDto>> =
            coroutineScope {
                val force = !fromCopy
                val recheck = async { gate.recheck(force) }
                val roster = async { repo.listStored(homeId, force) }
                val access = async { adminRepo.myAccessStored(homeId, force) }
                recheck.await()
                roster.await() to access.await()
            }

        private fun publish(
            roster: Stored<OwnersResponse>,
            access: Stored<HomeAccessDto>,
        ) {
            val list = roster.data
            val viewer = access.data
            when {
                list != null && viewer != null -> {
                    _access.value = viewer
                    owners = list.owners
                    applyState()
                }
                list != null -> {
                    _access.value = null
                    _state.value =
                        ListOfRowsUiState.Error(
                            (access.failure ?: NetworkError.NotFound).displayMessage("Couldn't load owner permissions."),
                        )
                }
                roster.failure is NetworkError.Forbidden -> {
                    _access.value = null
                    // Not (or no longer) an owner, e.g. right after transferring
                    // the Home: a retry can't change that, so say so plainly.
                    _state.value =
                        ListOfRowsUiState.Empty(
                            icon = PantopusIcon.Shield,
                            headline = "You're not an owner of this Home",
                            subcopy = "Only the Home's owners can see its owners and transfers.",
                        )
                }
                else -> {
                    _access.value = null
                    _state.value =
                        ListOfRowsUiState.Error((roster.failure ?: NetworkError.NotFound).displayMessage("Couldn't load the list."))
                }
            }
            _refreshNotice.value = RefreshNotice(roster.fetchedAt, ::refresh).takeIf { roster.showsRefreshFailure(StoreKind.HOMES) }
        }

        private fun applyState() {
            if (owners.isEmpty()) {
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Shield,
                        headline = "No owners yet",
                        subcopy =
                            "Invite a spouse, sibling, or co-investor who's on " +
                                "the deed. They'll upload proof and split the share " +
                                "with you.",
                        ctaTitle = if (canManageOwnership) "Invite an owner" else null,
                        onCta = if (canManageOwnership) ::requestInvite else null,
                    )
                return
            }
            val total = owners.size
            val rows =
                owners.mapIndexed { position, owner ->
                    row(owner, position, total)
                }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "owners", rows = rows)),
                    hasMore = false,
                )
        }

        /**
         * Project one DTO into a [RowModel].
         *
         * Slot map (mirrors the P15 brief and iOS):
         *  - title: owner name
         *  - inlineChip: "You" pill when the viewer matches the subject.
         *      The brief reserves this slot for a "Resident" chip when
         *      the owner also lives at the home, but `/owners` doesn't
         *      currently join residency — Resident is a backend
         *      follow-up.
         *  - subtitle: role ("Sole owner" / "Primary owner" /
         *      "Co-owner" / "Invited · awaiting verification") with a
         *      shield prefix.
         *  - body: verbose proof label ("Deed on file" / "Pending
         *      review") with the proof glyph prefix.
         *  - trailing: kebab → confirms removal. "View claim" + "Edit"
         *      deferred (no `claim_id` exposed on the owner row; no
         *      per-owner edit endpoint).
         */
        private fun row(
            owner: OwnerDto,
            position: Int,
            totalOwners: Int,
        ): RowModel {
            val displayName = displayName(owner)
            val proof =
                OwnerProof.resolve(
                    ownerStatus = owner.ownerStatus,
                    verificationTier = owner.verificationTier,
                )
            val tone = OwnerTone.at(position)
            val isYou = currentUserId?.let { it == owner.subjectId } ?: false
            val youChip: RowChip? =
                if (isYou) {
                    RowChip(
                        text = "You",
                        tint =
                            RowChip.Tint.Custom(
                                background = PantopusColors.primary50,
                                foreground = PantopusColors.primary700,
                            ),
                    )
                } else {
                    null
                }
            return RowModel(
                id = owner.id,
                title = displayName,
                subtitle =
                    roleSubtitle(
                        isPrimary = owner.isPrimaryOwner,
                        totalOwners = totalOwners,
                        isPending = owner.ownerStatus.lowercase() == "pending",
                    ),
                template = RowTemplate.AvatarKebab,
                leading =
                    RowLeading.AvatarWithBadge(
                        name = displayName,
                        imageUrl = owner.user?.profilePictureUrl?.takeIf { it.isNotEmpty() },
                        background = AvatarBackground.Gradient(tone.gradient),
                        size = AvatarBadgeSize.Medium,
                        verified = proof != OwnerProof.Pending,
                    ),
                trailing = if (canManageOwnership) RowTrailing.Kebab else RowTrailing.None,
                onTap = {
                    // No-op — the only interactive surface is the kebab
                    // menu. A future "View claim" destination would push
                    // here.
                },
                onSecondary = {
                    if (canManageOwnership) {
                        _pendingEvent.value =
                            OwnersListEvent.ConfirmRemove(
                                ownerId = owner.id,
                                displayName = displayName,
                            )
                    }
                },
                body = proof.bodyLabel,
                subtitleIcon = PantopusIcon.Shield,
                bodyIcon = proof.icon,
                inlineChip = youChip,
            )
        }

        private fun displayName(owner: OwnerDto): String {
            val name = owner.user?.name?.takeIf { it.isNotEmpty() }
            if (name != null) return name
            MadeUpUsername.handle(owner.user?.username)?.let { return it }
            val suffix = owner.subjectId.takeLast(SUBJECT_ID_DISPLAY_SUFFIX_LENGTH)
            return when (owner.subjectType.lowercase()) {
                "business" -> "Business · $suffix"
                "trust" -> "Trust · $suffix"
                else -> "Owner · $suffix"
            }
        }

        private fun roleSubtitle(
            isPrimary: Boolean,
            totalOwners: Int,
            isPending: Boolean,
        ): String {
            if (isPending) return "Invited · awaiting verification"
            if (totalOwners <= 1) return "Sole owner"
            return if (isPrimary) "Primary owner" else "Co-owner"
        }

        /** Public for tests: build a row from a DTO with the same
         *  projection the VM uses internally. */
        internal fun rowForTest(
            owner: OwnerDto,
            position: Int,
            totalOwners: Int,
        ): RowModel = row(owner, position, totalOwners)
    }
