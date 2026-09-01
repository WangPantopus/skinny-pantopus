@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.RecordsDetailDto
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.RelatedRecords
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.VaultBreadcrumb
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Concrete body for the Records mailbox category (A17.10). An archival
 * delivery: the cover-letter excerpt + "Read full document" affordance,
 * the Vault destination breadcrumb, and — only in the filed state — the
 * related-records strip. The shell owns the slate accent strip, sender
 * (IssuerCard), trust pill, AI elf, PaperStack hero, key-facts grid, and
 * the sticky File-in-Vault / filed action shelf. Compose mirror of the
 * body section of iOS `RecordsDetailLayout`.
 */
@Composable
fun RecordsBody(
    records: RecordsDetailDto,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().testTag("recordsBody"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        CoverLetterCard(
            paragraphs = records.bodyParagraphs,
            coverPageHint = records.coverPageHint,
            pageCount = records.pageCount,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        VaultBreadcrumb(
            trail = records.vaultTrail,
            retentionLine = records.retentionLine,
            isFiled = records.isFiled,
            onChangeFolder = if (records.isFiled) null else ({}),
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        if (records.isFiled && records.related.isNotEmpty()) {
            RelatedRecords(
                records = records.related,
                total = 8,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        }
    }
}

@Composable
private fun CoverLetterCard(
    paragraphs: List<String>,
    coverPageHint: String,
    pageCount: Int,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("mailDetail_records_body"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "COVER LETTER",
                modifier = Modifier.semantics { heading() },
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            Spacer(Modifier.weight(1f))
            Text(
                text = coverPageHint,
                fontSize = 10.5.sp,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appTextMuted,
            )
        }
        paragraphs.forEach { paragraph ->
            Text(
                text = paragraph,
                fontSize = 13.5.sp,
                lineHeight = 19.sp,
                color = PantopusColors.appText,
            )
        }
        ReadFullButton(pageCount = pageCount)
    }
}

@Composable
private fun ReadFullButton(pageCount: Int) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s1)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable {}
                .padding(vertical = Spacing.s2)
                .testTag("mailDetail_records_readFull"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.FileText,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appText,
        )
        Spacer(Modifier.padding(horizontal = 3.dp))
        Text(
            text = "Read full document · $pageCount pages",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
    }
}
