package app.pantopus.android.data.payments

import android.content.SharedPreferences
import app.pantopus.android.data.api.models.payments.TipOriginal
import app.pantopus.android.data.api.models.payments.TipTerms
import app.pantopus.android.data.auth.InMemorySharedPreferences
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PendingGigTipStoreTest {
    private val prefs = InMemorySharedPreferences()
    private val moshi = Moshi.Builder().build()
    private val gig = "11111111-1111-4111-8111-111111111111"
    private val actor = "22222222-2222-4222-8222-222222222222"
    private val worker = "33333333-3333-4333-8333-333333333333"
    private val id = "44444444-4444-4444-8444-444444444444"
    private val original = TipOriginal(id, id, gig, actor, worker, 500, "usd", TipTerms(gig, actor, worker, "2026-09-14T00:00:00Z"))

    private fun store(preferences: SharedPreferences = prefs) = PersistentPendingGigTipStore(moshi) { preferences }

    @Test fun retainedOriginalSurvivesStoreRecreationAndScopesStaySeparate() =
        runTest {
            store().replace("api|actor|gig", null, original) { true }
            assertEquals(original, store().read("api|actor|gig"))
            assertNull(store().read("other-api|actor|gig"))
            assertNull(store().read("api|other-actor|gig"))
            assertNull(store().read("api|actor|other-gig"))
            store().replace("api|actor|gig", original, null) { true }
            assertNull(store().read("api|actor|gig"))
        }

    @Test fun onlyOriginalNonsecretFieldsAreSerialized() =
        runTest {
            store().replace("scope", null, original) { true }
            val raw = checkNotNull(prefs.getString("scope", null))
            val fields = moshi.adapter(Map::class.java).fromJson(raw).orEmpty()
            assertEquals(setOf("requestId", "paymentId", "gigId", "payerId", "payeeId", "amountCents", "currency", "terms"), fields.keys)
            assertFalse(raw.contains("secret"))
            assertFalse(raw.contains("session"))
            assertFalse(raw.contains("checkout"))
        }

    @Test fun unreadableStoredDataIsNotMistakenForAnAbsentRequest() =
        runTest {
            for (raw in listOf("{broken", "null", "{}", moshi.adapter(TipOriginal::class.java).toJson(original.copy(amountCents = 0)))) {
                prefs.edit().putString("scope", raw).commit()
                assertTrue(runCatching { store().read("scope") }.isFailure)
                assertTrue(runCatching { store().replace("scope", null, original) { true } }.isFailure)
                assertEquals(raw, prefs.getString("scope", null))
            }
        }

    @Test fun changedOriginalAndRetiredSessionCannotOverwriteOrDelete() =
        runTest {
            val store = store()
            store.replace("scope", null, original) { true }
            assertTrue(runCatching { store.replace("scope", null, original.copy(amountCents = 1000)) { true } }.isFailure)
            assertTrue(runCatching { store.replace("scope", original, null) { false } }.isFailure)
            assertTrue(runCatching { store.replace("scope", original, original.copy(amountCents = 1000)) { false } }.isFailure)
            assertEquals(original, store.read("scope"))
        }

    @Test fun failedCommitMemoryMutationCannotMasqueradeAsSuccessfulCleanup() =
        runTest {
            store().replace("scope", null, original) { true }
            var fail = true
            val failing =
                object : SharedPreferences by prefs {
                    override fun edit(): SharedPreferences.Editor {
                        val edit = prefs.edit()
                        return object : SharedPreferences.Editor by edit {
                            override fun commit(): Boolean {
                                edit.commit()
                                return !fail
                            }
                        }
                    }
                }
            val store = store(failing)
            assertTrue(runCatching { store.replace("scope", original, null) { true } }.isFailure)
            assertNull(prefs.getString("scope", null)) // Android commit can mutate memory before failing on disk.
            assertEquals(original, store.read("scope"))
            fail = false
            store.replace("scope", original, null) { true }
            assertNull(store.read("scope"))
        }

    @Test fun inaccessibleProtectedPreferencesCannotFallBackToPlaintext() =
        runTest {
            val store = PersistentPendingGigTipStore(moshi) { error("Keystore unavailable") }
            assertTrue(runCatching { store.read("scope") }.isFailure)
            assertTrue(runCatching { store.replace("scope", null, original) { true } }.isFailure)
            assertTrue(prefs.all.isEmpty())
        }
}
