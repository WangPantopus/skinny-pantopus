@file:Suppress("MagicNumber", "LongMethod", "FunctionNaming", "LongParameterList", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Postcard hero used in the A12.7 Postcard verification flow. Compose
 * mirror of iOS `Core/Design/Components/Postcard.swift`.
 *
 * Renders a 320×196 dp cream-stock card with the recipient address in
 * a serif italic block, three faded postage marks in the top-right,
 * and a 1 dp vertical divider down the middle. When [delivered] is
 * `true`, a -8°-rotated red `DELIVERED` cancellation stamp is overlaid
 * at 60% opacity.
 */
@Composable
fun Postcard(
    recipientName: String,
    street: String,
    cityZip: String,
    modifier: Modifier = Modifier,
    delivered: Boolean = false,
) {
    val statusLabel = if (delivered) "delivered postcard" else "postcard"
    Box(
        modifier =
            modifier
                .size(width = 320.dp, height = 196.dp)
                .shadow(
                    elevation = 14.dp,
                    shape = RoundedCornerShape(Radii.md),
                    ambientColor = Color.Black.copy(alpha = 0.10f),
                    spotColor = Color.Black.copy(alpha = 0.10f),
                )
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.paperCream)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.md))
                .semantics { contentDescription = "$statusLabel to $recipientName, $street, $cityZip" },
    ) {
        // Center divider.
        Row(modifier = Modifier.fillMaxSize()) {
            Spacer(modifier = Modifier.weight(1f))
            Box(
                modifier =
                    Modifier
                        .width(1.dp)
                        .fillMaxHeight()
                        .padding(vertical = Spacing.s3)
                        .background(PantopusColors.appBorder),
            )
            Spacer(modifier = Modifier.weight(1f))
        }
        // Postage marks top-right.
        PostageMarks(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(Spacing.s3),
        )
        // Recipient block bottom-right.
        RecipientBlock(
            recipientName = recipientName,
            street = street,
            cityZip = cityZip,
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(Spacing.s4),
        )
        // Delivered stamp.
        if (delivered) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 36.dp, end = 16.dp)
                        .offset(x = (-56).dp, y = 32.dp)
                        .alpha(0.6f)
                        .rotate(-8f),
            ) {
                DeliveredStamp()
            }
        }
    }
}

@Composable
private fun PostageMarks(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        repeat(3) {
            Box(
                modifier =
                    Modifier
                        .size(width = 18.dp, height = 24.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(PantopusColors.warningBg.copy(alpha = 0.6f))
                        .border(width = 0.5.dp, color = PantopusColors.appTextMuted, shape = RoundedCornerShape(2.dp)),
            )
        }
    }
}

@Composable
private fun RecipientBlock(
    recipientName: String,
    street: String,
    cityZip: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.width(140.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = recipientName,
            color = PantopusColors.appText,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Serif,
            fontStyle = FontStyle.Italic,
        )
        Text(
            text = street,
            color = PantopusColors.appTextStrong,
            fontSize = 13.sp,
            fontFamily = FontFamily.Serif,
            fontStyle = FontStyle.Italic,
        )
        Text(
            text = cityZip,
            color = PantopusColors.appTextStrong,
            fontSize = 13.sp,
            fontFamily = FontFamily.Serif,
            fontStyle = FontStyle.Italic,
        )
    }
}

@Composable
private fun DeliveredStamp() {
    Box(
        modifier =
            Modifier
                .border(width = 3.dp, color = PantopusColors.error, shape = RoundedCornerShape(Radii.xs))
                .padding(horizontal = Spacing.s2, vertical = 6.dp),
    ) {
        Text(
            text = "DELIVERED",
            color = PantopusColors.error,
            fontSize = 18.sp,
            fontWeight = FontWeight.ExtraBold,
            fontFamily = FontFamily.Serif,
            letterSpacing = 2.sp,
        )
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 500, backgroundColor = 0xFFF6F7F9)
@Composable
private fun PostcardPreview() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Postcard(
            recipientName = "Mira Patel",
            street = "412 Elm St, Apt 3B",
            cityZip = "San Francisco, CA 94114",
        )
        Postcard(
            recipientName = "Mira Patel",
            street = "412 Elm St, Apt 3B",
            cityZip = "San Francisco, CA 94114",
            delivered = true,
        )
    }
}
