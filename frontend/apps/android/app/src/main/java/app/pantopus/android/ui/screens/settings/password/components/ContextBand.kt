@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.settings.password.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.14 — quiet identity reminder pinned under the top bar of the Change
 * Password screen: mail icon + "Signed in as …" over a clock icon + "Last
 * changed …". Mirrors the iOS `ContextBand`.
 */
@Composable
fun ContextBand(
    email: String,
    lastChanged: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().testTag("passwordChangeContextBand"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurfaceMuted)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .semantics(mergeDescendants = true) {
                        contentDescription = "Signed in as $email. Last changed $lastChanged."
                    },
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Mail,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "Signed in as $email",
                    style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appTextStrong,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Clock,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.appTextMuted,
                )
                Text(
                    text = "Last changed $lastChanged",
                    style = TextStyle(fontSize = 11.sp),
                    color = PantopusColors.appTextMuted,
                )
            }
        }
        HorizontalDivider(color = PantopusColors.appBorder, thickness = 1.dp)
    }
}
