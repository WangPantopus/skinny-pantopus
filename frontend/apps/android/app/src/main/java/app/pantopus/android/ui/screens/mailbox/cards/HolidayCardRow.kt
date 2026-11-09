@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import app.pantopus.android.data.api.models.mailbox.HolidayCardStamps
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
    get() = today?.takeIf { !postageEnabled && it.status != "withdrawn" }

/** With digital stamps on: what's left to send with (nothing said when the balance couldn't be read). */
private fun stampsLine(stamps: HolidayCardStamps?): String =
    when {
        stamps == null -> "Pick a picture and write a note."
        stamps.available == 0 -> "You’re out of stamps. Get a stamp book to send more."
        stamps.freeRemaining > 0 && stamps.paidRemaining <= 0 ->
            "Pick a picture and write a note. ${stamps.freeRemaining} free ${if (stamps.freeRemaining == 1) "card" else "cards"} left."
        else -> "Pick a picture and write a note. ${stamps.available} ${if (stamps.available == 1) "stamp" else "stamps"} left."
    }

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
    if (cards.postageEnabled) {
        HolidayStampPromotion(cards, onOpen, modifier)
        return
    }
    val today = cards.todaysCard
    val zone = HolidayCardTimes.zone(cards.timeZone)
    val title =
        when {
            today == null -> "Send a Christmas card"
            today.byLink && today.status != "claimed" -> "Today’s card · by link"
            else -> "Today’s card · to ${today.toName ?: "them"}"
        }
    val line =
        if (today != null) {
            todayLine(today, zone)
        } else if (cards.postageEnabled) {
            stampsLine(cards.stamps)
        } else {
            "Pick a picture and write a note. One card a day."
        }
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

/** Christmas promotion with direct access to the existing native purchase sheet. */
@Composable
private fun HolidayStampPromotion(
    cards: HolidayCardsResponse,
    onOpen: () -> Unit,
    modifier: Modifier,
    stamps: MailStampBooksViewModel = hiltViewModel(),
) {
    var showsBooks by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(cards.stamps?.available) { stamps.refresh() }
    LifecycleResumeEffect(stamps) {
        stamps.refresh()
        onPauseOrDispose { }
    }
    val shape = RoundedCornerShape(Radii.xl)
    Column(
        modifier =
            modifier.padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s3)
                .fillMaxWidth().clip(shape).background(PantopusColors.cardNotePaper)
                .border(1.dp, PantopusColors.cardNoteEdge, shape).padding(Spacing.s4)
                .testTag("christmasStampPromotion"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    "CHRISTMAS CARDS",
                    fontSize = 11.sp,
                    lineHeight = 15.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.4.sp,
                    color = PantopusColors.cardWax,
                )
                Text(
                    "Make their Christmas personal.",
                    fontSize = 23.sp,
                    lineHeight = 28.sp,
                    fontFamily = FontFamily.Serif,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.cardTextStrong,
                )
            }
            Fan(HolidayCardArt.fan, cards)
        }
        Text(
            "Pick a festive design, add your words, and send a digital card they can keep.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.cardTextBody,
        )
        val free = stamps.balance?.freeRemaining ?: cards.stamps?.freeRemaining
        val paid = stamps.balance?.paidRemaining ?: cards.stamps?.paidRemaining
        if (free != null && paid != null) {
            Text(
                stampBalanceLabel(free, paid),
                fontSize = 14.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardTextStrong,
            )
        }
        Text(
            "Free cards first. Then 1 stamp per recipient.",
            fontSize = 12.5.sp,
            lineHeight = 18.sp,
            color = PantopusColors.cardTextQuiet,
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            CardButton(
                if (stamps.balance?.salesOpen == false) "View stamp books" else "Buy stamp books",
                onClick = {
                    stamps.refresh()
                    showsBooks = true
                },
                modifier = Modifier.testTag("mailBuyStampBooks"),
            )
            CardButton(
                "Create a Christmas card",
                onClick = onOpen,
                kind = CardButtonKind.Paper,
                modifier = Modifier.testTag("mailHolidayCardRow"),
            )
        }
        val price = stamps.products.firstOrNull()?.oneTimePurchaseOfferDetails?.formattedPrice
        val caption =
            if (stamps.balance?.salesOpen == false) {
                "Use your stamps until December 31."
            } else {
                price?.let { "Stamp books from $it · One-time purchase" } ?: "Books of 5, 20 or 50 stamps · No subscription"
            }
        Text(
            caption,
            fontSize = 12.5.sp,
            lineHeight = 18.sp,
            color = PantopusColors.cardTextQuiet,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
    if (showsBooks) StampBooksSheet(stamps, onDismiss = { showsBooks = false })
}

/** Where today's card is, in a line. */
private fun todayLine(
    card: SentHolidayCard,
    zone: ZoneId,
): String =
    when {
        card.byLink ->
            if (card.status == "claimed") {
                card.toName?.let { "$it opened your link and has your card." } ?: "They opened your link and have your card."
            } else {
                "Waiting for someone to open your link."
            }
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
