package app.pantopus.android.ui.screens.homes.tasks

import androidx.test.platform.app.InstrumentationRegistry
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceRequest
import app.pantopus.android.data.homes.HomeTaskRecurrenceScope
import app.pantopus.android.data.homes.PendingHomeTaskRecurrence
import app.pantopus.android.data.homes.PersistentPendingHomeTaskRecurrenceStore
import com.squareup.moshi.Moshi
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.util.UUID

/** Actual emulator Keystore/EncryptedSharedPreferences; no plaintext test substitute. */
class HomeTaskRecurrenceStorageTest {
    @Test fun protected_original_reopens_by_exact_scope_and_requires_matching_clear() =
        runBlocking {
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            val moshi = Moshi.Builder().build()
            val scope =
                HomeTaskRecurrenceScope(
                    "http://recurrence.example.invalid/",
                    UUID.randomUUID().toString(),
                    UUID.randomUUID().toString(),
                    UUID.randomUUID().toString(),
                )
            val request =
                HomeTaskRecurrenceRequest(
                    UUID.randomUUID().toString(),
                    "start",
                    0,
                    "2026-09-10T12:00:00Z",
                    "MONTHLY",
                    2,
                    "America/Los_Angeles",
                )
            val original = PendingHomeTaskRecurrence(scope, request)
            val store = PersistentPendingHomeTaskRecurrenceStore(context, moshi)
            store.replace(scope, null, original)
            try {
                val reopened = PersistentPendingHomeTaskRecurrenceStore(context, moshi)
                assertEquals(original, reopened.read(scope))
                assertNull(reopened.read(scope.copy(taskId = UUID.randomUUID().toString())))
                val different = original.copy(request = request.copy(interval = 3))
                assertTrue(runCatching { reopened.replace(scope, different, null) }.isFailure)
                assertEquals(original, reopened.read(scope))
                val ciphertext = File(context.applicationInfo.dataDir, "shared_prefs/private_home_task_recurrence_v1.xml").readText()
                assertFalse(ciphertext.contains(request.requestId))
                assertFalse(ciphertext.contains(scope.actorId))
                assertFalse(ciphertext.contains("America/Los_Angeles"))
                reopened.replace(scope, original, null)
                assertNull(store.read(scope))
            } finally {
                store.read(scope)?.let { store.replace(scope, it, null) }
            }
        }
}
