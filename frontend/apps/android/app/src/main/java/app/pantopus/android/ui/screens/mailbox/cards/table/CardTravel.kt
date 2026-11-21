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
    /** The journey's id (its public page's address); null where it hasn't started yet. */
    val journey: String?,
    val postmarks: List<CardTravelStop>,
    val miles: Int,
    val towns: Int,
    /** How many more people this reader may pass it to (decision D1: two in all). */
    val placesLeft: Int = 0,
    /** The place the next pass-on takes (1 or 2). */
    val nextPlace: Int? = null,
    /** Who they passed it to, by first name (or the address, or "someone" for a link, as the web says it), in place order. */
    val passedTo: List<String> = emptyList(),
    /** They can pass it on now; else [refusal] says why in plain words (sealed until Christmas, cards done). */
    val canPassOn: Boolean = false,
    val refusal: String? = null,
) {
    /**
     * The table's button for passing it on (Part 4): "Pass it on" filled before any, "Pass it on to one more" quiet after
     * one, none after two; null while it can't be passed on at all.
     */
    val passOnLabel: String?
        get() =
            when {
                !canPassOn || placesLeft <= 0 -> null
                passedTo.isEmpty() -> PASS_IT_ON
                else -> "Pass it on to one more"
            }

    /** "You passed it on to Ivy and Cass." once both places are taken. */
    val passedLine: String?
        get() = passedTo.takeIf { placesLeft <= 0 && it.isNotEmpty() }?.let { "You passed it on to ${it.joinToString(" and ")}." }

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
        /** From a piece's `card.travel`; null with neither a journey nor a postmark. */
        fun of(travel: MailCardTravel): CardTravel? {
            val journey = travel.journey?.takeIf { it.isNotBlank() }
            if (journey == null && travel.postmarks.isEmpty()) return null
            return CardTravel(
                journey = journey,
                postmarks = travel.postmarks.filter { it.town.isNotBlank() }.map { CardTravelStop(it.town, it.state, it.on) },
                miles = travel.miles,
                towns = travel.towns,
                placesLeft = travel.placesLeft,
                nextPlace = travel.nextPlace,
                passedTo =
                    travel.passed.sortedBy { it.place }.map { passed ->
                        passed.firstName?.takeIf { it.isNotBlank() }
                            ?: passed.toName?.takeIf { it.isNotBlank() && !passed.byLink }
                            ?: "someone"
                    },
                canPassOn = travel.canPassOn,
                refusal = travel.passOnRefusal?.error,
            )
        }

        /** "2,692 miles", "1 mile". */
        fun miles(value: Int): String = "${NumberFormat.getIntegerInstance(Locale.US).format(value)} ${if (value == 1) "mile" else "miles"}"
    }
}
