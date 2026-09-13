package app.pantopus.android.data.homes

import android.content.Context
import android.content.SharedPreferences
import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PendingHomeTaskCreateStoreTest {
    private val scope =
        HomeTaskCreateScope(
            "https://home.test",
            "22222222-2222-4222-8222-222222222222",
            "11111111-1111-4111-8111-111111111111",
        )
    private val pending =
        PendingHomeTaskCreate(
            scope,
            CreateHomeTaskRequest(
                "chore",
                "Private task",
                requestId = "44444444-4444-4444-8444-444444444444",
            ),
        )
    private val prefs = mockk<SharedPreferences>()
    private val values = mutableMapOf<String, String?>()
    private var commitSucceeds = true
    private val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()

    private fun store(): PersistentPendingHomeTaskCreateStore {
        every { prefs.getString(any(), null) } answers { values[firstArg()] }
        every { prefs.edit() } answers {
            val changes = mutableMapOf<String, String?>()
            val edit = mockk<SharedPreferences.Editor>()
            every { edit.putString(any(), any()) } answers {
                changes[firstArg()] = secondArg()
                edit
            }
            every { edit.remove(any()) } answers {
                changes[firstArg()] = null
                edit
            }
            every { edit.commit() } answers {
                values.putAll(changes) // Android's memory cache can change even when disk commit reports failure.
                commitSucceeds
            }
            edit
        }
        return PersistentPendingHomeTaskCreateStore(mockk<Context>(), moshi).also {
            val field = it.javaClass.getDeclaredField("preferences")
            field.isAccessible = true
            field.set(it, prefs)
        }
    }

    @Test fun persisted_original_reopens_with_exact_bytes_and_scope() =
        runTest {
            val store = store()
            store.replace(scope, null, pending)
            assertEquals(pending, store().read(scope))
            assertNull(store.read(scope.copy(actorId = scope.homeId)))
            assertNull(store.read(scope.copy(homeId = scope.actorId)))
            assertNull(store.read(scope.copy(origin = "https://other.test")))
        }

    @Test fun wrong_scope_or_malformed_record_is_not_treated_as_empty() =
        runTest {
            val store = store()
            store.replace(scope, null, pending)
            val key = values.keys.single()
            for (raw in listOf(
                "broken",
                moshi.adapter(PendingHomeTaskCreate::class.java).toJson(
                    pending.copy(scope = scope.copy(actorId = scope.homeId)),
                ),
            )) {
                values[key] = raw
                assertTrue(runCatching { store.read(scope) }.isFailure)
                assertEquals(raw, values[key])
            }
        }

    @Test fun failed_commit_after_cache_mutation_retains_original_until_successful_retry() =
        runTest {
            val store = store()
            store.replace(scope, null, pending)
            commitSucceeds = false
            assertTrue(runCatching { store.replace(scope, pending, null) }.isFailure)
            assertEquals(pending, store.read(scope))
            commitSucceeds = true
            store.replace(scope, pending, null)
            assertNull(store.read(scope))
        }

    @Test fun occupied_slot_cannot_be_replaced_or_cleared_by_another_command() =
        runTest {
            val store = store()
            store.replace(scope, null, pending)
            val other = pending.copy(request = pending.request.copy(title = "Other"))
            assertTrue(runCatching { store.replace(scope, null, other) }.isFailure)
            assertTrue(runCatching { store.replace(scope, other, null) }.isFailure)
            assertEquals(pending, store.read(scope))
        }

    @Test fun concurrent_reservations_have_only_one_winner() =
        runTest {
            val store = store()
            val other = pending.copy(request = pending.request.copy(title = "Other"))
            val results = listOf(pending, other).map { async { runCatching { store.replace(scope, null, it) }.isSuccess } }.awaitAll()
            assertEquals(1, results.count { it })
            assertNotNull(store.read(scope))
        }

    @Test fun unreadable_protected_preferences_fail_without_mutating_storage() =
        runTest {
            val store = store()
            every { prefs.getString(any(), null) } throws SecurityException("locked")
            assertTrue(runCatching { store.read(scope) }.isFailure)
            assertFalse(values.isNotEmpty())
        }
}
