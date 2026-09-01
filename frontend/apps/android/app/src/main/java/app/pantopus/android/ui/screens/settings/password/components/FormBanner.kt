@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.settings.password.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.14 — form-level alert banner pinned to the top of a form body: title +
 * supporting line in a tinted, bordered card with a leading status icon.
 * Mirrors the iOS `FormBanner`.
 */
@Composable
fun FormBanner(
    tone: FormBannerTone,
    title: String,
    modifier: Modifier = Modifier,
    message: String? = null,
) {
    val foreground = if (tone == FormBannerTone.Error) PantopusColors.error else PantopusColors.primary700
    val background = if (tone == FormBannerTone.Error) PantopusColors.errorBg else PantopusColors.primary50
    val border = if (tone == FormBannerTone.Error) PantopusColors.errorLight else PantopusColors.primary200
    val icon = if (tone == FormBannerTone.Error) PantopusIcon.AlertCircle else PantopusIcon.Info

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(background)
                .border(width = 1.dp, color = border, shape = RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .semantics(mergeDescendants = true) {
                    contentDescription = if (message != null) "$title. $message" else title
                }.testTag("passwordChangeFormBanner"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = Radii.xl,
            tint = foreground,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = title,
                style = TextStyle(fontSize = 12.5.sp, fontWeight = FontWeight.Bold),
                color = foreground,
            )
            if (message != null) {
                Text(
                    text = message,
                    style = TextStyle(fontSize = 11.5.sp),
                    color = foreground.copy(alpha = 0.85f),
                )
            }
        }
    }
}
