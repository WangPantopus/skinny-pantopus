@file:Suppress("PackageNaming", "ktlint:standard:max-line-length")

package app.pantopus.android.ui.screens.scheduling.invitee.confirm

import app.pantopus.android.data.api.models.scheduling.PublicBookingCreatedResponse
import app.pantopus.android.data.api.models.scheduling.PublicBookingRef
import app.pantopus.android.data.api.models.scheduling.PublicConfirmPage
import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.data.api.models.scheduling.PublicPageView
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.ManageTokenStore
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class InviteeConfirmViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val manageTokens: ManageTokenStore = mockk(relaxed = true)
    private val errors: SchedulingErrorDecoder = mockk()
    private val flags = SchedulingFeatureFlags().apply { environment = "production" }

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = InviteeConfirmViewModel(repo, manageTokens, flags, errors)

    private fun args(
        priceCents: Int = 0,
        depositCents: Int = 0,
        requiresApproval: Boolean = false,
    ) = InviteeConfirmArgs(
        slug = "maria",
        eventTypeSlug = "intro-call",
        eventType =
            PublicEventTypeView(
                id = "et1",
                name = "Intro call",
                slug = "intro-call",
                defaultDuration = 30,
                priceCents = priceCents,
                currency = "USD",
                depositCents = depositCents,
                requiresApproval = requiresApproval,
                locationMode = "video",
            ),
        page = PublicPageView(slug = "maria", title = "Maria Kessler", ownerType = "user"),
        hostName = "Maria Kessler",
        ownerType = "user",
        startAtUtc = "2026-06-17T16:30:00Z",
        endAtUtc = "2026-06-17T17:00:00Z",
        tz = "America/Los_Angeles",
    )

    private fun fillValid(vm: InviteeConfirmViewModel) =
        vm.updateValues(IntakeValues(firstName = "Maya", lastName = "Chen", email = "maya@example.com"))

    @Test
    fun `free booking persists the manage token and lands on confirmed`() =
        runTest(dispatcher) {
            coEvery { repo.publicCreateBooking(any(), any(), any()) } returns
                NetworkResult.Success(
                    PublicBookingCreatedResponse(
                        booking = PublicBookingRef(id = "b1", requiresApproval = false),
                        manageToken = "mt1",
                        clientSecret = null,
                        page = PublicConfirmPage(confirmationMessage = "See you soon"),
                    ),
                )
            val vm = vm()
            vm.start(args())
            fillValid(vm)
            vm.onPrimary() // details -> review
            vm.onPrimary() // submit
            advanceUntilIdle()

            val s = vm.state.value
            assertEquals(ConfirmStep.Confirmed, s.step)
            assertEquals("b1", s.confirmed?.bookingId)
            assertEquals("mt1", s.confirmed?.manageToken)
            assertFalse(s.submitting)
            coVerify { manageTokens.save("b1", "mt1") }
        }

    @Test
    fun `a 409 conflict surfaces nearest alternatives without leaving review`() =
        runTest(dispatcher) {
            val alt = SlotDto(start = "2026-06-17T18:00:00Z", end = "2026-06-17T18:30:00Z", startLocal = "2026-06-17T11:00:00")
            coEvery { repo.publicCreateBooking(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.ClientError(409, "{}"))
            every { errors.decode(any(), any()) } returns SchedulingError.Conflict("SLOT_TAKEN", listOf(alt))

            val vm = vm()
            vm.start(args())
            fillValid(vm)
            vm.onPrimary()
            vm.onPrimary()
            advanceUntilIdle()

            val s = vm.state.value
            assertEquals(ConfirmStep.Review, s.step)
            assertEquals(1, s.conflict?.alternatives?.size)
            assertFalse(s.submitting)
        }

    @Test
    fun `incomplete details never hit the network`() =
        runTest(dispatcher) {
            val vm = vm()
            vm.start(args())
            vm.onPrimary() // empty form
            advanceUntilIdle()

            val s = vm.state.value
            assertEquals(ConfirmStep.Details, s.step)
            assertTrue(s.shownErrors.isNotEmpty())
            coVerify(exactly = 0) { repo.publicCreateBooking(any(), any(), any()) }
        }

    @Test
    fun `picking an alternative re-submits with the new slot`() =
        runTest(dispatcher) {
            coEvery { repo.publicCreateBooking(any(), any(), any()) } returns
                NetworkResult.Success(PublicBookingCreatedResponse(booking = PublicBookingRef(id = "b2"), manageToken = "mt2"))
            val vm = vm()
            vm.start(args())
            fillValid(vm)
            vm.pickAlternative("2026-06-17T18:00:00Z", "2026-06-17T18:30:00Z")
            advanceUntilIdle()

            val s = vm.state.value
            assertEquals(ConfirmStep.Confirmed, s.step)
            assertEquals("2026-06-17T18:00:00Z", s.slotStartUtc)
            coVerify { repo.publicCreateBooking(any(), any(), match { it.startAt == "2026-06-17T18:00:00Z" }) }
        }

    @Test
    fun `priced booking routes through the payment step then confirms paid`() =
        runTest(dispatcher) {
            flags.environment = "local" // paid scheduling enabled outside production
            coEvery { repo.publicCreateBooking(any(), any(), any()) } returns
                NetworkResult.Success(PublicBookingCreatedResponse(booking = PublicBookingRef(id = "b3"), manageToken = "mt3", clientSecret = "cs_test_123"))
            val vm = vm()
            vm.start(args(priceCents = 4800))
            fillValid(vm)
            vm.onPrimary()
            vm.onPrimary()
            advanceUntilIdle()
            assertEquals(ConfirmStep.Payment, vm.state.value.step)

            vm.onPrimary() // confirm represented payment
            val s = vm.state.value
            assertEquals(ConfirmStep.Confirmed, s.step)
            // The created booking id survives the payment detour (post-payment
            // nav + receipt line depend on it).
            assertEquals("b3", s.confirmed?.bookingId)
            assertNotNull(s.confirmed?.paid)
            assertEquals(PriceMode.Full, s.confirmed?.paid?.mode)
            assertEquals(4800, s.confirmed?.paid?.amountPaidCents)
        }
}
