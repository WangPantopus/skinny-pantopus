package app.pantopus.android.ui.screens.homes

import app.cash.turbine.test
import app.pantopus.android.data.api.models.homes.DeleteHomeResponse
import app.pantopus.android.data.api.models.homes.HomeOccupancy
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MyHomesListViewModelTest {
    private val repo: HomesRepository = mockk()
    private val adminRepo: HomeAdminRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeHome(
        id: String,
        name: String? = "Main",
        city: String? = "X",
        ownership: String? = "verified",
        roleBase: String? = null,
        isPrimary: Boolean? = true,
        canDeleteHome: Boolean? = null,
    ) = MyHome(
        id = id,
        name = name,
        address = "1 Main",
        city = city,
        state = "CA",
        zipcode = "90000",
        homeType = "single_family",
        visibility = "public",
        description = null,
        createdAt = null,
        updatedAt = null,
        occupancy =
            roleBase?.let {
                HomeOccupancy(
                    id = "o-$id",
                    role = it,
                    roleBase = it,
                    isActive = true,
                    startAt = null,
                    endAt = null,
                    verificationStatus = "verified",
                )
            },
        ownershipStatus = ownership,
        verificationTier = "attom",
        isPrimaryOwner = isPrimary,
        pendingClaimId = null,
        canDeleteHome = canDeleteHome,
    )

    @Test
    fun happy_path_emits_loaded_rows_with_role_chip_and_banner() =
        runTest {
            coEvery { repo.myHomes() } returns
                NetworkResult.Success(
                    MyHomesResponse(
                        homes =
                            listOf(
                                makeHome("h1", name = "Birch Lane", city = "Elm Park", ownership = "verified", isPrimary = true),
                                makeHome(
                                    "h2",
                                    name = null,
                                    city = "Sellwood",
                                    ownership = null,
                                    roleBase = "lease_resident",
                                    isPrimary = false,
                                ),
                            ),
                        message = null,
                    ),
                )
            val vm = MyHomesListViewModel(repo, adminRepo)
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val rows = loaded.sections.first().rows
            assertEquals(2, rows.size)
            // Primary-owner row has the Active-home chip and verified ring.
            assertEquals("Birch Lane", rows[0].title)
            assertEquals("Owner · Elm Park, CA", rows[0].subtitle)
            val chips = rows[0].chips
            assertNotNull(chips)
            assertEquals("Active home", chips!!.first().text)
            assertTrue(chips.first().tint is RowChip.Tint.Custom)
            val leading = rows[0].leading as RowLeading.Avatar
            assertEquals(IdentityPillar.Home, leading.identity)
            assertEquals(1.0f, leading.ringProgress, 0.001f)
            // Tenant row has no chip, address-only title, and the lower
            // 0.3 ring progress.
            assertEquals("1 Main", rows[1].title)
            assertEquals("Tenant · Sellwood, CA", rows[1].subtitle)
            assertNull(rows[1].chips)
            assertEquals(0.3f, (rows[1].leading as RowLeading.Avatar).ringProgress, 0.001f)
            // Banner shows count + home tint when populated.
            val banner = vm.banner.value
            assertNotNull(banner)
            assertEquals("2 homes you belong to", banner!!.title)
            assertEquals(BannerCtaTint.Home, banner.tint)
        }

    @Test
    fun empty_response_surfaces_empty_state_and_clears_banner() =
        runTest {
            coEvery { repo.myHomes() } returns NetworkResult.Success(MyHomesResponse(homes = emptyList(), message = null))
            val vm = MyHomesListViewModel(repo, adminRepo)
            vm.state.test {
                awaitItem() // Loading
                vm.load()
                val empty = awaitItem() as ListOfRowsUiState.Empty
                assertEquals("You don’t belong to any homes yet", empty.headline)
                assertEquals("Claim a home", empty.ctaTitle)
                cancelAndConsumeRemainingEvents()
            }
            assertNull(vm.banner.value)
        }

    @Test
    fun failure_surfaces_error_state() =
        runTest {
            coEvery { repo.myHomes() } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = MyHomesListViewModel(repo, adminRepo)
            vm.state.test {
                awaitItem()
                vm.load()
                assertTrue(awaitItem() is ListOfRowsUiState.Error)
                cancelAndConsumeRemainingEvents()
            }
        }

    // ─── Delete home (RN parity: `src/app/homes/index.tsx:249`) ───

    @Test
    fun rows_without_can_delete_home_keep_the_plain_chevron() =
        runTest {
            coEvery { repo.myHomes() } returns
                NetworkResult.Success(MyHomesResponse(homes = listOf(makeHome("h1")), message = null))
            val vm = MyHomesListViewModel(repo, adminRepo)
            vm.load()
            val row = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first()
            assertEquals(RowTrailing.Chevron, row.trailing)
            assertNull(row.onSecondary)
        }

    @Test
    fun rows_with_can_delete_home_expose_a_kebab_that_asks_for_confirmation() =
        runTest {
            coEvery { repo.myHomes() } returns
                NetworkResult.Success(
                    MyHomesResponse(homes = listOf(makeHome("h1", canDeleteHome = true)), message = null),
                )
            val vm = MyHomesListViewModel(repo, adminRepo)
            vm.load()
            val row = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first()
            assertEquals(RowTrailing.Kebab, row.trailing)
            assertNotNull(row.onSecondary)
            row.onSecondary!!.invoke()
            assertEquals(MyHomesListEvent.ConfirmDelete("h1", "Main"), vm.pendingEvent.value)
        }

    @Test
    fun delete_home_calls_the_delete_route_and_refetches() =
        runTest {
            coEvery { repo.myHomes() } returns
                NetworkResult.Success(
                    MyHomesResponse(homes = listOf(makeHome("h1", canDeleteHome = true)), message = null),
                )
            coEvery { adminRepo.deleteHome("h1") } returns
                NetworkResult.Success(DeleteHomeResponse(message = "Home deleted successfully"))
            val vm = MyHomesListViewModel(repo, adminRepo)
            vm.load()
            vm.deleteHome("h1")
            coVerify { adminRepo.deleteHome("h1") }
            assertNull(vm.actionError.value)
        }

    @Test
    fun delete_home_failure_surfaces_the_server_message() =
        runTest {
            coEvery { repo.myHomes() } returns
                NetworkResult.Success(
                    MyHomesResponse(homes = listOf(makeHome("h1", canDeleteHome = true)), message = null),
                )
            coEvery { adminRepo.deleteHome("h1") } returns
                NetworkResult.Failure(NetworkError.Server(403, "Only the primary owner can delete this home."))
            val vm = MyHomesListViewModel(repo, adminRepo)
            vm.load()
            vm.deleteHome("h1")
            assertNotNull(vm.actionError.value)
            // The row survives — the delete was awaited, not optimistic.
            assertEquals(1, (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows.size)
        }

    @Test
    fun empty_state_cta_fires_onAddHome() =
        runTest {
            coEvery { repo.myHomes() } returns NetworkResult.Success(MyHomesResponse(homes = emptyList(), message = null))
            var added = false
            val vm =
                MyHomesListViewModel(repo, adminRepo).apply {
                    configureNavigation(onOpenHome = {}, onAddHome = { added = true })
                }
            vm.load()
            val empty = vm.state.value as ListOfRowsUiState.Empty
            empty.onCta?.invoke()
            assertTrue(added)
        }
}
