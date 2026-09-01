package app.pantopus.android.ui.screens.homes

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homedashboard.HomeAuditLogEntryDto
import app.pantopus.android.data.api.models.homedashboard.HomeBillTrendsDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardCountsDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardMemberDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardMemberUserDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardResponse
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardTodayDto
import app.pantopus.android.data.api.models.homedashboard.HomeHealthDimensionDto
import app.pantopus.android.data.api.models.homedashboard.HomeHealthScoreDto
import app.pantopus.android.data.api.models.homedashboard.HomePropertyValueDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistItemDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistProgressDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistSeasonDto
import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.models.homes.HomeDetail
import app.pantopus.android.data.api.models.homes.HomeDetailResponse
import app.pantopus.android.data.api.models.homes.HomePublicProfile
import app.pantopus.android.data.api.models.homes.HomePublicProfileResponse
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomeDashboardRepository
import app.pantopus.android.data.homes.HomesRepository
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

@OptIn(ExperimentalCoroutinesApi::class)
class HomeDashboardViewModelTest {
    private val repo: HomesRepository = mockk()
    private val intelligenceRepo: HomeDashboardRepository = mockk()
    private val adminRepo: HomeAdminRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        // Every Home Intelligence read defaults to "unavailable" so each
        // test only stubs what it asserts on.
        coEvery { intelligenceRepo.dashboard(any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
        // No access record by default → tiles + tabs render ungated, the
        // same fallback the VM takes on a 403 from `GET /:id/me`.
        coEvery { adminRepo.myAccess(any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
        coEvery { intelligenceRepo.healthScore(any(), any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
        coEvery { intelligenceRepo.seasonalChecklist(any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
        coEvery { intelligenceRepo.propertyValue(any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
        coEvery { intelligenceRepo.billTrends(any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(homeId: String = "h1") =
        HomeDashboardViewModel(
            repo = repo,
            intelligenceRepo = intelligenceRepo,
            adminRepo = adminRepo,
            savedStateHandle = SavedStateHandle(mapOf(HOME_DASHBOARD_HOME_ID_KEY to homeId)),
        )

    private fun detail(isOwner: Boolean = true) =
        HomeDetailResponse(
            home =
                HomeDetail(
                    id = "h1",
                    name = "Main",
                    address = "1 Main",
                    city = "X",
                    state = "CA",
                    zipcode = "90000",
                    homeType = "single_family",
                    visibility = "public",
                    description = null,
                    createdAt = null,
                    owner = null,
                    occupants = emptyList(),
                    location = null,
                    isOwner = isOwner,
                    isPendingOwner = false,
                    pendingClaimId = null,
                    isOccupant = !isOwner,
                    owners = emptyList(),
                    canDeleteHome = isOwner,
                ),
        )

    private fun public_() =
        HomePublicProfileResponse(
            home =
                HomePublicProfile(
                    id = "h1",
                    name = null,
                    address = "200 Public St",
                    city = "Y",
                    state = "CA",
                    zipcode = "90000",
                    homeType = "single_family",
                    visibility = "public",
                    description = null,
                    createdAt = "2025-01-01T00:00:00Z",
                    hasVerifiedOwner = true,
                    verifiedOwner = null,
                    userMembershipStatus = "none",
                    userResidencyClaim = null,
                    memberCount = 2,
                    nearbyGigs = 5,
                ),
        )

    private fun dashboard() =
        HomeDashboardResponse(
            today =
                HomeDashboardTodayDto(
                    tasksDue =
                        listOf(
                            HomeTaskDto(
                                id = "t1",
                                homeId = "h1",
                                taskType = "chore",
                                title = "Take out trash",
                                status = "open",
                                dueAt = "2999-01-01T00:00:00Z",
                            ),
                        ),
                    nextBill =
                        BillDto(
                            id = "b1",
                            homeId = "h1",
                            billType = "electric",
                            providerName = "ConEd",
                            amount = BigDecimal("142.80"),
                            currency = "USD",
                            dueDate = "2999-01-03T00:00:00Z",
                            status = "due",
                        ),
                    deliveriesArriving = 3,
                ),
            counts =
                HomeDashboardCountsDto(
                    tasksOpen = 5,
                    issuesOpen = 1,
                    billsDue = 2,
                    packagesExpected = 3,
                    documents = 4,
                    eventsUpcoming = 6,
                    membersActive = 2,
                    pets = 1,
                ),
            members =
                listOf(
                    HomeDashboardMemberDto(
                        userId = "u2",
                        role = "member",
                        user = HomeDashboardMemberUserDto(id = "u2", username = "maria", name = "Maria Kim"),
                    ),
                ),
            recentActivity =
                listOf(
                    HomeAuditLogEntryDto(
                        id = "a1",
                        actorUserId = "u2",
                        action = "guest_pass_created",
                        targetType = "guest_pass",
                        createdAt = "2025-01-01T00:00:00Z",
                    ),
                ),
        )

    private fun health(emergencyScore: Int = 15) =
        HomeHealthScoreDto(
            score = 62,
            breakdown =
                mapOf(
                    "maintenance" to HomeHealthDimensionDto(25, 25, emptyList()),
                    "bills" to HomeHealthDimensionDto(10, 20, listOf("ConEd bill is overdue")),
                    "seasonal" to HomeHealthDimensionDto(5, 20, listOf("3 of 4 seasonal tasks incomplete")),
                    "emergency" to HomeHealthDimensionDto(emergencyScore, 15, emptyList()),
                    "household" to HomeHealthDimensionDto(5, 10, emptyList()),
                    "documents" to HomeHealthDimensionDto(2, 10, emptyList()),
                ),
            topIssue = "3 of 4 seasonal tasks incomplete",
        )

    private fun checklist() =
        SeasonalChecklistDto(
            season = SeasonalChecklistSeasonDto(key = "fall_prep", label = "Fall prep"),
            items =
                listOf(
                    SeasonalChecklistItemDto(
                        id = "i1",
                        title = "Clean gutters before rain season",
                        gigCategory = "Cleaning",
                        status = "pending",
                        sortOrder = 1,
                    ),
                    SeasonalChecklistItemDto(
                        id = "i2",
                        title = "Inspect and service furnace",
                        gigCategory = "Handyman",
                        status = "completed",
                        sortOrder = 2,
                    ),
                ),
            progress = SeasonalChecklistProgressDto(total = 2, completed = 1, percentage = 50),
        )

    // ── Core dashboard ──────────────────────────────────────────────

    @Test
    fun hero_stats_come_from_the_dashboard_aggregate() =
        runTest {
            coEvery { repo.detail("h1") } returns NetworkResult.Success(detail())
            coEvery { intelligenceRepo.dashboard("h1") } returns NetworkResult.Success(dashboard())
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as HomeDashboardUiState.Loaded
            assertEquals("1 Main", loaded.content.address)
            assertTrue(loaded.content.verified)
            assertEquals(6, loaded.content.tabs.size)
            assertEquals(listOf("Packages", "Bills", "Tasks"), loaded.content.stats.map { it.label })
            assertEquals(listOf("3", "2", "5"), loaded.content.stats.map { it.value })
        }

    @Test
    fun quick_action_badges_come_from_counts() =
        runTest {
            coEvery { repo.detail("h1") } returns NetworkResult.Success(detail())
            coEvery { intelligenceRepo.dashboard("h1") } returns NetworkResult.Success(dashboard())
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as HomeDashboardUiState.Loaded

            fun badge(id: String) = loaded.content.quickActions.firstOrNull { it.id == id }?.badge
            assertEquals("5", badge("view_tasks"))
            assertEquals("2", badge("view_bills"))
            assertEquals("3", badge("view_packages"))
        }

    @Test
    fun overview_is_built_from_the_aggregate_not_fixtures() =
        runTest {
            coEvery { repo.detail("h1") } returns NetworkResult.Success(detail())
            coEvery { intelligenceRepo.dashboard("h1") } returns NetworkResult.Success(dashboard())
            coEvery { intelligenceRepo.healthScore("h1", any()) } returns NetworkResult.Success(health())
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as HomeDashboardUiState.Loaded
            val titles = loaded.content.overview.upcoming.map { it.title }
            assertEquals("ConEd bill due", titles.first())
            assertTrue(titles.contains("Take out trash"))
            assertTrue(titles.contains("3 packages on the way"))
            assertTrue(titles.none { it == "Amazon - waiting pickup" })

            assertEquals(1, loaded.content.overview.activity.size)
            assertEquals("Maria Kim: Guest pass created", loaded.content.overview.activity.first().title)
            assertEquals("MK", loaded.content.overview.activity.first().initials)

            // emergency dimension scored 15/15 → configured
            assertTrue(loaded.content.overview.emergency.isConfigured)
        }

    @Test
    fun missing_emergency_contacts_flip_the_emergency_row_to_unconfigured() =
        runTest {
            coEvery { repo.detail("h1") } returns NetworkResult.Success(detail())
            coEvery { intelligenceRepo.dashboard("h1") } returns NetworkResult.Success(dashboard())
            coEvery {
                intelligenceRepo.healthScore("h1", any())
            } returns NetworkResult.Success(health(emergencyScore = 0))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as HomeDashboardUiState.Loaded
            assertTrue(!loaded.content.overview.emergency.isConfigured)
        }

    @Test
    fun forbidden_falls_back_to_public_profile() =
        runTest {
            coEvery { repo.detail("h1") } returns NetworkResult.Failure(NetworkError.Forbidden)
            coEvery { repo.publicProfile("h1") } returns NetworkResult.Success(public_())
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as HomeDashboardUiState.Loaded
            assertEquals("200 Public St", loaded.content.address)
            assertTrue(loaded.content.verified)
            // No dashboard access → zeroed hero stats, never fixtures.
            assertEquals(listOf("0", "0", "0"), loaded.content.stats.map { it.value })
        }

    @Test
    fun server_error_surfaces_error() =
        runTest {
            coEvery { repo.detail("h1") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is HomeDashboardUiState.Error)
        }

    @Test
    fun tab_selection_updates_state_flow() =
        runTest {
            coEvery { repo.detail("h1") } returns NetworkResult.Success(detail())
            val vm = makeVm()
            vm.load()
            vm.selectTab("members")
            assertEquals("members", vm.selectedTab.value)
        }

    // ── Home Intelligence ───────────────────────────────────────────

    @Test
    fun intelligence_cards_load_independently() =
        runTest {
            coEvery { repo.detail("h1") } returns NetworkResult.Success(detail())
            coEvery { intelligenceRepo.dashboard("h1") } returns NetworkResult.Success(dashboard())
            coEvery {
                intelligenceRepo.healthScore("h1", any())
            } returns NetworkResult.Failure(NetworkError.Server(500, null))
            coEvery { intelligenceRepo.seasonalChecklist("h1") } returns NetworkResult.Success(checklist())
            coEvery {
                intelligenceRepo.propertyValue("h1")
            } returns NetworkResult.Success(HomePropertyValueDto(estimatedValue = 812_000.0))
            coEvery {
                intelligenceRepo.billTrends("h1")
            } returns NetworkResult.Success(HomeBillTrendsDto())

            val vm = makeVm()
            vm.load()

            // A failed health score must not blank the screen.
            assertTrue(vm.state.value is HomeDashboardUiState.Loaded)
            assertTrue(vm.healthScore.value is HomeIntelligenceCardState.Failed)
            assertEquals(2, vm.checklist.value.valueOrNull()?.items?.size)
            assertEquals(812_000.0, vm.propertyValue.value.valueOrNull()?.estimatedValue ?: 0.0, 0.001)
            assertTrue(vm.billTrends.value is HomeIntelligenceCardState.Loaded)
        }

    @Test
    fun bill_trends_without_finance_permission_is_forbidden_not_an_error() =
        runTest {
            coEvery { repo.detail("h1") } returns NetworkResult.Success(detail())
            coEvery { intelligenceRepo.dashboard("h1") } returns NetworkResult.Success(dashboard())
            val vm = makeVm()
            vm.load()
            assertTrue(vm.billTrends.value is HomeIntelligenceCardState.Forbidden)
        }

    @Test
    fun complete_checklist_item_reflects_the_server_returned_row() =
        runTest {
            coEvery { repo.detail("h1") } returns NetworkResult.Success(detail())
            coEvery { intelligenceRepo.dashboard("h1") } returns NetworkResult.Success(dashboard())
            coEvery { intelligenceRepo.seasonalChecklist("h1") } returns NetworkResult.Success(checklist())
            coEvery { intelligenceRepo.healthScore("h1", any()) } returns NetworkResult.Success(health())
            coEvery {
                intelligenceRepo.updateSeasonalChecklistItem("h1", "i1", "completed")
            } returns
                NetworkResult.Success(
                    SeasonalChecklistItemDto(
                        id = "i1",
                        title = "Clean gutters before rain season",
                        gigCategory = "Cleaning",
                        status = "completed",
                        completedAt = "2026-02-01T00:00:00Z",
                        sortOrder = 1,
                    ),
                )

            val vm = makeVm()
            vm.load()
            assertEquals("pending", vm.checklist.value.valueOrNull()?.items?.first()?.status)

            vm.completeChecklistItem("i1")

            assertEquals("completed", vm.checklist.value.valueOrNull()?.items?.first()?.status)
            assertEquals(2, vm.checklist.value.valueOrNull()?.progress?.completed)
            assertEquals(100, vm.checklist.value.valueOrNull()?.progress?.percentage)
            assertTrue(vm.pendingChecklistItemIds.value.isEmpty())
            coVerify { intelligenceRepo.updateSeasonalChecklistItem("h1", "i1", "completed") }
        }

    @Test
    fun skip_checklist_item_sends_skipped_status() =
        runTest {
            coEvery { repo.detail("h1") } returns NetworkResult.Success(detail())
            coEvery { intelligenceRepo.dashboard("h1") } returns NetworkResult.Success(dashboard())
            coEvery { intelligenceRepo.seasonalChecklist("h1") } returns NetworkResult.Success(checklist())
            coEvery { intelligenceRepo.healthScore("h1", any()) } returns NetworkResult.Success(health())
            coEvery {
                intelligenceRepo.updateSeasonalChecklistItem("h1", "i1", "skipped")
            } returns
                NetworkResult.Success(
                    SeasonalChecklistItemDto(
                        id = "i1",
                        title = "Clean gutters before rain season",
                        gigCategory = "Cleaning",
                        status = "skipped",
                        completedAt = "2026-02-01T00:00:00Z",
                        sortOrder = 1,
                    ),
                )

            val vm = makeVm()
            vm.load()
            vm.skipChecklistItem("i1")

            assertEquals("skipped", vm.checklist.value.valueOrNull()?.items?.first()?.status)
            coVerify { intelligenceRepo.updateSeasonalChecklistItem("h1", "i1", "skipped") }
        }

    @Test
    fun top_action_route_maps_to_a_dashboard_action_id() {
        assertEquals("view_maintenance", healthActionId("/homes/h1/maintenance"))
        assertEquals("view_bills", healthActionId("/homes/h1/bills"))
        assertEquals("view_emergency", healthActionId("/homes/h1/emergency"))
        assertEquals("add_member", healthActionId("/homes/h1/members"))
        assertEquals("view_docs", healthActionId("/homes/h1/documents"))
        assertNull(healthActionId("/homes/h1/dashboard"))
    }

    // ── Sample-id shortcuts (QA fixtures, not live data) ─────────────

    @Test
    fun brand_new_sample_renders_empty_state() =
        runTest {
            val vm = makeVm(HomeDashboardSampleData.EMPTY_HOME_ID)
            vm.load()
            val empty = vm.state.value as HomeDashboardUiState.Empty
            assertEquals(
                listOf("Add members", "Set access codes", "Log emergency info"),
                empty.brandNew.onboardingSteps.map { it.title },
            )
            assertEquals(listOf("0", "0", "0"), empty.brandNew.content.stats.map { it.value })
        }

    @Test
    fun needs_attention_sample_renders_attention_state() =
        runTest {
            val vm = makeVm(HomeDashboardSampleData.NEEDS_ATTENTION_HOME_ID)
            vm.load()
            val needsAttention = vm.state.value as HomeDashboardUiState.NeedsAttention
            assertEquals(
                "3 items need attention: 1 overdue bill, 2 maintenance items past due, 1 pending claim",
                needsAttention.content.attentionSummary?.message,
            )
            assertEquals(
                listOf("view_bills", "view_maintenance", "view_claims"),
                needsAttention.content.attentionSummary?.chips?.map { it.actionId },
            )
        }
}
