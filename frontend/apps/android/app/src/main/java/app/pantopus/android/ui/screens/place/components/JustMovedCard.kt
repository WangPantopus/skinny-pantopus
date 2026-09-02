package app.pantopus.android.ui.screens.place.components

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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.place.PlaceDetailGroup
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import java.time.LocalDate

// ============================================================
// Just moved — the first-week checklist (Wedge v2 D5, movers first).
// A household that just moved has the strongest address needs of anyone
// and no network to miss. Shows for ~60 days after the move-in date;
// five things, each a link into a surface that already exists.
// Parity twin of the web `JustMovedCard`.
// ============================================================

const val JUST_MOVED_WINDOW_DAYS: Long = 60
private const val LOOKAHEAD_DAYS: Long = 14
private const val DATE_PREFIX_LENGTH = 10

/** True when the move-in date is within the last 60 days (or up to 14 days ahead). */
fun isRecentMove(
    moveInDate: String?,
    todayEpochDay: Long = LocalDate.now().toEpochDay(),
): Boolean {
    if (moveInDate.isNullOrBlank()) return false
    val day = runCatching { LocalDate.parse(moveInDate.take(DATE_PREFIX_LENGTH)).toEpochDay() }.getOrNull() ?: return false
    val days = todayEpochDay - day
    return days >= -LOOKAHEAD_DAYS && days <= JUST_MOVED_WINDOW_DAYS
}

private data class JustMovedStep(
    val icon: PantopusIcon,
    val label: String,
    val sub: String,
    val target: PlaceDetailGroup?,
)

private val STEPS =
    listOf(
        JustMovedStep(
            PantopusIcon.Trash2,
            "Set your pickup day",
            "Garbage and recycling reminders start the night before",
            PlaceDetailGroup.TODAY,
        ),
        JustMovedStep(
            PantopusIcon.Mailbox,
            "Send back the previous resident's mail",
            "Mail Day returns it in one tap; your own gets filed",
            null,
        ),
        JustMovedStep(
            PantopusIcon.Zap,
            "Utilities, rebates, and rates",
            "What this address qualifies for, and the tax dates",
            PlaceDetailGroup.MONEY,
        ),
        JustMovedStep(
            PantopusIcon.Landmark,
            "Who represents you, and the schools",
            "Your districts, the next election, the council calendar",
            PlaceDetailGroup.CIVIC,
        ),
        JustMovedStep(
            PantopusIcon.Users,
            "Meet the block",
            "Who is verified nearby, and the Founding Neighbor slots",
            PlaceDetailGroup.BLOCK,
        ),
    )

@Composable
fun JustMovedCard(
    moveInDate: String?,
    onOpenDetail: (PlaceDetailGroup) -> Unit,
    onOpenMailDay: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var dismissed by rememberSaveable(moveInDate) { mutableStateOf(false) }
    if (dismissed || !isRecentMove(moveInDate)) return
    Column(modifier = modifier.fillMaxWidth().placeCard().padding(16.dp).testTag("place.justMoved")) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier.size(42.dp).clip(RoundedCornerShape(12.dp)).background(PantopusColors.homeBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(PantopusIcon.Truck, null, size = 22.dp, strokeWidth = 2f, tint = PantopusColors.home)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "Just moved in? Here's the first week.",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    lineHeight = 23.sp,
                    color = PantopusColors.appText,
                )
                Text(
                    "Five things this address can do for you now, before there are neighbors to meet.",
                    fontSize = 13.5.sp,
                    lineHeight = 19.sp,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Box(
                modifier = Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).clickable { dismissed = true },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(PantopusIcon.X, "Dismiss", size = 16.dp, strokeWidth = 2.25f, tint = PantopusColors.appTextMuted)
            }
        }
        Column(modifier = Modifier.padding(top = 12.dp)) {
            STEPS.forEach { step ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { step.target?.let(onOpenDetail) ?: onOpenMailDay() }
                            .padding(vertical = 10.dp, horizontal = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PantopusIconImage(step.icon, null, size = 18.dp, strokeWidth = 2f, tint = PantopusColors.home)
                    Column(modifier = Modifier.weight(1f)) {
                        Text(step.label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                        Text(step.sub, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary)
                    }
                    PantopusIconImage(
                        PantopusIcon.ChevronRight,
                        null,
                        size = 16.dp,
                        strokeWidth = 2.25f,
                        tint = PantopusColors.appTextMuted,
                    )
                }
            }
        }
    }
}
