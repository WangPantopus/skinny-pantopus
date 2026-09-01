@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.business

import app.pantopus.android.data.api.models.businesses.BusinessAccessDto
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.GetEventTypesResponse
import app.pantopus.android.data.api.models.scheduling.NotificationPrefsResponse
import app.pantopus.android.data.api.models.scheduling.PaymentStatusResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingRepository
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BusinessSchedulingSettingsViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val team: BusinessTeamRepository = mockk(relaxed = true)
    private val auth: AuthRepository = mockk()
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val flags = SchedulingFeatureFlags().apply { environment = "local" }

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every {
            auth.state
        } returns
            MutableStateFlow(
                AuthRepository.State.SignedIn(UserDto(id = "biz1", email = "b@x.com", displayName = "Biz", avatarUrl = null)),
            )
    }

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = BusinessSchedulingSettingsViewModel(repo, team, auth, errors, flags)

    private fun page() = BookingPageResponse(BookingPageDto(id = "p1", timezone = "America/Los_Angeles"))

    @Before
    fun seed() {
        coEvery { repo.getBookingPage(any()) } returns NetworkResult.Success(page())
        coEvery {
            repo.getPaymentsStatus(any())
        } returns NetworkResult.Success(PaymentStatusResponse(applicable = true, connected = true, chargesEnabled = true))
        coEvery { repo.getEventTypes(any()) } returns
            NetworkResult.Success(
                GetEventTypesResponse(
                    eventTypes = listOf(EventTypeDto(id = "e1", name = "Visit", slug = "visit", requiresApproval = true)),
                ),
            )
        coEvery {
            repo.getNotificationPreferences()
        } returns NetworkResult.Success(NotificationPrefsResponse(prefs = mapOf("business_notify_owner" to true)))
        coEvery { team.access("biz1") } returns NetworkResult.Success(BusinessAccessDto(isOwner = true))
    }

    @Test
    fun `loads booking-page timezone payments and confirmation default`() =
        runTest(dispatcher) {
            val vm = vm()
            vm.load()
            advanceUntilIdle()

            val content = (vm.state.value as BusinessSchedulingSettingsViewModel.UiState.Loaded).content
            assertEquals("America/Los_Angeles", content.timezone)
            assertTrue(content.confirmationApprove)
            assertTrue(content.paymentsConnected)
            assertTrue(content.notifyOwner)
            assertFalse(content.gated)
        }

    @Test
    fun `saveTimezone writes the booking page`() =
        runTest(dispatcher) {
            coEvery { repo.updateBookingPage(any(), any()) } returns
                NetworkResult.Success(BookingPageResponse(BookingPageDto(id = "p1", timezone = "UTC")))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.saveTimezone("UTC")
            advanceUntilIdle()

            coVerify { repo.updateBookingPage(any(), match { it.timezone == "UTC" }) }
            assertEquals("UTC", (vm.state.value as BusinessSchedulingSettingsViewModel.UiState.Loaded).content.timezone)
        }

    @Test
    fun `toggling owner notification persists business-namespaced prefs`() =
        runTest(dispatcher) {
            coEvery { repo.updateNotificationPreferences(any()) } returns
                NetworkResult.Success(NotificationPrefsResponse(prefs = mapOf("business_notify_owner" to false)))
            val vm = vm()
            vm.load()
            advanceUntilIdle()
            vm.setNotifyOwner(false)
            advanceUntilIdle()

            coVerify { repo.updateNotificationPreferences(match { (it.prefs["business_notify_owner"] as? Boolean) == false }) }
        }
}
