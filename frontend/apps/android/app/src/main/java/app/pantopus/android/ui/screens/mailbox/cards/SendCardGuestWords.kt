@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards

import app.pantopus.android.data.api.models.mailbox.HolidayCardPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.SentHolidayCard
import java.time.ZoneId

// The sender's words for a card by email or by link while the card improvements are on (GET /cards `improved`):
// someone not on Pantopus can open and read it before joining (Wave 1, guest opening). The web's and iPhone's words.
// Without `improved` every caller keeps the words it had.

/** Who it's for, under "Send it by link". */
internal const val GUEST_LINK_LINE = "Text it, or paste it anywhere. They can open it right away, and save it to keep it."

/** The email form, under the address. */
internal const val GUEST_EMAIL_LINE =
    "They get an email saying you sent them a Christmas card. They can open and read it right away — no account needed — " +
        "and join free anytime to keep it or write back. The email never shows your note."

private const val OPENS_IN_BROWSER = "They can open and read it right in their browser."

/**
 * An arrival choice's title and sentence by email ([byLink] false) or by link, while `improved`; null otherwise (and for
 * anyone on Pantopus), so the choice keeps the words it had.
 */
internal fun guestChoice(
    arrival: String,
    cards: HolidayCardsResponse,
    byLink: Boolean,
    zone: ZoneId,
): Pair<String, String>? {
    if (!cards.improved) return null
    if (byLink) {
        return if (arrival == "sealed_christmas") {
            "Sealed until Christmas" to
                "It waits with a “Do not open until Christmas” seal and opens on December 25. They can save it to their mailbox anytime."
        } else {
            "Right away" to "Whoever opens your link can open and read the card right away — no account needed."
        }
    }
    return when (arrival) {
        "next_morning" ->
            "With the morning mail" to
                "We email them ${HolidayCardTimes.emailGoesAt(cards.nextRoundAt, zone)}, your time. $OPENS_IN_BROWSER"
        "christmas_morning" ->
            "On Christmas morning" to
                "We email them ${HolidayCardTimes.emailGoesAt(cards.christmasMorningAt, zone)}, your time. $OPENS_IN_BROWSER"
        "sealed_christmas" ->
            "Sealed until Christmas" to
                "They get an email now with a “Do not open until Christmas” seal, and a reminder on Christmas morning when it opens."
        else -> "Right away, by email" to "They get an email now and can open and read it right in their browser — no account needed."
    }
}

/**
 * Look it over's first words for a card by email or by link while `improved` and the server says the page opens it
 * for a guest (`link_page.guest_open`); null otherwise.
 */
internal fun guestLookIntro(
    to: CardRecipient,
    preview: HolidayCardPreview,
    improved: Boolean,
): String? {
    if (!improved || preview.linkPage?.guestOpen != true) return null
    val sealed = preview.sealed
    return when (to) {
        is CardRecipient.Link ->
            "Anyone with your link can open and read the card${if (sealed) " once Christmas morning arrives" else " right away"} — no " +
                "account needed. The first person to save it keeps it."
        is CardRecipient.Email ->
            "They aren’t on Pantopus yet. The email never shows your note; " +
                if (sealed) {
                    "they get a reminder on Christmas morning when it opens."
                } else {
                    "they can open and read the card right away without an account, and join free to keep it or write back."
                }
        else -> null
    }
}

/** How a card by email or by link stands once sent, while `improved`; null for the rest, which keep their words. */
internal fun guestSentLine(
    card: SentHolidayCard,
    zone: ZoneId,
): String? {
    val sealed = card.arrival == "sealed_christmas"
    return when {
        card.status == "withdrawn" || (card.byLink && card.status in setOf("claimed", "expired")) -> null
        card.byLink && sealed ->
            "Ready to share. It stays sealed until Christmas morning, and anyone with your link can save it to their mailbox."
        card.byLink -> "Ready to share. Anyone with your link can open and read it right away, and save it to keep it."
        !card.byEmail -> null
        card.status == "claimed" -> "${card.toName ?: "They"} saved your card to their Pantopus mailbox."
        card.emailSendAt != null ->
            "We’ll email them ${HolidayCardTimes.emailGoesAt(card.emailSendAt, zone)}, your time. $OPENS_IN_BROWSER"
        sealed -> "We emailed them. It stays sealed until Christmas morning, when we’ll send a reminder to open it."
        else -> "We emailed them. They can open and read it right in their browser, and join free to keep it or write back."
    }
}
