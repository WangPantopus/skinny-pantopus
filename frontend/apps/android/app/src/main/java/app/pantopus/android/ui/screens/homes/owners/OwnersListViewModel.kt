@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.owners

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.OwnerDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeOwnersRepository
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
        authRepository: AuthRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val homeId: String = savedStateHandle[OWNERS_LIST_HOME_ID_KEY] ?: ""

        /** Drives the "You" chip on the viewer's own row. Resolved
         *  eagerly from [AuthRepository] state at construction. */
        val currentUserId: String? =
            (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _pendingEvent = MutableStateFlow<OwnersListEvent?>(null)
        val pendingEvent: StateFlow<OwnersListEvent?> = _pendingEvent.asStateFlow()

        /** Cached roster — preserves backend ordering and drives
         *  optimistic-remove rollback. */
        private var owners: List<OwnerDto> = emptyList()

        /** Idempotent — re-running won't refetch once content is loaded. */
        fun load() {
            if (_state.value is ListOfRowsUiState.Loaded && owners.isNotEmpty()) return
            reload()
        }

        /** Pull-to-refresh / retry. */
        fun refresh() = reload()

        /** Backend doesn't paginate /owners. */
        fun loadMoreIfNeeded() = Unit

        /** Screen calls this after dispatching a pending event. */
        fun acknowledgeEvent() {
            _pendingEvent.value = null
        }

        /** Fired by the FAB / empty CTA. */
        fun requestInvite() {
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
        val fab: FabAction =
            FabAction(
                icon = PantopusIcon.UserPlus,
                contentDescription = "Invite an owner",
                variant = FabVariant.SecondaryCreate,
                tint = FabTint.Home,
                onClick = ::requestInvite,
            )

        /** Look up a cached owner by id. */
        fun cachedOwner(id: String): OwnerDto? = owners.firstOrNull { it.id == id }

        /**
         * Apply the result of the Invite Owner flow — the backend returns
         * a new claim id rather than a hydrated owner row, so the
         * simplest correct behaviour is to refetch so the new pending
         * row appears in the right order.
         */
        fun handleInviteCompleted() = reload()

        /** Optimistic remove + rollback on failure. */
        fun removeOwner(ownerId: String) {
            val previous = owners
            val target = previous.firstOrNull { it.id == ownerId } ?: return
            owners = previous.filter { it.id != ownerId }
            applyState()
            viewModelScope.launch {
                when (repo.remove(homeId, ownerId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        owners = previous
                        applyState()
                        @Suppress("UNUSED_VARIABLE")
                        val rollbackTarget = target
                    }
                }
            }
        }

        private fun reload() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.list(homeId)) {
                    is NetworkResult.Success -> {
                        owners = result.data.owners
                        applyState()
                    }
                    is NetworkResult.Failure -> {
                        _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                    }
                }
            }
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
                        ctaTitle = "Invite an owner",
                        onCta = ::requestInvite,
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
                trailing = RowTrailing.Kebab,
                onTap = {
                    // No-op — the only interactive surface is the kebab
                    // menu. A future "View claim" destination would push
                    // here.
                },
                onSecondary = {
                    _pendingEvent.value =
                        OwnersListEvent.ConfirmRemove(
                            ownerId = owner.id,
                            displayName = displayName,
                        )
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
            val username = owner.user?.username?.takeIf { it.isNotEmpty() }
            if (username != null) return "@$username"
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
