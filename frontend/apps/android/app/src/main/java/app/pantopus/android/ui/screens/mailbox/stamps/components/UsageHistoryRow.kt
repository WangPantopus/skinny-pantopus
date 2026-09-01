@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.stamps.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.PerforatedStamp
import app.pantopus.android.ui.screens.mailbox.stamps.StampCard
import app.pantopus.android.ui.screens.mailbox.stamps.StampSectionLabel
import app.pantopus.android.ui.screens.mailbox.stamps.StampUsage
import app.pantopus.android.ui.screens.mailbox.stamps.StampsSampleData
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.11 — "Usage history": which send consumed which stamp. A card of
 * rows (recipient · kind · date) each led by a tiny ink-matched stamp
 * chit, plus a "See all sends" footer. Mirrors iOS `UsageHistoryRow.swift`.
 */
@Composable
fun UsageHistoryCard(
    usage: List<StampUsage>,
    window: String,
    onSeeAll: () -> Unit = {},
) {
    StampCard(noPad = true, modifier = Modifier.testTag("stampsUsageHistory")) {
        StampSectionLabel(
            title = "Usage history",
            modifier = Modifier.padding(horizontal = 14.dp).padding(top = Spacing.s3),
        ) {
            Text(
                text = window,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextSecondary,
            )
        }
        usage.forEachIndexed { index, item ->
            if (index == 0) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            }
            UsageHistoryRow(usage = item)
            if (index < usage.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            }
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onSeeAll)
                    .padding(vertical = 11.dp)
                    .testTag("stampsUsageSeeAll"),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "See all sends",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary600,
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.primary600,
                modifier = Modifier.padding(start = Spacing.s1),
            )
        }
    }
}

/** One ledger row — ink chit + recipient + kind/stamp + date. */
@Composable
fun UsageHistoryRow(usage: StampUsage) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp)
                .semantics {
                    contentDescription =
                        "${usage.recipient}, ${usage.kind}, ${usage.stampName} stamp, ${usage.dateLabel}"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PerforatedStamp(ink = usage.ink.color, width = 26.dp, height = 32.dp, toothRadius = 2.dp, toothGap = 7.dp) {}
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = usage.recipient,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text =
                    buildAnnotatedString {
                        append("${usage.kind} · ")
                        withStyle(
                            SpanStyle(fontWeight = FontWeight.SemiBold, color = PantopusColors.appText),
                        ) {
                            append(usage.stampName)
                        }
                        append(" stamp")
                    },
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(
            text = usage.dateLabel,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Preview(showBackground = true, widthDp = 390, heightDp = 400)
@Composable
private fun UsageHistoryPreview() {
    PantopusTheme {
        Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
            UsageHistoryCard(
                usage = StampsSampleData.populated.usage,
                window = StampsSampleData.populated.usageWindow,
            )
        }
    }
}
