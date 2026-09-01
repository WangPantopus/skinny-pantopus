@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.recent_activity

import app.pantopus.android.data.api.models.hub.HubActivityItem
import app.pantopus.android.data.api.models.hub.HubAvailability
import app.pantopus.android.data.api.models.hub.HubCards
import app.pantopus.android.data.api.models.hub.HubContext
import app.pantopus.android.data.api.models.hub.HubHomeCard
import app.pantopus.android.data.api.models.hub.HubPersonalCard
import app.pantopus.android.data.api.models.hub.HubResponse
import app.pantopus.android.data.api.models.hub.HubSetup
import app.pantopus.android.data.api.models.hub.HubUser
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.hub.HubRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.theme.PantopusIcon
import io.mockk.coEvery
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
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class RecentActivityViewModelTest {
    private val repo: HubRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun activity(
        id: String,
        title: String = "Title $id",
        route: String = "/posts/p_$id",
        read: Boolean = false,
    ) = HubActivityItem(
        id = id,
        pillar = "personal",
        title = title,
        at = "2026-05-15T10:00:00Z",
        read = read,
        route = route,
    )

    private fun hub(items: List<HubActivityItem>): HubResponse =
        HubResponse(
            user =
                HubUser(
                    id = "u",
                    name = "Alice",
                    firstName = "Alice",
                    username = "alice",
                    avatarUrl = null,
                    email = "a@b.co",
                ),
            context = HubContext(activeHomeId = "h1", activePersona = HubContext.ActivePersona("personal")),
            availability = HubAvailability(hasHome = true, hasBusiness = false, hasPayoutMethod = false),
            homes = emptyList(),
            businesses = emptyList(),
            setup =
                HubSetup(
                    steps = emptyList(),
                    allDone = true,
                    profileCompleteness =
                        HubSetup.ProfileCompleteness(
                            score = 0.9,
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
                            unreadChats = 0,
                            earnings = 0.0,
                            gigsNearby = 0,
                            rating = 0.0,
                            reviewCount = 0,
                        ),
                    home = HubHomeCard(newMail = 0, billsDue = emptyList(), tasksDue = emptyList(), memberCount = 1),
                    business = null,
                ),
            jumpBackIn = emptyList(),
            activity = items,
            neighborDensity = null,
        )

    @Test
    fun load_populated_renders_row_per_activity_item() =
        runTest {
            coEvery { repo.overview() } returns
                NetworkResult.Success(
                    hub(
                        listOf(
                            activity("1", route = "/gigs/g_1"),
                            activity("2", route = "/listings/l_1"),
                            activity("3", route = "/app/homes/h_1/dashboard"),
                        ),
                    ),
                )
            val vm = RecentActivityViewModel(repo)
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Loaded, got $state", state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(false, loaded.hasMore)
            assertEquals(3, loaded.sections.first().rows.size)
        }

    @Test
    fun load_empty_shows_designed_empty_state() =
        runTest {
            coEvery { repo.overview() } returns NetworkResult.Success(hub(emptyList()))
            val vm = RecentActivityViewModel(repo)
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Empty, got $state", state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals(PantopusIcon.Bell, empty.icon)
            assertEquals("No activity yet", empty.headline)
        }

    @Test
    fun load_failure_transitions_to_error() =
        runTest {
            coEvery { repo.overview() } returns NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = RecentActivityViewModel(repo)
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Error, got $state", state is ListOfRowsUiState.Error)
        }

    @Test
    fun destination_for_each_route_kind() {
        assertEquals(
            RecentActivityDestination.GigDetail("g_42"),
            RecentActivityViewModel.destinationFor(activity("a", route = "/gigs/g_42")),
        )
        assertEquals(
            RecentActivityDestination.ListingDetail("l_7"),
            RecentActivityViewModel.destinationFor(activity("a", route = "/listings/l_7")),
        )
        assertEquals(
            RecentActivityDestination.MailItemDetail("m_9"),
            RecentActivityViewModel.destinationFor(
                activity("a", route = "/app/mailbox/item/m_9"),
            ),
        )
        assertEquals(
            RecentActivityDestination.PulsePost("p_1"),
            RecentActivityViewModel.destinationFor(activity("a", route = "/posts/p_1")),
        )
        assertEquals(
            RecentActivityDestination.HomeDashboard("h_3"),
            RecentActivityViewModel.destinationFor(
                activity("a", route = "/app/homes/h_3/dashboard"),
            ),
        )
        assertEquals(
            RecentActivityDestination.Placeholder("Title a"),
            RecentActivityViewModel.destinationFor(
                activity("a", title = "Title a", route = "/app/notifications"),
            ),
        )
    }

    @Test
    fun row_marks_unread_rows() {
        val row =
            RecentActivityViewModel.row(
                item = activity("a", route = "/posts/p_1", read = false),
                now = Instant.parse("2026-05-15T10:30:00Z"),
                onSelect = {},
            )
        assertEquals(RowHighlight.Unread, row.highlight)
    }

    @Test
    fun row_skips_highlight_for_read_rows() {
        val row =
            RecentActivityViewModel.row(
                item = activity("a", route = "/posts/p_1", read = true),
                now = Instant.parse("2026-05-15T10:30:00Z"),
                onSelect = {},
            )
        assertNull(row.highlight)
    }
}
