package app.pantopus.android.ui.screens.hub

import android.content.SharedPreferences
import app.pantopus.android.data.api.models.gigs.RebookableGigsResponse
import app.pantopus.android.data.api.models.hub.DiscoveryItem
import app.pantopus.android.data.api.models.hub.HubAvailability
import app.pantopus.android.data.api.models.hub.HubCards
import app.pantopus.android.data.api.models.hub.HubContext
import app.pantopus.android.data.api.models.hub.HubDiscoveryResponse
import app.pantopus.android.data.api.models.hub.HubHomeCard
import app.pantopus.android.data.api.models.hub.HubHomeSummary
import app.pantopus.android.data.api.models.hub.HubPersonalCard
import app.pantopus.android.data.api.models.hub.HubResponse
import app.pantopus.android.data.api.models.hub.HubSetup
import app.pantopus.android.data.api.models.hub.HubTodayResponse
import app.pantopus.android.data.api.models.hub.HubUser
import app.pantopus.android.data.api.models.notifications.NotificationUnreadCountResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigExtrasRepository
import app.pantopus.android.data.hub.HubRepository
import app.pantopus.android.data.notifications.NotificationsRepository
import io.mockk.coEvery
import io.mockk.every
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
class HubViewModelTest {
    private val repo: HubRepository = mockk()
    private val prefs: SharedPreferences =
        mockk(relaxed = true) {
            every { getBoolean(any(), any()) } returns false
        }

    // S5 — the Hub reads `byContext.audience` for the Beacon megaphone.
    private val notificationsRepo: NotificationsRepository = mockk()

    // "Jump back in" prepends up to two rebookable-helper cards.
    private val gigExtrasRepo: GigExtrasRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { notificationsRepo.unreadCount() } returns
            NetworkResult.Success(NotificationUnreadCountResponse(count = 0, byContext = null))
        coEvery { gigExtrasRepo.rebookable() } returns
            NetworkResult.Success(RebookableGigsResponse(rebookable = emptyList()))
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeHub(
        allDone: Boolean = true,
        score: Double = 0.9,
        homeCount: Int = 1,
    ): HubResponse =
        HubResponse(
            user = HubUser(id = "u", name = "Alice Doe", firstName = "Alice", username = "alice", avatarUrl = null, email = "a@b.co"),
            context = HubContext(activeHomeId = "h1", activePersona = HubContext.ActivePersona("personal")),
            availability = HubAvailability(hasHome = homeCount > 0, hasBusiness = false, hasPayoutMethod = false),
            homes =
                if (homeCount > 0) {
                    listOf(
                        HubHomeSummary(
                            id = "h1",
                            name = "Main",
                            addressShort = "1 Main",
                            city = "X",
                            state = "CA",
                            latitude = null,
                            longitude = null,
                            isPrimary = true,
                            roleBase = "owner",
                        ),
                    )
                } else {
                    emptyList()
                },
            businesses = emptyList(),
            setup =
                HubSetup(
                    steps = listOf(HubSetup.Step(key = "verify_home", done = allDone)),
                    allDone = allDone,
                    profileCompleteness =
                        HubSetup.ProfileCompleteness(
                            score = score,
                            checks =
                                HubSetup.ProfileCompleteness.Checks(
                                    firstName = true,
                                    lastName = true,
                                    photo = true,
                                    bio = true,
                                    skills = true,
                                ),
                            missingFields = emptyList(),
                        ),
                ),
            statusItems = emptyList(),
            cards =
                HubCards(
                    personal =
                        HubPersonalCard(
                            unreadChats = 2,
                            earnings = 0.0,
                            gigsNearby = 3,
                            rating = 0.0,
                            reviewCount = 0,
                        ),
                    home = HubHomeCard(newMail = 1, billsDue = emptyList(), tasksDue = emptyList(), memberCount = 1),
                    business = null,
                ),
            jumpBackIn = emptyList(),
            activity = emptyList(),
            neighborDensity = null,
        )

    @Test
    fun skeleton_to_populated() =
        runTest {
            coEvery { repo.overview() } returns NetworkResult.Success(makeHub())
            coEvery { repo.today() } returns NetworkResult.Success(HubTodayResponse(today = null, error = null))
            coEvery { repo.discovery(any(), any()) } returns
                NetworkResult.Success(HubDiscoveryResponse(items = emptyList()))

            val vm = HubViewModel(repo, prefs, notificationsRepo, gigExtrasRepo)
            assertTrue(vm.state.value is HubUiState.Skeleton)
            vm.load()
            val populated = vm.state.value as HubUiState.Populated
            assertEquals("Alice", populated.content.topBar.name)
            assertEquals(4, populated.content.pillars.size)
        }

    @Test
    fun skeleton_to_firstRun() =
        runTest {
            coEvery { repo.overview() } returns
                NetworkResult.Success(makeHub(allDone = false, score = 0.2, homeCount = 0))
            coEvery { repo.today() } returns NetworkResult.Success(HubTodayResponse(today = null, error = null))
            coEvery { repo.discovery(any(), any()) } returns
                NetworkResult.Success(HubDiscoveryResponse(items = emptyList()))

            val vm = HubViewModel(repo, prefs, notificationsRepo, gigExtrasRepo)
            vm.load()
            val first = vm.state.value as HubUiState.FirstRun
            assertEquals(0.2f, first.content.profileCompleteness, 0.001f)
        }

    @Test
    fun error_then_retry() =
        runTest {
            coEvery { repo.overview() } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.Server(code = 503, body = null)),
                    NetworkResult.Success(makeHub()),
                )
            coEvery { repo.today() } returns NetworkResult.Success(HubTodayResponse(today = null, error = null))
            coEvery { repo.discovery(any(), any()) } returns
                NetworkResult.Success(HubDiscoveryResponse(items = emptyList()))

            val vm = HubViewModel(repo, prefs, notificationsRepo, gigExtrasRepo)
            vm.load()
            assertTrue(vm.state.value is HubUiState.Error)
            vm.refresh()
            assertTrue(vm.state.value is HubUiState.Populated)
        }

    @Test
    fun setup_banner_shows_then_dismisses() =
        runTest {
            coEvery { repo.overview() } returns NetworkResult.Success(makeHub(allDone = false, score = 0.9, homeCount = 1))
            coEvery { repo.today() } returns NetworkResult.Success(HubTodayResponse(today = null, error = null))
            coEvery { repo.discovery(any(), any()) } returns
                NetworkResult.Success(HubDiscoveryResponse(items = emptyList()))

            val vm = HubViewModel(repo, prefs, notificationsRepo, gigExtrasRepo)
            vm.load()
            val firstContent = (vm.state.value as HubUiState.Populated).content
            assertNotNull(firstContent.setupBanner)

            vm.dismissSetupBanner()
            val afterDismiss = (vm.state.value as HubUiState.Populated).content
            assertNull(afterDismiss.setupBanner)
        }

    @Test
    fun discovery_items_flow_through() =
        runTest {
            coEvery { repo.overview() } returns NetworkResult.Success(makeHub())
            coEvery { repo.today() } returns NetworkResult.Success(HubTodayResponse(today = null, error = null))
            coEvery { repo.discovery(any(), any()) } returns
                NetworkResult.Success(
                    HubDiscoveryResponse(
                        items =
                            listOf(
                                DiscoveryItem(
                                    id = "g1",
                                    type = "gig",
                                    title = "Mow lawn",
                                    meta = "\$40",
                                    category = "Yardwork",
                                    avatarUrl = null,
                                    route = "/g/g1",
                                ),
                            ),
                    ),
                )
            val vm = HubViewModel(repo, prefs, notificationsRepo, gigExtrasRepo)
            vm.load()
            val populated = vm.state.value as HubUiState.Populated
            assertEquals(1, populated.content.discovery.size)
            assertEquals(
                "Mow lawn",
                populated.content.discovery
                    .first()
                    .title,
            )
        }
}
