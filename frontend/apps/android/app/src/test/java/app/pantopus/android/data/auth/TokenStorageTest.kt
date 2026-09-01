package app.pantopus.android.data.auth

import android.content.Context
import android.content.SharedPreferences
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
 * Drives [TokenStorage] against an in-memory fake [SharedPreferences] so
 * the test can run on the JVM without Robolectric or a device. The real
 * `EncryptedSharedPreferences` is exercised by
 * `androidTest/data/auth/TokenStoragePersistenceTest.kt`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TokenStorageTest {
    private lateinit var fake: FakeSharedPreferences
    private lateinit var storage: TokenStorage

    @Before
    fun setUp() {
        fake = FakeSharedPreferences()
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
}

/**
 * Bare-bones [SharedPreferences] for unit tests. Implements only the
 * subset of methods that [TokenStorage] reaches for (getString /
 * getBoolean / edit) — the rest throw to keep accidental reliance
 * out of test code.
 */
private class FakeSharedPreferences : SharedPreferences {
    private val data = linkedMapOf<String, Any?>()

    override fun getString(
        key: String?,
        defValue: String?,
    ): String? = (data[key] as? String) ?: defValue

    override fun getBoolean(
        key: String?,
        defValue: Boolean,
    ): Boolean = (data[key] as? Boolean) ?: defValue

    override fun contains(key: String?): Boolean = data.containsKey(key)

    override fun getAll(): MutableMap<String, *> = data.toMutableMap()

    override fun getStringSet(
        key: String?,
        defValues: MutableSet<String>?,
    ): MutableSet<String>? = throw UnsupportedOperationException()

    override fun getInt(
        key: String?,
        defValue: Int,
    ): Int = throw UnsupportedOperationException()

    override fun getLong(
        key: String?,
        defValue: Long,
    ): Long = throw UnsupportedOperationException()

    override fun getFloat(
        key: String?,
        defValue: Float,
    ): Float = throw UnsupportedOperationException()

    override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) = Unit

    override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) = Unit

    override fun edit(): SharedPreferences.Editor = FakeEditor()

    private inner class FakeEditor : SharedPreferences.Editor {
        private val ops = mutableListOf<() -> Unit>()

        override fun putString(
            key: String?,
            value: String?,
        ): SharedPreferences.Editor {
            ops += { data[key!!] = value }
            return this
        }

        override fun putBoolean(
            key: String?,
            value: Boolean,
        ): SharedPreferences.Editor {
            ops += { data[key!!] = value }
            return this
        }

        override fun remove(key: String?): SharedPreferences.Editor {
            ops += { data.remove(key) }
            return this
        }

        override fun clear(): SharedPreferences.Editor {
            ops += { data.clear() }
            return this
        }

        override fun commit(): Boolean {
            ops.forEach { it() }
            ops.clear()
            return true
        }

        override fun apply() {
            commit()
        }

        override fun putStringSet(
            key: String?,
            values: MutableSet<String>?,
        ): SharedPreferences.Editor = throw UnsupportedOperationException()

        override fun putInt(
            key: String?,
            value: Int,
        ): SharedPreferences.Editor = throw UnsupportedOperationException()

        override fun putLong(
            key: String?,
            value: Long,
        ): SharedPreferences.Editor = throw UnsupportedOperationException()

        override fun putFloat(
            key: String?,
            value: Float,
        ): SharedPreferences.Editor = throw UnsupportedOperationException()
    }
}
