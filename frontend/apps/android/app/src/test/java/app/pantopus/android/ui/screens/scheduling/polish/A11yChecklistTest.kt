@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.polish

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * H14 accessibility helpers + the audit contract: the TalkBack label builders,
 * the large-text reflow gate, and that the encoded audit is coherent (every
 * requirement covered; every flagged finding names a follow-up to file against
 * the owning stream).
 */
class A11yChecklistTest {
    @Test
    fun `slotLabel announces date, time, and availability`() {
        assertEquals(
            "Tue Jun 16, 3:00 PM, available",
            SchedulingA11y.slotLabel("Tue Jun 16", "3:00 PM", isAvailable = true),
        )
        assertEquals(
            "Tue Jun 16, 3:00 PM, taken",
            SchedulingA11y.slotLabel("Tue Jun 16", "3:00 PM", isAvailable = false),
        )
    }

    @Test
    fun `timezoneLabel omits a matching or absent host`() {
        assertEquals("Times shown in Pacific Time", SchedulingA11y.timezoneLabel("Pacific Time"))
        assertEquals("Times shown in Pacific Time", SchedulingA11y.timezoneLabel("Pacific Time", host = "Pacific Time"))
    }

    @Test
    fun `timezoneLabel speaks a host mismatch`() {
        assertEquals(
            "Times shown in Pacific Time, host is in Eastern Time",
            SchedulingA11y.timezoneLabel("Pacific Time", host = "Eastern Time"),
        )
    }

    @Test
    fun `slotColumns reflow to one column at accessibility font scales`() {
        assertEquals(3, SchedulingA11y.slotColumns(fontScale = 1.0f))
        assertEquals(3, SchedulingA11y.slotColumns(fontScale = 1.2f))
        assertEquals(1, SchedulingA11y.slotColumns(fontScale = 1.3f))
        assertEquals(1, SchedulingA11y.slotColumns(fontScale = 2.0f))
    }

    @Test
    fun `minimum tap target is the Android 48dp floor`() {
        assertEquals(48, A11Y_MIN_TAP_TARGET_DP)
    }

    @Test
    fun `audit covers every requirement`() {
        val covered = SchedulingA11yAudit.findings.map { it.requirement }.toSet()
        SchedulingA11yRequirement.entries.forEach { requirement ->
            assertTrue("audit missing requirement: $requirement", covered.contains(requirement))
        }
    }

    @Test
    fun `flagged findings all name a follow-up`() {
        assertFalse("audit should record the known SlotPicker gaps", SchedulingA11yAudit.flagged.isEmpty())
        SchedulingA11yAudit.flagged.forEach { finding ->
            assertNotNull("flagged finding ${finding.id} must name a follow-up", finding.followUp)
            assertTrue(finding.followUp?.isNotBlank() == true)
        }
    }

    @Test
    fun `passing findings exist`() {
        assertFalse(SchedulingA11yAudit.passing.isEmpty())
    }
}
