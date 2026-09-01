@file:Suppress("MagicNumber", "PackageNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage

/**
 * Keepsake photograph hero for the A17.7 Memory body. A white polaroid
 * card sits — slightly rotated — on a paper "table", with a handwritten
 * serif caption printed under the photo and a small printed label below.
 */
@Composable
fun PolaroidFrame(
    photoUrl: String?,
    caption: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(vertical = Spacing.s5, horizontal = Spacing.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(
            modifier =
                Modifier
                    .rotate(-2f)
                    .width(232.dp)
                    .shadow(6.dp, RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.appSurface, RoundedCornerShape(Radii.sm))
                    .padding(Spacing.s3)
                    .padding(bottom = Spacing.s2),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Photo(photoUrl)
            Text(
                text = caption,
                fontSize = 14.sp,
                fontFamily = FontFamily.Serif,
                fontStyle = FontStyle.Italic,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { contentDescription = "Caption: $caption" },
            )
        }

        Text(
            text = label.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.4.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun Photo(photoUrl: String?) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .aspectRatio(4f / 5f)
                .clip(RoundedCornerShape(Radii.xs))
                .background(PantopusColors.warningBg)
                .semantics { contentDescription = "Photograph" },
        contentAlignment = Alignment.Center,
    ) {
        if (!photoUrl.isNullOrEmpty()) {
            SubcomposeAsyncImage(
                model = photoUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                loading = { PhotoPlaceholder() },
                error = { PhotoPlaceholder() },
            )
        } else {
            PhotoPlaceholder()
        }
    }
}

@Composable
private fun PhotoPlaceholder() {
    PantopusIconImage(
        icon = PantopusIcon.Image,
        contentDescription = null,
        size = 32.dp,
        tint = PantopusColors.warning,
    )
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun PolaroidFramePreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
        PolaroidFrame(
            photoUrl = null,
            caption = "Pepper, May 19 2025",
            label = "1 of 1 · sent by Mei",
        )
    }
}
