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
    /**
     * RN's rows minus the tiles that only logged a click (Pay, Sign, Remind,
     * Forward, Dispute, Share with Household, Acknowledge).
     */
    @Test
    fun categoryActions_offerOnlyTilesThatWork() {
        val expected =
            mapOf(
                "bill" to listOf("File"),
                "legal" to listOf("File Now"),
                "notice" to listOf("Create Task", "File"),
                "receipt" to listOf("File"),
                "community" to listOf("File"),
                "promo" to listOf("Save Offer", "Dismiss"),
                "other" to listOf("File"),
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
            listOf("File"),
            MailCategoryActions.actions("not-a-category", isSenderUnknown = false).map { it.label },
        )
        assertEquals(
            listOf("File"),
            MailCategoryActions.actions(null, isSenderUnknown = false).map { it.label },
        )
    }

    @Test
    fun unknownSender_suppressesPayAndSign() {
        val actions = MailCategoryActions.actions("bill", isSenderUnknown = true)
        assertEquals(listOf("File"), actions.map { it.label })
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
