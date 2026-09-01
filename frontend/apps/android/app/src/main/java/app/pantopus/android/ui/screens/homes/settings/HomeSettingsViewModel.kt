@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.settings

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.HomeDetail
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomeSettingsRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav key carrying the home id into the per-home Settings stack. */
const val HOME_SETTINGS_HOME_ID_KEY = "homeId"

/**
 * Sentinel routes the per-home Settings index can ask its host to
 * push. Mirrors the iOS `HomeSettingsRoute` enum.
 */
enum class HomeSettingsRoute {
    Address,
    PropertyDetails,
    Photos,
    Documents,
    AccessCodes,
    TrustedNeighbors,
    Security,

    /**
     * A14.2 (policy variant) — per-home ownership security policy
     * (`/api/homes/:id/security`). Distinct from [Security], which is the
     * 9-toggle privacy screen on `/api/homes/:id/privacy`.
     */
    OwnershipSecurity,
    People,
    InviteLink,
    HomeNotifications,
    LeaveHome,
    CancelClaim,
}

/**
 * Inline rename state for the identity card — RN's nickname editor
 * (`src/app/homes/[id]/settings/index.tsx:89-108`).
 */
data class HomeRenameState(
    /**
     * True when the viewer may rename this home. Mirrors RN's `canEdit`
     * (`settings/index.tsx:47`); the backend enforces the same `home.edit`
     * gate on `PATCH /api/homes/:id` (`home.js:3110`).
     */
    val canEdit: Boolean = false,
    /** True when the card renders the field instead of the name. */
    val isRenaming: Boolean = false,
    val draft: String = "",
    val isSaving: Boolean = false,
    val error: String? = null,
) {
    companion object {
        /** `updateHomeSchema`'s `name: Joi.string().max(120)`. */
        const val NAME_MAX_LENGTH: Int = 120
    }
}

/**
 * P5.1 / A14.1 / Block 2A — per-home Settings index. A NAVIGATION index
 * (chevron rows routing to Address / Photos / People / … sub-screens)
 * plus one mutation: the inline rename on the identity card, which
 * PATCHes `/api/homes/:id`.
 *
 * Wiring: fetches the real home (`GET /:id`) so the identity card shows
 * `home.name` + a verification chip derived from the claim state, and
 * the People row's subtext reflects the real member / pending counts
 * from the same `GET /:id/occupants` the Members screen uses. Rows with
 * no backend source are left bare rather than faked. Sample frames in
 * [HomeSettingsSampleData] back the previews + Paparazzi baselines.
 */
@HiltViewModel
class HomeSettingsViewModel
    @Inject
    constructor(
        private val homesRepository: HomesRepository,
        private val homeMembersRepository: HomeMembersRepository,
        private val homeAdminRepository: HomeAdminRepository,
        private val homeSettingsRepository: HomeSettingsRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val title: String = "Home settings"

        val homeId: String =
            requireNotNull(savedStateHandle[HOME_SETTINGS_HOME_ID_KEY]) {
                "HomeSettingsViewModel requires a '$HOME_SETTINGS_HOME_ID_KEY' nav arg."
            }

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        private val _identity =
            MutableStateFlow(HomeSettingsSampleData.identity(HomeSettingsSampleData.Frame.Populated))
        val identity: StateFlow<HomeSettingsSampleData.Identity> = _identity.asStateFlow()

        private val _footerCaption = MutableStateFlow<String?>(null)
        val footerCaption: StateFlow<String?> = _footerCaption.asStateFlow()

        private val _navigation = MutableStateFlow<HomeSettingsRoute?>(null)
        val navigation: StateFlow<HomeSettingsRoute?> = _navigation.asStateFlow()

        private val _rename = MutableStateFlow(HomeRenameState())
        val rename: StateFlow<HomeRenameState> = _rename.asStateFlow()

        private var frame: HomeSettingsSampleData.Frame = HomeSettingsSampleData.Frame.Populated
        private var subtexts = RowSubtexts()
        private var loadedOnce = false

        fun load() {
            if (loadedOnce) return
            reload()
        }

        fun refresh() = reload()

        fun consumeNavigation() {
            _navigation.value = null
        }

        fun onRow(rowId: String) {
            _navigation.value =
                when (rowId) {
                    "address" -> HomeSettingsRoute.Address
                    "propertyDetails" -> HomeSettingsRoute.PropertyDetails
                    "photos" -> HomeSettingsRoute.Photos
                    "documents" -> HomeSettingsRoute.Documents
                    "accessCodes" -> HomeSettingsRoute.AccessCodes
                    "trustedNeighbors" -> HomeSettingsRoute.TrustedNeighbors
                    "privacy" -> HomeSettingsRoute.Security
                    "ownershipSecurity" -> HomeSettingsRoute.OwnershipSecurity
                    "people" -> HomeSettingsRoute.People
                    "inviteLink" -> HomeSettingsRoute.InviteLink
                    "homeNotifications" -> HomeSettingsRoute.HomeNotifications
                    "leaveHome" -> HomeSettingsRoute.LeaveHome
                    "cancelClaim" -> HomeSettingsRoute.CancelClaim
                    else -> null
                }
        }

        // MARK: - Inline rename

        /** Swap the identity card's name for the field. */
        fun beginRenaming() {
            _rename.update { current ->
                if (!current.canEdit || current.isSaving) {
                    current
                } else {
                    current.copy(isRenaming = true, draft = _identity.value.homeName, error = null)
                }
            }
        }

        /** Field binding. */
        fun updateRenameDraft(value: String) {
            _rename.update { it.copy(draft = value, error = null) }
        }

        /** Discard the draft — RN's close button (`settings/index.tsx:103`). */
        fun cancelRenaming() {
            _rename.update {
                it.copy(isRenaming = false, draft = _identity.value.homeName, error = null)
            }
        }

        /**
         * `PATCH /api/homes/:id` with the trimmed draft, then re-read the
         * home so every derived caption follows the new name.
         */
        fun saveRenaming() {
            val current = _rename.value
            if (!current.canEdit || current.isSaving) return
            val trimmed = current.draft.trim()
            if (trimmed.isEmpty()) {
                _rename.update { it.copy(error = "Enter a name for this home.") }
                return
            }
            if (trimmed.length > HomeRenameState.NAME_MAX_LENGTH) {
                _rename.update {
                    it.copy(error = "Keep the name under ${HomeRenameState.NAME_MAX_LENGTH} characters.")
                }
                return
            }
            _rename.update { it.copy(isSaving = true, error = null) }
            viewModelScope.launch {
                when (val result = homeSettingsRepository.updateHome(homeId, UpdateHomeRequest(name = trimmed))) {
                    is NetworkResult.Success -> {
                        _rename.update { it.copy(isSaving = false, isRenaming = false, error = null) }
                        reload()
                    }
                    is NetworkResult.Failure -> {
                        _rename.update {
                            it.copy(
                                isSaving = false,
                                error = result.error.displayMessage("Couldn't rename this home. Try again."),
                            )
                        }
                    }
                }
            }
        }

        private fun reload() {
            _state.value = GroupedListUiState.Loading
            viewModelScope.launch {
                when (val result = homesRepository.detail(homeId)) {
                    is NetworkResult.Success -> {
                        // Member counts + viewer access are best-effort — a
                        // failure on either still lets the identity card +
                        // navigation render.
                        val occupants =
                            (homeMembersRepository.listOccupants(homeId) as? NetworkResult.Success)?.data
                        val access =
                            (homeAdminRepository.myAccess(homeId) as? NetworkResult.Success)?.data
                        apply(result.data.home, occupants, access)
                        loadedOnce = true
                        _state.value = GroupedListUiState.Loaded(groups())
                    }
                    is NetworkResult.Failure -> {
                        _state.value = GroupedListUiState.Error(result.error.displayMessage("Couldn't load settings."))
                    }
                }
            }
        }

        private fun apply(
            detail: HomeDetail,
            occupants: OccupantsResponse?,
            access: HomeAccessDto?,
        ) {
            val isPending = detail.isPendingOwner || detail.pendingClaimId != null
            frame = if (isPending) HomeSettingsSampleData.Frame.Pending else HomeSettingsSampleData.Frame.Populated

            val homeName =
                detail.name?.takeIf { it.isNotBlank() }
                    ?: detail.address?.takeIf { it.isNotBlank() }
                    ?: "This home"
            _identity.value =
                HomeSettingsSampleData.Identity(
                    homeName = homeName,
                    addressChipLabel = if (isPending) "Verifying" else "Verified",
                    addressChipTone = if (isPending) RowControl.ChipTone.Warning else RowControl.ChipTone.Success,
                )
            _footerCaption.value = "$homeName · ${if (isPending) "Claim pending" else "Owner"}"
            subtexts =
                RowSubtexts(
                    address = addressLine(detail),
                    propertyDetails = humanizedHomeType(detail.homeType),
                    people = peopleSubtext(occupants),
                )
            _rename.update { current ->
                current.copy(
                    canEdit = canEdit(detail, access),
                    draft = if (current.isRenaming) current.draft else homeName,
                )
            }
        }

        /**
         * RN's `canEdit` (`settings/index.tsx:47`): owner, an explicit
         * `home.edit` permission, or an owner/admin base role. `GET /:id/me`
         * is best-effort, so fall back to the detail payload's `isOwner`.
         */
        private fun canEdit(
            detail: HomeDetail,
            access: HomeAccessDto?,
        ): Boolean {
            access ?: return detail.isOwner
            if (access.isOwner || detail.isOwner) return true
            if (access.permissions.contains("home.edit")) return true
            return access.roleBase == "owner" || access.roleBase == "admin"
        }

        private fun addressLine(detail: HomeDetail): String? {
            val street = detail.address?.takeIf { it.isNotBlank() } ?: return null
            val city = detail.city?.takeIf { it.isNotBlank() }
            return if (city != null) "$street, $city" else street
        }

        private fun humanizedHomeType(raw: String?): String? {
            val value = raw?.takeIf { it.isNotBlank() } ?: return null
            return value
                .replace('_', ' ')
                .replace('-', ' ')
                .split(' ')
                .joinToString(" ") { word -> word.replaceFirstChar { it.uppercase() } }
        }

        private fun peopleSubtext(occupants: OccupantsResponse?): String? {
            occupants ?: return null
            val members = occupants.occupants.size
            val pending = occupants.pendingInvites.size
            val memberLabel = if (members == 1) "1 member" else "$members members"
            if (pending == 0) return memberLabel
            val pendingLabel = if (pending == 1) "1 pending" else "$pending pending"
            return "$memberLabel · $pendingLabel"
        }

        // Group projection — structure mirrors iOS `groups()`; subtexts are
        // resolved from live data (or left null when no endpoint backs them).

        private fun groups(): List<GroupedListGroup> =
            listOf(
                homeIdentityGroup(),
                accessGroup(),
                membersGroup(),
                notificationsGroup(),
                windDownGroup(),
            )

        private fun homeIdentityGroup(): GroupedListGroup {
            val identity = _identity.value
            val addressControl =
                RowControl.ChipStatus(
                    label = identity.addressChipLabel,
                    tone = identity.addressChipTone,
                    includesChevron = true,
                )
            return GroupedListGroup(
                id = "homeIdentity",
                overline = "Home identity",
                rows =
                    listOf(
                        GroupedListRow("address", "Address", subtext = subtexts.address, control = addressControl),
                        GroupedListRow(
                            "propertyDetails",
                            "Property details",
                            subtext = subtexts.propertyDetails,
                            control = RowControl.Chevron,
                        ),
                        GroupedListRow("photos", "Photos", subtext = subtexts.photos, control = RowControl.Chevron),
                        GroupedListRow("documents", "Documents", subtext = subtexts.documents, control = RowControl.Chevron),
                    ),
            )
        }

        private fun accessGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "access",
                overline = "Access",
                rows =
                    listOf(
                        GroupedListRow("accessCodes", "Access codes", subtext = subtexts.accessCodes, control = RowControl.Chevron),
                        GroupedListRow(
                            "trustedNeighbors",
                            "Trusted neighbors",
                            subtext = subtexts.trustedNeighbors,
                            control = RowControl.Chevron,
                        ),
                        GroupedListRow("privacy", "Privacy", subtext = subtexts.privacy, control = RowControl.Chevron),
                        GroupedListRow(
                            "ownershipSecurity",
                            "Ownership & Security",
                            subtext = "Discoverability, owner claims, member policy",
                            control = RowControl.Chevron,
                        ),
                    ),
            )

        private fun membersGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "members",
                overline = "Members",
                rows =
                    listOf(
                        GroupedListRow("people", "People", subtext = subtexts.people, control = RowControl.Chevron),
                        GroupedListRow("inviteLink", "Invite link", subtext = subtexts.inviteLink, control = RowControl.Chevron),
                    ),
            )

        private fun notificationsGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "notifications",
                overline = "Notifications",
                rows =
                    listOf(
                        GroupedListRow(
                            "homeNotifications",
                            "Home notifications",
                            subtext = subtexts.notifications,
                            control = RowControl.Chevron,
                        ),
                    ),
            )

        private fun windDownGroup(): GroupedListGroup {
            val row =
                when (frame) {
                    HomeSettingsSampleData.Frame.Populated ->
                        GroupedListRow("leaveHome", "Leave this home", control = RowControl.Chevron, destructive = true)
                    HomeSettingsSampleData.Frame.Pending ->
                        GroupedListRow("cancelClaim", "Cancel claim", control = RowControl.Chevron, destructive = true)
                }
            return GroupedListGroup(id = "windDown", overline = "Wind down", rows = listOf(row))
        }
    }

/**
 * Row subtexts resolved for the active frame. Live data fills only the
 * slots a real endpoint backs (address, property type, people counts);
 * the rest stay null so the row renders bare rather than faked.
 */
private data class RowSubtexts(
    val address: String? = null,
    val propertyDetails: String? = null,
    val photos: String? = null,
    val documents: String? = null,
    val accessCodes: String? = null,
    val trustedNeighbors: String? = null,
    val privacy: String? = null,
    val people: String? = null,
    val inviteLink: String? = null,
    val notifications: String? = null,
)
