@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.documents

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii

/**
 * 40×48 (default) tinted tile rendered as the leading visual on every
 * Document row and as the picked-file glyph inside the Upload form.
 *
 * Mirrors the iOS `FileTypeTile` struct so the two surfaces read
 * identical. Colours come from [DocumentFileType.background] /
 * [DocumentFileType.foreground].
 */
@Composable
fun FileTypeTile(
    fileType: DocumentFileType,
    width: Dp = 40.dp,
    height: Dp = 48.dp,
) {
    Column(
        modifier =
            Modifier
                .size(width = width, height = height)
                .clip(RoundedCornerShape(Radii.sm))
                .background(fileType.background),
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(contentAlignment = Alignment.Center) {
            PantopusIconImage(
                icon = fileType.icon,
                contentDescription = null,
                size = Radii.xl2,
                tint = fileType.foreground,
            )
        }
        Text(
            text = fileType.stamp,
            color = fileType.foreground,
            fontSize = 8.sp,
            fontWeight = FontWeight.ExtraBold,
            style = PantopusTextStyle.caption.copy(),
        )
    }
}
