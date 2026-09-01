@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.invitee.confirm

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.ui.screens.scheduling._shared.PaidGate
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * D2 — Review & confirm (the scrollable body). A who/what/when/where summary
 * card with a collapsible "Your answers" disclosure, an optional price
 * breakdown (full vs deposit) behind the paid flag, the refund-policy line, and
 * a represented payment region (the real Stripe PaymentSheet lives behind A14).
 */
@Composable
fun ReviewConfirmBody(
    state: ConfirmFlowState,
    args: InviteeConfirmArgs,
    pillar: SchedulingPillar,
    paidEnabled: Boolean,
    questions: List<IntakeQuestion>,
    answersExpanded: Boolean,
    onToggleAnswers: () -> Unit,
    modifier: Modifier = Modifier,
    onRefundPolicy: () -> Unit = {},
) {
    val et = args.eventType
    val answers = answeredPairs(state.values, questions)
    // Spec frame 6: while confirming the whole form dims to 0.85 and is disabled
    // (the shimmer CTA lives in the footer). Mirrors iOS .opacity(0.85)/.disabled.
    val confirmingAlpha = if (state.submitting) 0.85f else 1f
    Column(
        modifier = modifier.fillMaxWidth().alpha(confirmingAlpha),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        ReviewSummaryCard(
            args = args,
            pillar = pillar,
            whenLabel = ConfirmUtils.formatSlotRange(state.slotStartUtc, state.slotEndUtc, state.tz),
            tzLabel = ConfirmUtils.tzChipLabel(state.tz, state.slotStartUtc),
            inviteeName = "${state.values.firstName} ${state.values.lastName}".trim(),
            guests = state.values.guests.map { it.trim() }.filter { it.isNotEmpty() },
            answers = answers,
            answersExpanded = answersExpanded,
            onToggleAnswers = onToggleAnswers,
        )

        if (paidEnabled) {
            Column {
                ConfirmOverline("Price")
                PriceBreakdown(et = et, accent = pillar.accent)
            }
        }

        RefundLine(args = args, accent = pillar.accent, onRefundPolicy = onRefundPolicy)

        PaidGate(enabled = paidEnabled) {
            Column(modifier = Modifier.padding(top = Spacing.s1)) {
                ConfirmOverline("Payment")
                PaymentMethodButton(accent = pillar.accent)
                TrustRow()
            }
        }
    }
}

@Composable
private fun ReviewSummaryCard(
    args: InviteeConfirmArgs,
    pillar: SchedulingPillar,
    whenLabel: String,
    tzLabel: String,
    inviteeName: String,
    guests: List<String>,
    answers: List<Pair<String, String>>,
    answersExpanded: Boolean,
    onToggleAnswers: () -> Unit,
) {
    val location = ConfirmUtils.locationLabel(args.eventType.locationMode, args.eventType.locationDetail)
    ConfirmCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            HostAvatar(pillar = pillar, initials = ConfirmUtils.initials(args.hostName), diameter = 38.dp)
            Column(modifier = Modifier.weight(1f).padding(start = Spacing.s2)) {
                Text(
                    text = args.eventType.name ?: "Booking",
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Text(text = "with ${args.hostName}", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                    PillarTag(pillar = pillar)
                }
            }
        }
        HorizontalDivider(color = PantopusColors.appBorder, modifier = Modifier.padding(vertical = Spacing.s2))

        SummaryDetailRow(icon = PantopusIcon.Calendar) {
            Text(text = whenLabel, style = PantopusTextStyle.caption, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            TimezoneChip(label = tzLabel, accent = pillar.accent, modifier = Modifier.padding(top = Spacing.s1))
        }
        SummaryDetailRow(icon = locationIcon(args.eventType.locationMode)) {
            Text(text = location.label, style = PantopusTextStyle.caption, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            if (location.sub != null) Text(text = location.sub, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        SummaryDetailRow(icon = PantopusIcon.Users, divider = answers.isNotEmpty()) {
            Row {
                Text(
                    text =
                        inviteeName.ifEmpty {
                            "You"
                        },
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Text(text = " (you)", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
            if (guests.isNotEmpty()) {
                Text(
                    text = "+ ${guests.size} guest${if (guests.size == 1) "" else "s"}",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }

        if (answers.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth().clickable(onClick = onToggleAnswers).padding(top = Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MessageSquare,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(end = Spacing.s2),
                )
                Text(
                    text = "Your answers",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "${answers.size}",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.padding(end = Spacing.s1),
                )
                PantopusIconImage(
                    icon = if (answersExpanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
            if (answersExpanded) {
                Column(
                    modifier = Modifier.padding(top = Spacing.s2, start = Spacing.s5),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    answers.forEach { (q, a) ->
                        Column {
                            Text(
                                text = q,
                                style = PantopusTextStyle.caption,
                                fontWeight = FontWeight.SemiBold,
                                color = PantopusColors.appTextSecondary,
                            )
                            Text(text = a, style = PantopusTextStyle.caption, color = PantopusColors.appText)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PriceBreakdown(
    et: PublicEventTypeView,
    accent: androidx.compose.ui.graphics.Color,
) {
    val mode = ConfirmUtils.priceMode(et.priceCents, et.depositCents)
    val currency = et.currency
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        val lineLabel = listOfNotNull(et.name, ConfirmUtils.durationLabel(et.defaultDuration).ifEmpty { null }).joinToString(" · ")
        LineRow(label = lineLabel.ifEmpty { "Booking" }, value = ConfirmUtils.formatCents(et.priceCents ?: 0, currency), strong = true)
        HorizontalDivider(color = PantopusColors.appBorder, modifier = Modifier.padding(vertical = Spacing.s1))
        when (mode) {
            PriceMode.Deposit -> {
                TotalRow(
                    label = "Due now",
                    value = ConfirmUtils.formatCents(ConfirmUtils.dueNowCents(et.priceCents, et.depositCents), currency),
                    accent = accent,
                )
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Balance at your visit", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                    Text(
                        text = ConfirmUtils.formatCents(ConfirmUtils.balanceCents(et.priceCents, et.depositCents), currency),
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextStrong,
                    )
                }
            }
            else -> TotalRow(label = "Total", value = ConfirmUtils.formatCents(et.priceCents ?: 0, currency), accent = accent)
        }
    }
}

@Composable
private fun LineRow(
    label: String,
    value: String,
    strong: Boolean = false,
) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            fontWeight = if (strong) FontWeight.SemiBold else FontWeight.Normal,
            color = if (strong) PantopusColors.appText else PantopusColors.appTextStrong,
        )
        Text(text = value, style = PantopusTextStyle.caption, color = PantopusColors.appTextStrong)
    }
}

@Composable
private fun TotalRow(
    label: String,
    value: String,
    accent: androidx.compose.ui.graphics.Color,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(text = label, style = PantopusTextStyle.small, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        // Use pillar accent so Home/Business hosts show correct green/violet instead of sky blue.
        Text(text = value, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = accent)
    }
}

@Composable
private fun RefundLine(
    args: InviteeConfirmArgs,
    accent: androidx.compose.ui.graphics.Color,
    onRefundPolicy: () -> Unit,
) {
    // Spec RefundLink: a shield-check + summary sentence + a primary-accent
    // "Refund policy" link that opens the cancellation-policy detail.
    val summary =
        args.cancellationPolicy?.takeIf { it.isNotBlank() } ?: "Free cancellation up to 24h before."
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        PantopusIconImage(icon = PantopusIcon.ShieldCheck, contentDescription = null, size = 13.dp, tint = PantopusColors.appTextMuted)
        Row(modifier = Modifier.weight(1f)) {
            Text(
                text = "$summary ",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Refund policy",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = accent,
                modifier = Modifier.clickable(onClick = onRefundPolicy),
            )
        }
    }
}

@Composable
private fun PaymentMethodButton(accent: androidx.compose.ui.graphics.Color) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.md))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(30.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.CreditCard, contentDescription = null, size = 16.dp, tint = accent)
        }
        Column(modifier = Modifier.weight(1f).padding(start = Spacing.s2)) {
            Text(
                text = "Payment method",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(text = "Choose a card or Apple Pay", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun TrustRow() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Lock,
            contentDescription = null,
            size = 12.dp,
            tint = PantopusColors.appTextMuted,
            modifier = Modifier.padding(end = Spacing.s1),
        )
        Text(text = "Payments secured by Stripe", style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted)
    }
}

private fun locationIcon(mode: String?): PantopusIcon =
    when (mode) {
        "video" -> PantopusIcon.Video
        "phone" -> PantopusIcon.Phone
        "in_person" -> PantopusIcon.MapPin
        else -> PantopusIcon.Calendar
    }

private fun answeredPairs(
    values: IntakeValues,
    questions: List<IntakeQuestion>,
): List<Pair<String, String>> =
    questions.mapIndexedNotNull { index, question ->
        val key = ConfirmUtils.questionKey(question, index)
        when (val answer = values.answers[key]) {
            is AnswerValue.Text -> answer.value.takeIf { it.isNotBlank() }?.let { question.label to it }
            is AnswerValue.Choices -> answer.value.takeIf { it.isNotEmpty() }?.let { question.label to it.joinToString(", ") }
            is AnswerValue.Flag -> if (answer.value) question.label to "Yes" else null
            null -> null
        }
    }
