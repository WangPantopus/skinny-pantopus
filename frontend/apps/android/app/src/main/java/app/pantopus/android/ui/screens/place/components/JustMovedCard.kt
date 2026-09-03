package app.pantopus.android.ui.screens.place.components

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.place.PlaceDetailGroup
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import java.time.LocalDate

// ============================================================
// Just moved — the first week at this address (Wedge v2 D5, movers first).
// For ~60 days after the move-in date this card leads the dashboard: five
// things the address can do now, each a row into a surface that already
// exists, each with a check the person ticks off. "Set your pickup day"
// ticks itself once the calendar runs on the household's own day. At five
// of five the card retires into one line; "Not new here" dismisses it.
// Only the ticks and the dismissal are stored, locally. Parity twin of
// the web `JustMovedCard`.
// ============================================================

const val JUST_MOVED_WINDOW_DAYS: Long = 60
private const val LOOKAHEAD_DAYS: Long = 14
private const val DATE_PREFIX_LENGTH = 10
private const val PREFS = "just_moved"

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

enum class JustMovedStepId { PICKUP, MAIL, MONEY, CIVIC, BLOCK }

private data class JustMovedStep(
    val id: JustMovedStepId,
    val icon: PantopusIcon,
    val label: String,
    val payoff: String,
    val target: PlaceDetailGroup?,
)

private val STEPS =
    listOf(
        JustMovedStep(
            JustMovedStepId.PICKUP,
            PantopusIcon.Trash2,
            "Set your pickup day",
            "Reminders the night before, every week",
            PlaceDetailGroup.TODAY,
        ),
        JustMovedStep(
            JustMovedStepId.MAIL,
            PantopusIcon.Mailbox,
            "Send back the previous resident's mail",
            "One tap returns it; yours gets filed",
            null,
        ),
        JustMovedStep(
            JustMovedStepId.MONEY,
            PantopusIcon.Zap,
            "Utilities, rebates, and rates",
            "What this address qualifies for, and when taxes are due",
            PlaceDetailGroup.MONEY,
        ),
        JustMovedStep(
            JustMovedStepId.CIVIC,
            PantopusIcon.Landmark,
            "Who represents you, and the schools",
            "Your districts, the next election, the council calendar",
            PlaceDetailGroup.CIVIC,
        ),
        JustMovedStep(
            JustMovedStepId.BLOCK,
            PantopusIcon.Users,
            "Meet the block",
            "Who is verified nearby, and the Founding Neighbor slots",
            PlaceDetailGroup.BLOCK,
        ),
    )

/** Local, per-home memory of the ticks and the dismissal. */
class JustMovedStore(context: Context, private val homeId: String) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isDismissed(): Boolean = prefs.getBoolean("dismissed:$homeId", false)

    fun dismiss() = prefs.edit().putBoolean("dismissed:$homeId", true).apply()

    fun done(): Set<JustMovedStepId> =
        prefs.getStringSet("done:$homeId", emptySet()).orEmpty().mapNotNull {
                name ->
            JustMovedStepId.entries.firstOrNull { it.name == name }
        }.toSet()

    fun setDone(done: Set<JustMovedStepId>) = prefs.edit().putStringSet("done:$homeId", done.map { it.name }.toSet()).apply()
}

@Composable
@Suppress("LongMethod")
fun JustMovedCard(
    homeId: String,
    moveInDate: String?,
    onOpenDetail: (PlaceDetailGroup) -> Unit,
    onOpenMailDay: () -> Unit,
    modifier: Modifier = Modifier,
    /** From the address calendar: false once the household has set its own pickup day. */
    needsPickupDay: Boolean? = null,
) {
    if (!isRecentMove(moveInDate)) return
    val context = LocalContext.current
    val store = remember(homeId) { JustMovedStore(context, homeId) }
    var dismissed by remember(homeId) { mutableStateOf(store.isDismissed()) }
    var done by remember(homeId) { mutableStateOf(store.done()) }
    if (dismissed) return

    fun isDone(id: JustMovedStepId) = (id == JustMovedStepId.PICKUP && needsPickupDay == false) || id in done
    val doneCount = STEPS.count { isDone(it.id) }
    val total = STEPS.size
    val dismiss = {
        store.dismiss()
        dismissed = true
    }

    // Five of five: the card retires into one line rather than vanishing.
    if (doneCount == total) {
        Row(
            modifier =
                modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(PantopusColors.homeBg)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp, vertical = 12.dp)
                    .testTag("place.justMoved.done"),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(modifier = Modifier.size(32.dp).clip(CircleShape).background(PantopusColors.home), contentAlignment = Alignment.Center) {
                PantopusIconImage(PantopusIcon.Check, null, size = 16.dp, strokeWidth = 2.75f, tint = Color.White)
            }
            Text(
                "First week done. The block is yours.",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Text(
                "Hide",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
                modifier =
                    Modifier.clickable {
                        dismiss()
                    },
            )
        }
        return
    }

    Column(modifier = modifier.fillMaxWidth().placeCard().testTag("place.justMoved")) {
        // Header band in the home tint: this is the card the eye lands on.
        Column(
            modifier =
                Modifier.fillMaxWidth().background(
                    PantopusColors.homeBg,
                ).padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 14.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                Box(
                    modifier = Modifier.size(42.dp).clip(RoundedCornerShape(12.dp)).background(PantopusColors.home),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.Truck, null, size = 22.dp, strokeWidth = 2f, tint = Color.White)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Your first week at this address",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 24.sp,
                        letterSpacing = (-0.27).sp,
                        color = PantopusColors.appText,
                    )
                    Text(
                        "Five things it can do for you now, before there are neighbors to meet.",
                        fontSize = 13.5.sp,
                        lineHeight = 19.sp,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(modifier = Modifier.weight(1f).height(6.dp).clip(CircleShape).background(PantopusColors.appSurface)) {
                    Box(
                        modifier =
                            Modifier.fillMaxWidth(
                                doneCount.toFloat() / total,
                            ).fillMaxHeight().clip(CircleShape).background(PantopusColors.home),
                    )
                }
                Text(
                    "$doneCount of $total done",
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }

        Column(modifier = Modifier.padding(horizontal = 8.dp)) {
            STEPS.forEachIndexed { index, step ->
                if (index > 0) HorizontalDivider(color = PantopusColors.appBorderSubtle)
                val checked = isDone(step.id)
                val auto = step.id == JustMovedStepId.PICKUP && needsPickupDay == false
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier =
                            Modifier.padding(4.dp).size(28.dp).clip(CircleShape)
                                .background(if (checked) PantopusColors.home else PantopusColors.appSurface)
                                .border(2.dp, if (checked) PantopusColors.home else PantopusColors.appBorder, CircleShape)
                                .toggleable(value = checked, enabled = !auto, role = Role.Checkbox) {
                                    done = if (step.id in done) done - step.id else done + step.id
                                    store.setDone(done)
                                }
                                .semantics { contentDescription = step.label }
                                .testTag("place.justMoved.check.${step.id.name.lowercase()}"),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (checked) PantopusIconImage(PantopusIcon.Check, null, size = 14.dp, strokeWidth = 3f, tint = Color.White)
                    }
                    Row(
                        modifier =
                            Modifier.weight(1f).clip(RoundedCornerShape(8.dp))
                                .clickable { step.target?.let(onOpenDetail) ?: onOpenMailDay() }
                                .padding(vertical = 10.dp, horizontal = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        PantopusIconImage(
                            step.icon,
                            null,
                            size = 18.dp,
                            strokeWidth = 2f,
                            tint = if (checked) PantopusColors.appTextMuted else PantopusColors.home,
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                step.label,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (checked) PantopusColors.appTextSecondary else PantopusColors.appText,
                            )
                            Text(step.payoff, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary)
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

        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Shows for your first two months here.",
                fontSize = 12.sp,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.weight(1f),
            )
            Text(
                "Not new here",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.clickable { dismiss() }.testTag("place.justMoved.dismiss"),
            )
        }
    }
}
