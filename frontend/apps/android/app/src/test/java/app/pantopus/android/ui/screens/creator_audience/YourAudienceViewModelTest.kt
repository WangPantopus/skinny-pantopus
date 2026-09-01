@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.creator_audience

import app.pantopus.android.data.api.models.audience.AudienceCountsDto
import app.pantopus.android.data.api.models.audience.AudienceFollowerDto
import app.pantopus.android.data.api.models.audience.AudienceFollowerUpdateResponse
import app.pantopus.android.data.api.models.audience.AudienceListResponse
import app.pantopus.android.data.api.models.audience.AudienceMemberActionResponse
import app.pantopus.android.data.api.models.audience.AudiencePaginationDto
import app.pantopus.android.data.api.models.audience.FanDto
import app.pantopus.android.data.api.models.audience.FanTierBadgeDto
import app.pantopus.android.data.api.models.audience.PersonaSummaryDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.audience.AudienceProfileRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class YourAudienceViewModelTest {
    private val repository: AudienceProfileRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun fan(
        id: String,
        handle: String,
        name: String,
        rank: Int,
        local: Boolean,
        status: String,
        month: String,
    ) = FanDto(
        membershipId = id,
        fanHandle = handle,
        fanDisplayName = name,
        fanAvatarUrl = null,
        status = status,
        tier = FanTierBadgeDto(rank = rank, name = testTierName(rank)),
        verifiedLocal = local,
        tenureMonths = 4,
        joinedMonth = month,
        cancelAtPeriodEnd = false,
    )

    private val populated =
        AudienceListResponse(
            items =
                listOf(
                    fan("m1", "danareyes", "Dana Reyes", 3, true, "pending", "2025-05"),
                    fan("m2", "priyanair", "Priya Nair", 4, true, "active", "2025-01"),
                    fan("m3", "tombecker", "Tom Becker", 4, false, "muted", "2024-11"),
                    fan("m4", "sanaortiz", "Sana Ortiz", 3, true, "active", "2025-03"),
                ),
            counts = AudienceCountsDto(totalActive = 3, pending = 1, byTier = mapOf("3" to 2, "4" to 2)),
        )

    @Test
    fun load_populated_projectsPendingAndTierGroups() {
        coEvery { repository.audienceMembers(any(), any(), any(), any(), any()) } returns NetworkResult.Success(populated)
        val vm = YourAudienceViewModel(repository)
        vm.load()

        val state = vm.state.value
        assertTrue(state is YourAudienceUiState.Loaded)
        val loaded = (state as YourAudienceUiState.Loaded).loaded
        assertEquals(listOf("m1"), loaded.pending.map { it.membershipId })
        // Premium tier first: VIP (rank 4) before Insiders (rank 3).
        assertEquals(listOf(4, 3), loaded.tierGroups.map { it.rank })
        assertEquals(2, loaded.tierGroups.first().members.size) // VIP: active + muted
        assertTrue(loaded.tierGroups.first().members.any { it.isMuted })
        assertEquals(listOf("m4"), loaded.tierGroups.last().members.map { it.membershipId })
    }

    @Test
    fun countsAndDerivations() {
        coEvery { repository.audienceMembers(any(), any(), any(), any(), any()) } returns NetworkResult.Success(populated)
        val vm = YourAudienceViewModel(repository)
        vm.load()

        assertEquals(3, vm.counts.value.totalActive)
        assertEquals(1, vm.counts.value.pending)
        assertEquals("3 members · 1 pending", audienceCountLine(vm.counts.value))
        val chips = audienceTierChips(vm.counts.value, vm.tierNames.value)
        assertEquals(listOf(4, 3), chips.map { it.rank })
        assertEquals("VIP", chips.first().name)
        assertEquals(2, chips.first().count)
    }

    @Test
    fun load_empty_transitionsToEmpty() {
        val body =
            AudienceListResponse(
                items = emptyList(),
                counts = AudienceCountsDto(totalActive = 0, pending = 0, byTier = mapOf("1" to 0)),
            )
        coEvery { repository.audienceMembers(any(), any(), any(), any(), any()) } returns NetworkResult.Success(body)
        val vm = YourAudienceViewModel(repository)
        vm.load()

        assertTrue(vm.state.value is YourAudienceUiState.Empty)
        assertEquals("0 members", audienceCountLine(vm.counts.value))
    }

    @Test
    fun load_failure_transitionsToError() {
        coEvery { repository.audienceMembers(any(), any(), any(), any(), any()) } returns
            NetworkResult.Failure(NetworkError.Server(500, null))
        val vm = YourAudienceViewModel(repository)
        vm.load()

        assertTrue(vm.state.value is YourAudienceUiState.Error)
    }

    @Test
    fun cycleSort_advancesAndToasts() {
        coEvery { repository.audienceMembers(any(), any(), any(), any(), any()) } returns
            NetworkResult.Success(populated)
        val vm = YourAudienceViewModel(repository)
        vm.load()
        assertEquals(AudienceSort.Recent, vm.sort.value)

        vm.cycleSort()

        assertEquals(AudienceSort.Tenure, vm.sort.value)
        assertEquals("Sort: Longest-tenured first", vm.toast.value)
    }

    @Test
    fun loadMore_appendsSecondPage() {
        val page1 =
            AudienceListResponse(
                persona = PersonaSummaryDto(id = "p1"),
                items = listOf(fan("m1", "a", "A", 4, false, "active", "2025-01")),
                counts = AudienceCountsDto(totalActive = 2, pending = 0, byTier = mapOf("4" to 2)),
                pagination = AudiencePaginationDto(nextOffset = 1, hasMore = true),
            )
        val page2 =
            AudienceListResponse(
                persona = PersonaSummaryDto(id = "p1"),
                items = listOf(fan("m2", "b", "B", 4, false, "active", "2025-02")),
                counts = AudienceCountsDto(totalActive = 2, pending = 0, byTier = mapOf("4" to 2)),
                pagination = AudiencePaginationDto(nextOffset = null, hasMore = false),
            )
        coEvery { repository.audienceMembers(any(), any(), any(), any(), any()) } returnsMany
            listOf(NetworkResult.Success(page1), NetworkResult.Success(page2))

        val vm = YourAudienceViewModel(repository)
        vm.load()
        assertTrue(vm.hasMore)

        vm.loadMore()

        val loaded = (vm.state.value as YourAudienceUiState.Loaded).loaded
        assertEquals(listOf("m1", "m2"), loaded.tierGroups.first().members.map { it.membershipId })
        assertTrue(!vm.hasMore)
    }

    @Test
    fun block_commitsFollowerStatusAndReFetches() {
        val withPersona =
            AudienceListResponse(
                persona = PersonaSummaryDto(id = "p1"),
                items = listOf(fan("m2", "priyanair", "Priya Nair", 4, true, "active", "2025-01")),
                counts = AudienceCountsDto(totalActive = 1, pending = 0, byTier = mapOf("4" to 1)),
            )
        val afterBlock =
            AudienceListResponse(
                persona = PersonaSummaryDto(id = "p1"),
                items = emptyList(),
                counts = AudienceCountsDto(totalActive = 0, pending = 0, byTier = mapOf("4" to 0)),
            )
        coEvery { repository.audienceMembers(any(), any(), any(), any(), any()) } returnsMany
            listOf(NetworkResult.Success(withPersona), NetworkResult.Success(afterBlock))
        coEvery { repository.updateFollowerStatus("p1", "m2", "blocked") } returns
            NetworkResult.Success(AudienceFollowerUpdateResponse(AudienceFollowerDto(id = "m2", status = "blocked")))

        val vm = YourAudienceViewModel(repository)
        vm.load()
        val member = (vm.state.value as YourAudienceUiState.Loaded).loaded.tierGroups.first().members.first()

        vm.requestBlock(member)
        assertEquals("m2", vm.blockTarget.value?.membershipId)

        vm.confirmBlock(member)

        assertEquals(null, vm.blockTarget.value)
        assertEquals("Blocked Priya Nair.", vm.toast.value)
        assertTrue(vm.state.value is YourAudienceUiState.Empty)
    }

    @Test
    fun approve_reFetchesAndClearsPending() {
        val afterApprove =
            AudienceListResponse(
                items =
                    listOf(
                        fan("m1", "danareyes", "Dana Reyes", 3, true, "active", "2025-05"),
                    ),
                counts = AudienceCountsDto(totalActive = 4, pending = 0, byTier = mapOf("3" to 3, "4" to 2)),
            )
        coEvery { repository.audienceMembers(any(), any(), any(), any(), any()) } returnsMany
            listOf(NetworkResult.Success(populated), NetworkResult.Success(afterApprove))
        coEvery { repository.audienceMemberAction("m1", "approve") } returns
            NetworkResult.Success(AudienceMemberActionResponse("m1", "active"))

        val vm = YourAudienceViewModel(repository)
        vm.load()
        val pendingMember = (vm.state.value as YourAudienceUiState.Loaded).loaded.pending.first()
        assertEquals("m1", pendingMember.membershipId)

        vm.approve(pendingMember)

        val after = vm.state.value
        assertTrue(after is YourAudienceUiState.Loaded)
        assertTrue((after as YourAudienceUiState.Loaded).loaded.pending.isEmpty())
        assertEquals(0, vm.counts.value.pending)
        assertEquals("Approved Dana Reyes.", vm.toast.value)
    }

    private fun testTierName(rank: Int): String =
        when (rank) {
            4 -> "VIP"
            3 -> "Insiders"
            else -> audienceTierDefaultName(rank)
        }
}
