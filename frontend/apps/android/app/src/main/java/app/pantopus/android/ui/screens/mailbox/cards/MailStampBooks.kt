@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.R
import app.pantopus.android.data.api.models.mailbox.StampBalance
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.mailbox.components.MailStamp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import com.android.billingclient.api.ProductDetails
import java.text.NumberFormat
import java.util.Currency

// Digital stamps (server `MAIL_STAMPS_ENABLED`), mirroring the web's `StampBooks.tsx` and iOS `MailStampBooksView.swift`:
// the stamp count in the card composer's header, the postage line by Seal and send, and the stamp books sheet that opens
// from either (or when a card needs a stamp and none are left). The server owns the balance.

/** The painted Pantopus Post stamp the card table uses for [this]. */
private val MailStamp.art: Int
    get() =
        when (this) {
            MailStamp.Fir -> R.drawable.card_table_stamp_fir
            MailStamp.Peak -> R.drawable.card_table_stamp_peak
            MailStamp.River -> R.drawable.card_table_stamp_river
        }

/** The stamp a card carries, by its picture's number: the same in every app. */
internal fun cardStamp(design: String?): MailStamp = design?.let { MailStamp.forCard(null, it) } ?: MailStamp.Fir

private fun plural(
    count: Int,
    one: String,
    many: String = "${one}s",
): String = "$count ${if (count == 1) one else many}"

/** A painted stamp with a soft shadow in its own perforated shape. */
@Composable
internal fun PaintedStamp(
    stamp: MailStamp,
    width: Dp,
    height: Dp,
    modifier: Modifier = Modifier,
) {
    val art = painterResource(stamp.art)
    Box(modifier = modifier.size(width = width, height = height)) {
        Image(
            painter = art,
            contentDescription = null,
            contentScale = ContentScale.Fit,
            colorFilter = ColorFilter.tint(PantopusColors.cardEdgeShade.copy(alpha = 0.3f)),
            modifier = Modifier.matchParentSize().offset(y = 1.dp),
        )
        Image(painter = art, contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.matchParentSize())
    }
}

/** The composer header's stamp count: opens the stamp books. Nothing until the balance is read. */
@Composable
internal fun StampChip(
    balance: StampBalance?,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val have = balance ?: return
    val shape = RoundedCornerShape(Radii.lg)
    Row(
        modifier =
            modifier.fillMaxWidth().clip(shape)
                .background(PantopusColors.cardNotePaper)
                .border(1.dp, PantopusColors.cardNoteEdge, shape)
                .clickable(onClick = onOpen)
                .padding(Spacing.s3)
                .clearAndSetSemantics {
                    contentDescription = stampBalanceLabel(have.freeRemaining, have.paidRemaining) +
                        if (have.salesOpen == false) ". View stamp books" else ". Buy stamp books"
                    role = Role.Button
                }.testTag("stampChip"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                plural(have.freeRemaining, "free card"),
                fontSize = 14.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardTextStrong,
            )
            Text(
                "${plural(have.paidRemaining.coerceAtLeast(0), "paid stamp")} · 1 stamp = 1 card",
                fontSize = 12.5.sp,
                lineHeight = 17.sp,
                color = PantopusColors.cardTextQuiet,
            )
        }
        Box(
            modifier =
                Modifier.clip(RoundedCornerShape(Radii.md)).background(PantopusColors.cardWax)
                    .heightIn(min = 44.dp).padding(horizontal = Spacing.s3),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                if (have.salesOpen == false) "View stamps" else "Buy stamps",
                fontSize = 14.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.cardWaxText,
            )
        }
    }
}

internal fun stampBalanceLabel(
    free: Int,
    paid: Int,
): String = "${plural(free, "free card")} · ${plural(paid.coerceAtLeast(0), "paid stamp")}"

/** What this card costs, beside Seal and send, in the card's own stamp ([design] is its picture); [count] cards on a list. */
@Composable
internal fun StampPostageLine(
    balance: StampBalance?,
    design: String?,
    modifier: Modifier = Modifier,
    count: Int = 1,
) {
    val have = balance ?: return
    val out = have.available < count
    val shape = RoundedCornerShape(Radii.lg)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardField)
                .drawBehind {
                    val edge = 1.dp.toPx()
                    drawRoundRect(
                        color = PantopusColors.cardFieldEdge,
                        topLeft = Offset(edge / 2, edge / 2),
                        size = Size(size.width - edge, size.height - edge),
                        cornerRadius = CornerRadius(Radii.lg.toPx()),
                        style = Stroke(width = edge, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))),
                    )
                }.padding(horizontal = Spacing.s3, vertical = 10.dp)
                .semantics(mergeDescendants = true) {}
                .testTag("postageLine"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PaintedStamp(cardStamp(design), width = 30.dp, height = 38.dp, modifier = Modifier.rotate(3f))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                if (count > 1) "POSTAGE · $count PEOPLE · ${plural(count, "STAMP", "STAMPS")}" else "POSTAGE",
                fontSize = 11.sp,
                lineHeight = 14.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.3.sp,
                color = PantopusColors.cardFooterInk,
            )
            Text(
                if (count > 1) listPostageLine(have, count) else postageLine(have),
                fontSize = 14.sp,
                lineHeight = 19.sp,
                color = if (out) PantopusColors.cardWax else PantopusColors.cardTextStrong,
            )
        }
    }
}

private fun postageLine(have: StampBalance): String =
    when {
        have.available == 0 -> "No stamps left. Get a stamp book to send this card."
        have.freeRemaining > 1 -> "Free: uses 1 of your free cards (${have.freeRemaining - 1} left after this)."
        have.freeRemaining == 1 -> "Free: this is your last free card."
        else -> "1 stamp (${plural(have.available - 1, "stamp")} left after this)."
    }

/** What [count] cards on a list cost: free cards first, then stamps; or how many they need. */
private fun listPostageLine(
    have: StampBalance,
    count: Int,
): String {
    if (have.available < count) return "$count cards need ${plural(count, "stamp")}. You have ${haveWords(have)}."
    val free = minOf(have.freeRemaining, count)
    val paid = count - free
    val left = have.available - count
    return when {
        free > 0 && paid > 0 ->
            "${plural(free, "free card")} first, then ${plural(paid, "stamp")}. ${plural(left, "stamp")} left after this."
        free > 0 -> "Free: uses $free of your free cards (${have.freeRemaining - free} left after this)."
        else -> "${plural(paid, "stamp")} (${plural(left, "stamp")} left after this)."
    }
}

/** What's left, in words: "1 free card and 2 stamps". */
private fun haveWords(have: StampBalance): String =
    if (have.available == 0) "none left" else stampsHeldWords(have.available, have.freeRemaining, have.paidRemaining)

/**
 * The stamps someone holds, in the stamp screens' words: "3 free cards", "1 free card and 2 stamps", "2 stamps", or
 * "You’re out of stamps" (Mail's day-with-no-mail card says it beside its stamps).
 */
internal fun stampsHeldWords(
    available: Int,
    free: Int,
    paid: Int,
): String {
    val bought = maxOf(0, paid)
    return when {
        available == 0 -> "You’re out of stamps"
        bought > 0 && free > 0 -> "${plural(free, "free card")} and ${plural(bought, "stamp")}"
        bought > 0 -> plural(bought, "stamp")
        else -> plural(free, "free card")
    }
}

/** A fanned book of stamps; bigger books fan more stamps. */
@Composable
private fun StampBooklet(credits: Int) {
    val shown =
        when {
            credits >= 50 -> 4
            credits >= 20 -> 3
            else -> 2
        }
    Box(modifier = Modifier.size(width = 60.dp, height = 58.dp).clearAndSetSemantics {}, contentAlignment = Alignment.Center) {
        repeat(shown) { index ->
            val turn = (index - (shown - 1) / 2f) * 9f
            PaintedStamp(
                MailStamp.entries[index % MailStamp.entries.size],
                width = 38.dp,
                height = 47.dp,
                modifier =
                    Modifier
                        .offset(x = (turn * 0.9f).dp)
                        .graphicsLayer {
                            rotationZ = turn
                            transformOrigin = TransformOrigin(0.5f, 1f)
                        },
            )
        }
    }
}

private const val FINE_PRINT =
    "Digital delivery only. Christmas cards can be sent until December 31; unused stamps stay in your account. " +
        "Receiving cards and replying are always free."

/**
 * The stamp books: what's left, the three books at Google Play's prices, and what a stamp does. Buying goes through
 * Google Play; the server credits the stamps before the purchase is consumed.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun StampBooksSheet(
    model: MailStampBooksViewModel,
    onDismiss: () -> Unit,
    /** Opened for a list whose cards need more stamps than are left. */
    short: StampShort? = null,
    /** Opened for the card's photo or voice greeting, which need a bought stamp: the sheet says so first. */
    forMedia: Boolean = false,
) {
    val activity = LocalContext.current.activity()
    val balance = model.balance
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.cardDesk,
        dragHandle = { BottomSheetDefaults.DragHandle(color = PantopusColors.cardFieldEdge) },
        modifier = Modifier.testTag("stampBooks"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(start = Spacing.s5, end = Spacing.s5, bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Row(verticalAlignment = Alignment.Top) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        "Christmas stamp books",
                        fontFamily = FontFamily.Serif,
                        fontSize = 28.sp,
                        lineHeight = 34.sp,
                        color = PantopusColors.cardTextStrong,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text(
                        "Send a little Christmas joy to everyone on your list. One stamp sends one digital card to one person.",
                        fontSize = 15.sp,
                        lineHeight = 21.sp,
                        color = PantopusColors.cardTextQuiet,
                    )
                }
                IconButton(onClick = onDismiss, modifier = Modifier.testTag("stampBooksClose")) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = "Close",
                        size = 20.dp,
                        tint = PantopusColors.cardTextQuiet,
                    )
                }
            }
            short?.takeIf { it.missing > 0 }?.let {
                Text(
                    "These ${it.cards} cards need ${plural(it.missing, "more stamp", "more stamps")}.",
                    fontSize = 15.sp,
                    lineHeight = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.cardWax,
                    modifier = Modifier.testTag("stampBooksShort"),
                )
            }
            if (forMedia) {
                Text(
                    MEDIA_NEEDS_BOUGHT_STAMP,
                    fontSize = 15.sp,
                    lineHeight = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.cardWax,
                    modifier = Modifier.testTag("stampBooksMediaReason"),
                )
            }
            balance?.let { have ->
                Text(
                    haveLine(have),
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (have.available == 0) PantopusColors.cardWax else PantopusColors.cardTextBody,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.cardInitialPaper)
                            .padding(horizontal = Spacing.s3, vertical = 5.dp),
                )
            }
            when {
                balance?.salesOpen == false ->
                    SheetNote("Stamp books aren’t on sale any more this year. You can use your stamps until December 31.")
                model.products.isNotEmpty() ->
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        model.products.forEach { product ->
                            val book = balance?.books?.firstOrNull { it.id == product.productId }
                            val price = product.oneTimePurchaseOfferDetails?.formattedPrice
                            if (book != null && price != null) {
                                StampBookRow(
                                    credits = book.credits,
                                    detail =
                                        listOfNotNull(
                                            "Send ${book.credits} digital cards",
                                            perCard(product, book.credits),
                                        ).joinToString(" · "),
                                    price = price,
                                    enabled = !model.busy && activity != null,
                                    onBuy = { activity?.let { model.buy(it, product) } },
                                )
                            }
                        }
                    }
                model.storeAnswered -> SheetNote("Stamp books are unavailable in Google Play right now.")
                // Google Play is still answering: the books' places.
                balance != null ->
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        repeat(3) { Shimmer(width = 360.dp, height = 78.dp, cornerRadius = Radii.xl, modifier = Modifier.fillMaxWidth()) }
                    }
            }
            Text(
                "One-time purchase · No subscription. Your free cards are used first.",
                fontSize = 13.sp,
                lineHeight = 18.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.cardTextBody,
            )
            Text(FINE_PRINT, fontSize = 12.5.sp, lineHeight = 18.sp, color = PantopusColors.cardFooterInk)
            model.message?.let {
                Text(
                    it,
                    fontSize = 13.5.sp,
                    lineHeight = 19.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.cardTextBody,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
            Text(
                "Already paid? Check for your stamps",
                fontSize = 13.5.sp,
                lineHeight = 19.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardWax,
                modifier =
                    Modifier
                        .alpha(if (model.busy) 0.5f else 1f)
                        .clickable(enabled = !model.busy, role = Role.Button, onClick = model::refresh)
                        .padding(vertical = Spacing.s2)
                        .testTag("stampBooksCheck"),
            )
        }
    }
}

private fun haveLine(have: StampBalance): String {
    val paid = have.paidRemaining.coerceAtLeast(0)
    val free = have.freeRemaining
    return when {
        have.available == 0 -> "You’re out of stamps."
        paid > 0 && free > 0 -> "You have ${plural(paid, "stamp")} and ${plural(free, "free card")}."
        paid > 0 -> "You have ${plural(paid, "stamp")}."
        else -> "You have ${plural(free, "free card")} left."
    }
}

/** Google Play's price for one card, in its own currency. */
private fun perCard(
    product: ProductDetails,
    credits: Int,
): String? {
    val offer = product.oneTimePurchaseOfferDetails ?: return null
    if (credits <= 0) return null
    val format =
        runCatching { NumberFormat.getCurrencyInstance().apply { currency = Currency.getInstance(offer.priceCurrencyCode) } }
            .getOrNull() ?: return null
    return format.format(offer.priceAmountMicros / MICROS / credits) + " a card"
}

private const val MICROS = 1_000_000.0

/** A note in the sheet: why the books aren't there. */
@Composable
private fun SheetNote(text: String) {
    val shape = RoundedCornerShape(Radii.lg)
    Text(
        text,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        color = PantopusColors.cardTextBody,
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardField)
                .border(1.dp, PantopusColors.cardNoteEdge, shape)
                .padding(Spacing.s3)
                .testTag("stampBooksNote"),
    )
}

/** One book: its fan of stamps, how many and what for, and Google Play's price in a wax pill. */
@Composable
private fun StampBookRow(
    credits: Int,
    detail: String,
    price: String,
    enabled: Boolean,
    onBuy: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.xl)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .alpha(if (enabled) 1f else 0.6f)
                .clip(shape)
                .background(PantopusColors.cardField)
                .border(1.dp, if (credits == 20) PantopusColors.cardWax.copy(alpha = 0.45f) else PantopusColors.cardNoteEdge, shape)
                .clickable(enabled = enabled, role = Role.Button, onClick = onBuy)
                .padding(start = Spacing.s2, end = Spacing.s3, top = 10.dp, bottom = 10.dp)
                .testTag("stampBook.$credits"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StampBooklet(credits)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "$credits stamps",
                fontSize = 17.sp,
                lineHeight = 22.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardTextStrong,
            )
            if (detail.isNotEmpty()) Text(detail, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.cardTextQuiet)
        }
        Text(
            "Buy $price",
            fontSize = 15.sp,
            lineHeight = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.cardWaxText,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.cardWax)
                    .padding(horizontal = 14.dp, vertical = Spacing.s2),
        )
    }
}
