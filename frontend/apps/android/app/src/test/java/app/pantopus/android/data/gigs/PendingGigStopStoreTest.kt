package app.pantopus.android.data.gigs

import app.pantopus.android.data.api.models.gigs.GigStopJsonAdapterFactory
import app.pantopus.android.data.api.models.gigs.GigStopRequest
import app.pantopus.android.data.api.models.gigs.GigStopTerms
import com.squareup.moshi.Moshi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class PendingGigStopStoreTest {
    @get:Rule val directory = TemporaryFolder()
    private val moshi = Moshi.Builder().add(GigStopJsonAdapterFactory).build()
    private val request =
        GigStopRequest(
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            "33333333-3333-4333-8333-333333333333",
            "close",
            GigStopTerms(
                "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333",
                null, null, 0, "usd", "open", null, null, "standard", 0,
            ),
            null,
            null,
            "none",
        )

    private fun store() = PersistentPendingGigStopStore(File(directory.root, "pending"), moshi)

    @Test fun originalNullableTermsSurviveRecreationAndActorApiGigScopesRemainSeparate() =
        runTest {
            val keys = listOf("api|actor|gig", "other|actor|gig", "api|other|gig", "api|actor|other")
            keys.forEach { store().retain(it, request) }
            keys.forEach { assertEquals(request, store().read(it)) }
            val mismatch = runCatching { store().complete(keys[0], request.copy(reason = "other")) }.exceptionOrNull()
            assertTrue(mismatch is GigStopRecoveryChanged)
            assertEquals(request, store().read(keys[0]))
            store().complete(keys[0], request)
            assertNull(store().read(keys[0]))
            assertEquals(request, store().read(keys[1]))
            val raw = File(directory.root, "pending").listFiles().orEmpty().first().readText()
            assertFalse(raw.contains("Session"))
            assertFalse(raw.contains("secret"))
            assertFalse(raw.contains("accessToken"))
            listOf("workerId", "paymentId", "acceptedAt", "acceptedBidId").forEach { key ->
                assertTrue(raw.contains("\"$key\":null"))
            }
        }

    @Test fun concurrentDifferentOperationsCannotOverwriteUnknownOriginalAndCompletionIsExact() =
        runTest {
            val other = request.copy(requestId = "44444444-4444-4444-8444-444444444444")
            val results =
                listOf(
                    async {
                        runCatching { store().retain("key", request) }
                    },
                    async { runCatching { store().retain("key", other) } },
                ).map { it.await() }
            assertEquals(1, results.count { it.isSuccess })
            val retained = checkNotNull(store().read("key"))
            val replacement = if (retained == request) other else request
            assertTrue(runCatching { store().retain("key", replacement) }.isFailure)
            store().retain("key", replacement, retained)
            assertEquals(replacement, store().read("key"))
            assertTrue(runCatching { store().complete("key", retained) }.exceptionOrNull() is GigStopRecoveryChanged)
            assertEquals(replacement, store().read("key"))
        }

    @Test fun corruptStorageAndFreeTextCannotBeMistakenForNoRequest() =
        runTest {
            store().retain("key", request)
            val file = File(directory.root, "pending").listFiles().orEmpty().single()
            file.writeText("{invalid")
            assertTrue(runCatching { store().read("key") }.isFailure)
            assertTrue(runCatching { store().retain("key", request) }.isFailure)
            assertEquals("{invalid", file.readText())
            assertTrue(runCatching { store().retain("other", request.copy(reason = "private free text")) }.isFailure)
        }

    @Test fun retiredCompletionAndReplacementCannotEraseOriginalFile() =
        runTest {
            store().retain("key", request)
            val completion = runCatching { store().complete("key", request, canCommit = { false }) }
            assertTrue(completion.exceptionOrNull() is kotlinx.coroutines.CancellationException)
            assertEquals(request, store().read("key"))
            val replacement = request.copy(requestId = "44444444-4444-4444-8444-444444444444")
            var checks = 0
            val result = runCatching { store().retain("key", replacement, request, canCommit = { ++checks == 1 }) }
            assertTrue(result.exceptionOrNull() is kotlinx.coroutines.CancellationException)
            assertEquals(request, store().read("key"))
            assertEquals(1, File(directory.root, "pending").listFiles().orEmpty().size)
        }
}
