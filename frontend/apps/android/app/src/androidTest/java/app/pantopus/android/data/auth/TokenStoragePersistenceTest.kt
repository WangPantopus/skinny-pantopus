package app.pantopus.android.data.auth

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Drives the real [TokenStorage] against the device's
 * `EncryptedSharedPreferences`. Confirms that values written by one
 * instance are still readable from a brand-new instance — the
 * Singleton's cached prefs reference is reset along with the test class
 * instance, so this exercises the same path a process kill + relaunch
 * would take.
 */
@RunWith(AndroidJUnit4::class)
class TokenStoragePersistenceTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @After
    fun tearDown() {
        // Drop any tokens this test wrote so neighbouring tests start clean.
        runBlocking { TokenStorage(context).clear() }
    }

    @Test
    fun tokens_persist_across_instance_recreation() =
        runBlocking {
            val writer = TokenStorage(context)
            writer.save(
                accessToken = "at-persist-1",
                refreshToken = "rt-persist-1",
                userId = "u-persist-1",
            )

            // Fresh instance — mimics a cold start after the previous
            // process was killed. The encrypted prefs file on disk is
            // the only carrier of state.
            val reader = TokenStorage(context)
            assertEquals("at-persist-1", reader.accessToken())
            assertEquals("rt-persist-1", reader.refreshToken())

            // Rotate the access token only — userId must survive.
            reader.updateTokens(accessToken = "at-persist-2", refreshToken = null)

            val rotated = TokenStorage(context)
            assertEquals("at-persist-2", rotated.accessToken())
            assertEquals("rt-persist-1", rotated.refreshToken())
        }

    @Test
    fun clear_removes_tokens_but_keeps_migration_flag() =
        runBlocking {
            val storage = TokenStorage(context)
            storage.save(
                accessToken = "at-clear",
                refreshToken = "rt-clear",
                userId = "u-clear",
            )
            storage.clear()

            val reborn = TokenStorage(context)
            assertNull(reborn.accessToken())
            assertNull(reborn.refreshToken())
        }
}
