@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.settings.data_export

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * WS5.3 — GDPR data-export request UI. No backend export job yet;
 * routes users to privacy@ until the export API lands.
 */
@Composable
fun DataExportScreen(
    onBack: () -> Unit = {},
    onEmailPrivacy: () -> Unit = {},
) {
    ContentDetailShell(
        title = "Data export",
        onBack = onBack,
        header = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = "Download your data",
                    style = PantopusTextStyle.h2,
                    color = PantopusColors.appText,
                )
                Text(
                    text =
                        "You can request a copy of the personal data Pantopus stores about you. " +
                            "Automated ZIP export is coming soon — for now we process requests by email.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            }
        },
        body = {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag("dataExport")
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                InfoCard(
                    title = "What's included",
                    body =
                        "Profile, homes, gigs, messages metadata, wallet history, and settings " +
                            "preferences — packaged as human-readable files.",
                )
                InfoCard(
                    title = "Timing",
                    body =
                        "We respond within 30 days. You'll receive a secure download link at the " +
                            "email on your account.",
                )
            }
        },
        cta = {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(PantopusColors.appSurface)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            ) {
                PrimaryButton(
                    title = "Email privacy team",
                    onClick = onEmailPrivacy,
                    modifier = Modifier.testTag("dataExportRequestCTA"),
                )
            }
        },
    )
}

@Composable
private fun InfoCard(
    title: String,
    body: String,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            text = title,
            style = PantopusTextStyle.body.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
        Text(
            text = body,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
    }
}
