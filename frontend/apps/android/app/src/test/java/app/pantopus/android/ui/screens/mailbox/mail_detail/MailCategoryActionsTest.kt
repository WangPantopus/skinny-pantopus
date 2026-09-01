@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mail_detail

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * M5 — the A17.1 per-category ACTIONS row. Mirrors iOS
 * `PantopusTests/Features/Mailbox/MailboxP3ParityTests.swift`.
 */
class MailCategoryActionsTest {
    @Test
    fun categoryActions_matchRnVerbatim() {
        val expected =
            mapOf(
                "bill" to listOf("Pay", "Remind", "File", "Forward", "Dispute"),
                "legal" to listOf("File Now", "Forward", "Remind"),
                "notice" to listOf("Acknowledge", "Share with Household", "Create Task", "File"),
                "receipt" to listOf("File", "Forward"),
                "community" to listOf("Acknowledge", "Share with Household", "File"),
                "promo" to listOf("Save Offer", "Dismiss"),
                "other" to listOf("File", "Forward"),
            )
        expected.forEach { (category, labels) ->
            assertEquals(
                labels,
                MailCategoryActions.actions(category, isSenderUnknown = false).map { it.label },
            )
        }
    }

    @Test
    fun unknownCategory_fallsBackToOther() {
        assertEquals(
            listOf("File", "Forward"),
            MailCategoryActions.actions("not-a-category", isSenderUnknown = false).map { it.label },
        )
        assertEquals(
            listOf("File", "Forward"),
            MailCategoryActions.actions(null, isSenderUnknown = false).map { it.label },
        )
    }

    @Test
    fun unknownSender_suppressesPayAndSign() {
        val actions = MailCategoryActions.actions("bill", isSenderUnknown = true)
        assertEquals(listOf("Remind", "File", "Forward", "Dispute"), actions.map { it.label })
        assertTrue(MailCategoryAction.Pay !in actions)
        assertTrue(MailCategoryAction.Sign !in actions)
    }

    /**
     * Every wire key must be inside the backend allow-list at
     * `backend/routes/mailboxV2.js:464` — RN's derived keys are not.
     */
    @Test
    fun everyActionKeyIsBackendValid() {
        val valid =
            setOf(
                "pay",
                "sign",
                "forward",
                "file",
                "shred",
                "remind",
                "split",
                "acknowledge",
                "share_household",
                "create_task",
                "dispute",
            )
        MailCategoryAction.entries.forEach { action ->
            assertTrue(
                "${action.label} → ${action.actionKey} is not in the backend allow-list",
                action.actionKey in valid,
            )
        }
    }

    @Test
    fun onlyDismissIsDestructive() {
        assertEquals(
            listOf(MailCategoryAction.Dismiss),
            MailCategoryAction.entries.filter { it.isDestructive },
        )
    }
}
