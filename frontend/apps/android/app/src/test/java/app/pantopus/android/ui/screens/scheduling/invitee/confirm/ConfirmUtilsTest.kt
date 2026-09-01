@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invitee.confirm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ConfirmUtilsTest {
    private fun valid() = IntakeValues(firstName = "Maya", lastName = "Chen", email = "maya@example.com")

    @Test
    fun `validateIntake flags missing name and bad email`() {
        val errors = ConfirmUtils.validateIntake(IntakeValues(email = "nope"))
        assertTrue(errors.containsKey("firstName"))
        assertTrue(errors.containsKey("lastName"))
        assertEquals("Enter a valid email address", errors["email"])
    }

    @Test
    fun `validateIntake passes for a complete form`() {
        assertTrue(ConfirmUtils.isIntakeValid(valid()))
    }

    @Test
    fun `required question must be answered`() {
        val q = IntakeQuestion(id = "q1", label = "What should we cover?", required = true)
        val missing = ConfirmUtils.validateIntake(valid(), listOf(q))
        assertEquals("This question is required", missing["q1"])
        val answered = valid().copy(answers = mapOf("q1" to AnswerValue.Text("Roadmap")))
        assertTrue(ConfirmUtils.isIntakeValid(answered, listOf(q)))
    }

    @Test
    fun `phone question validates digit count`() {
        val q = IntakeQuestion(id = "p", label = "Phone", fieldType = IntakeFieldType.Phone, required = false)
        val short = valid().copy(answers = mapOf("p" to AnswerValue.Text("123")))
        assertTrue(ConfirmUtils.validateIntake(short, listOf(q)).containsKey("p"))
    }

    @Test
    fun `invalid guest email is reported per index`() {
        val withGuest = valid().copy(guests = listOf("ok@example.com", "broken"))
        val errors = ConfirmUtils.validateIntake(withGuest)
        assertFalse(errors.containsKey("guest0"))
        assertTrue(errors.containsKey("guest1"))
    }

    @Test
    fun `buildBookingRequest assembles name, phone, guests and question answers`() {
        val q = IntakeQuestion(id = "q1", label = "Topic", required = true)
        val values =
            valid().copy(
                phone = "(415) 555-0142",
                guests = listOf("sam@example.com", " "),
                answers = mapOf("q1" to AnswerValue.Text("Q3 rollout")),
            )
        val body =
            ConfirmUtils.buildBookingRequest(
                values,
                startAtUtc = "2026-06-17T16:30:00Z",
                durationMin = 30,
                timezone = "America/Los_Angeles",
                questions = listOf(q),
            )
        assertEquals("Maya Chen", body.name)
        assertEquals("maya@example.com", body.email)
        assertEquals("(415) 555-0142", body.phone)
        assertEquals(30, body.durationMin)
        assertEquals("America/Los_Angeles", body.timezone)
        assertEquals("Q3 rollout", body.answers?.get("Topic"))
        assertEquals(listOf("sam@example.com"), body.answers?.get("guest_emails"))
    }

    @Test
    fun `priceMode resolves free, full and deposit`() {
        assertEquals(PriceMode.Free, ConfirmUtils.priceMode(0, 0))
        assertEquals(PriceMode.Free, ConfirmUtils.priceMode(null, null))
        assertEquals(PriceMode.Full, ConfirmUtils.priceMode(4800, 0))
        assertEquals(PriceMode.Deposit, ConfirmUtils.priceMode(6000, 2000))
    }

    @Test
    fun `dueNow and balance follow the price mode`() {
        assertEquals(2000, ConfirmUtils.dueNowCents(6000, 2000))
        assertEquals(4000, ConfirmUtils.balanceCents(6000, 2000))
        assertEquals(4800, ConfirmUtils.dueNowCents(4800, 0))
        assertEquals(0, ConfirmUtils.balanceCents(4800, 0))
    }

    @Test
    fun `reviewCtaLabel reflects paid flag and price`() {
        assertEquals("Confirm booking", ConfirmUtils.reviewCtaLabel(0, 0, "USD", paidEnabled = true))
        assertEquals("Confirm booking", ConfirmUtils.reviewCtaLabel(4800, 0, "USD", paidEnabled = false))
        assertTrue(ConfirmUtils.reviewCtaLabel(4800, 0, "USD", paidEnabled = true).startsWith("Pay "))
    }

    @Test
    fun `isPastBooking uses status then end time`() {
        assertTrue(ConfirmUtils.isPastBooking("completed", null))
        assertTrue(ConfirmUtils.isPastBooking("no_show", null))
        assertFalse(ConfirmUtils.isPastBooking("pending", null))
        assertTrue(ConfirmUtils.isPastBooking("confirmed", "2000-01-01T00:00:00Z"))
        assertFalse(ConfirmUtils.isPastBooking("confirmed", "2999-01-01T00:00:00Z"))
    }

    @Test
    fun `formatSlotRange renders the range in the requested zone`() {
        val label = ConfirmUtils.formatSlotRange("2026-06-17T16:30:00Z", "2026-06-17T17:00:00Z", "America/Los_Angeles")
        // 16:30 UTC is 9:30 AM Pacific (PDT) on Jun 17.
        assertTrue(label.contains("Wed, Jun 17"))
        assertTrue(label.contains("9:30"))
        assertTrue(label.contains("10:00"))
    }

    @Test
    fun `initials takes up to two leading characters`() {
        assertEquals("MC", ConfirmUtils.initials("Maya Chen"))
        assertEquals("M", ConfirmUtils.initials("maya@example.com"))
        assertEquals("?", ConfirmUtils.initials(""))
    }
}
