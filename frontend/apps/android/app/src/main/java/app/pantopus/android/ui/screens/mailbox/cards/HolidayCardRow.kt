@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.SentHolidayCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import java.time.ZoneId

/** Today's card, unless it was taken back. */
val HolidayCardsResponse.todaysCard: SentHolidayCard?
    get() = today?.takeIf { it.status != "withdrawn" }

/**
 * The way in to Christmas cards, at the top of Me in the Mailbox: "Send a Christmas card" over a fan of three pictures,
 * or today's card once it's sent (one a day), with when it arrives. The Mailbox shows it only while cards are on and
 * open.
 */
@Composable
fun HolidayCardRow(
    cards: HolidayCardsResponse,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val today = cards.todaysCard
    val zone = HolidayCardTimes.zone(cards.timeZone)
    val title = if (today != null) "Today’s card · to ${today.toName ?: "them"}" else "Send a Christmas card"
    val line = if (today != null) todayLine(today, zone) else "Pick a picture and write a note. One card a day."
    val shape = RoundedCornerShape(Radii.lg)
    Row(
        modifier =
            modifier
                .padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s3)
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardNotePaper)
                .border(1.dp, PantopusColors.cardNoteEdge, shape)
                .clickable(onClick = onOpen)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .clearAndSetSemantics {
                    // "to Maya O." already ends with its full stop.
                    contentDescription = "${title.removeSuffix(".")}. $line"
                    role = Role.Button
                }.testTag("mailHolidayCardRow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Fan(today?.design?.let(::listOf) ?: HolidayCardArt.fan, cards)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                title,
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (today != null) PantopusColors.cardTextStrong else PantopusColors.cardWax,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(line, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.cardTextQuiet)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 20.dp, tint = PantopusColors.cardChevron)
    }
}

/** Where today's card is, in a line. */
private fun todayLine(
    card: SentHolidayCard,
    zone: ZoneId,
): String =
    when {
        card.byEmail -> if (card.status == "claimed") "They joined Pantopus and have it." else "Waiting for them to open the email."
        card.status == "delivered" -> "In their mailbox now."
        card.arrival == "christmas_morning" -> "Arrives on Christmas morning."
        else -> {
            val sealed = if (card.opensAt != null) ", sealed until Christmas" else ""
            "Arrives with their 7 a.m. mail on ${HolidayCardTimes.shortDay(card.arrivesOn ?: card.arrivesAt, zone)}$sealed."
        }
    }

/** Three pictures fanned out, or today's card on its own, tilted; each its paper at its shape while it loads. */
@Composable
private fun Fan(
    designs: List<String>,
    cards: HolidayCardsResponse,
) {
    Box(modifier = Modifier.size(width = 62.dp, height = 54.dp)) {
        designs.forEachIndexed { index, design ->
            val single = designs.size == 1
            val shape = RoundedCornerShape(2.dp)
            val known = cards.designOf(design)
            AsyncImage(
                model = HolidayCardArt.picture(design, thumb = true),
                contentDescription = null,
                contentScale = ContentScale.FillBounds,
                modifier =
                    Modifier
                        .offset(x = if (single) 11.dp else (index * 11).dp)
                        .rotate(if (single) -3f else (index - 1) * 7f)
                        .width(40.dp)
                        .aspectRatio(HolidayCardArt.pictureAspect(design, known?.height))
                        .shadow(3.dp, shape)
                        .clip(shape)
                        .background(HolidayCardArt.paper(known?.paper)),
            )
        }
    }
}
