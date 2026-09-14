package app.pantopus.android.ui.screens.homes.members

import android.content.Context
import android.content.SharedPreferences
import app.pantopus.android.data.homes.HomeMemberRemovalRequest
import app.pantopus.android.data.homes.PendingHomeMemberRemoval
import app.pantopus.android.data.homes.PersistentPendingHomeMemberRemovalStore
import com.squareup.moshi.Moshi
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicBoolean

class HomeMemberRemovalStoreTest {
    private val fixture = RemovalFixture()
    private val scope = fixture.scope
    private val request =
        HomeMemberRemovalRequest("ddc24300-0000-4000-8000-000000000004", fixture.intent(), fixture.occupancy, fixture.decision)
    private val original = PendingHomeMemberRemoval(scope, request, fixture.codec.encode(request), "Fixture Home\n@member_fixture")
    private val proof = original.copy(receiptJson = fixture.codec.outcome(fixture.resultJson(original), original).receiptJson)
    private val values = mutableMapOf<String, String?>()
    private var commitSucceeds = true
    private var commits = 0

    private fun store(): PersistentPendingHomeMemberRemovalStore {
        val prefs = mockk<SharedPreferences>()
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
                commits++
                values.putAll(changes)
                commitSucceeds
            }
            edit
        }
        return PersistentPendingHomeMemberRemovalStore(mockk<Context>(), Moshi.Builder().build()).also {
            it.javaClass.getDeclaredField("preferences").apply { isAccessible = true }.set(it, prefs)
        }
    }

    @Test fun exact_original_and_proof_reopen_in_only_the_same_account_and_origin() =
        runTest {
            val store = store()
            store.replace(scope, null, original) {}
            assertEquals(original, store().read(scope))
            assertNull(store.read(scope.copy(actorId = fixture.target)))
            assertNull(store.read(scope.copy(origin = "https://other.test/")))
            store.replace(scope, original, proof) {}
            assertEquals(proof, store().read(scope))
        }

    @Test fun corrupt_false_null_array_and_foreign_original_remain_occupied() =
        runTest {
            val store = store()
            store.replace(scope, null, original) {}
            val key = values.keys.single()
            val saved = requireNotNull(values[key])
            for (raw in listOf("null", "false", "[]", "{}", "broken", saved.replace(scope.actorId, fixture.target))) {
                values[key] = raw
                assertTrue(runCatching { store.read(scope) }.isFailure)
                assertTrue(runCatching { store.replace(scope, null, original) {} }.isFailure)
                assertEquals(raw, values[key])
            }
            assertEquals(1, commits)
        }

    @Test fun failed_commit_with_changed_memory_cache_retains_original_for_explicit_retry() =
        runTest {
            val store = store()
            store.replace(scope, null, proof) {}
            commitSucceeds = false
            assertTrue(runCatching { store.replace(scope, proof, null) {} }.isFailure)
            assertEquals(proof, store.read(scope))
            commitSucceeds = true
            store.replace(scope, proof, null) {}
            assertNull(store.read(scope))
        }

    @Test fun mutex_queued_original_proof_and_acknowledgement_recheck_lifetime_before_commit() =
        runTest {
            for ((expected, next) in listOf(null to original, original to proof, proof to null)) {
                values.clear()
                val store = store()
                if (expected != null) store.replace(scope, null, expected) {}
                val before = commits
                val lock = store.javaClass.getDeclaredField("lock").apply { isAccessible = true }.get(store) as Mutex
                lock.lock()
                val current = AtomicBoolean(true)
                val writing =
                    async(Dispatchers.IO, start = CoroutineStart.UNDISPATCHED) {
                        runCatching { store.replace(scope, expected, next) { check(current.get()) } }
                    }
                current.set(false)
                lock.unlock()
                assertTrue(writing.await().isFailure)
                assertEquals(before, commits)
                assertEquals(expected, store.read(scope))
            }
        }

    @Test fun another_original_cannot_replace_or_acknowledge_an_occupied_slot() =
        runTest {
            val store = store()
            store.replace(scope, null, original) {}
            val other = original.copy(summary = "Different reviewed member")
            assertTrue(runCatching { store.replace(scope, null, other) {} }.isFailure)
            assertTrue(runCatching { store.replace(scope, other, null) {} }.isFailure)
            assertEquals(original, store.read(scope))
        }
}
