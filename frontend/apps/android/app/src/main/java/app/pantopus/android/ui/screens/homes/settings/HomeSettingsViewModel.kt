@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.settings

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.HomeDetail
import app.pantopus.android.data.api.models.homes.HomeDetailResponse
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomeSettingsRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.screens.homes.HomeCopyGateFactory
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
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
        gates: HomeCopyGateFactory,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val title: String = "Home settings"

        val homeId: String =
            requireNotNull(savedStateHandle[HOME_SETTINGS_HOME_ID_KEY]) {
                "HomeSettingsViewModel requires a '$HOME_SETTINGS_HOME_ID_KEY' nav arg."
            }

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        /** The quiet "Couldn't refresh. Showing 3:42 PM." line when a read fails on a copy past its max shown age. */
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        /** Founder decision 3: who may see this screen from the store's copy, and what leaves with the screen. */
        private val gate =
            gates.create(homeId, listOf(StoreKeys.homeDetail(homeId), StoreKeys.homeOccupants(homeId), StoreKeys.homeMe(homeId)))
        private var readGeneration = 0L

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
        private var showsGuestPasses = true

        /**
         * The viewer's effective permissions from `GET /:id/me`, so rows the server
         * would refuse (Privacy, Access codes, People…) aren't offered. Null when
         * `/me` didn't load: every row shows, as before.
         */
        private var viewerAccess: HomeAccessDto? = null
        private var loadedOnce = false

        /**
         * Screen entry and every return (Instant Screens): owners and household roles see the stored copy at once,
         * and the store answers a fresh copy without a request or revalidates an older one quietly.
         */
        fun load() {
            if (!loadedOnce && gate.showsCopy) showStoredCopy()
            read(force = false)
        }

        /** Pull to refresh, Retry and own edits: read now. */
        fun refresh() = read(force = true)

        override fun onCleared() {
            gate.leave()
        }

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

        /**
         * The Home's own name ("" when it has none). The identity card shows the
         * address in that case, but the editor starts from, and compares with,
         * the real name, so an untouched save never stores the address as a name.
         */
        private var currentName = ""

        /** Swap the identity card's name for the field. */
        fun beginRenaming() {
            _rename.update { current ->
                if (!current.canEdit || current.isSaving) {
                    current
                } else {
                    current.copy(isRenaming = true, draft = currentName, error = null)
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
                it.copy(isRenaming = false, draft = currentName, error = null)
            }
        }

        /**
         * `PATCH /api/homes/:id` with the trimmed draft, then re-read the
         * home so every derived caption follows the new name. An unchanged
         * draft saves nothing; an empty one clears the name (the server stores
         * null and the Home shows its address), as the web Settings tab does.
         */
        fun saveRenaming() {
            val current = _rename.value
            if (!current.canEdit || current.isSaving) return
            val trimmed = current.draft.trim()
            if (trimmed == currentName) {
                _rename.update { it.copy(isRenaming = false, error = null) }
                return
            }
            if (trimmed.length > HomeRenameState.NAME_MAX_LENGTH) {
                _rename.update {
                    it.copy(error = "Keep the name to ${HomeRenameState.NAME_MAX_LENGTH} characters or fewer.")
                }
                return
            }
            _rename.update { it.copy(isSaving = true, error = null) }
            viewModelScope.launch {
                when (val result = homeSettingsRepository.updateHome(homeId, UpdateHomeRequest(name = trimmed))) {
                    is NetworkResult.Success -> {
                        _rename.update { it.copy(isSaving = false, isRenaming = false, error = null) }
                        refresh()
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

        private fun showStoredCopy() {
            val detail = homesRepository.storedDetail(homeId)?.home ?: return
            apply(detail, homeMembersRepository.storedOccupants(homeId), homeAdminRepository.storedMyAccess(homeId))
            loadedOnce = true
            _state.value = GroupedListUiState.Loaded(groups())
        }

        private fun read(force: Boolean) {
            val generation = ++readGeneration
            if (!loadedOnce) _state.value = GroupedListUiState.Loading
            viewModelScope.launch {
                val fromCopy = gate.showsCopy && !force
                var reads = readAll(force = !fromCopy)
                // Household access ended meanwhile: whatever came from a copy is read again now.
                if (fromCopy && !gate.showsCopy) reads = readAll(force = true)
                if (generation == readGeneration) publish(reads)
            }
        }

        /** The Home, its occupants and the viewer's access, read side by side with the access re-check. */
        private suspend fun readAll(force: Boolean): SettingsReads =
            coroutineScope {
                val recheck = async { gate.recheck(force) }
                val detail = async { homesRepository.detailStored(homeId, force) }
                val occupants = async { homeMembersRepository.listOccupantsStored(homeId, force) }
                val access = async { homeAdminRepository.myAccessStored(homeId, force) }
                recheck.await()
                SettingsReads(detail.await(), occupants.await(), access.await())
            }

        private fun publish(reads: SettingsReads) {
            val home = reads.detail.data?.home
            if (home != null) {
                // Member counts + viewer access are best-effort — a
                // failure on either still lets the identity card +
                // navigation render.
                apply(home, reads.occupants.data, reads.access.data)
                loadedOnce = true
                _state.value = GroupedListUiState.Loaded(groups())
            } else {
                // Nothing to show, or the server ended this viewer's access (the store dropped the copy).
                loadedOnce = false
                val error = reads.detail.failure ?: NetworkError.NotFound
                _state.value = GroupedListUiState.Error(error.displayMessage("Couldn't load settings."))
            }
            _refreshNotice.value =
                RefreshNotice(reads.detail.fetchedAt, ::refresh).takeIf { reads.detail.showsRefreshFailure(StoreKind.HOMES) }
        }

        private fun apply(
            detail: HomeDetail,
            occupants: OccupantsResponse?,
            access: HomeAccessDto?,
        ) {
            val isPending = detail.isPendingOwner || detail.pendingClaimId != null
            frame = if (isPending) HomeSettingsSampleData.Frame.Pending else HomeSettingsSampleData.Frame.Populated

            currentName = detail.name?.trim().orEmpty()
            val homeName =
                detail.name?.takeIf { it.isNotBlank() }
                    ?: detail.address?.takeIf { it.isNotBlank() }
                    ?: "This home"
            _identity.value = identityFor(homeName, detail, isPending)
            _footerCaption.value = "$homeName · ${if (isPending) "Claim pending" else roleLabel(detail, access)}"
            subtexts =
                RowSubtexts(
                    address = addressLine(detail),
                    propertyDetails = humanizedHomeType(detail.homeType),
                    people = peopleSubtext(occupants),
                )
            // "Invite link" opens the guest-pass manager, which only viewers with
            // members.manage may use (the server answers everyone else 403). Shown
            // when GET /:id/me didn't load, as before.
            showsGuestPasses = access?.canManageMembers ?: true
            viewerAccess = access
            _rename.update { current ->
                current.copy(
                    canEdit = canEdit(detail, access),
                    draft = if (current.isRenaming) current.draft else currentName,
                )
            }
        }

        /**
         * The chip describes this viewer's real standing: the detail payload carries
         * their owner_status, occupancy verification and its source. An invitation or
         * a manager's approval gives household access, not a verified address (F3b),
         * so it doesn't read as "Verified".
         */
        private fun identityFor(
            homeName: String,
            detail: HomeDetail,
            isPending: Boolean,
        ): HomeSettingsSampleData.Identity {
            val verified = detail.ownershipStatus == "verified" || detail.residencyStatus == "verified"
            val householdOnly =
                verified && detail.ownershipStatus != "verified" && detail.residencySource == "household"
            // A pending owner who verified the address by mail (founder option 4) reads as
            // verified; the footer still says the claim is pending.
            val (label, tone) =
                when {
                    householdOnly -> "Household access" to RowControl.ChipTone.Info
                    verified -> "Verified" to RowControl.ChipTone.Success
                    isPending -> "Verifying" to RowControl.ChipTone.Warning
                    else -> "Unverified" to RowControl.ChipTone.Warning
                }
            return HomeSettingsSampleData.Identity(homeName = homeName, addressChipLabel = label, addressChipTone = tone)
        }

        /** Human label for the viewer's role in this home (owner, else their role_base). */
        private fun roleLabel(
            detail: HomeDetail,
            access: HomeAccessDto?,
        ): String {
            if (access?.isOwner == true || detail.isOwner) return "Owner"
            val base = access?.roleBase ?: detail.roleBase ?: return "Member"
            return base.replace('_', ' ').replaceFirstChar(Char::uppercase)
        }

        /**
         * The owner, or the effective `home.edit` permission from `GET /:id/me`: the right
         * `PATCH /api/homes/:id` checks. A role name alone doesn't grant it (the seeded admin role
         * has no `home.edit`, and the server refuses its rename with 403). `/me` is best-effort, so
         * fall back to the detail payload's `isOwner`.
         */
        private fun canEdit(
            detail: HomeDetail,
            access: HomeAccessDto?,
        ): Boolean {
            access ?: return detail.isOwner
            if (access.isOwner || detail.isOwner) return true
            return access.permissions.contains("home.edit")
        }

        private fun addressLine(detail: HomeDetail): String? {
            val street = detail.address?.takeIf { it.isNotBlank() } ?: return null
            val line = listOfNotNull(street, detail.address2?.takeIf { it.isNotBlank() }).joinToString(" ")
            val city = detail.city?.takeIf { it.isNotBlank() }
            return if (city != null) "$line, $city" else line
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
            ).filter { it.rows.isNotEmpty() }

        /** True when the viewer holds any of these permissions, or when their access couldn't be read. */
        private fun allows(vararg permissions: String): Boolean {
            val access = viewerAccess ?: return true
            return permissions.any { access.can(it) }
        }

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
                    listOfNotNull(
                        GroupedListRow("address", "Address", subtext = subtexts.address, control = addressControl),
                        GroupedListRow(
                            "propertyDetails",
                            "Property details",
                            subtext = subtexts.propertyDetails,
                            control = RowControl.Chevron,
                        ),
                        // Photos only points to the documents vault, so it needs docs.view too.
                        GroupedListRow("photos", "Photos", subtext = subtexts.photos, control = RowControl.Chevron)
                            .takeIf { allows("docs.view") },
                        GroupedListRow("documents", "Documents", subtext = subtexts.documents, control = RowControl.Chevron)
                            .takeIf { allows("docs.view") },
                    ),
            )
        }

        private fun accessGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "access",
                overline = "Access",
                rows =
                    listOfNotNull(
                        GroupedListRow("accessCodes", "Access codes", subtext = subtexts.accessCodes, control = RowControl.Chevron)
                            .takeIf { allows("access.view_codes", "access.view_wifi", "access.manage") },
                        // Both screens read routes gated on security.manage.
                        GroupedListRow("privacy", "Privacy", subtext = subtexts.privacy, control = RowControl.Chevron)
                            .takeIf { allows("security.manage") },
                        GroupedListRow(
                            "ownershipSecurity",
                            "Ownership & Security",
                            subtext = "Discoverability and owner claims",
                            control = RowControl.Chevron,
                        ).takeIf { allows("security.manage") },
                    ),
            )

        private fun membersGroup(): GroupedListGroup =
            GroupedListGroup(
                id = "members",
                overline = "Members",
                rows =
                    listOfNotNull(
                        GroupedListRow("people", "People", subtext = subtexts.people, control = RowControl.Chevron)
                            .takeIf { allows("members.view") },
                        GroupedListRow("inviteLink", "Invite link", subtext = subtexts.inviteLink, control = RowControl.Chevron)
                            .takeIf { showsGuestPasses },
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

/** One read of the Settings index: the Home is required; occupants and access are best-effort. */
private data class SettingsReads(
    val detail: Stored<HomeDetailResponse>,
    val occupants: Stored<OccupantsResponse>,
    val access: Stored<HomeAccessDto>,
)

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
