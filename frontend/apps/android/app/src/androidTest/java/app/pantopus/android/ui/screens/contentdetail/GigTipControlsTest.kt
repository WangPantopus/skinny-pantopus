@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.contentdetail

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.platform.app.InstrumentationRegistry
import app.pantopus.android.data.api.models.payments.TipOriginal
import app.pantopus.android.data.api.models.payments.TipTerms
import app.pantopus.android.data.payments.PersistentPendingGigTipStore
import com.squareup.moshi.Moshi
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.UUID

/** Existing Compose picker plus real emulator Keystore; API/provider outcomes are tested separately. */
class GigTipControlsTest {
    @get:Rule val compose = createComposeRule()

    @Test fun retained_original_disables_presets_and_continues_its_frozen_amount() {
        var amount: Int? = null
        var canceled = 0
        compose.setContent {
            TipAmountSheet(
                GigTipState(
                    originalAmount = 500,
                    canContinue = true,
                    canCancel = true,
                    actionTitle = "Continue original tip",
                ),
                { amount = it },
                { canceled++ },
            )
        }
        compose.onNodeWithTag("tip.amount.1000").assertIsNotEnabled()
        compose.onNodeWithText("Continue original tip").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals(500, amount) }
        compose.onNodeWithText("Cancel tip").performClick()
        compose.runOnIdle { assertEquals(1, canceled) }
    }

    @Test fun loading_original_cannot_send_or_cancel() {
        compose.setContent { TipAmountSheet(GigTipState(busy = true, originalAmount = 500), {}, {}) }
        compose.onNodeWithTag("tip.amount.500").assertIsNotEnabled()
        compose.onNodeWithTag("tip.amount.customSubmit").assertIsNotEnabled()
        compose.onNodeWithText("Not now").assertIsNotEnabled()
    }

    @Test fun existing_picker_preserves_preset_selection() {
        var amount: Int? = null
        compose.setContent { TipAmountSheet(GigTipState(canChoose = true), { amount = it }, {}) }
        compose.onNodeWithTag("tip.amount.500").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals(500, amount) }
    }

    @Test fun retired_account_removes_the_previous_original_amount_from_controls() {
        val state = mutableStateOf(GigTipState(originalAmount = 500, canContinue = true))
        compose.setContent { TipAmountSheet(state.value, {}, {}) }
        compose.onNodeWithText("5.00").assertExists()
        compose.runOnIdle { state.value = GigTipState(invalidated = true) }
        compose.onNodeWithText("5.00").assertDoesNotExist()
        compose.onNodeWithTag("tip.amount.customSubmit").assertIsNotEnabled()
    }

    @Test fun encrypted_original_reopens_and_exact_cleanup_preserves_other_scopes() =
        runBlocking {
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            val gig = UUID.randomUUID().toString()
            val actor = UUID.randomUUID().toString()
            val worker = UUID.randomUUID().toString()
            val id = UUID.randomUUID().toString()
            val key = "gig-tip-original-v1|https://tip.example.invalid/|$actor|$gig"
            val original = TipOriginal(id, id, gig, actor, worker, 500, "usd", TipTerms(gig, actor, worker, "2026-09-14T00:00:00Z"))
            val moshi = Moshi.Builder().build()
            val store = PersistentPendingGigTipStore(context, moshi)
            store.replace(key, null, original) { true }
            try {
                val reopened = PersistentPendingGigTipStore(context, moshi)
                assertEquals(original, reopened.read(key))
                assertNull(reopened.read("$key-other"))
                assertTrue(runCatching { reopened.replace(key, original.copy(amountCents = 1000), null) { true } }.isFailure)
                assertTrue(runCatching { reopened.replace(key, original, null) { false } }.isFailure)
                assertEquals(original, reopened.read(key))
                val ciphertext = File(context.applicationInfo.dataDir, "shared_prefs/private_gig_tips_v1.xml").readText()
                assertFalse(ciphertext.contains(id))
                assertFalse(ciphertext.contains(actor))
                assertFalse(ciphertext.contains(gig))
                assertFalse(ciphertext.contains("tip.example.invalid"))
                reopened.replace(key, original, null) { true }
                assertNull(store.read(key))
            } finally {
                store.read(key)?.let { store.replace(key, it, null) { true } }
            }
        }
}
