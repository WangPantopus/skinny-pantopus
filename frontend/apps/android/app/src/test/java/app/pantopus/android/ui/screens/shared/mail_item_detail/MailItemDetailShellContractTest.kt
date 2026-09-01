@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.shared.mail_item_detail

import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * T6.5a (P19) — Contract tests for the A17 Mailbox item detail
 * archetype shell payloads. Mirrors iOS `MailItemDetailShellTests`.
 *
 * Pure value-type tests — the snapshot test in
 * `MailItemDetailShellSnapshotTest` covers the composable render shape.
 */
class MailItemDetailShellContractTest {
    // ─── Top bar ─────────────────────────────────────────

    @Test fun topBar_carries_overflow_items() {
        val topBar =
            MailTopBarConfig(
                eyebrow = "Notice",
                trust = MailDetailTrust.Warning,
                onBack = {},
                overflowItems =
                    listOf(
                        MailOverflowItem("f", PantopusIcon.Send, "Forward") {},
                        MailOverflowItem("a", PantopusIcon.Archive, "Archive") {},
                        MailOverflowItem("r", PantopusIcon.Info, "Report") {},
                    ),
            )
        assertEquals(3, topBar.overflowItems.size)
        assertEquals("r", topBar.overflowItems[2].id)
        assertEquals("Notice", topBar.eyebrow)
        assertEquals(MailDetailTrust.Warning, topBar.trust)
    }

    @Test fun topBar_destructive_flag() {
        val item = MailOverflowItem("d", PantopusIcon.Trash2, "Delete", isDestructive = true) {}
        assertTrue(item.isDestructive)
    }

    @Test fun topBar_handles_no_back_button() {
        val topBar = MailTopBarConfig(eyebrow = "Booklet", trust = MailDetailTrust.Verified)
        assertNull(topBar.onBack)
        assertNull(topBar.trailingAction)
        assertTrue(topBar.overflowItems.isEmpty())
    }

    @Test fun topBar_trailing_action_payload() {
        var tapped = false
        val trailing =
            MailTopBarTrailingAction(
                icon = PantopusIcon.Bookmark,
                contentDescription = "Save to vault",
                isActive = true,
            ) { tapped = true }
        assertTrue(trailing.isActive)
        assertEquals("Save to vault", trailing.contentDescription)
        trailing.onClick()
        assertTrue(tapped)
    }

    // ─── AI elf ─────────────────────────────────────────

    @Test fun aiElf_default_headline() {
        val elf = AIElfStripContent(summary = "Quick summary.")
        assertEquals("Pantopus read this for you", elf.headline)
        assertTrue(elf.bullets.isEmpty())
        assertNull(elf.trailingBadge)
        assertNull(elf.onRedo)
    }

    @Test fun aiElf_custom_headline() {
        val elf =
            AIElfStripContent(
                headline = "You acknowledged this",
                summary = "Your name is on file.",
                bullets = emptyList(),
                trailingBadge = null,
                onRedo = null,
            )
        assertEquals("You acknowledged this", elf.headline)
    }

    @Test fun aiElf_bullet_payload() {
        val bullet =
            AIElfBullet(
                id = "b1",
                icon = PantopusIcon.Calendar,
                label = "Hearing Tue Jun 3",
                text = "6:00 PM",
            )
        assertEquals("b1", bullet.id)
        assertEquals("Hearing Tue Jun 3", bullet.label)
        assertEquals("6:00 PM", bullet.text)
    }

    @Test fun aiElf_with_redo_handler() {
        var redone = false
        val elf =
            AIElfStripContent(
                summary = "Summary",
                onRedo = { redone = true },
            )
        assertNotNull(elf.onRedo)
        elf.onRedo?.invoke()
        assertTrue(redone)
    }

    // ─── Attachments ────────────────────────────────────

    @Test fun attachments_default_title() {
        val row =
            AttachmentsRowContent(
                items =
                    listOf(
                        AttachmentItem(id = "a", kind = AttachmentKind.Pdf, name = "x.pdf"),
                    ),
            )
        assertEquals("Attachments", row.title)
        assertEquals(1, row.items.size)
    }

    @Test fun attachments_kinds_are_distinct() {
        val kinds =
            listOf(
                AttachmentKind.Pdf,
                AttachmentKind.Image,
                AttachmentKind.Video,
                AttachmentKind.Audio,
                AttachmentKind.Link,
                AttachmentKind.Other,
            )
        assertEquals(kinds.size, kinds.toSet().size)
    }

    @Test fun attachment_item_carries_optional_meta() {
        val withMeta = AttachmentItem(id = "a", kind = AttachmentKind.Pdf, name = "x", meta = "2 pp")
        val withoutMeta = AttachmentItem(id = "b", kind = AttachmentKind.Pdf, name = "y")
        assertEquals("2 pp", withMeta.meta)
        assertNull(withoutMeta.meta)
    }

    // ─── Trust dot color resolution ─────────────────────

    @Test fun trust_dot_colors_are_distinct() {
        val v = MailDetailTrust.Verified.dotColor
        val n = MailDetailTrust.Neutral.dotColor
        val w = MailDetailTrust.Warning.dotColor
        val c = MailDetailTrust.Celebration.dotColor
        assertFalse(v == n)
        assertFalse(n == w)
        assertFalse(v == w)
        assertFalse(c == v)
        assertFalse(c == w)
    }
}
