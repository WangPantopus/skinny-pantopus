package app.pantopus.android.data.auth

import com.squareup.moshi.Moshi
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The Block Store payload rules (CONTRACT §"Client storage keys"): max 3
 * accounts most-recent-first, the grant belongs to `grantUserId`, removing
 * an account drops its grant, JSON shape `{ v, accounts, resumeGrant?,
 * grantUserId?, issuedAt }`, and the default [AccountHintStore] helpers.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AccountHintStoreTest {
    private fun hint(
        id: String,
        seen: Long,
    ) = AccountHint(userId = id, displayName = "User $id", lastSeenAt = seen)

    @Test
    fun `withAccount keeps most recent first and caps at three`() {
        var payload = AccountHintPayload()
        payload = payload.withAccount(hint("a", 1))
        payload = payload.withAccount(hint("b", 2))
        payload = payload.withAccount(hint("c", 3))
        payload = payload.withAccount(hint("d", 4))
        assertEquals(listOf("d", "c", "b"), payload.accounts.map { it.userId })

        // Re-signing in with an existing account moves it to the front.
        payload = payload.withAccount(hint("b", 5))
        assertEquals(listOf("b", "d", "c"), payload.accounts.map { it.userId })
        assertEquals(5L, payload.primary?.lastSeenAt)
    }

    @Test
    fun `grantAccount resolves the grant owner and withoutAccount drops that grant`() {
        val payload =
            AccountHintPayload(accounts = listOf(hint("a", 1), hint("b", 2)))
                .withGrant("g", "b")
        assertEquals("b", payload.grantAccount?.userId)

        val withoutA = payload.withoutAccount("a")
        assertEquals("g", withoutA.resumeGrant)
        assertEquals("b", withoutA.grantUserId)

        val withoutB = payload.withoutAccount("b")
        assertNull(withoutB.resumeGrant)
        assertNull(withoutB.grantUserId)
        assertNull(withoutB.grantAccount)
    }

    @Test
    fun `withGrant with a blank grant clears the grant`() {
        val payload = AccountHintPayload(accounts = listOf(hint("a", 1))).withGrant("g", "a")
        assertEquals("g", payload.resumeGrant)
        assertNull(payload.withGrant("", "a").resumeGrant)
        assertNull(payload.withGrant(null, "a").grantUserId)
        assertNull(payload.withoutGrant().resumeGrant)
    }

    @Test
    fun `payload serialises to the CONTRACT JSON shape`() {
        val adapter = Moshi.Builder().build().adapter(AccountHintPayload::class.java)
        val payload =
            AccountHintPayload(
                accounts =
                    listOf(
                        AccountHint(
                            userId = "u",
                            displayName = "Ying",
                            maskedEmail = "y•••@gmail.com",
                            lastMethod = "google",
                            lastSeenAt = 7L,
                        ),
                    ),
                resumeGrant = "grant",
                grantUserId = "u",
                issuedAt = 9L,
            )
        val json = adapter.toJson(payload)
        assertEquals(
            "{\"v\":1,\"accounts\":[{\"userId\":\"u\",\"displayName\":\"Ying\",\"maskedEmail\":\"y•••@gmail.com\"," +
                "\"lastMethod\":\"google\",\"lastSeenAt\":7}],\"resumeGrant\":\"grant\",\"grantUserId\":\"u\",\"issuedAt\":9}",
            json,
        )
        assertEquals(payload, adapter.fromJson(json))
    }

    @Test
    fun `maskEmail keeps the first character and the domain`() {
        assertEquals("y•••@gmail.com", AccountHint.maskEmail("ying@gmail.com"))
        assertEquals("a•••@b.co", AccountHint.maskEmail("  a@b.co "))
        assertNull(AccountHint.maskEmail("no-at-sign"))
        assertNull(AccountHint.maskEmail("@x.com"))
        assertNull(AccountHint.maskEmail("x@"))
        assertNull(AccountHint.maskEmail(null))
    }

    @Test
    fun `default helpers upsert, set grant, clear grant and remove accounts`() =
        runTest {
            val store = AuthTestSupport.FakeAccountHintStore()
            store.upsertAccount(hint("a", 1))
            store.setGrant("g1", "a")
            assertEquals("g1", store.payload?.resumeGrant)
            assertEquals("a", store.payload?.grantUserId)

            store.clearGrant()
            assertNull(store.payload?.resumeGrant)
            assertEquals(listOf("a"), store.payload?.accounts?.map { it.userId })
            // Idempotent: no write when there is nothing to clear.
            val writes = store.writes
            store.clearGrant()
            assertEquals(writes, store.writes)

            store.upsertAccount(hint("b", 2))
            store.setGrant("g2", "b")
            store.removeAccount("b")
            assertEquals(listOf("a"), store.payload?.accounts?.map { it.userId })
            assertNull(store.payload?.resumeGrant)

            store.removeAccount("a")
            assertNull(store.payload)
            assertEquals(1, store.deletes)
        }
}
