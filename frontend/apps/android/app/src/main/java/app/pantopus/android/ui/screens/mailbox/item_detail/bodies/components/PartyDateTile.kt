@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii

/**
 * A17.9 — Rose calendar-page tile. 56×60 dp card with a rose month
 * strip on top (MAY) and a serif day number + uppercase weekday label
 * below. Mirrors iOS `DateTile`.
 */
@Composable
fun PartyDateTile(
    monthLabel: String,
    dayNumber: String,
    dayLabel: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .size(width = 56.dp, height = 60.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .semantics { contentDescription = "$dayLabel $monthLabel $dayNumber" }
                .testTag("partyDateTile"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(18.dp)
                    .background(PantopusColors.categoryParty),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = monthLabel,
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.2.sp,
                color = PantopusColors.appTextInverse,
            )
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(42.dp)
                    .background(PantopusColors.appSurface),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = dayNumber,
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = (-0.5).sp,
                color = PantopusColors.appText,
                lineHeight = 22.sp,
            )
            Text(
                text = dayLabel,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.7.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}
