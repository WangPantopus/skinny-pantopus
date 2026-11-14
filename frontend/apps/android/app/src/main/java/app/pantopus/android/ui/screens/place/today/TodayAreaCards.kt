package app.pantopus.android.ui.screens.place.today

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

// What someone with no address on Pantopus yet sees on Today (TABCARD §4a, drawing TodayNoAddress): the start card
// with "Use my location" and "Type my address", and "Add your address for the rest" last on the city's day. Both address
// buttons open Place's address-first screen, never the Add Home steps. Words and ids match iOS and web.

/** Location was allowed (precise or approximate) before: "Use my location" reads a fix without asking. */
internal fun hasLocationPermission(context: Context): Boolean =
    listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION).any {
        ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
    }

/**
 * Today with no Home, saved address or claim in review, and no city kept yet (replaces "Today starts at your address").
 * Only the "Use my location" tap asks the system for location; [refused] shows the line under the buttons.
 */
@Composable
fun TodayAreaStartCard(
    locating: Boolean,
    refused: Boolean,
    onUseLocation: () -> Unit,
    onTypeAddress: () -> Unit,
) {
    Column(
        modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth().placeCard().padding(24.dp).testTag("today.areaStart"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier.size(56.dp).clip(RoundedCornerShape(16.dp)).background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.CloudSun, null, size = 28.dp, strokeWidth = 2f, tint = PantopusColors.home)
        }
        Text(
            "Today starts where you are",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            color = PantopusColors.appText,
        )
        Text(
            "See the sun, weather and air for your city now. Add your address for pickup day, tax deadlines and alerts on " +
                "your street.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            textAlign = TextAlign.Center,
            color = PantopusColors.appTextSecondary,
        )
        PrimaryButton(
            title = "Use my location",
            onClick = onUseLocation,
            isLoading = locating,
            modifier = Modifier.fillMaxWidth().testTag("today.areaStart.useLocation"),
        )
        GhostButton(
            title = "Type my address",
            onClick = onTypeAddress,
            modifier = Modifier.fillMaxWidth().testTag("today.areaStart.typeAddress"),
        )
        // Refused, off, or no fix came.
        if (refused) {
            Text(
                "Location is off for Pantopus. You can type your address instead.",
                fontSize = 13.sp,
                lineHeight = 18.sp,
                textAlign = TextAlign.Center,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.testTag("today.areaStart.denied"),
            )
        }
    }
}

/** Last on the city's day: the rest of Today needs the street. [onAdd] opens Place's address-first screen. */
@Composable
fun TodayAreaAddAddressCard(onAdd: () -> Unit) {
    Column(
        modifier = Modifier.padding(top = 24.dp).fillMaxWidth().placeCard().padding(Spacing.s4).testTag("today.areaAddAddress"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("Add your address for the rest", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            "Pickup day, tax deadlines, council meetings and alerts for your street.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextSecondary,
        )
        PrimaryButton(
            title = "Add your address",
            onClick = onAdd,
            modifier = Modifier.padding(top = 4.dp).fillMaxWidth().testTag("today.areaAddAddress.add"),
        )
    }
}
