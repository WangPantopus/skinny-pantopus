@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.mail_detail.letter

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.screens.mailbox.components.MailSender
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/**
 * The envelope, turned over (drawing `R6-Envelope`): who sent it, with a chip for how Pantopus checked them (the
 * landmark only for a verified government) and a sentence on it, "Unverified sender" and its caution in red, their
 * page when there is one, and the trail: postmarked, delivered, opened, acknowledged, and where it stands.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EnvelopeSheet(
    letter: MailLetter,
    /** "See their business page" / "See their profile"; null when the sender has no page. */
    pageLabel: String?,
    onOpenPage: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = PantopusColors.appSurface) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(start = 20.dp, end = 20.dp, bottom = Spacing.s8)
                    .testTag("mailEnvelopeSheet"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            SectionTitle("Who sent it")
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Box(
                    modifier = Modifier.size(40.dp).clip(RoundedCornerShape(8.dp)).background(PantopusColors.mailInk),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        letter.fromName.firstOrNull()?.uppercase() ?: "?",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        letter.fromName,
                        fontSize = 17.sp,
                        lineHeight = 22.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                    TrustChip(letter.sender)
                }
            }
            letter.fromLine?.let { Text(it, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary) }
            Text(
                letter.checked,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                color = if (letter.sender == MailSender.Unknown) PantopusColors.error else PantopusColors.appText,
                modifier = Modifier.testTag("mailEnvelopeSheetChecked"),
            )
            if (pageLabel != null) {
                GhostButton(title = pageLabel, onClick = onOpenPage, modifier = Modifier.fillMaxWidth().testTag("mailEnvelopeSheetPage"))
            }
            SectionTitle("Its trail")
            Column(modifier = Modifier.fillMaxWidth().testTag("mailEnvelopeSheetTrail")) {
                letter.trail.forEachIndexed { index, step -> TrailRow(step, isLast = index == letter.trail.lastIndex) }
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.07.em,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(top = Spacing.s2).semantics { heading() },
    )
}

/** "Verified business" with the icon for that kind of sender; "Unverified sender" in red. */
@Composable
fun TrustChip(sender: MailSender) {
    val (ink, fill) =
        when (sender) {
            MailSender.Business, MailSender.Government, MailSender.Utility -> PantopusColors.success to PantopusColors.successBg
            MailSender.Unknown -> PantopusColors.error to PantopusColors.errorBg
            else -> PantopusColors.info to PantopusColors.infoBg
        }
    val icon =
        when (sender) {
            MailSender.Business, MailSender.PantopusBusiness -> PantopusIcon.Store
            MailSender.Government -> PantopusIcon.Landmark
            MailSender.Utility -> PantopusIcon.Zap
            MailSender.Pantopus -> PantopusIcon.BadgeCheck
            MailSender.Neighbor -> PantopusIcon.User
            MailSender.Unknown -> PantopusIcon.AlertTriangle
        }
    val label = if (sender == MailSender.Neighbor) "Pantopus neighbor" else sender.line
    Row(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(fill)
                .padding(horizontal = Spacing.s2, vertical = 3.dp)
                .semantics(mergeDescendants = true) {}
                .testTag("mailTrustChip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 12.dp, tint = ink)
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = ink)
    }
}

/** One step of the trail: a dot on the line, what happened and when (the envelope's trail, and a card's in Sent). */
@Composable
internal fun TrailRow(
    step: MailTrailStep,
    isLast: Boolean,
) {
    val dot: Color =
        when {
            !step.done -> PantopusColors.appSurface
            step.readers -> PantopusColors.primary600
            else -> PantopusColors.mailInk
        }
    Row(
        modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min).semantics(mergeDescendants = true) {}.testTag("mailTrail.${step.id}"),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(modifier = Modifier.width(12.dp).fillMaxHeight(), contentAlignment = Alignment.TopCenter) {
            if (!isLast) {
                Box(modifier = Modifier.padding(top = 10.dp).width(2.dp).fillMaxHeight().background(PantopusColors.appBorder))
            }
            Box(
                modifier =
                    Modifier
                        .padding(top = 4.dp)
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(dot)
                        .then(if (step.done) Modifier else Modifier.border(2.dp, PantopusColors.appTextMuted, CircleShape)),
            )
        }
        Column(modifier = Modifier.weight(1f).padding(bottom = Spacing.s4)) {
            Text(
                step.title,
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = if (step.done) FontWeight.SemiBold else FontWeight.Normal,
                color = if (step.done) PantopusColors.appText else PantopusColors.appTextMuted,
            )
            step.detail?.let {
                Text(it, fontFamily = FontFamily.Monospace, fontSize = 12.sp, lineHeight = 16.sp, color = PantopusColors.appTextSecondary)
            }
        }
    }
}
