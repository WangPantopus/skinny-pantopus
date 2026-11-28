@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.CardFreeAllowance
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.StampBalance
import app.pantopus.android.ui.theme.Spacing

/**
 * What Write on the back says about a photo or voice greeting and the stamps it needs. [buyStamp]: the buttons open the
 * stamp books, and [needsStampLine] says why; [freeHint]: one quiet line under them while free photo cards are left.
 */
internal data class CardMediaWords(
    val buyStamp: Boolean,
    val needsStampLine: String = MEDIA_NEEDS_BOUGHT_STAMP,
    val freeHint: String? = null,
)

/**
 * [CardMediaWords] for this read of `GET /cards`, the stamps left ([stamps], once read) and the card's people. Without
 * `improved`, as before: the buttons open the stamp books while `media.bought_stamp` says "buy". With it (cards-next
 * Wave 2): the first `media.free_allowance.limit` cards with a photo or greeting need no bought stamp; with free ones
 * left but no stamp of any kind (fix 4) the buttons open the stamp books with the line from before; with at least one
 * stamp and no bought one, the free line shows, as on the web and iPhone.
 */
internal fun HolidayCardsResponse.mediaWords(
    stamps: StampBalance?,
    form: SendCardForm,
): CardMediaWords {
    val toBuy = postageEnabled && media?.boughtStamp?.toBuy == true
    val free = media?.freeAllowance?.takeIf { improved && postageEnabled && it.limit > 0 } ?: return CardMediaWords(toBuy)
    val stampsLeft = stamps?.available ?: this.stamps?.available ?: 0
    val boughtLeft = stamps?.paidRemaining ?: this.stamps?.paidRemaining ?: 0
    return when {
        free.remaining <= 0 ->
            CardMediaWords(toBuy, "You’ve used your ${free.limit} free photo or voice cards. Adding more uses a bought stamp.")
        stampsLeft == 0 -> CardMediaWords(buyStamp = true)
        boughtLeft > 0 -> CardMediaWords(toBuy)
        else -> CardMediaWords(toBuy, freeHint = freeHint(free, form))
    }
}

/** The free photo cards line: how many are left, and what a list needs beyond them. */
private fun freeHint(
    free: CardFreeAllowance,
    form: SendCardForm,
): String {
    val count = (form.to as? CardRecipient.Several)?.entries?.size ?: 1
    return when {
        count > free.remaining -> {
            val need = count - free.remaining
            "You have ${free.remaining} free photo or voice ${cards(free.remaining)} left. This list of $count will need " +
                "$need bought ${if (need == 1) "stamp" else "stamps"}."
        }
        free.remaining == free.limit -> "Your first ${free.limit} cards with a photo or voice greeting are free."
        else -> "${free.remaining} free photo or voice ${cards(free.remaining)} left — after that, they use a bought stamp."
    }
}

private fun cards(count: Int): String = if (count == 1) "card" else "cards"

/** The free photo cards line under "Add a photo" and "Record a greeting" (cards-next Wave 2). */
@Composable
internal fun MediaFreeHint(text: String) {
    Text(
        text,
        fontSize = 13.sp,
        color = DeskInk.quiet,
        modifier = Modifier.padding(top = Spacing.s2).testTag("sendCardMediaFreeHint"),
    )
}
