@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.scheduling.CreateEventTypeRequest
import app.pantopus.android.data.api.models.scheduling.EventTypeDetailResponse
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.EventTypeResponse
import app.pantopus.android.data.api.models.scheduling.PaymentStatusResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
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
class EventTypeEditorViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val errors = SchedulingErrorDecoder(Moshi.Builder().build())
    private val flags = SchedulingFeatureFlags().apply { environment = "local" }
    private val relay = SchedulingEditorOwnerRelay()

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun handle(id: String) = SavedStateHandle(mapOf(SchedulingRoutes.ARG_EVENT_TYPE_ID to id))

    private fun vm(id: String) = EventTypeEditorViewModel(handle(id), repo, errors, flags, relay)

    private fun content() = state() as EventTypeEditorUiState.Content

    private lateinit var current: EventTypeEditorViewModel

    private fun state() = current.state.value

    @Test
    fun `create mode starts blank and invalid`() =
        runTest(dispatcher) {
            current = vm("new")
            current.start()
            advanceUntilIdle()
            val c = content()
            assertTrue(c.isCreate)
            assertFalse(c.form.isValid)
            assertEquals("", c.form.name)
        }

    @Test
    fun `a valid name enables save in create mode`() =
        runTest(dispatcher) {
            current = vm("new")
            current.start()
            advanceUntilIdle()
            current.onName("Intro call")
            val c = content()
            assertTrue(c.form.nameValid)
            assertTrue(c.canSave)
        }

    @Test
    fun `a name that can't form a slug shows an inline error`() =
        runTest(dispatcher) {
            current = vm("new")
            current.start()
            advanceUntilIdle()
            current.onName("***")
            val c = content()
            assertFalse(c.form.nameValid)
            assertNotNull(c.nameError)
        }

    @Test
    fun `editing an existing business event type derives the violet pillar`() =
        runTest(dispatcher) {
            val dto =
                EventTypeDto(
                    id = "e1", name = "Consultation", slug = "consult", durations = listOf(30), defaultDuration = 30,
                    locationMode = "video", ownerType = "business", ownerId = "biz1", priceCents = 12000, currency = "USD",
                )
            coEvery { repo.getEventType(any(), "e1") } returns NetworkResult.Success(EventTypeDetailResponse(dto, questions = emptyList()))
            val payments = PaymentStatusResponse(connected = true, chargesEnabled = true)
            coEvery { repo.getPaymentsStatus(any()) } returns NetworkResult.Success(payments)
            current = vm("e1")
            current.start()
            advanceUntilIdle()
            val c = content()
            assertEquals(SchedulingPillar.Business, c.pillar)
            assertEquals("Consultation", c.form.name)
            assertFalse(c.isCreate)
        }

    @Test
    fun `saving a new event type posts and emits saved`() =
        runTest(dispatcher) {
            val created = EventTypeDto(id = "e9", name = "Intro call", slug = "intro-call", durations = listOf(30))
            coEvery { repo.createEventType(any(), any()) } returns NetworkResult.Success(EventTypeResponse(created))
            current = vm("new")
            current.start()
            advanceUntilIdle()
            current.onName("Intro call")
            current.save()
            advanceUntilIdle()
            assertTrue(current.saved.value)
            coVerify { repo.createEventType(SchedulingOwner.Personal, any()) }
        }

    @Test
    fun `creating from the business pillar carries owner_type onto the POST`() =
        runTest(dispatcher) {
            relay.pending = SchedulingOwner.Business("biz1")
            val payments = PaymentStatusResponse(connected = true, chargesEnabled = true)
            coEvery { repo.getPaymentsStatus(any()) } returns NetworkResult.Success(payments)
            val body = slot<CreateEventTypeRequest>()
            val dto = EventTypeDto(id = "e1", name = "Consultation", slug = "consultation", durations = listOf(30))
            coEvery { repo.createEventType(any(), capture(body)) } returns NetworkResult.Success(EventTypeResponse(dto))
            current = vm("new")
            current.start()
            advanceUntilIdle()
            assertEquals(SchedulingPillar.Business, content().pillar)
            current.onName("Consultation")
            current.save()
            advanceUntilIdle()
            assertTrue(current.saved.value)
            assertEquals("business", body.captured.ownerType)
            assertEquals("biz1", body.captured.ownerId)
        }

    @Test
    fun `the secret visibility flag is sent on create`() =
        runTest(dispatcher) {
            val body = slot<CreateEventTypeRequest>()
            val dto = EventTypeDto(id = "e1", name = "Private 1:1", slug = "private-1-1", durations = listOf(30))
            coEvery { repo.createEventType(any(), capture(body)) } returns NetworkResult.Success(EventTypeResponse(dto))
            current = vm("new")
            current.start()
            advanceUntilIdle()
            current.onName("Private 1:1")
            current.onVisibilitySecret(true)
            current.save()
            advanceUntilIdle()
            assertEquals("secret", body.captured.visibility)
        }

    @Test
    fun `slug taken maps to a name error and does not save`() =
        runTest(dispatcher) {
            coEvery { repo.createEventType(any(), any()) } returns
                NetworkResult.Failure(NetworkError.ClientError(409, """{"error":"SLUG_TAKEN","suggestions":[]}"""))
            current = vm("new")
            current.start()
            advanceUntilIdle()
            current.onName("Intro call")
            current.save()
            advanceUntilIdle()
            assertFalse(current.saved.value)
            assertNotNull(content().nameError)
        }
}
