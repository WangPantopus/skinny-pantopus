@file:Suppress("PackageNaming")

package app.pantopus.android.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pure-projection tests for the SystemSheets payload types. Mirrors the
 * iOS `MailDraft.mailtoURL` + `InviteLinks` test surface. Lives on the
 * JVM (no Robolectric / Android Uri runtime) — the production code
 * exposes a `mailtoUriString` for exactly this reason.
 */
class SystemSheetsTest {
    @Test
    fun mailDraftEncodesSubjectAndBody() {
        val draft =
            MailDraft(
                subject = "Hello & welcome",
                body = "Line 1\nLine 2",
                recipients = listOf("alice@example.com"),
            )
        val s = draft.mailtoUriString
        assertTrue("scheme: $s", s.startsWith("mailto:"))
        assertTrue("subject encoded: $s", s.contains("subject=Hello%20%26%20welcome"))
        assertTrue("body encoded: $s", s.contains("body=Line%201%0ALine%202"))
        assertTrue("recipient included: $s", s.contains("alice%40example.com"))
    }

    @Test
    fun mailDraftSupportsMultipleRecipients() {
        val draft =
            MailDraft(
                subject = "s",
                body = "b",
                recipients = listOf("a@x.com", "b@x.com"),
            )
        val s = draft.mailtoUriString
        val recipientPart = s.removePrefix("mailto:").substringBefore("?")
        assertTrue("recipientPart=$recipientPart", recipientPart.contains("a%40x.com,b%40x.com"))
    }

    @Test
    fun mailDraftWithNoRecipientsStartsWithMailtoQuestionMark() {
        val draft = MailDraft(subject = "s", body = "b")
        assertTrue(draft.mailtoUriString.startsWith("mailto:?"))
    }

    @Test
    fun inviteLinksMessageIncludesDownloadUrl() {
        assertTrue(InviteLinks.INVITE_MESSAGE.contains(InviteLinks.DOWNLOAD_URL))
    }

    @Test
    fun pickedContactCarriesNullableFields() {
        val both =
            PickedContact(
                name = "Jamie",
                phone = "555-1234",
                email = "j@x.com",
            )
        assertEquals("Jamie", both.name)
        assertEquals("555-1234", both.phone)
        assertEquals("j@x.com", both.email)

        val nameOnly = PickedContact(name = "Pat", phone = null, email = null)
        assertNull(nameOnly.phone)
        assertNull(nameOnly.email)
    }
}
