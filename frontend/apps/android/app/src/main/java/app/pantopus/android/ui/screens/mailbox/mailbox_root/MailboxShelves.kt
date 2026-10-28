@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.MailHome
import app.pantopus.android.data.api.models.mailbox.v2.MailVacationHold
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * The Home drawer while every Home the person lives at waits for proof of the address (Mail tab drawings,
 * `R14-HomeLocked`): the grey padlocked mailbox, what comes once they verify, Verify your home, and that their own mail
 * still comes to Me (a tap opens Me).
 */
@Composable
fun MailClosedHomeDrawer(
    home: MailHome,
    onVerify: () -> Unit,
    onGoToMe: () -> Unit,
) {
    val address = home.addressLine?.takeIf { it.isNotBlank() } ?: home.name?.takeIf { it.isNotBlank() } ?: "your home"
    Column(
        modifier =
            Modifier
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s5)
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(20.dp))
                .padding(start = Spacing.s5, end = Spacing.s5, top = 28.dp, bottom = 22.dp)
                .testTag("mailClosedHome"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        ClosedMailbox(modifier = Modifier.size(150.dp))
        Text(
            "Verify your home to get its mail",
            fontSize = 20.sp,
            lineHeight = 26.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s3).semantics { heading() },
        )
        Text(
            "Bills, notices and ballot guides for your household come to the Home drawer once you verify you live at $address.",
            fontSize = 15.sp,
            lineHeight = 21.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 6.dp),
        )
        Spacer(Modifier.height(18.dp))
        PrimaryButton(title = "Verify your home", onClick = onVerify, modifier = Modifier.fillMaxWidth().testTag("mailClosedHomeVerify"))
        Text(
            buildAnnotatedString {
                append("Your own mail still comes to ")
                withStyle(SpanStyle(textDecoration = TextDecoration.Underline, color = PantopusColors.primary600)) { append("Me") }
                append(".")
            },
            fontSize = 13.sp,
            lineHeight = 18.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    .padding(top = Spacing.s1)
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(onClick = onGoToMe)
                    .padding(horizontal = Spacing.s2, vertical = 14.dp)
                    .semantics {
                        contentDescription = "Your own mail still comes to Me. Opens Me."
                        role = Role.Button
                    }.testTag("mailClosedHomeGoToMe"),
        )
    }
}

/** Above the Home drawer's mail when one of several Homes waits for proof: its mail waits until then. */
@Composable
fun MailHomeWaitingBanner(
    home: MailHome,
    onVerify: () -> Unit,
) {
    val name = home.name?.takeIf { it.isNotBlank() } ?: home.addressLine?.takeIf { it.isNotBlank() } ?: "A home"
    Row(
        modifier =
            Modifier
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4)
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(12.dp))
                .clickable(onClick = onVerify)
                .padding(Spacing.s3)
                .clearAndSetSemantics {
                    contentDescription = "$name's mail waits until you verify the address. Verify your home."
                    role = Role.Button
                }.testTag("mailHomeWaiting"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextStrong)
        Text(
            "$name's mail waits until you verify the address.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Text("Verify", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
    }
}

/**
 * A hold in effect, or set for later, at the top of the Mailbox (`R11-Vacation`): "Your mail is on hold · Back Sun,
 * Nov 29 · 3 days left · 4 pieces held", or when it starts. A tap opens Hold my mail.
 */
@Composable
fun MailHoldBanner(
    hold: MailVacationHold,
    zone: ZoneId,
    onOpen: () -> Unit,
) {
    val title = if (hold.active) "Your mail is on hold" else "Your mail hold is set"
    val detail = holdDetail(hold, LocalDate.now(zone))
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(PantopusColors.infoBg)
                .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(12.dp))
                .clickable(onClick = onOpen)
                .padding(Spacing.s3)
                .clearAndSetSemantics {
                    contentDescription = "$title. ${detail.replace(" · ", ", ")}. Opens Hold my mail."
                    role = Role.Button
                }.testTag("mailHoldBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = PantopusIcon.CalendarClock, contentDescription = null, size = 20.dp, tint = PantopusColors.info)
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(detail, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextMuted)
    }
}

private val holdDay = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)

/** "Back Sun, Nov 29 · 3 days left · 4 pieces held", or "Starts Fri, Nov 20 · back Sun, Nov 29". */
internal fun holdDetail(
    hold: MailVacationHold,
    today: LocalDate,
): String {
    val end = hold.endDate?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }
    val start = hold.startDate?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }
    val held = if (hold.heldCount == 1) "1 piece held" else "${hold.heldCount} pieces held"
    return if (hold.active) {
        val days = end?.let { ChronoUnit.DAYS.between(today, it).coerceAtLeast(0) }
        listOfNotNull(
            end?.let { "Back ${it.format(holdDay)}" },
            days?.let { if (it == 1L) "1 day left" else "$it days left" },
            held,
        ).joinToString(" · ")
    } else {
        listOfNotNull(start?.let { "Starts ${it.format(holdDay)}" }, end?.let { "back ${it.format(holdDay)}" }).joinToString(" · ")
    }
}

/** The grey padlocked mailbox from the drawing: the Home's box, shut until the address is proven. */
@Composable
private fun ClosedMailbox(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.clearAndSetSemantics {}) {
        // The drawing's 120 × 130 viewbox, fitted and centered.
        val unit = minOf(size.width / 120f, size.height / 130f)
        val left = (size.width - 120f * unit) / 2f
        val top = (size.height - 130f * unit) / 2f

        fun at(
            x: Float,
            y: Float,
        ) = Offset(left + x * unit, top + y * unit)

        fun arch(
            x: Float,
            y: Float,
            width: Float,
            bottom: Float,
        ): Path =
            Path().apply {
                val radius = width / 2f
                moveTo(left + x * unit, top + bottom * unit)
                lineTo(left + x * unit, top + (y + radius) * unit)
                arcTo(
                    rect =
                        androidx.compose.ui.geometry.Rect(
                            at(x, y),
                            Size(width * unit, width * unit),
                        ),
                    startAngleDegrees = 180f,
                    sweepAngleDegrees = 180f,
                    forceMoveTo = false,
                )
                lineTo(left + (x + width) * unit, top + bottom * unit)
                close()
            }
        // The post.
        drawRoundRect(PantopusColors.mailboxPost, at(54f, 96f), Size(12f * unit, 34f * unit), CornerRadius(2f * unit))
        // The box and its door, shut.
        drawPath(arch(18f, 8f, 84f, 94f), PantopusColors.mailboxLocked)
        drawPath(arch(27f, 17f, 66f, 90f), PantopusColors.mailboxLockedDoor)
        // The flag, down.
        drawRoundRect(PantopusColors.mailboxLocked, at(102f, 64f), Size(16f * unit, 7f * unit), CornerRadius(1.5f * unit))
        // The padlock on the door.
        drawArc(
            color = PantopusColors.mailboxLockedPlate,
            startAngle = 180f,
            sweepAngle = 180f,
            useCenter = false,
            topLeft = at(52f, 40f),
            size = Size(16f * unit, 16f * unit),
            style = Stroke(width = 3f * unit),
        )
        drawRoundRect(PantopusColors.mailboxLockedPlate, at(48f, 48f), Size(24f * unit, 18f * unit), CornerRadius(3f * unit))
        drawCircle(PantopusColors.mailboxLockedDoor, radius = 2.2f * unit, center = at(60f, 56f))
    }
}
