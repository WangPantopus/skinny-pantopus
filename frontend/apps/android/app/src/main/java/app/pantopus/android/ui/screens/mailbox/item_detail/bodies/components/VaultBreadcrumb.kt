@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.RecordsVaultCrumb
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.10 — VaultBreadcrumb. The "Will be filed at" / "Filed at" card on
 * the records variant: a header strip with a "Change folder" affordance,
 * the slate-tinted chevron breadcrumb (Mailbox › Vault › Finance ›
 * Statements › 2026), and a retention strip — neutral clock copy when
 * open, success-lock copy when filed. Compose mirror of iOS
 * `Variants/Components/VaultBreadcrumb.swift`.
 */
@Composable
fun VaultBreadcrumb(
    trail: List<RecordsVaultCrumb>,
    retentionLine: String,
    isFiled: Boolean,
    modifier: Modifier = Modifier,
    onChangeFolder: (() -> Unit)? = null,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("mailDetail_records_vaultBreadcrumb"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Header(isFiled = isFiled, onChangeFolder = onChangeFolder)
        Crumbs(trail = trail)
        RetentionStrip(retentionLine = retentionLine, isFiled = isFiled)
    }
}

@Composable
private fun Header(
    isFiled: Boolean,
    onChangeFolder: (() -> Unit)?,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = if (isFiled) "FILED AT" else "WILL BE FILED AT",
            modifier = Modifier.semantics { heading() },
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(Modifier.weight(1f))
        if (onChangeFolder != null && !isFiled) {
            Row(
                modifier =
                    Modifier
                        .clickable(onClick = onChangeFolder)
                        .testTag("mailDetail_records_changeFolder"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Pencil,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = "Change folder",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary600,
                )
            }
        }
    }
}

@Composable
private fun Crumbs(trail: List<RecordsVaultCrumb>) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        trail.forEachIndexed { index, crumb ->
            CrumbChip(crumb = crumb)
            if (index < trail.size - 1) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

@Composable
private fun CrumbChip(crumb: RecordsVaultCrumb) {
    val current = crumb.isCurrent
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(7.dp))
                .background(if (current) PantopusColors.categoryRecordsDeep else PantopusColors.categoryRecordsBg)
                .then(
                    if (current) {
                        Modifier
                    } else {
                        Modifier.border(1.dp, PantopusColors.categoryRecordsBorder, RoundedCornerShape(7.dp))
                    },
                )
                .padding(horizontal = Spacing.s2, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = glyph(crumb.glyph),
            contentDescription = null,
            size = 11.dp,
            tint = if (current) PantopusColors.appTextInverse else PantopusColors.categoryRecordsDeep,
        )
        Text(
            text = crumb.label,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (current) PantopusColors.appTextInverse else PantopusColors.categoryRecordsDeep,
        )
    }
}

@Composable
private fun RetentionStrip(
    retentionLine: String,
    isFiled: Boolean,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(if (isFiled) PantopusColors.successBg else PantopusColors.appSurfaceSunken)
                .border(
                    1.dp,
                    if (isFiled) PantopusColors.successLight else PantopusColors.appBorderSubtle,
                    RoundedCornerShape(Radii.md),
                )
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = if (isFiled) PantopusIcon.Lock else PantopusIcon.Clock,
            contentDescription = null,
            size = 12.dp,
            tint = if (isFiled) PantopusColors.success else PantopusColors.appTextSecondary,
        )
        val tail = if (isFiled) " Auto-delete prompt April 2033." else " Filing will start the retention clock."
        Text(
            text =
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(retentionLine) }
                    append(tail)
                },
            fontSize = 11.5.sp,
            color = if (isFiled) PantopusColors.success else PantopusColors.appTextStrong,
        )
    }
}

private fun glyph(glyph: RecordsVaultCrumb.Glyph): PantopusIcon =
    when (glyph) {
        RecordsVaultCrumb.Glyph.Inbox -> PantopusIcon.Inbox
        RecordsVaultCrumb.Glyph.Archive -> PantopusIcon.Archive
        RecordsVaultCrumb.Glyph.Landmark -> PantopusIcon.Landmark
        RecordsVaultCrumb.Glyph.FileText -> PantopusIcon.FileText
        RecordsVaultCrumb.Glyph.Calendar -> PantopusIcon.CalendarDays
    }
