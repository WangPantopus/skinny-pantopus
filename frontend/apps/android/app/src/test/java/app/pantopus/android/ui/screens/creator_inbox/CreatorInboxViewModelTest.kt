@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.creator_inbox

import app.pantopus.android.data.api.models.audience.FanTierBadgeDto
import app.pantopus.android.data.api.models.audience.PersonaMeResponse
import app.pantopus.android.data.api.models.audience.PersonaSummaryDto
import app.pantopus.android.data.api.models.audience.PersonaThreadDto
import app.pantopus.android.data.api.models.audience.PersonaThreadsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.audience.AudienceProfileRepository
import app.pantopus.android.data.personadm.PersonaDmRepository
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Mirrors [CreatorInboxViewModelTests] (iOS): load → loaded / empty /
 * error, filter chip counts derive from the loaded thread list,
 * selecting a filter narrows the visible rows, and a row routes into the
 * persona-DM thread by thread id (never by a user id — the DM serializer
 * emits none).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class CreatorInboxViewModelTest {
    private val repository: AudienceProfileRepository = mockk()
    private val dmRepository: PersonaDmRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun fullPersona(): PersonaSummaryDto =
        PersonaSummaryDto(
            id = "p_demo",
            handle = "mariak",
            displayName = "Maria K.",
            audienceLabel = "followers",
            followerCount = 24,
        )

    private fun sampleThreads(): List<PersonaThreadDto> =
        listOf(
            PersonaThreadDto(
                id = "th_gold",
                fanHandle = "derek_tan",
                fanDisplayName = "Derek Tan",
                tier = FanTierBadgeDto(rank = 4, name = "Gold"),
                lastMessagePreview = "Could I commission a custom loaf?",
                lastMessageAt = "2026-05-15T10:00:00Z",
                unreadCount = 2,
                flagged = false,
                verifiedLocal = true,
                counterpartyUserId = "u_derek",
            ),
            PersonaThreadDto(
                id = "th_silver",
                fanHandle = "lenapap",
                fanDisplayName = "Lena P.",
                tier = FanTierBadgeDto(rank = 3, name = "Silver"),
                lastMessagePreview = "Question on step 4",
                lastMessageAt = "2026-05-15T09:30:00Z",
                unreadCount = 1,
                flagged = false,
                verifiedLocal = true,
                counterpartyUserId = "u_lena",
            ),
            PersonaThreadDto(
                id = "th_bronze_unread",
                fanHandle = "ravidesai",
                fanDisplayName = "Ravi Desai",
                tier = FanTierBadgeDto(rank = 2, name = "Bronze"),
                lastMessagePreview = "Voice message 0:42",
                lastMessageAt = "2026-05-15T08:30:00Z",
                unreadCount = 3,
                flagged = false,
                verifiedLocal = false,
                counterpartyUserId = "u_ravi",
            ),
            PersonaThreadDto(
                id = "th_flagged",
                fanHandle = "marcok",
                fanDisplayName = "Marco K.",
                tier = FanTierBadgeDto(rank = 2, name = "Bronze"),
                lastMessagePreview = "Heads up — impersonation report",
                lastMessageAt = "2026-05-14T12:00:00Z",
                unreadCount = 0,
                flagged = true,
                verifiedLocal = true,
                counterpartyUserId = "u_marco",
            ),
            PersonaThreadDto(
                id = "th_free",
                fanHandle = "junie_l",
                fanDisplayName = "Junie L.",
                tier = FanTierBadgeDto(rank = 1, name = "Free"),
                lastMessagePreview = "Following from the market!",
                lastMessageAt = "2026-05-12T15:00:00Z",
                unreadCount = 0,
                flagged = false,
                verifiedLocal = false,
                counterpartyUserId = "u_junie",
            ),
        )

    private fun stubLoaded() {
        coEvery { repository.me() } returns
            NetworkResult.Success(PersonaMeResponse(persona = fullPersona(), channel = null))
        coEvery { dmRepository.threads("p_demo") } returns
            NetworkResult.Success(PersonaThreadsResponse(threads = sampleThreads()))
    }

    @Test fun load_projectsThreadsAndChipCounts() =
        runTest {
            stubLoaded()
            val vm = CreatorInboxViewModel(repository, dmRepository)
            vm.load()
            val state = vm.state.value as CreatorInboxUiState.Loaded
            assertEquals("@mariak", state.content.header.handle)
            assertEquals(5, state.content.rows.size)
            assertEquals(5, state.content.counts.total)
            assertEquals(3, state.content.counts.unread)
            assertEquals(1, state.content.counts.flagged)
            // Chips: All=5, Unread=3, Bronze+=4, Flagged=1
            assertEquals(5, state.content.chips.first { it.filter == CreatorInboxFilter.All }.count)
            assertEquals(3, state.content.chips.first { it.filter == CreatorInboxFilter.Unread }.count)
            assertEquals(4, state.content.chips.first { it.filter == CreatorInboxFilter.BronzePlus }.count)
            assertEquals(1, state.content.chips.first { it.filter == CreatorInboxFilter.Flagged }.count)
        }

    @Test fun filterUnread_narrowsRows() =
        runTest {
            stubLoaded()
            val vm = CreatorInboxViewModel(repository, dmRepository)
            vm.load()
            vm.selectFilter(CreatorInboxFilter.Unread)
            val state = vm.state.value as CreatorInboxUiState.Loaded
            assertEquals(3, state.content.rows.size)
            assertTrue(state.content.rows.all { it.unread })
        }

    @Test fun filterBronzePlus_excludesFreeTier() =
        runTest {
            stubLoaded()
            val vm = CreatorInboxViewModel(repository, dmRepository)
            vm.load()
            vm.selectFilter(CreatorInboxFilter.BronzePlus)
            val state = vm.state.value as CreatorInboxUiState.Loaded
            assertEquals(4, state.content.rows.size)
            assertFalse(state.content.rows.any { it.tierRank == 1 })
        }

    @Test fun filterFlagged_isolatesFlaggedRow() =
        runTest {
            stubLoaded()
            val vm = CreatorInboxViewModel(repository, dmRepository)
            vm.load()
            vm.selectFilter(CreatorInboxFilter.Flagged)
            val state = vm.state.value as CreatorInboxUiState.Loaded
            assertEquals(1, state.content.rows.size)
            assertEquals("th_flagged", state.content.rows.first().id)
            assertTrue(state.content.rows.first().flagged)
        }

    @Test fun emptyPersona_transitionsToEmpty() =
        runTest {
            coEvery { repository.me() } returns
                NetworkResult.Success(PersonaMeResponse(persona = null, channel = null))
            val vm = CreatorInboxViewModel(repository, dmRepository)
            vm.load()
            val state = vm.state.value as CreatorInboxUiState.Empty
            assertNull(state.header.handle)
        }

    @Test fun emptyThreadList_transitionsToEmpty() =
        runTest {
            coEvery { repository.me() } returns
                NetworkResult.Success(PersonaMeResponse(persona = fullPersona(), channel = null))
            coEvery { dmRepository.threads("p_demo") } returns
                NetworkResult.Success(PersonaThreadsResponse(threads = emptyList()))
            val vm = CreatorInboxViewModel(repository, dmRepository)
            vm.load()
            val state = vm.state.value as CreatorInboxUiState.Empty
            assertEquals("@mariak", state.header.handle)
        }

    @Test fun loadFailure_transitionsError() =
        runTest {
            coEvery { repository.me() } returns NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = CreatorInboxViewModel(repository, dmRepository)
            vm.load()
            val state = vm.state.value
            assertTrue(state is CreatorInboxUiState.Error)
        }

    @Test fun activeFilter_defaultsToAll() {
        val vm = CreatorInboxViewModel(repository, dmRepository)
        assertEquals(CreatorInboxFilter.All, vm.activeFilter.value)
    }

    @Test fun threadDestination_routesOnThreadIdNotUserId() =
        runTest {
            stubLoaded()
            val vm = CreatorInboxViewModel(repository, dmRepository)
            vm.load()
            val loaded = vm.state.value as CreatorInboxUiState.Loaded
            val row = loaded.content.rows.first { it.id == "th_gold" }
            val destination = vm.threadDestination(row)
            assertEquals("th_gold", destination.threadId)
            assertEquals("p_demo", destination.personaId)
            assertNotEquals(row.counterpartyUserId, destination.threadId)
            assertEquals("Derek Tan", destination.displayName)
            assertTrue(destination.verified)
        }
}
