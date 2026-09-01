@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Locks in the cross-platform string contract on the JVM-testable public
 * surface of the five ported components. A drift on either side fails the
 * matching test on the other.
 *
 * Pin sources (iOS):
 *   - InviteLinks:  `Core/Design/Components/SystemSheets.swift:31-33`
 *   - Toast palette: `Core/Design/Components/Toast.swift:11-16`
 *
 * Component-internal strings (e.g. `BidderStack`'s "N bidders" formatter,
 * `CompactButton`'s 28/30/34dp geometry, the toast `testTag` defaults)
 * are private to each component file; an instrumentation test exercising
 * the rendered semantics tree is the right place to lock those. This
 * file covers only the values the JVM unit suite can reach without a
 * Compose runtime.
 */
class ComponentA11yStringsParityTest {
    @Test
    fun invite_message_is_verbatim_equal_to_iOS() {
        // iOS `InviteLinks.inviteMessage` — locked so a marketing copy
        // update has to flow to both platforms in lockstep.
        val expected =
            "Join me on Pantopus — your neighborhood for trusted home help, " +
                "local gigs, and your whole household in one place. " +
                InviteLinks.DOWNLOAD_URL
        assertEquals(expected, InviteLinks.INVITE_MESSAGE)
    }

    @Test
    fun invite_download_url_is_canonical() {
        assertEquals("https://pantopus.app", InviteLinks.DOWNLOAD_URL)
    }

    @Test
    fun toast_palette_covers_the_four_semantic_kinds() {
        // The four semantic tokens (success / warning / error / info)
        // each need a corresponding ToastKind so the design palette
        // and the toast API stay in lockstep. `Neutral` is the
        // catch-all fallback (mirrors iOS `Toast.swift`'s `neutral`).
        val kinds = ToastKind.entries.map { it.name }.toSet()
        assertTrue("Success kind is present", "Success" in kinds)
        assertTrue("Warning kind is present", "Warning" in kinds)
        assertTrue("Error kind is present", "Error" in kinds)
        assertTrue("Info kind is present", "Info" in kinds)
        assertTrue("Neutral kind is present (iOS fallback)", "Neutral" in kinds)
    }

    @Test
    fun toast_default_kind_is_neutral_matching_iOS() {
        // iOS `ToastMessage.init(..., kind: .neutral)` defaults to the
        // dim-ground appText pill; Android default matches so a bare
        // `controller.show("Saved")` reads as "neutral" on both.
        val message = ToastMessage(text = "x")
        assertEquals(ToastKind.Neutral, message.kind)
    }
}
