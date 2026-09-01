@file:Suppress("MagicNumber", "PackageNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Paper "letter" surface for the A17.7 Memory body. Renders the
 * handwritten note as multi-paragraph serif body on a sunken paper card,
 * closing with an italic serif signature. Serif is reserved for
 * ceremonial / mailbox letter surfaces only (per design system).
 */
@Composable
fun StationeryCard(
    eyebrow: String,
    paragraphs: List<String>,
    signature: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        EyebrowRow(eyebrow)

        paragraphs.forEach { paragraph ->
            Text(
                text = paragraph,
                fontFamily = FontFamily.Serif,
                fontSize = 16.sp,
                lineHeight = 24.sp,
                color = PantopusColors.appText,
            )
        }

        Text(
            text = "— $signature",
            fontFamily = FontFamily.Serif,
            fontStyle = FontStyle.Italic,
            fontSize = 20.sp,
            color = PantopusColors.appText,
            modifier =
                Modifier
                    .padding(top = Spacing.s1)
                    .semantics { contentDescription = "Signed, $signature" },
        )
    }
}

@Composable
private fun EyebrowRow(eyebrow: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .width(24.dp)
                    .height(1.dp)
                    .background(PantopusColors.warning),
        )
        Text(eyebrow, style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .height(1.dp)
                    .background(PantopusColors.appBorder),
        )
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun StationeryCardPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4)) {
        StationeryCard(
            eyebrow = "The note",
            paragraphs =
                listOf(
                    "It's been a year, can you believe it.",
                    "I still think about how you walked back from the trail with Pepper under your arm.",
                    "Thank you again. I baked you a loaf — it's on the porch.",
                ),
            signature = "Mei (and Pepper)",
        )
    }
}
