@file:Suppress("PackageNaming", "MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.DrawerMail
import app.pantopus.android.ui.screens.mailbox.components.MailPiece
import app.pantopus.android.ui.screens.mailbox.components.MailPieceMapper
import app.pantopus.android.ui.screens.mailbox.components.MailPieceModel
import app.pantopus.android.ui.screens.mailbox.components.MappedMail
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.roundToInt

/**
 * A piece on the Counter (Mail tab drawings, board `R9-Counter`): its manila due tag ("DUE NOV 7", "DUE TODAY",
 * "OVERDUE", "SIGN", "TO DO"), the line under it ("Pay $184.00 · due Fri, Nov 7") and its one button: Pay for a bill
 * still owed, Acknowledge when the sender asks, else Open. The same words as iOS.
 */
data class MailCounterItem(
    val piece: MailPieceModel,
    /** The tag's words, one or two lines. */
    val tag: String,
    val lineTitle: String,
    val lineDetail: String?,
    /** Due today or overdue (or waiting to be acknowledged): the detail reads in the warning colour. */
    val pressing: Boolean,
    /** Pay opens this invoice; null opens the piece. */
    val payInvoiceId: String?,
    val actionLabel: String,
) {
    val id: String get() = piece.id

    /** One sentence for TalkBack: the piece, then what it needs. */
    val spokenLabel: String get() = "${piece.accessibilityLabel} ${listOfNotNull(lineTitle, lineDetail).joinToString(", ")}."

    companion object {
        private val tagDay = DateTimeFormatter.ofPattern("MMM d", Locale.US)
        private val dueDay = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)

        fun from(
            mail: MappedMail,
            zone: ZoneId,
            now: Instant = Instant.now(),
        ): MailCounterItem {
            val row = mail.row
            val today = now.atZone(zone).toLocalDate()
            val payable = row.invoice?.takeIf { it.owed }
            val due = parseDay(payable?.dueDate ?: row.invoice?.dueDate ?: row.dueDate)
            val daysLeft = due?.let { ChronoUnit.DAYS.between(today, it) }
            val asksAcknowledge = asksAcknowledge(row)
            val tag = tag(due, daysLeft, asksAcknowledge)
            val detail = if (due != null && daysLeft != null) dueWords(due, daysLeft) else null
            val pressing = (daysLeft ?: 1L) <= 0L
            return when {
                payable != null ->
                    MailCounterItem(
                        piece = mail.piece,
                        tag = tag,
                        lineTitle = payable.totalCents?.let { "Pay ${MailPieceMapper.money(it, payable.currency)}" } ?: "Pay this bill",
                        lineDetail = detail,
                        pressing = pressing,
                        payInvoiceId = payable.id,
                        actionLabel = "Pay",
                    )
                asksAcknowledge ->
                    MailCounterItem(
                        piece = mail.piece,
                        tag = tag,
                        lineTitle = "Acknowledge it",
                        lineDetail = detail ?: arrived(row, zone, today),
                        pressing = true,
                        payInvoiceId = null,
                        actionLabel = "Acknowledge",
                    )
                else ->
                    MailCounterItem(
                        piece = mail.piece,
                        tag = tag,
                        lineTitle = row.displayTitle?.takeIf { it.isNotBlank() } ?: row.subject?.takeIf { it.isNotBlank() } ?: "Read it",
                        lineDetail = detail,
                        pressing = pressing,
                        payInvoiceId = null,
                        actionLabel = "Open",
                    )
            }
        }

        /** The tag's words: when it's due, else what it asks. */
        private fun tag(
            due: LocalDate?,
            daysLeft: Long?,
            asksAcknowledge: Boolean,
        ): String =
            when {
                due == null || daysLeft == null -> if (asksAcknowledge) "SIGN" else "TO DO"
                daysLeft < 0 -> "OVERDUE"
                daysLeft == 0L -> "DUE\nTODAY"
                else -> "DUE\n${due.format(tagDay).uppercase(Locale.US)}"
            }

        /** "overdue since Mon, Oct 26", "due today", "due tomorrow" or "due Fri, Nov 7". */
        private fun dueWords(
            due: LocalDate,
            daysLeft: Long,
        ): String =
            when {
                daysLeft < 0 -> "overdue since ${due.format(dueDay)}"
                daysLeft == 0L -> "due today"
                daysLeft == 1L -> "due tomorrow"
                else -> "due ${due.format(dueDay)}"
            }

        /** The sender asks for an acknowledgement (or it's certified mail), and nobody in the household gave it yet. */
        private fun asksAcknowledge(row: DrawerMail): Boolean {
            val asked = row.ackRequired == true || row.certified
            val given = row.acknowledgedAt != null || row.ackStatus.equals("acknowledged", ignoreCase = true)
            return asked && !given
        }

        /** "arrived today" or "arrived Mon, Oct 26". */
        private fun arrived(
            row: DrawerMail,
            zone: ZoneId,
            today: LocalDate,
        ): String {
            val day = MailPieceMapper.deliveredAt(row)?.atZone(zone)?.toLocalDate() ?: today
            return if (day == today) "arrived today" else "arrived ${day.format(dueDay)}"
        }

        private fun parseDay(value: String?): LocalDate? = value?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }
    }
}

/** The Counter's top: "3 waiting on you · Soonest first. Done pieces go to the Vault." on the counter's surface. */
@Composable
fun MailCounterTop(count: Int) {
    Column(
        modifier =
            Modifier
                .padding(start = Spacing.s3, end = Spacing.s3, top = 14.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
                .background(PantopusColors.mailCounter)
                .padding(start = Spacing.s4, end = Spacing.s4, top = 14.dp, bottom = 18.dp)
                .testTag("mailCounterTop"),
    ) {
        Text(
            if (count == 1) "1 waiting on you" else "$count waiting on you",
            fontSize = 18.sp,
            lineHeight = 24.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            "Soonest first. Done pieces go to the Vault.",
            fontSize = 13.sp,
            lineHeight = 18.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/**
 * One piece on the counter: drawn a little smaller with its manila tag tied on, the line under it and its button. The
 * piece opens the letter; the button pays, or opens it to acknowledge or read.
 */
@Composable
fun MailCounterRow(
    item: MailCounterItem,
    index: Int,
    onOpen: () -> Unit,
    onAction: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s3)
                .fillMaxWidth()
                .background(PantopusColors.mailCounter)
                .padding(start = Spacing.s3, end = Spacing.s3, bottom = 20.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(onClick = onOpen)
                    .clearAndSetSemantics {
                        contentDescription = item.spokenLabel
                        role = Role.Button
                    }.testTag("mailCounterPiece.${item.id}"),
        ) {
            Scaled(COUNTER_PIECE_SCALE) { MailPiece(item.piece) }
            MailDueTag(
                text = item.tag,
                tilt = tagTilts[index % tagTilts.size],
                modifier = Modifier.align(Alignment.TopEnd).offset(x = 2.dp, y = 16.dp),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)) { append(item.lineTitle) }
                    item.lineDetail?.let { detail ->
                        withStyle(SpanStyle(color = if (item.pressing) PantopusColors.warning else PantopusColors.appTextSecondary)) {
                            append(" · $detail")
                        }
                    }
                },
                fontSize = 14.sp,
                lineHeight = 20.sp,
                modifier = Modifier.weight(1f).clearAndSetSemantics {},
            )
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(12.dp))
                        .clickable(onClick = onAction)
                        .padding(horizontal = Spacing.s4)
                        .semantics {
                            contentDescription = "${item.actionLabel}: ${item.lineTitle}"
                            role = Role.Button
                        }.testTag("mailCounterAction.${item.id}"),
                contentAlignment = Alignment.Center,
            ) {
                Text(item.actionLabel, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
            }
        }
    }
}

/** The counter's bottom edge: the next page loading, or why it didn't, with Try again. */
@Composable
fun MailCounterEnd(
    hasMore: Boolean,
    loadMoreError: String?,
    onRetryMore: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s3)
                .fillMaxWidth()
                .clip(RoundedCornerShape(bottomStart = 20.dp, bottomEnd = 20.dp))
                .background(PantopusColors.mailCounter),
    ) {
        if (hasMore || loadMoreError != null) MailboxListFooter(loadMoreError, onRetryMore)
        Spacer(Modifier.height(Spacing.s2))
    }
}

/** The manila tag tied to a piece on the Counter, its words in a typewriter face. */
@Composable
private fun MailDueTag(
    text: String,
    tilt: Float,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(topStart = 3.dp, bottomStart = 3.dp, topEnd = 9.dp, bottomEnd = 9.dp)
    Box(
        modifier =
            modifier
                .rotate(tilt)
                .shadow(2.dp, shape)
                .background(PantopusColors.mailManila, shape)
                .border(1.dp, PantopusColors.mailManilaEdge, shape)
                .padding(start = 18.dp, end = 10.dp, top = 6.dp, bottom = 6.dp)
                .clearAndSetSemantics {},
    ) {
        // The tag's hole, where its string goes through.
        Box(
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .offset(x = (-12).dp)
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.mailCounter)
                    .border(1.dp, PantopusColors.mailManilaEdge, CircleShape),
        )
        Text(
            text,
            fontSize = 10.sp,
            lineHeight = 12.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 0.8.sp,
            color = PantopusColors.mailManilaInk,
        )
    }
}

/**
 * [content] laid out at the full width and drawn at [scale] from its top left corner, taking only the scaled space: the
 * Counter's pieces are the Mailbox's pieces drawn smaller (as the drawing's `scale(0.8)`), words and all, so they keep
 * their proportions and leave room for the tag.
 */
@Composable
private fun Scaled(
    scale: Float,
    content: @Composable () -> Unit,
) {
    Layout(content = content) { measurables, constraints ->
        val placeable = measurables.first().measure(constraints.copy(minWidth = 0, minHeight = 0))
        layout((placeable.width * scale).roundToInt(), (placeable.height * scale).roundToInt()) {
            placeable.placeWithLayer(0, 0) {
                scaleX = scale
                scaleY = scale
                transformOrigin = TransformOrigin(0f, 0f)
            }
        }
    }
}

/** How much smaller a piece is drawn on the Counter. */
private const val COUNTER_PIECE_SCALE = 0.84f

/** Each tag hangs at a slightly different angle, as tied by hand. */
private val tagTilts = listOf(5f, -4f, 3f)
