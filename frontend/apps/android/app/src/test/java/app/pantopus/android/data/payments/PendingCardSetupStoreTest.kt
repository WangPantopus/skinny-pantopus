package app.pantopus.android.data.payments

import app.pantopus.android.data.auth.InMemorySharedPreferences
import app.pantopus.android.data.auth.TokenStorage
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PendingCardSetupStoreTest {
    private val preferences = InMemorySharedPreferences()
    private val tokens = mockk<TokenStorage>()

    private fun store(origin: String = "https://example.com") = PersistentPendingCardSetupStore(preferences, tokens, origin)

    @Test
    fun stores_only_id_and_survives_recreation() =
        runTest {
            assertTrue(store().save("account_a", "seti_saved"))
            assertEquals("seti_saved", store().read("account_a"))
            assertEquals(listOf("seti_saved"), preferences.all.values.toList())
        }

    @Test
    fun secrets_and_malformed_identifiers_are_rejected() =
        runTest {
            assertFalse(store().save("account_a", "seti_saved_secret_test"))
            assertFalse(store().save("account_a", "ek_secret"))
            assertFalse(store().save("", "seti_saved"))
            assertTrue(preferences.all.isEmpty())
        }

    @Test
    fun accounts_and_api_origins_have_separate_recovery() =
        runTest {
            store().save("account_a", "seti_saved")
            store().save("account_b", "seti_other")
            store("https://staging.example.com").save("account_a", "seti_staging")
            assertEquals("seti_saved", store().read("account_a"))
            assertEquals("seti_other", store().read("account_b"))
            assertEquals("seti_staging", store("https://staging.example.com").read("account_a"))
            assertNull(store().read("account_c"))
            assertEquals("seti_saved", store("https://example.com/").read("account_a"))
        }

    @Test
    fun completion_cannot_clear_a_newer_setup_or_another_account() =
        runTest {
            store().save("account_a", "seti_saved")
            store().save("account_b", "seti_other")
            store().clear("account_a", "seti_old")
            assertEquals("seti_saved", store().read("account_a"))
            store().clear("account_a", "seti_saved")
            assertNull(store().read("account_a"))
            assertEquals("seti_other", store().read("account_b"))
        }

    @Test
    fun account_scope_follows_authenticated_storage_not_remembered_account_hints() =
        runTest {
            coEvery { tokens.userId() } returnsMany listOf("account_a", null, "account_b")
            val store = store()
            assertEquals("account_a", store.currentAccountId())
            assertNull(store.currentAccountId())
            assertEquals("account_b", store.currentAccountId())
        }
}
