@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.settings

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.HomeDetail
import app.pantopus.android.data.api.models.homes.HomeDetailResponse
import app.pantopus.android.data.api.models.homes.HomeDto
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.PendingInviteDto
import app.pantopus.android.data.api.models.homes.UpdateHomeRequest
import app.pantopus.android.data.api.models.homes.UpdateHomeResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomeSettingsRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * P5.1 / A14.1 / Block 2A — projection tests for the per-home Settings
 * index, now driven by the live `GET /:id` + `GET /:id/occupants`
 * fetch. Locks the slot inventory (5 groups, row ids), the destructive
 * row swap by claim state, the verification chip, the real member-count
 * subtext, and the honest-null treatment for rows no endpoint backs.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class HomeSettingsViewModelTest {
    private val homesRepository: HomesRepository = mockk()
    private val homeMembersRepository: HomeMembersRepository = mockk()
    private val homeAdminRepository: HomeAdminRepository = mockk()
    private val homeSettingsRepository: HomeSettingsRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun homeDetail(
        name: String? = "14 Elm Park Lane",
        address: String? = "14 Elm Park Lane",
        city: String? = "Oakland",
        homeType: String? = "single_family",
        isPendingOwner: Boolean = false,
        pendingClaimId: String? = null,
    ) = HomeDetail(
        id = "home-1",
        name = name,
        address = address,
        city = city,
        state = "CA",
        zipcode = "94601",
        homeType = homeType,
        visibility = "members",
        description = null,
        createdAt = null,
        owner = null,
        location = null,
        isPendingOwner = isPendingOwner,
        pendingClaimId = pendingClaimId,
    )

    private fun occupants(
        members: Int,
        pending: Int,
    ) = OccupantsResponse(
        occupants = (1..members).map { OccupantDto(id = "occ-$it", userId = "u-$it") },
        pendingInvites = (1..pending).map { PendingInviteDto(id = "inv-$it") },
    )

    private fun makeVm(
        detail: NetworkResult<HomeDetailResponse> = NetworkResult.Success(HomeDetailResponse(homeDetail())),
        occupants: NetworkResult<OccupantsResponse> = NetworkResult.Failure(NetworkError.NotFound),
        access: NetworkResult<HomeAccessDto> = NetworkResult.Failure(NetworkError.NotFound),
        updateHome: NetworkResult<UpdateHomeResponse> =
            NetworkResult.Success(UpdateHomeResponse(message = "Home updated successfully", home = homeRow())),
        homeId: String = "home-1",
    ): HomeSettingsViewModel {
        coEvery { homesRepository.detail(any()) } returns detail
        coEvery { homeMembersRepository.listOccupants(any()) } returns occupants
        coEvery { homeAdminRepository.myAccess(any()) } returns access
        coEvery { homeSettingsRepository.updateHome(any(), any()) } returns updateHome
        return HomeSettingsViewModel(
            homesRepository = homesRepository,
            homeMembersRepository = homeMembersRepository,
            homeAdminRepository = homeAdminRepository,
            homeSettingsRepository = homeSettingsRepository,
            savedStateHandle = SavedStateHandle(mapOf(HOME_SETTINGS_HOME_ID_KEY to homeId)),
        )
    }

    private fun homeRow(name: String? = "The Lane House") =
        HomeDto(
            id = "home-1",
            name = name,
            address = "14 Elm Park Lane",
            city = "Oakland",
            state = "CA",
            zipcode = "94601",
            homeType = "single_family",
            visibility = "members",
            description = null,
            createdAt = null,
            updatedAt = null,
        )

    private fun loadedGroups(vm: HomeSettingsViewModel) = (vm.state.value as GroupedListUiState.Loaded).groups

    @Test
    fun loaded_produces_five_groups() {
        val vm = makeVm()
        vm.load()
        assertEquals(
            listOf("homeIdentity", "access", "members", "notifications", "windDown"),
            loadedGroups(vm).map { it.id },
        )
    }

    @Test
    fun row_inventory_matches_audit() {
        val vm = makeVm()
        vm.load()
        val byGroup = loadedGroups(vm).associate { it.id to it.rows.map { row -> row.id } }
        assertEquals(listOf("address", "propertyDetails", "photos", "documents"), byGroup["homeIdentity"])
        assertEquals(
            listOf("accessCodes", "trustedNeighbors", "privacy", "ownershipSecurity"),
            byGroup["access"],
        )
        assertEquals(listOf("people", "inviteLink"), byGroup["members"])
        assertEquals(listOf("homeNotifications"), byGroup["notifications"])
        assertEquals(listOf("leaveHome"), byGroup["windDown"])
    }

    @Test
    fun established_home_carries_success_verified_chip() {
        val vm = makeVm()
        vm.load()
        val address = loadedGroups(vm).first { it.id == "homeIdentity" }.rows.first { it.id == "address" }
        val control = address.control as RowControl.ChipStatus
        assertEquals("Verified", control.label)
        assertEquals(RowControl.ChipTone.Success, control.tone)
        assertTrue(control.includesChevron)
    }

    @Test
    fun pending_owner_swaps_destructive_to_cancel_claim() {
        val vm = makeVm(detail = NetworkResult.Success(HomeDetailResponse(homeDetail(isPendingOwner = true))))
        vm.load()
        val destructive = loadedGroups(vm).last().rows.first()
        assertEquals("cancelClaim", destructive.id)
        assertEquals("Cancel claim", destructive.label)
        assertTrue(destructive.destructive)
    }

    @Test
    fun pending_owner_carries_warning_verifying_chip() {
        val vm = makeVm(detail = NetworkResult.Success(HomeDetailResponse(homeDetail(isPendingOwner = true))))
        vm.load()
        val address = loadedGroups(vm).first { it.id == "homeIdentity" }.rows.first { it.id == "address" }
        val control = address.control as RowControl.ChipStatus
        assertEquals("Verifying", control.label)
        assertEquals(RowControl.ChipTone.Warning, control.tone)
    }

    @Test
    fun people_subtext_reflects_member_and_pending_counts() {
        val vm = makeVm(occupants = NetworkResult.Success(occupants(members = 4, pending = 1)))
        vm.load()
        val people = loadedGroups(vm).first { it.id == "members" }.rows.first { it.id == "people" }
        assertEquals("4 members · 1 pending", people.subtext)
    }

    @Test
    fun address_row_shows_real_address() {
        val vm = makeVm()
        vm.load()
        val address = loadedGroups(vm).first { it.id == "homeIdentity" }.rows.first { it.id == "address" }
        assertEquals("14 Elm Park Lane, Oakland", address.subtext)
    }

    @Test
    fun unsourced_rows_are_not_faked() {
        val vm = makeVm()
        vm.load()
        val identity = loadedGroups(vm).first { it.id == "homeIdentity" }
        assertNull(identity.rows.first { it.id == "photos" }.subtext)
        assertNull(identity.rows.first { it.id == "documents" }.subtext)
        val access = loadedGroups(vm).first { it.id == "access" }
        assertNull(access.rows.first { it.id == "accessCodes" }.subtext)
    }

    @Test
    fun detail_failure_surfaces_error() {
        val vm = makeVm(detail = NetworkResult.Failure(NetworkError.NotFound))
        vm.load()
        assertTrue(vm.state.value is GroupedListUiState.Error)
    }

    @Test
    fun tap_privacy_row_routes_to_security() {
        val vm = makeVm()
        vm.load()
        vm.onRow("privacy")
        assertEquals(HomeSettingsRoute.Security, vm.navigation.value)
    }

    @Test
    fun rename_is_gated_on_edit_permission() {
        val vm = makeVm()
        vm.load()
        vm.beginRenaming()
        assertEquals(false, vm.rename.value.canEdit)
        assertEquals(false, vm.rename.value.isRenaming)
    }

    @Test
    fun owner_rename_patches_the_home_and_closes_the_editor() {
        val vm = makeVm(access = NetworkResult.Success(HomeAccessDto(hasAccess = true, isOwner = true)))
        vm.load()
        vm.beginRenaming()
        assertTrue(vm.rename.value.isRenaming)
        vm.updateRenameDraft("  The Lane House  ")
        vm.saveRenaming()
        coVerify { homeSettingsRepository.updateHome("home-1", UpdateHomeRequest(name = "The Lane House")) }
        assertEquals(false, vm.rename.value.isRenaming)
        assertNull(vm.rename.value.error)
    }

    @Test
    fun blank_rename_never_reaches_the_network() {
        val vm = makeVm(access = NetworkResult.Success(HomeAccessDto(hasAccess = true, isOwner = true)))
        vm.load()
        vm.beginRenaming()
        vm.updateRenameDraft("   ")
        vm.saveRenaming()
        coVerify(exactly = 0) { homeSettingsRepository.updateHome(any(), any()) }
        assertEquals("Enter a name for this home.", vm.rename.value.error)
    }

    @Test
    fun rename_failure_keeps_the_editor_open_with_an_error() {
        val vm =
            makeVm(
                access = NetworkResult.Success(HomeAccessDto(hasAccess = true, isOwner = true)),
                updateHome = NetworkResult.Failure(NetworkError.Server(500, "Failed to update home")),
            )
        vm.load()
        vm.beginRenaming()
        vm.updateRenameDraft("The Lane House")
        vm.saveRenaming()
        assertTrue(vm.rename.value.isRenaming)
        assertTrue(vm.rename.value.error!!.isNotEmpty())
    }

    @Test
    fun frame_inference_follows_home_id_prefix() {
        assertEquals(HomeSettingsSampleData.Frame.Populated, HomeSettingsSampleData.frameForHomeId("home-abc"))
        assertEquals(HomeSettingsSampleData.Frame.Pending, HomeSettingsSampleData.frameForHomeId("pending-xyz"))
    }
}
