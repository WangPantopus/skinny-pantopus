@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import android.content.Intent
import android.net.Uri
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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the certified-mail terms sheet. */
const val CERTIFIED_TERMS_SHEET_TAG = "certifiedTermsSheet"

/**
 * Modal bottom sheet shown when the user taps "View terms" on a
 * certified mail item. Surfaces the [termsUrl] with a primary CTA
 * that opens it in the system browser. Fetching the document body is
 * left for a later prompt — the design says "fetch as plain text or
 * render as in-line markdown" but no fetch endpoint exists today.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CertifiedTermsSheet(
    termsUrl: String,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag(CERTIFIED_TERMS_SHEET_TAG),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = "Certified delivery terms",
                style = PantopusTextStyle.h3,
                color = PantopusColors.appText,
            )
            Text(
                text = "Review the delivery terms before signing for this certified item.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
            CertifiedTermsSummaryCard(termsUrl = null, onViewTerms = null)
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "Document URL",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
                Text(
                    text = termsUrl,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appText,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            PrimaryButton(
                title = "Open in browser",
                onClick = {
                    val intent =
                        Intent(Intent.ACTION_VIEW, Uri.parse(termsUrl)).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    runCatching { context.startActivity(intent) }
                    onDismiss()
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/** Compact high-stakes summary shown directly above certified notice text. */
@Composable
fun CertifiedTermsSummaryCard(
    termsUrl: String?,
    onViewTerms: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("certifiedTermsSummary"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        TermsSummaryHeader()
        TermsSummaryBullets()
        if (!termsUrl.isNullOrEmpty() && onViewTerms != null) {
            ReviewTermsLink(onViewTerms = onViewTerms)
        }
    }
}

@Composable
private fun TermsSummaryHeader() {
    Row(
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.warningBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.warning,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
            Text(
                text = "Certified delivery terms",
                modifier = Modifier.semantics { heading() },
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text =
                    "A high-stakes item needs a signed delivery receipt before Pantopus " +
                        "marks it complete.",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun TermsSummaryBullets() {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        TermsBullet(icon = PantopusIcon.CheckCircle, text = "Signing confirms receipt only.")
        TermsBullet(icon = PantopusIcon.Flag, text = "It does not waive appeal, dispute, or payment rights.")
        TermsBullet(icon = PantopusIcon.Archive, text = "Pantopus stores the receipt with the chain of custody.")
    }
}

@Composable
private fun ReviewTermsLink(onViewTerms: () -> Unit) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.sm))
                .clickable(onClick = onViewTerms)
                .padding(vertical = Spacing.s2)
                .testTag("certifiedTermsSummary_review")
                .semantics { contentDescription = "Review full certified delivery terms" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "Review full terms",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.primary600,
        )
    }
}

@Composable
private fun TermsBullet(
    icon: PantopusIcon,
    text: String,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.warning,
        )
        Text(text = text, fontSize = 12.sp, color = PantopusColors.appTextStrong)
    }
}
