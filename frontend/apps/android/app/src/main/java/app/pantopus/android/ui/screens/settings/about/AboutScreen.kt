@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.settings.about

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.BuildConfig
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Calendar

/**
 * P8 / T6.2c — Settings → About. Static screen with version,
 * mission, and a link to Settings → Legal for attributions.
 */
@Composable
fun AboutScreen(onBack: () -> Unit = {}) {
    ContentDetailShell(
        title = "About",
        onBack = onBack,
        header = {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = Spacing.s5)
                        .testTag("aboutScreen"),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(96.dp)
                            .clip(RoundedCornerShape(22.dp))
                            .background(PantopusColors.primary600),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "P",
                        color = Color.White,
                        fontSize = 44.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }
                Text(
                    text = "Pantopus",
                    style = PantopusTextStyle.h2,
                    color = PantopusColors.appText,
                )
                Text(
                    text = "Version ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.testTag("aboutVersion"),
                )
            }
        },
        body = {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                InfoCard(
                    heading = "Mission",
                    body =
                        "A trusted neighborhood platform. We help neighbors swap goods, find help, " +
                            "and stay in touch — without the noise of a public feed.",
                )
                InfoCard(
                    heading = "Built by",
                    body =
                        "A small team of people who wanted somewhere better to ask their block for a ladder. " +
                            "Reach us at support@pantopus.app.",
                )
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurface)
                            .padding(Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Text(
                        text = "Attributions",
                        style = PantopusTextStyle.h3,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = "See Settings → Legal → Open-source licenses for the libraries that power Pantopus.",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                Text(
                    text = "© ${currentYear()} Pantopus",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextMuted,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(top = Spacing.s4),
                )
            }
        },
    )
}

@Composable
private fun InfoCard(
    heading: String,
    body: String,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = heading,
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
        )
        Text(
            text = body,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
    }
}

private fun currentYear(): Int = Calendar.getInstance().get(Calendar.YEAR)
