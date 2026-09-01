@file:Suppress("PackageNaming", "MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.screens._internal

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Debug-only grid of every [PantopusIcon], labelled with its Lucide token
 * name. Reached from [TokenGalleryScreen] — no production nav entry.
 */
@Composable
fun IconGalleryScreen() {
    PantopusTheme {
        LazyVerticalGrid(
            columns = GridCells.Fixed(4),
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            items(PantopusIcon.entries.toList(), key = { it.name }) { icon ->
                IconCell(icon)
            }
        }
    }
}

@Composable
private fun IconCell(icon: PantopusIcon) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = icon.lucideName,
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s2),
            size = 28.dp,
            tint = PantopusColors.appText,
        )
        Text(
            text = icon.lucideName,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            maxLines = 1,
        )
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 1200)
@Composable
private fun IconGalleryScreenPreview() {
    IconGalleryScreen()
}
