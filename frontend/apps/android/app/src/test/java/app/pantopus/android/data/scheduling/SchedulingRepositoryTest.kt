package app.pantopus.android.data.scheduling

import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.BookingPageResponse
import app.pantopus.android.data.api.models.scheduling.CreateEventTypeRequest
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.EventTypeResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.services.SchedulingApi
import app.pantopus.android.data.api.services.SchedulingPublicApi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SchedulingRepositoryTest {
    private val api: SchedulingApi = mockk()
    private val publicApi: SchedulingPublicApi = mockk()
    private val repo = SchedulingRepository(api, publicApi)

    private fun pageResponse() = BookingPageResponse(BookingPageDto(id = "page-1"))

    @Test
    fun personal_read_sends_scheduling_base_and_no_owner_query() =
        runTest {
            coEvery { api.getBookingPage(any(), any(), any()) } returns pageResponse()
            repo.getBookingPage(SchedulingOwner.Personal)
            coVerify { api.getBookingPage("scheduling", null, null) }
        }

    @Test
    fun business_read_sends_owner_type_and_owner_id_query() =
        runTest {
            coEvery { api.getBookingPage(any(), any(), any()) } returns pageResponse()
            repo.getBookingPage(SchedulingOwner.Business("biz-1"))
            coVerify { api.getBookingPage("scheduling", "business", "biz-1") }
        }

    @Test
    fun home_read_uses_home_alias_base_path() =
        runTest {
            coEvery { api.getBookingPage(any(), any(), any()) } returns pageResponse()
            repo.getBookingPage(SchedulingOwner.Home("home-7"))
            coVerify { api.getBookingPage("homes/home-7/scheduling", null, null) }
        }

    @Test
    fun business_create_injects_owner_fields_into_the_request_body() =
        runTest {
            val captured = slot<CreateEventTypeRequest>()
            coEvery { api.createEventType(any(), capture(captured)) } returns
                EventTypeResponse(EventTypeDto(id = "et-1", name = "Intro call", slug = "intro", durations = listOf(30)))
            repo.createEventType(
                SchedulingOwner.Business("biz-1"),
                CreateEventTypeRequest(name = "Intro call", slug = "intro", durations = listOf(30)),
            )
            coVerify { api.createEventType("scheduling", any()) }
            assertEquals("business", captured.captured.ownerType)
            assertEquals("biz-1", captured.captured.ownerId)
        }

    @Test
    fun failure_is_propagated_as_network_result_failure() =
        runTest {
            coEvery { api.getBookingPage(any(), any(), any()) } throws
                retrofit2.HttpException(
                    retrofit2.Response.error<Any>(500, "boom".toResponseBody(null)),
                )
            val result = repo.getBookingPage(SchedulingOwner.Personal)
            assertTrue(result is NetworkResult.Failure)
            assertTrue((result as NetworkResult.Failure).error is NetworkError.Server)
        }
}
