package app.pantopus.android.data.location

import android.location.Location
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.tasks.CancellationToken
import com.google.android.gms.tasks.TaskCompletionSource
import com.google.android.gms.tasks.Tasks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class DeviceLocationProviderTest {
    private val client = mockk<FusedLocationProviderClient>()
    private var allowed = true
    private var now = 1_000_000L
    private val provider = DeviceLocationProvider(client, { allowed }, { now })

    private fun location(time: Long = now): Location =
        mockk {
            every { latitude } returns 45.6
            every { longitude } returns -122.4
            every { accuracy } returns 40f
            every { hasAccuracy() } returns true
            every { this@mockk.time } returns time
        }

    @Test
    fun stalled_fresh_read_times_out_and_cancels_fused_request() =
        runTest {
            val pending = TaskCompletionSource<Location>()
            val tokens = mutableListOf<CancellationToken>()
            every { client.getCurrentLocation(any<Int>(), capture(tokens)) } returns pending.task
            val request = async { provider.requestCurrent(100) }
            runCurrent()
            advanceTimeBy(100)
            runCurrent()
            assertNull(request.await())
            assertTrue(tokens.single().isCancellationRequested)
            verify(exactly = 0) { client.lastLocation }
            pending.setResult(location())
            runCurrent()
            assertNull(provider.cachedCoordinate())
        }

    @Test
    fun last_known_read_uses_the_remaining_acquisition_budget() =
        runTest {
            val pending = TaskCompletionSource<Location>()
            every { client.getCurrentLocation(any<Int>(), any()) } returns Tasks.forResult(null)
            every { client.lastLocation } returns pending.task
            val request = async { provider.requestCurrent(100) }
            runCurrent()
            advanceTimeBy(100)
            runCurrent()
            assertNull(request.await())
            assertEquals(100L, testScheduler.currentTime)
        }

    @Test
    fun cancelling_one_caller_does_not_cancel_another() =
        runTest {
            val firstReply = TaskCompletionSource<Location>()
            val secondReply = TaskCompletionSource<Location>()
            val tokens = mutableListOf<CancellationToken>()
            every { client.getCurrentLocation(any<Int>(), capture(tokens)) } returnsMany listOf(firstReply.task, secondReply.task)
            val first = async { provider.requestCurrent(1_000) }
            val second = async { provider.requestCurrent(1_000) }
            runCurrent()
            first.cancelAndJoin()
            assertTrue(tokens[0].isCancellationRequested)
            assertFalse(tokens[1].isCancellationRequested)
            secondReply.setResult(location())
            assertEquals(45.6, second.await()?.latitude)
            assertTrue(tokens[1].isCancellationRequested)
        }

    @Test
    fun denial_clears_a_previous_coordinate_and_prevents_another_read() =
        runTest {
            every { client.getCurrentLocation(any<Int>(), any()) } returns Tasks.forResult(location())
            assertEquals(45.6, provider.requestCurrent(100)?.latitude)
            allowed = false
            assertNull(provider.cachedCoordinate())
            assertNull(provider.requestCurrent(100))
            allowed = true
            assertNull(provider.cachedCoordinate())
            verify(exactly = 1) { client.getCurrentLocation(any<Int>(), any()) }
        }

    @Test
    fun stale_coordinates_cannot_reappear_as_current_location() =
        runTest {
            every { client.getCurrentLocation(any<Int>(), any()) } returns Tasks.forResult(location())
            assertEquals(45.6, provider.requestCurrent(100)?.latitude)
            now += 121_000
            assertNull(provider.cachedCoordinate())
            every { client.getCurrentLocation(any<Int>(), any()) } returns Tasks.forResult(location(time = 0))
            every { client.lastLocation } returns Tasks.forResult(location(time = 0))
            assertNull(provider.requestCurrent(100))
        }
}
