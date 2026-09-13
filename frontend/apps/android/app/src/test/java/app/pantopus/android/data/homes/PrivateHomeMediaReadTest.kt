package app.pantopus.android.data.homes

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Test
import kotlin.coroutines.CoroutineContext

@OptIn(ExperimentalCoroutinesApi::class)
class PrivateHomeMediaReadTest {
    @Test fun cancellation_on_dispatcher_return_erases_undelivered_private_bytes() =
        runTest {
            val queued = ArrayDeque<Runnable>()
            val io =
                object : CoroutineDispatcher() {
                    override fun dispatch(
                        context: CoroutineContext,
                        block: Runnable,
                    ) {
                        queued.addLast(block)
                    }
                }
            val bytes = "private selection or download".toByteArray()
            var delivered = false
            val read =
                async {
                    readPrivateHomeMedia(erase = {
                            content: ByteArray ->
                        content.fill(0)
                    }, dispatcher = io) { bytes }
                    delivered = true
                }
            runCurrent()
            queued.removeFirst().run()
            // The IO read finished; delivery is queued on the caller dispatcher.
            read.cancel()
            runCurrent()
            read.join()
            assertFalse(delivered)
            assertArrayEquals(ByteArray(bytes.size), bytes)
        }

    @Test fun completed_return_transfers_the_original_bytes_to_the_caller() =
        runTest {
            val bytes = "exact retained bytes".toByteArray()
            val result =
                readPrivateHomeMedia(
                    erase = { content: ByteArray -> content.fill(0) },
                    dispatcher = StandardTestDispatcher(testScheduler),
                ) { bytes }
            assertSame(bytes, result)
            assertArrayEquals("exact retained bytes".toByteArray(), result)
            result.fill(0)
        }
}
