@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.net.Uri
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.mailbox.CardPhoto
import app.pantopus.android.ui.screens.mailbox.mail_detail.letter.MailLetterCard
import app.pantopus.android.ui.theme.PantopusColors
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import java.io.File
import java.time.LocalDate
import java.time.OffsetDateTime
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * A card's own photo as the apps draw it (memories plan step 4): where its bytes are read, always one of the routes that
 * check the reader on every request, never a storage link; its upright size; the sender's description; and whether it's
 * [covered] (from someone who isn't the reader's connection: nothing loads until the tap). Never in a share picture.
 */
data class CardPrintPhoto(
    val url: String,
    val width: Int?,
    val height: Int?,
    val alt: String?,
    val covered: Boolean = false,
) {
    /** How tall the print's picture is for its width; a photo of unknown shape is drawn 4:3. */
    val ratio: Float get() {
        val w = width ?: 0
        val h = height ?: 0
        return if (w > 0 && h > 0) w.toFloat() / h else 4f / 3f
    }

    companion object {
        private fun base() = BuildConfig.PANTOPUS_API_BASE_URL.trimEnd('/')

        /** The sender's own upload, while it's written and on Look it over (`GET /api/mailbox/cards/media/:fileId`). */
        fun own(photo: CardPhoto): CardPrintPhoto =
            CardPrintPhoto("${base()}/api/mailbox/cards/media/${Uri.encode(photo.fileId)}", photo.width, photo.height, photo.alt)

        /** On a card the person sent (`GET /api/mailbox/sent/:id/card-media/:fileId`); never covered for its sender. */
        fun sent(
            sentId: String,
            photo: CardPhoto,
        ): CardPrintPhoto =
            CardPrintPhoto(
                "${base()}/api/mailbox/sent/${Uri.encode(sentId)}/card-media/${Uri.encode(photo.fileId)}",
                photo.width,
                photo.height,
                photo.alt,
            )

        /** On a card the person got (`GET /api/mailbox/:id/card-media/:fileId`), covered as the server says. */
        fun received(
            pieceId: String,
            photo: CardPhoto,
        ): CardPrintPhoto =
            CardPrintPhoto(
                "${base()}/api/mailbox/${Uri.encode(pieceId)}/card-media/${Uri.encode(photo.fileId)}",
                photo.width,
                photo.height,
                photo.alt,
                covered = photo.covered,
            )
    }
}

/**
 * "'26 11 10": the card's own day as a 1990s camera printed it, for a nostalgia card's print (the founder's choice;
 * never the photo's own date). Null when the day can't be read.
 */
internal fun printedDate(at: String?): String? {
    val text = at ?: return null
    val day =
        runCatching { OffsetDateTime.parse(text).toLocalDate() }.getOrNull()
            ?: runCatching { LocalDate.parse(text.take(10)) }.getOrNull()
            ?: return null

    fun two(n: Int) = n.toString().padStart(2, '0')
    return "'${two(day.year % 100)} ${two(day.monthValue)} ${two(day.dayOfMonth)}"
}

/**
 * The print (wave 4 drawings 2-5): a white-bordered photo lying a little askew, with a soft gloss, and on a nostalgia card
 * the orange date ([datedOn]). [local] is the chosen picture on this phone while it uploads ([uploading] runs a bar along
 * the print). A [CardPrintPhoto.covered] one says "Photo from {first name}. Tap to show." and loads nothing until tapped.
 */
@Composable
internal fun CardPrint(
    photo: CardPrintPhoto?,
    modifier: Modifier = Modifier,
    local: File? = null,
    localRatio: Float? = null,
    datedOn: String? = null,
    fromFirst: String = "",
    uploading: Boolean = false,
    tilt: Float = -3f,
) {
    var uncovered by remember(photo?.url) { mutableStateOf(false) }
    val covered = photo?.covered == true && !uncovered
    val ratio = photo?.ratio ?: localRatio ?: (4f / 3f)
    val who = fromFirst.ifBlank { "them" }
    BoxWithConstraints(
        modifier =
            modifier
                .rotate(tilt)
                .shadow(10.dp, RectangleShape)
                .background(PantopusColors.cardPrintPaper)
                .testTag("cardPrint"),
    ) {
        val side = maxWidth * 0.06f
        Box(modifier = Modifier.padding(start = side, end = side, top = side, bottom = maxWidth * 0.14f)) {
            if (covered) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .aspectRatio(ratio)
                            .background(PantopusColors.cardPrintCover)
                            .clickable(role = Role.Button, onClickLabel = "Show the photo") { uncovered = true }
                            .testTag("cardPrintCover"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "Photo from $who. Tap to show.",
                        fontFamily = FontFamily.Serif,
                        fontSize = 15.sp,
                        lineHeight = 1.35.em,
                        color = PantopusColors.cardPrintCoverInk,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 12.dp),
                    )
                }
            } else {
                PrintPicture(photo, local, ratio, datedOn, who)
            }
        }
        if (uploading) {
            Box(
                Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .height(5.dp)
                    .background(PantopusColors.cardWax),
            )
        }
    }
}

@Composable
private fun PrintPicture(
    photo: CardPrintPhoto?,
    local: File?,
    ratio: Float,
    datedOn: String?,
    who: String,
) {
    val context = LocalContext.current
    var failed by remember(photo?.url, local) { mutableStateOf(false) }
    var shown by remember(photo?.url, local) { mutableStateOf(false) }
    val model =
        remember(photo?.url, local) {
            when {
                local != null -> local
                photo != null ->
                    // The bytes come only from the reader-checked route, held in memory (cleared on sign-out), never on disk.
                    ImageRequest
                        .Builder(context)
                        .data(photo.url)
                        .diskCachePolicy(CachePolicy.DISABLED)
                        .build()
                else -> null
            }
        }
    Box(modifier = Modifier.fillMaxWidth().aspectRatio(ratio).background(PantopusColors.cardPrintEmpty)) {
        if (model != null) {
            AsyncImage(
                model = model,
                contentDescription = photo?.alt?.takeIf { it.isNotBlank() } ?: "Photo from $who",
                contentScale = ContentScale.Crop,
                onSuccess = { shown = true },
                onError = { failed = true },
                modifier = Modifier.fillMaxSize(),
            )
        }
        if (failed) {
            Text(
                "This photo couldn’t be loaded.",
                fontSize = 12.sp,
                color = PantopusColors.cardPrintEmptyInk,
                textAlign = TextAlign.Center,
                modifier = Modifier.align(Alignment.Center).padding(horizontal = 8.dp),
            )
        }
        // A soft gloss across the print.
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        0f to PantopusColors.cardPrintGloss,
                        0.4f to PantopusColors.cardPrintGloss.copy(alpha = 0f),
                        start = Offset.Zero,
                        end = Offset.Infinite,
                    ),
                ),
        )
        val date = printedDate(datedOn)
        if (date != null && shown) {
            BoxWithConstraints(Modifier.fillMaxSize()) {
                Text(
                    date,
                    style =
                        TextStyle(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = (maxWidth.value * 0.065f).coerceIn(10f, 15f).sp,
                            letterSpacing = 0.08.em,
                            color = PantopusColors.cardPrintDate,
                            shadow = Shadow(PantopusColors.cardPrintDateGlow, blurRadius = 8f),
                        ),
                    modifier =
                        Modifier
                            .align(Alignment.BottomEnd)
                            .padding(end = maxWidth * 0.06f, bottom = maxWidth * 0.045f)
                            .clearAndSetSemantics {},
                )
            }
        }
    }
}

/**
 * The card's own photo lying on the table once the card is turned over (wave 4 drawings 3 and 4): under the card and a
 * little over its bottom edge, in the room the table keeps for it ([TableGeometry.mediaRoom]), clear of FROM and the
 * signature and of the buttons. It isn't part of the card: it stays put while the card moves and never turns with it,
 * and screen readers reach it. Hidden while the card is enlarged; it fades in (at once with Reduce Motion).
 */
@Composable
internal fun TableMedia(
    state: CardTableState,
    card: CardOnTable,
    g: TableGeometry,
    reduceMotion: Boolean,
) {
    if (!card.hasMedia || g.mediaRoom <= 0f) return
    val shown = state.cardOutForOrder && state.cardBackShows && !state.enlarged
    val seen by animateFloatAsState(if (shown) 1f else 0f, tween(if (reduceMotion) 0 else 450), label = "cardMedia")
    if (seen <= 0f) return
    val density = LocalDensity.current
    val fade =
        Modifier.graphicsLayer {
            alpha = seen
            translationY = (1f - seen) * g.mediaRoom * 0.05f
        }
    card.photo?.let { photo ->
        // A portrait print lies narrower than a landscape one, so either fits the room.
        val printK = 0.88f / photo.ratio + 0.2f
        val width = min(g.cardWidth * 0.47f, g.mediaRoom * 1.1f / printK)
        val left = g.cardX + g.cardWidth * 0.02f
        val top = g.cardTop + g.cardHeight - g.mediaRoom * 0.16f
        CardPrint(
            photo = photo,
            datedOn = card.mailedOn.takeIf { state.mood == CardMood.Nostalgia },
            fromFirst = card.fromFirst,
            tilt = -3f,
            modifier =
                Modifier
                    .offset { IntOffset(left.roundToInt(), top.roundToInt()) }
                    .width(with(density) { width.toDp() })
                    .then(fade)
                    .testTag("cardTablePrint"),
        )
    }
    card.voice?.let { voice ->
        // As the web lays it: at the right under the card (in the middle when there's no photo).
        val width = min(g.cardWidth * 0.45f, (g.mediaRoom * 1.02f - 30.4f * g.density) / 0.62f)
        val left = if (card.photo != null) g.cardX + g.cardWidth * 0.98f - width else g.cardX + (g.cardWidth - width) / 2f
        val top = g.cardTop + g.cardHeight - g.mediaRoom * 0.08f
        CardGreeting(
            voice = voice,
            forFirst = card.to?.trim()?.substringBefore(' ')?.takeIf { it.isNotEmpty() } ?: "you",
            fromFirst = card.fromFirst,
            gift = state.mood == CardMood.Reverence,
            tilt = 3f,
            active = shown,
            modifier =
                Modifier
                    .offset { IntOffset(left.roundToInt(), top.roundToInt()) }
                    .width(with(density) { width.toDp() })
                    .then(fade)
                    .testTag("cardTableGreeting"),
        )
    }
}

/**
 * A card's own photo and voice greeting under its back where the sender looks at them (Look it over, Sent): theirs, so
 * the photo is never covered; the orange date on a nostalgia card; the cassette (a gift tag for Christmas with Jesus
 * Christ) labelled for [forFirst], pressed to play.
 */
@Composable
internal fun LetterCardPrint(
    card: MailLetterCard,
    fromFirst: String,
    forFirst: String,
    modifier: Modifier = Modifier,
) {
    if (card.photo == null && card.voice == null) return
    val mood = CardMood.of(card.number, card.design)
    Row(
        modifier = modifier.fillMaxWidth().testTag("cardLetterMedia"),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.Top,
    ) {
        card.photo?.let { photo ->
            CardPrint(
                photo = photo,
                datedOn = card.mailedOn.takeIf { mood == CardMood.Nostalgia },
                fromFirst = fromFirst,
                tilt = -3f,
                modifier = Modifier.weight(0.55f).testTag("cardLetterPrint"),
            )
        }
        card.voice?.let { voice ->
            CardGreeting(
                voice = voice,
                forFirst = forFirst,
                fromFirst = fromFirst,
                gift = mood == CardMood.Reverence,
                modifier = Modifier.weight(0.45f).padding(top = 12.dp),
            )
        }
        if (card.photo == null || card.voice == null) Spacer(Modifier.weight(0.45f))
    }
}
