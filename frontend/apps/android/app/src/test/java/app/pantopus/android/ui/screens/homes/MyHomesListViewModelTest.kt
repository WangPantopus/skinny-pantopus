package app.pantopus.android.ui.screens.homes

import app.pantopus.android.data.api.models.homes.DeleteHomeResponse
import app.pantopus.android.data.api.models.homes.HomeOccupancy
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyPage
import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomeResidencyProgressRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
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
    private val residencyRepo: HomeResidencyProgressRepository = mockk()

    private val sessions: HomeClaimSessionScopeFactory = mockk()
    private val session: HomeClaimSessionScope = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { sessions.create(any()) } returns session
        every { session.isCurrent } returns true
        every { session.invalidated } returns MutableStateFlow(false)
        coEvery { session.requireCurrent() } just Runs
        coEvery { residencyRepo.requests(null) } returns NetworkResult.Success(PersonalHomeResidencyPage(emptyList(), null))
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
        canDeleteHome: Boolean? = false,
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
        accessKind = "shared", hasHomeAccess = true, roleBase = roleBase ?: "owner",
    )

    @Test
    fun happy_path_emits_loaded_rows_with_role_chip_and_banner() =
        runTest {
            coEvery { repo.myHomes() } returns
                NetworkResult.Success(
                    MyHomesResponse(
                        homes =
                            listOf(
                                makeHome(
                                    "00000000-0000-4000-8000-000000000001",
                                    name = "Birch Lane", city = "Elm Park", ownership = "verified", isPrimary = true,
                                ),
                                makeHome(
                                    "00000000-0000-4000-8000-000000000002",
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
            val vm = MyHomesListViewModel(repo, adminRepo, sessions, residencyRepo)
            vm.load()
            val loaded = vm.state.value as ListOfRowsUiState.Loaded
            val rows = loaded.sections.first().rows
            assertEquals(2, rows.size)
            // Ownership is explicit; this owner fixture has no residency row.
            assertEquals("Birch Lane", rows[0].title)
            assertEquals("Owner role · Elm Park, CA", rows[0].subtitle)
            val chips = rows[0].chips
            assertNotNull(chips)
            assertEquals("Ownership verified", chips!!.first().text)
            assertTrue(chips.first().tint is RowChip.Tint.Status)
            assertTrue(rows[0].leading is RowLeading.TypeIcon)
            assertEquals("1 Main", rows[1].title)
            assertEquals("Tenant · Sellwood, CA", rows[1].subtitle)
            assertEquals(listOf("Residency verified"), rows[1].chips?.map { it.text })
            assertTrue(rows[1].leading is RowLeading.TypeIcon)
            // Banner shows count + home tint when populated.
            val banner = vm.banner.value
            assertNotNull(banner)
            assertEquals("2 saved Homes", banner!!.title)
            assertEquals(BannerCtaTint.Home, banner.tint)
        }

    @Test
    fun empty_response_surfaces_empty_state_and_clears_banner() =
        runTest {
            coEvery { repo.myHomes() } returns NetworkResult.Success(MyHomesResponse(homes = emptyList(), message = null))
            val vm = MyHomesListViewModel(repo, adminRepo, sessions, residencyRepo)
            vm.load()
            val empty = vm.state.value as ListOfRowsUiState.Empty
            assertEquals("No saved Homes yet", empty.headline)
            assertEquals("Add a home", empty.ctaTitle)
            assertNull(vm.banner.value)
        }

    @Test
    fun both_failed_reads_surface_error_state() =
        runTest {
            coEvery { repo.myHomes() } returns NetworkResult.Failure(NetworkError.NotFound)
            coEvery { residencyRepo.requests(null) } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = MyHomesListViewModel(repo, adminRepo, sessions, residencyRepo)
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    private fun request(
        id: String,
        home: String? = null,
    ) = PersonalHomeResidencyRequest(
        id,
        home,
        "12 Example St, 301",
        "household",
        "verified",
        null,
        "2026-09-12T00:00:00Z",
        null,
    )

    @Test
    fun personal_history_survives_failed_home_read_and_retired_navigation_is_inert() =
        runTest {
            val home = "00000000-0000-4000-8000-000000000002"
            val claim = request("00000000-0000-4000-8000-000000000003", home)
            coEvery { repo.myHomes() } returns NetworkResult.Failure(NetworkError.NotFound)
            coEvery { residencyRepo.requests(null) } returns NetworkResult.Success(PersonalHomeResidencyPage(listOf(claim), null))
            val opened = mutableListOf<String>()
            val vm = MyHomesListViewModel(repo, adminRepo, sessions, residencyRepo)
            vm.configureNavigation({}, {}, onVerifyResidency = { opened.add(it) })
            vm.load()
            val rows = (vm.state.value as ListOfRowsUiState.Loaded).sections.flatMap { it.rows }
            assertTrue(rows.any { it.id == "homes-retry" })
            val history = rows.single { it.id == "residency-request_${claim.id}" }
            assertEquals("Review recorded", history.subtitle)
            history.onTap()
            assertEquals(listOf(home), opened)
            vm.suspendContent()
            history.onTap()
            assertEquals(listOf(home), opened)
        }

    @Test
    fun failed_next_history_page_preserves_rows_and_explicit_retry_finishes() =
        runTest {
            val first = request("00000000-0000-4000-8000-000000000010")
            val second = request("00000000-0000-4000-8000-000000000011")
            coEvery { repo.myHomes() } returns NetworkResult.Success(MyHomesResponse(emptyList(), null))
            coEvery { residencyRepo.requests(null) } returns NetworkResult.Success(PersonalHomeResidencyPage(listOf(first), first.id))
            coEvery { residencyRepo.requests(first.id) } returns NetworkResult.Failure(NetworkError.NotFound)
            val vm = MyHomesListViewModel(repo, adminRepo, sessions, residencyRepo)
            vm.load()
            vm.loadMoreRequests()
            val failed = (vm.state.value as ListOfRowsUiState.Loaded).sections.flatMap { it.rows }
            assertTrue(failed.any { it.id == "residency-request_${first.id}" })
            assertTrue(failed.any { it.id == "residency-retry" })
            coEvery { residencyRepo.requests(first.id) } returns NetworkResult.Success(PersonalHomeResidencyPage(listOf(second), null))
            vm.loadMoreRequests()
            val recovered = (vm.state.value as ListOfRowsUiState.Loaded).sections.flatMap { it.rows }
            assertEquals(listOf("residency-request_${first.id}", "residency-request_${second.id}"), recovered.map { it.id })
            coVerify(exactly = 2) { residencyRepo.requests(first.id) }
        }

    // ─── Delete home (RN parity: `src/app/homes/index.tsx:249`) ───

    @Test
    fun rows_without_can_delete_home_keep_the_plain_chevron() =
        runTest {
            coEvery { repo.myHomes() } returns
                NetworkResult.Success(MyHomesResponse(homes = listOf(makeHome("00000000-0000-4000-8000-000000000001")), message = null))
            val vm = MyHomesListViewModel(repo, adminRepo, sessions, residencyRepo)
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
                    MyHomesResponse(homes = listOf(makeHome("00000000-0000-4000-8000-000000000001", canDeleteHome = true)), message = null),
                )
            val vm = MyHomesListViewModel(repo, adminRepo, sessions, residencyRepo)
            vm.load()
            val row = (vm.state.value as ListOfRowsUiState.Loaded).sections.first().rows.first()
            assertEquals(RowTrailing.Kebab, row.trailing)
            assertNotNull(row.onSecondary)
            row.onSecondary!!.invoke()
            assertEquals(MyHomesListEvent.ConfirmDelete("00000000-0000-4000-8000-000000000001", "Main"), vm.pendingEvent.value)
        }

    @Test
    fun delete_home_calls_the_delete_route_and_refetches() =
        runTest {
            coEvery { repo.myHomes() } returns
                NetworkResult.Success(
                    MyHomesResponse(homes = listOf(makeHome("00000000-0000-4000-8000-000000000001", canDeleteHome = true)), message = null),
                )
            coEvery { adminRepo.deleteHome("00000000-0000-4000-8000-000000000001") } returns
                NetworkResult.Success(DeleteHomeResponse(message = "Home deleted successfully"))
            val vm = MyHomesListViewModel(repo, adminRepo, sessions, residencyRepo)
            vm.load()
            vm.deleteHome("00000000-0000-4000-8000-000000000001")
            coVerify { adminRepo.deleteHome("00000000-0000-4000-8000-000000000001") }
            assertNull(vm.actionError.value)
        }

    @Test
    fun delete_home_failure_surfaces_the_server_message() =
        runTest {
            coEvery { repo.myHomes() } returns
                NetworkResult.Success(
                    MyHomesResponse(homes = listOf(makeHome("00000000-0000-4000-8000-000000000001", canDeleteHome = true)), message = null),
                )
            coEvery { adminRepo.deleteHome("00000000-0000-4000-8000-000000000001") } returns
                NetworkResult.Failure(NetworkError.Server(403, "Only the primary owner can delete this home."))
            val vm = MyHomesListViewModel(repo, adminRepo, sessions, residencyRepo)
            vm.load()
            vm.deleteHome("00000000-0000-4000-8000-000000000001")
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
                MyHomesListViewModel(repo, adminRepo, sessions, residencyRepo).apply {
                    configureNavigation(onOpenHome = {}, onAddHome = { added = true })
                }
            vm.load()
            val empty = vm.state.value as ListOfRowsUiState.Empty
            empty.onCta?.invoke()
            assertTrue(added)
        }
}
