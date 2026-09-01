@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The four create-actions surfaced from the Home calendar FAB sheet.
 * Mirrors iOS `HomeCreateAction`. Only [AddEvent] is in-stream (F3);
 * the others deep-link to other Home streams by route.
 */
enum class HomeCreateAction(
    val tagSuffix: String,
    val icon: PantopusIcon,
    val title: String,
    val subtitle: String,
) {
    AddEvent("addEvent", PantopusIcon.CalendarPlus, "Add event", "A one-off or repeating event"),
    FindATime("findATime", PantopusIcon.Users, "Find a time", "Pick a slot that works for everyone"),
    BookResource("bookResource", PantopusIcon.Package, "Book a resource", "Guest room, EV charger, tools"),
    ScheduleVisit("scheduleVisit", PantopusIcon.DoorOpen, "Schedule a visit", "Offer a vendor or guest a window"),
}

/**
 * Content for the FAB create-menu bottom sheet. The caller hosts it in a
 * `ModalBottomSheet` and dismisses on selection. Mirrors iOS
 * `HomeCalendarCreateMenu`.
 */
@Composable
fun HomeCreateMenuContent(
    onSelect: (HomeCreateAction) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(start = Spacing.s2, end = Spacing.s2, bottom = Spacing.s4),
    ) {
        Text(
            text = "Create",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(horizontal = Spacing.s2, vertical = Spacing.s2),
        )
        HomeCreateAction.entries.forEach { action ->
            CreateMenuRow(action = action, onClick = { onSelect(action) })
        }
    }
}

@Composable
private fun CreateMenuRow(
    action: HomeCreateAction,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s3)
                .testTag("homeCreateMenu_${action.tagSuffix}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = action.icon, contentDescription = null, size = 19.dp, tint = PantopusColors.home)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = action.title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(text = action.subtitle, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.appTextMuted,
        )
    }
}
