@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.homes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooter
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooterAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Surfaced to the screen so it can present the destructive confirm. */
sealed interface MyHomesListEvent {
    /** Owner tapped the row kebab on a home they are allowed to delete. */
    data class ConfirmDelete(
        val homeId: String,
        val name: String,
    ) : MyHomesListEvent
}

/**
 * Which verification (if any) a `my-homes` row is still waiting on.
 * Predicate copied from RN `src/app/homes/index.tsx:181-184`.
 */
enum class PendingVerification { Owner, Residency }

/** @see PendingVerification */
fun pendingVerificationFor(home: MyHome): PendingVerification? {
    val isPendingOwner = home.occupancy?.role == "pending_owner" || home.ownershipStatus == "pending"
    if (isPendingOwner) return PendingVerification.Owner
    val occupancy = home.occupancy ?: return null
    val needsVerification =
        occupancy.verificationStatus.isNotEmpty() &&
            occupancy.verificationStatus !in listOf("verified", "moved_out")
    return if (!occupancy.isActive || needsVerification) PendingVerification.Residency else null
}

/**
 * ViewModel for the refreshed My homes list — wraps `GET /api/homes/my-homes`.
 *
 * T6.3f / P14 row anatomy:
 *   leading  → identity-green avatar tile (initials from address)
 *   title    → nickname or formatted address
 *   subtitle → role chip + locality joined with "·"
 *   chips    → ["Active home"] on the primary-owner row (home-tinted)
 *   trailing → chevron (tap → Home dashboard)
 *
 * Plus a home-tinted intro banner ("N homes you belong to") and a
 * `.SecondaryCreate` FAB tinted `FabTint.Home`.
 */
@HiltViewModel
class MyHomesListViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        private val adminRepo: HomeAdminRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        /** Row-kebab event the screen turns into a confirm dialog. */
        private val _pendingEvent = MutableStateFlow<MyHomesListEvent?>(null)
        val pendingEvent: StateFlow<MyHomesListEvent?> = _pendingEvent.asStateFlow()

        /** Non-null when the last delete attempt failed (403, network, …). */
        private val _actionError = MutableStateFlow<String?>(null)
        val actionError: StateFlow<String?> = _actionError.asStateFlow()

        private var deleting = false

        private var onOpenHome: (String) -> Unit = {}
        private var onAddHome: () -> Unit = {}
        private var onUploadOwnershipEvidence: ((String) -> Unit)? = null
        private var onVerifyResidency: ((String) -> Unit)? = null

        fun configureNavigation(
            onOpenHome: (String) -> Unit,
            onAddHome: () -> Unit,
            onUploadOwnershipEvidence: ((String) -> Unit)? = null,
            onVerifyResidency: ((String) -> Unit)? = null,
        ) {
            this.onOpenHome = onOpenHome
            this.onAddHome = onAddHome
            this.onUploadOwnershipEvidence = onUploadOwnershipEvidence
            this.onVerifyResidency = onVerifyResidency
        }

        fun load() {
            if (_state.value is ListOfRowsUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = ListOfRowsUiState.Loading
            _banner.value = null
            viewModelScope.launch {
                when (val result = repo.myHomes()) {
                    is NetworkResult.Success -> applySuccess(result.data.homes)
                    is NetworkResult.Failure ->
                        _state.value =
                            ListOfRowsUiState.Error(
                                result.error.displayMessage("Couldn't load the list."),
                            )
                }
            }
        }

        /** Screen calls this after turning [pendingEvent] into a dialog. */
        fun acknowledgeEvent() {
            _pendingEvent.value = null
        }

        /** Screen calls this after showing [actionError]. */
        fun clearActionError() {
            _actionError.value = null
        }

        /**
         * `DELETE /api/homes/:id` — route `backend/routes/home.js:3191`.
         * Only reachable from rows whose `can_delete_home` flag is true;
         * the confirm dialog has already fired by the time this runs.
         * Awaited (not optimistic) so a 403 leaves the row in place.
         */
        fun deleteHome(homeId: String) {
            if (deleting) return
            deleting = true
            _actionError.value = null
            viewModelScope.launch {
                when (val result = adminRepo.deleteHome(homeId)) {
                    is NetworkResult.Success -> refresh()
                    is NetworkResult.Failure ->
                        _actionError.value = result.error.displayMessage("Failed to delete")
                }
                deleting = false
            }
        }

        private fun applySuccess(homes: List<MyHome>) {
            if (homes.isEmpty()) {
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Home,
                        headline = "You don’t belong to any homes yet",
                        subcopy = "Claim or join a verified home to unlock packages, bills, tasks, and member chat.",
                        ctaTitle = "Claim a home",
                        onCta = onAddHome,
                    )
                return
            }
            val rows = homes.map(::rowFor)
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "my-homes", rows = rows)),
                    hasMore = false,
                )
            _banner.value =
                BannerConfig(
                    icon = PantopusIcon.Home,
                    title = if (rows.size == 1) "1 home you belong to" else "${rows.size} homes you belong to",
                    subtitle = "Tap any home to jump into that household",
                    tint = BannerCtaTint.Home,
                )
        }

        private fun rowFor(home: MyHome): RowModel {
            val title =
                home.name?.takeIf { it.isNotEmpty() }
                    ?: home.address
                    ?: "Unnamed home"
            val locality =
                listOfNotNull(home.city, home.state)
                    .filter { it.isNotEmpty() }
                    .joinToString(", ")
                    .takeIf { it.isNotEmpty() }
            val role = roleLabel(home)
            val subtitle =
                listOfNotNull(role, locality)
                    .joinToString(" · ")
                    .takeIf { it.isNotEmpty() }
            val progress = if (home.ownershipStatus == "verified") 1.0f else 0.3f

            val pending = pendingVerificationFor(home)
            val chips: List<RowChip>? =
                buildList {
                    if (home.isPrimaryOwner == true) {
                        add(
                            RowChip(
                                text = "Active home",
                                icon = PantopusIcon.Home,
                                tint =
                                    RowChip.Tint.Custom(
                                        background = PantopusColors.homeBg,
                                        foreground = PantopusColors.home,
                                    ),
                            ),
                        )
                    }
                    // Parity with RN (`src/app/homes/index.tsx:235`): an
                    // unverified claim / occupancy carries a "Pending
                    // verification" chip plus an inline upload CTA.
                    if (pending != null) {
                        add(
                            RowChip(
                                text = "Pending verification",
                                icon = PantopusIcon.Clock,
                                tint = RowChip.Tint.Status(StatusChipVariant.Warning),
                            ),
                        )
                    }
                }.takeIf { it.isNotEmpty() }

            // Parity with RN (`src/app/homes/index.tsx:249`): the
            // destructive affordance only appears on rows the server says
            // the viewer may delete. Everyone else keeps the chevron.
            val canDelete = home.canDeleteHome == true

            return RowModel(
                id = home.id,
                title = title,
                subtitle = subtitle,
                template = RowTemplate.AvatarKebab,
                leading =
                    RowLeading.Avatar(
                        name = title,
                        imageUrl = null,
                        identity = IdentityPillar.Home,
                        ringProgress = progress,
                    ),
                trailing = if (canDelete) RowTrailing.Kebab else RowTrailing.Chevron,
                onTap = { onOpenHome(home.id) },
                onSecondary =
                    if (canDelete) {
                        { _pendingEvent.value = MyHomesListEvent.ConfirmDelete(home.id, title) }
                    } else {
                        null
                    },
                chips = chips,
                footer = pendingFooter(home.id, pending),
            )
        }

        /**
         * The "Upload documents to verify …" strip RN renders under a
         * pending row (`src/app/homes/index.tsx:262-283`). Owner-pending
         * rows route to the ownership evidence wizard; residency-pending
         * rows route to its residency variant.
         */
        private fun pendingFooter(
            homeId: String,
            pending: PendingVerification?,
        ): RowFooter? =
            when (pending) {
                null -> null
                PendingVerification.Owner ->
                    onUploadOwnershipEvidence?.let { open ->
                        RowFooter(
                            listOf(
                                RowFooterAction(
                                    title = "Upload documents to verify ownership",
                                    icon = PantopusIcon.Upload,
                                    variant = CompactButtonVariant.Primary,
                                    testTag = "myHomes.row_$homeId.verifyOwnership",
                                    onClick = { open(homeId) },
                                ),
                            ),
                        )
                    }
                PendingVerification.Residency ->
                    onVerifyResidency?.let { open ->
                        RowFooter(
                            listOf(
                                RowFooterAction(
                                    title = "Upload documents to verify residency",
                                    icon = PantopusIcon.Upload,
                                    variant = CompactButtonVariant.Primary,
                                    testTag = "myHomes.row_$homeId.verifyResidency",
                                    onClick = { open(homeId) },
                                ),
                            ),
                        )
                    }
            }

        /**
         * Maps the backend's role hierarchy onto the canonical four-role
         * label vocabulary the design uses: Owner / Tenant / Housemate /
         * Guest. `ownership_status` wins; otherwise `occupancy.role_base`;
         * final fallback `null` so the subtitle just shows locality.
         */
        private fun roleLabel(home: MyHome): String? {
            when (home.ownershipStatus) {
                "verified" -> return "Owner"
                "pending" -> return "Owner (pending)"
                else -> Unit
            }
            return when (home.occupancy?.roleBase) {
                "lease_resident" -> "Tenant"
                "household_member" -> "Housemate"
                "guest" -> "Guest"
                "owner" -> "Owner"
                "admin", "manager" -> "Manager"
                null -> null
                else -> home.occupancy?.roleBase?.replaceFirstChar { it.uppercase() }
            }
        }
    }
