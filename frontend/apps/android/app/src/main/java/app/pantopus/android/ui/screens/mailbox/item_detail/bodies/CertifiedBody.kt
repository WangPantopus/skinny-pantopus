@file:Suppress("MagicNumber", "PackageNaming", "LongParameterList", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.CertifiedChainStep
import app.pantopus.android.data.api.models.mailbox.v2.CertifiedDetailDto
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.CertifiedTermsSummaryCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Concrete body for the Certified mailbox category. The shell renders
 * the AI summary, key facts, and timeline; this body renders the A17.3
 * notice card and high-stakes delivery terms summary.
 */
@Composable
fun CertifiedBody(
    certified: CertifiedDetailDto,
    onViewTerms: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        if (certified.isHighStakes) {
            CertifiedTermsSummaryCard(
                termsUrl = certified.termsUrl,
                onViewTerms = if (certified.termsUrl.isNullOrEmpty()) null else onViewTerms,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        }
        NoticeCard(
            paragraphs = certified.noticeParagraphs(),
            showTermsAction = !certified.termsUrl.isNullOrEmpty(),
            onViewTerms = onViewTerms,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
    }
}

private val CertifiedDetailDto.isHighStakes: Boolean
    get() = !termsUrl.isNullOrEmpty() || !acknowledgeBy.isNullOrEmpty()

private fun CertifiedDetailDto.noticeParagraphs(): List<String> =
    noticeBody
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
        ?.split("\n\n")
        ?.map { it.trim() }
        ?.filter { it.isNotEmpty() }
        ?: listOf("No notice text was included with this certified item.")

@Composable
private fun NoticeCard(
    paragraphs: List<String>,
    showTermsAction: Boolean,
    onViewTerms: () -> Unit,
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
                .testTag("certifiedBody_notice"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "NOTICE TEXT",
            modifier = Modifier.semantics { heading() },
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        paragraphs.forEach { paragraph ->
            Text(
                text = paragraph,
                fontSize = 13.sp,
                color = PantopusColors.appTextStrong,
                lineHeight = 20.sp,
                modifier = Modifier.semantics { contentDescription = paragraph },
            )
        }
        if (showTermsAction) {
            Text(
                text = "Show full terms",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.sm))
                        .clickable(onClick = onViewTerms)
                        .heightIn(min = 48.dp)
                        .padding(top = Spacing.s1, bottom = Spacing.s1)
                        .testTag("certifiedBody_showTerms")
                        .semantics { contentDescription = "Show full certified terms" },
            )
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 640)
@Composable
private fun CertifiedBodyPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg)) {
        CertifiedBody(
            certified =
                CertifiedDetailDto(
                    referenceNumber = "CRT-2026-0091",
                    documentType = "Court summons",
                    acknowledgeBy = "2026-05-25",
                    chain =
                        listOf(
                            CertifiedChainStep("sent", "Sent", "2026-05-08", true),
                            CertifiedChainStep("facility", "At facility", "2026-05-09", true),
                            CertifiedChainStep("delivered", "Delivered", "2026-05-10", true),
                        ),
                    noticeBody = "You are summoned to appear at Cambridge District Court.",
                    termsUrl = "https://example.com/terms",
                    isAcknowledged = false,
                ),
            onViewTerms = {},
        )
    }
}
