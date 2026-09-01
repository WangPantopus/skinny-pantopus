@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.automations

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Stream A16 — pure-logic tests for the automations domain vocabulary
 * (trigger/channel mapping, offset + reminder formatting, variable catalog).
 */
class AutomationsSupportTest {
    @Test
    fun `trigger summaries read in plain English`() {
        assertEquals("When a booking is created", WorkflowTrigger.fromWire("booking_created").summary(0))
        assertEquals("When a booking is cancelled", WorkflowTrigger.fromWire("cancelled").summary(0))
        assertEquals("1 hour before it starts", WorkflowTrigger.BeforeStart.summary(60))
        assertEquals("1 day after it ends", WorkflowTrigger.AfterEnd.summary(1440))
        // Offset 0 on an offset trigger collapses to the instant phrasing.
        assertEquals("When it starts", WorkflowTrigger.BeforeStart.summary(0))
    }

    @Test
    fun `trigger wire decode falls back to created`() {
        assertEquals(WorkflowTrigger.BookingCreated, WorkflowTrigger.fromWire("garbage"))
        assertTrue(WorkflowTrigger.BeforeStart.usesOffset)
        assertFalse(WorkflowTrigger.BookingCreated.usesOffset)
    }

    @Test
    fun `channel mapping and coming-soon flags`() {
        assertEquals(WorkflowChannel.InApp, WorkflowChannel.fromWire("in_app"))
        assertTrue(WorkflowChannel.Sms.isComingSoon)
        assertFalse(WorkflowChannel.Email.isComingSoon)
        assertTrue(WorkflowChannel.Email.needsSubject)
        assertEquals("Email attendees", WorkflowChannel.Email.actionSummary)
        assertEquals("Notify you", WorkflowChannel.Push.actionSummary)
    }

    @Test
    fun `duration formatting picks the largest whole unit`() {
        assertEquals("45 minutes", AutomationsFormat.duration(45))
        assertEquals("1 hour", AutomationsFormat.duration(60))
        assertEquals("2 hours", AutomationsFormat.duration(120))
        assertEquals("1 day", AutomationsFormat.duration(1440))
        assertEquals("1 week", AutomationsFormat.duration(10080))
    }

    @Test
    fun `reminders summary joins sorted leads`() {
        assertEquals("1 day + 1 hour before · Push", AutomationsFormat.remindersSummary(listOf(60, 1440)))
        assertEquals("No reminders yet", AutomationsFormat.remindersSummary(emptyList()))
        // "At start" (0) drops the "before" suffix.
        assertEquals("at start · Push", AutomationsFormat.remindersSummary(listOf(0)))
    }

    @Test
    fun `reminder smart default is one day plus one hour`() {
        assertEquals(listOf(1440, 60), ReminderPreset.smartDefault.sortedDescending())
        assertEquals(6, ReminderPreset.all.size)
    }

    @Test
    fun `variable catalog search filters by label and key`() {
        val grouped = TemplateVariableCatalog.grouped("name")
        val labels = grouped.flatMap { it.items }.map { it.label }
        assertTrue(labels.contains("Attendee name"))
        assertTrue(labels.contains("Host name"))
        assertFalse(labels.contains("Reschedule link"))

        assertTrue(TemplateVariableCatalog.grouped("zzz").isEmpty())
        assertEquals("Maria K.", TemplateVariableCatalog.sampleValues["attendee_name"])
    }

    @Test
    fun `starters are distinct and include a subject email`() {
        val ids = StarterTemplate.all.map { it.id }.toSet()
        assertEquals(StarterTemplate.all.size, ids.size)
        assertTrue(StarterTemplate.all.any { it.channel == WorkflowChannel.Email && it.subject != null })
    }

    @Test
    fun `interpolation replaces tokens with sample values`() {
        val filled = interpolateTemplate("Hi {{attendee_name}} at {{event_time}}", TemplateVariableCatalog.sampleValues)
        assertEquals("Hi Maria K. at 3:00 PM", filled)
    }
}
