package app.pantopus.android.data.payments

import app.pantopus.android.data.api.models.payments.PaymentRefundAttempt
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class PendingRefundStoreTest {
    @get:Rule val directory = TemporaryFolder()
    private val moshi = Moshi.Builder().build()
    private val attempt = PaymentRefundAttempt("22222222-2222-4222-8222-222222222222", null, "requested_by_customer")

    private fun store() = PersistentPendingRefundStore(File(directory.root, "pending-refunds"), moshi)

    @Test fun atomicDiskRecoverySurvivesRecreationAndSeparatesActorOriginAndPayment() =
        runTest {
            val scopes = listOf("api|payer|payment", "api|other|payment", "other-api|payer|payment", "api|payer|other-payment")
            scopes.forEachIndexed { index, scope -> store().save(scope, attempt.copy(requestedAmountCents = 50 + index)) }
            scopes.forEachIndexed { index, scope -> assertEquals(50 + index, store().read(scope)?.requestedAmountCents) }
            store().save(scopes[0], attempt)
            assertEquals(attempt, store().read(scopes[0]))
            store().clear(scopes[0])
            assertNull(store().read(scopes[0]))
            assertEquals(51, store().read(scopes[1])?.requestedAmountCents)
            assertEquals(3, File(directory.root, "pending-refunds").listFiles().orEmpty().size)
            assertTrue(File(directory.root, "pending-refunds").listFiles().orEmpty().all { it.name.matches(Regex("[a-f0-9]{64}\\.json")) })
        }

    @Test fun writesOnlyOriginalNonsecretTermsAndNeverCopiesRemoteDescriptions() =
        runTest {
            store().save("scope", attempt)
            val raw = File(directory.root, "pending-refunds").listFiles().orEmpty().single().readText()
            val fields = moshi.adapter(Map::class.java).fromJson(raw).orEmpty()
            assertEquals(setOf("requestId", "reason"), fields.keys)
            store().save("remote", attempt.copy(description = "Private text from another device"))
            assertNull(store().read("remote"))
            assertFalse(raw.contains("Private"))
            assertFalse(raw.contains("secret"))
        }

    @Test fun corruptSavedOperationIsAnErrorAndCannotDisappearAsAnEmptyRead() =
        runTest {
            store().save("scope", attempt)
            val file = File(directory.root, "pending-refunds").listFiles().orEmpty().single()
            file.writeText("{broken")
            assertTrue(runCatching { store().read("scope") }.isFailure)
            assertEquals("{broken", file.readText())
            assertTrue(runCatching { store().save("other", attempt.copy(requestId = "pi_secret_invalid")) }.isFailure)
            assertEquals(1, File(directory.root, "pending-refunds").listFiles().orEmpty().size)
        }
}
