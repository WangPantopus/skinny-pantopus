@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.membership

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.membership.CredentialDto
import app.pantopus.android.data.api.models.membership.MembershipPersonaDto
import app.pantopus.android.data.api.models.membership.MembershipQuotaRemainingDto
import app.pantopus.android.data.api.models.membership.MembershipTierDto
import app.pantopus.android.data.api.models.membership.PersonaMembershipDto
import app.pantopus.android.data.api.models.membership.PersonaMembershipResponse
import app.pantopus.android.data.api.models.membership.PersonaPublicTierDto
import app.pantopus.android.data.api.models.membership.PersonaPublicTiersResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.membership.MembershipRepository
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

/**
 * Mirrors the iOS `MembershipDetailViewModelTests`: load() projects the
 * membership read onto [MembershipDetailContent], a null membership maps to
 * Error, and the single-tap cancel round-trips (success → callback, failure →
 * inline actionError).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MembershipDetailViewModelTest {
    private val repository: MembershipRepository = mockk()

    private fun makeVm(personaId: String = "p1"): MembershipDetailViewModel =
        MembershipDetailViewModel(
            SavedStateHandle(mapOf(MEMBERSHIP_DETAIL_PERSONA_ID_KEY to personaId)),
            repository,
        )

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        // The tier ladder load is non-blocking and fires on every successful
        // membership read — stub it so the picker has options to offer.
        coEvery { repository.publicTiers(any()) } returns
            NetworkResult.Success(
                PersonaPublicTiersResponse(
                    tiers =
                        listOf(
                            PersonaPublicTierDto(id = "t1", rank = 1, name = "Follower", priceCents = 0),
                            PersonaPublicTierDto(
                                id = "t2",
                                rank = 2,
                                name = "Silver",
                                priceCents = 800,
                                billingInterval = "month",
                            ),
                            PersonaPublicTierDto(
                                id = "t3",
                                rank = 3,
                                name = "Gold",
                                priceCents = 1500,
                                billingInterval = "month",
                            ),
                        ),
                ),
            )
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun membership(): PersonaMembershipResponse =
        PersonaMembershipResponse(
            membership =
                PersonaMembershipDto(
                    membershipId = "m1",
                    persona =
                        MembershipPersonaDto(
                            id = "p1",
                            handle = "lara",
                            displayName = "Lara Chen",
                            category = "food critic",
                            audienceLabel = "members",
                            followerCount = 1240,
                            credential = CredentialDto(status = "verified"),
                        ),
                    tier =
                        MembershipTierDto(
                            id = "t2",
                            rank = 2,
                            name = "Silver",
                            priceCents = 800,
                            currency = "usd",
                            billingInterval = "month",
                            msgThreadsPerPeriod = 4,
                            creatorCanInitiateDm = true,
                            replyPolicy = "within_48h",
                        ),
                    status = "active",
                    cancelAtPeriodEnd = false,
                    currentPeriodEnd = "2026-11-12T00:00:00.000Z",
                    quotaRemaining = MembershipQuotaRemainingDto(msgThreads = 2),
                ),
        )

    @Test
    fun `load projects membership`() =
        runTest {
            coEvery { repository.membership("p1") } returns NetworkResult.Success(membership())
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is MembershipDetailUiState.Populated)
            val content = (state as MembershipDetailUiState.Populated).content
            assertEquals("Lara Chen", content.persona.name)
            assertEquals("LC", content.persona.initials)
            assertTrue(content.persona.verified)
            assertEquals(MembershipTier.Silver, content.tier)
            assertEquals("\$8", content.priceLabel)
            assertEquals("month", content.periodLabel)
            assertTrue(content.benefits.isNotEmpty())
        }

    @Test
    fun `load missing membership shows error`() =
        runTest {
            coEvery { repository.membership("p1") } returns
                NetworkResult.Success(PersonaMembershipResponse(membership = null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is MembershipDetailUiState.Error)
        }

    @Test
    fun `cancel success invokes callback`() =
        runTest {
            coEvery { repository.cancel("p1") } returns NetworkResult.Success(membership())
            val vm = makeVm()
            var cancelled = false
            vm.cancel(onCancelled = { cancelled = true })
            assertTrue(cancelled)
            assertNull(vm.actionError.value)
        }

    @Test
    fun `cancel failure sets action error`() =
        runTest {
            coEvery { repository.cancel("p1") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.cancel(onCancelled = { })
            assertNotNull(vm.actionError.value)
        }

    @Test
    fun `tier ladder drops the current rank and labels direction`() =
        runTest {
            coEvery { repository.membership("p1") } returns NetworkResult.Success(membership())
            val vm = makeVm()
            vm.load()
            val options = vm.tierOptions.value
            assertEquals(2, options.size)
            assertNull(options.firstOrNull { it.rank == 2 })
            assertEquals(MembershipTierDirection.Downgrade, options.first { it.rank == 1 }.direction)
            assertEquals(MembershipTierDirection.Upgrade, options.first { it.rank == 3 }.direction)
        }

    @Test
    fun `changeTier to a higher rank calls upgrade`() =
        runTest {
            coEvery { repository.membership("p1") } returns NetworkResult.Success(membership())
            coEvery { repository.upgrade("p1", 3) } returns NetworkResult.Success(membership())
            val vm = makeVm()
            vm.load()
            vm.changeTier(vm.tierOptions.value.first { it.rank == 3 })
            coVerify(exactly = 1) { repository.upgrade("p1", 3) }
            assertEquals("Tier upgraded.", vm.tierChangeConfirmation.value)
        }

    @Test
    fun `changeTier to a lower rank schedules a downgrade`() =
        runTest {
            coEvery { repository.membership("p1") } returns NetworkResult.Success(membership())
            coEvery { repository.downgrade("p1", 1) } returns NetworkResult.Success(membership())
            val vm = makeVm()
            vm.load()
            vm.changeTier(vm.tierOptions.value.first { it.rank == 1 })
            coVerify(exactly = 1) { repository.downgrade("p1", 1) }
            assertTrue(vm.tierChangeConfirmation.value!!.contains("end of this period"))
        }

    @Test
    fun `refund request surfaces the backend rejection`() =
        runTest {
            coEvery { repository.membership("p1") } returns NetworkResult.Success(membership())
            coEvery { repository.requestRefund("p1", any(), any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(400, """{"error":"No qualifying SLA-missed thread found."}"""),
                )
            val vm = makeVm()
            vm.load()
            vm.requestRefund()
            assertEquals("No qualifying SLA-missed thread found.", vm.refundError.value)
        }

    @Test
    fun `inbox footnote reports the remaining message threads`() =
        runTest {
            coEvery { repository.membership("p1") } returns NetworkResult.Success(membership())
            val vm = makeVm()
            vm.load()
            val content = (vm.state.value as MembershipDetailUiState.Populated).content
            assertEquals("2 message threads left this period.", content.inbox.footnote)
            assertEquals("p1", content.personaId)
        }
}
