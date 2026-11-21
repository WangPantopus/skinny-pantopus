@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards.table

import androidx.compose.runtime.Immutable
import app.pantopus.android.data.api.models.mailbox.v2.MailCardTravel
import java.text.NumberFormat
import java.util.Locale

/**
 * One town a travelling card left (travelling card plan Part 3): its postmark. A town and a state ("Boise", "ID"), or
 * "Abroad" with no state; [on] is that day where its sender lives ("2026-11-23").
 */
@Immutable
data class CardTravelStop(
    val town: String,
    val state: String?,
    val on: String?,
) {
    /** "Boise, ID", or the town alone ("Abroad"). */
    val place: String get() = listOfNotNull(town.trim(), state?.trim()?.takeIf { it.isNotEmpty() }).joinToString(", ")
}

/**
 * A travelling card as its reader holds it (plan Parts 3 and 4, the server's switch `card_travel`): the postmarks of
 * the towns on its way to them, oldest first, and the miles and towns so far. Null on every other card, and on every
 * card while the switch is off: then nothing on the table changes.
 */
@Immutable
data class CardTravel(
    val journey: String,
    val postmarks: List<CardTravelStop>,
    val miles: Int,
    val towns: Int,
) {
    /**
     * "It came 2,692 miles through 4 towns to reach you.", above the envelope under "A Christmas card from Nora.";
     * null on its first stop, which says nothing more than today.
     */
    val cameLine: String?
        get() {
            val through = postmarks.size
            if (through < 2) return null
            return "It came ${miles(miles)} through $through towns to reach you."
        }

    /** For a screen reader, with the envelope: "Its envelope has 4 postmarks: Vancouver, WA; Boise, ID; …". */
    val spokenPostmarks: String
        get() {
            val count = postmarks.size
            val noun = if (count == 1) "postmark" else "postmarks"
            return "Its envelope has $count $noun: ${postmarks.joinToString("; ") { it.place }}."
        }

    companion object {
        /** From a piece's `card.travel`; null without a journey. */
        fun of(travel: MailCardTravel): CardTravel? {
            if (travel.journey.isBlank()) return null
            return CardTravel(
                journey = travel.journey,
                postmarks = travel.postmarks.filter { it.town.isNotBlank() }.map { CardTravelStop(it.town, it.state, it.on) },
                miles = travel.miles,
                towns = travel.towns,
            )
        }

        /** "2,692 miles", "1 mile". */
        fun miles(value: Int): String = "${NumberFormat.getIntegerInstance(Locale.US).format(value)} ${if (value == 1) "mile" else "miles"}"
    }
}
