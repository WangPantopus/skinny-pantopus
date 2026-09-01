package app.pantopus.android.data.auth

import android.content.Context
import app.cash.turbine.test
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * Drives [TokenStorage] against an in-memory fake `SharedPreferences` so
 * the test can run on the JVM without Robolectric or a device. The real
 * `EncryptedSharedPreferences` is exercised by
 * `androidTest/data/auth/TokenStoragePersistenceTest.kt`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TokenStorageTest {
    private lateinit var fake: InMemorySharedPreferences
    private lateinit var storage: TokenStorage

    @Before
    fun setUp() {
        fake = InMemorySharedPreferences()
        // Hilt's @Inject contract is `(@ApplicationContext context: Context)`.
        // We pass a relaxed mock — TokenStorage never touches the Context
        // once `prefsOverride` is set and `migrationCompleted` is true.
        storage =
            TokenStorage(mockk<Context>(relaxed = true)).apply {
                prefsOverride = fake
                migrationCompleted = true
            }
    }

    @Test
    fun `save persists access, refresh, userId`() =
        runTest {
            storage.save(accessToken = "at-1", refreshToken = "rt-1", userId = "u-1")

            assertEquals("at-1", storage.accessToken())
            assertEquals("rt-1", storage.refreshToken())
            assertEquals("at-1", fake.getString("access_token", null))
            assertEquals("rt-1", fake.getString("refresh_token", null))
            assertEquals("u-1", fake.getString("user_id", null))
        }

    @Test
    fun `save with null refresh keeps prior refresh`() =
        runTest {
            storage.save(accessToken = "at-1", refreshToken = "rt-1", userId = "u-1")
            storage.save(accessToken = "at-2", refreshToken = null, userId = "u-1")

            assertEquals("at-2", storage.accessToken())
            assertEquals("rt-1", storage.refreshToken())
        }

    @Test
    fun `updateTokens rotates access (and refresh) but does not touch userId`() =
        runTest {
            storage.save(accessToken = "at-1", refreshToken = "rt-1", userId = "u-1")
            storage.updateTokens(accessToken = "at-2", refreshToken = "rt-2")

            assertEquals("at-2", storage.accessToken())
            assertEquals("rt-2", storage.refreshToken())
            assertEquals("u-1", fake.getString("user_id", null))
        }

    @Test
    fun `updateTokens with null refresh keeps prior refresh`() =
        runTest {
            storage.save(accessToken = "at-1", refreshToken = "rt-1", userId = "u-1")
            storage.updateTokens(accessToken = "at-2", refreshToken = null)

            assertEquals("at-2", storage.accessToken())
            assertEquals("rt-1", storage.refreshToken())
        }

    @Test
    fun `clear wipes tokens but preserves v2_migrated flag`() =
        runTest {
            // Pretend a prior session already migrated.
            fake.edit().putBoolean("v2_migrated", true).commit()
            storage.save(accessToken = "at-1", refreshToken = "rt-1", userId = "u-1")

            storage.clear()

            assertNull(storage.accessToken())
            assertNull(storage.refreshToken())
            assertNull(fake.getString("user_id", null))
            assertEquals(true, fake.getBoolean("v2_migrated", false))
        }

    @Test
    fun `accessTokenFlow emits saved value and null on clear`() =
        runTest {
            storage.accessTokenFlow.test {
                assertNull(awaitItem()) // initial

                storage.save(accessToken = "at-1", refreshToken = "rt-1", userId = "u-1")
                assertEquals("at-1", awaitItem())

                storage.updateTokens(accessToken = "at-2", refreshToken = null)
                assertEquals("at-2", awaitItem())

                storage.clear()
                assertNull(awaitItem())

                cancelAndIgnoreRemainingEvents()
            }
        }

    @Test
    fun `save then read survives an instance recreation backed by the same prefs`() =
        runTest {
            storage.save(accessToken = "at-x", refreshToken = "rt-x", userId = "u-x")

            // Mimic a process restart: same backing storage, new TokenStorage.
            val reborn =
                TokenStorage(mockk<Context>(relaxed = true)).apply {
                    prefsOverride = fake
                    migrationCompleted = true
                }
            assertEquals("at-x", reborn.accessToken())
            assertEquals("rt-x", reborn.refreshToken())
            assertNotNull(fake.getString("user_id", null))
        }

    // ── Persistent login: expires_at / session_id / session_context ──

    @Test
    fun `save persists expiresAt sessionId and sessionContext and clear wipes them`() =
        runTest {
            storage.save(
                accessToken = "at-1",
                refreshToken = "rt-1",
                userId = "u-1",
                expiresAt = 1_800_000_000L,
                sessionId = "sid-1",
                sessionContext = "interactive",
            )

            assertEquals(1_800_000_000L, storage.expiresAt())
            assertEquals("sid-1", storage.sessionId())
            assertEquals("interactive", storage.sessionContext())
            assertEquals("u-1", storage.userId())

            storage.clear()

            assertNull(storage.expiresAt())
            assertNull(storage.sessionId())
            assertNull(storage.sessionContext())
            assertNull(storage.userId())
        }

    @Test
    fun `save without the persistent-login fields resets them (older backend)`() =
        runTest {
            storage.save("at-1", "rt-1", "u-1", expiresAt = 1L, sessionId = "sid-1", sessionContext = "restored")
            storage.save("at-2", "rt-2", "u-1")

            assertNull(storage.expiresAt())
            assertNull(storage.sessionId())
            assertNull(storage.sessionContext())
        }

    @Test
    fun `updateTokens refreshes expiresAt and sessionId when given, keeps them otherwise`() =
        runTest {
            storage.save("at-1", "rt-1", "u-1", expiresAt = 100L, sessionId = "sid-1", sessionContext = "interactive")

            storage.updateTokens(accessToken = "at-2", refreshToken = null)
            assertEquals(100L, storage.expiresAt())
            assertEquals("sid-1", storage.sessionId())

            storage.updateTokens(accessToken = "at-3", refreshToken = "rt-3", expiresAt = 200L, sessionId = "sid-2")
            assertEquals(200L, storage.expiresAt())
            assertEquals("sid-2", storage.sessionId())
            // Context is never rewritten by a rotation.
            assertEquals("interactive", storage.sessionContext())
        }
}
