@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.ui.screens.crewday.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.crewday.CrewDayListItemDto
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanRow
import app.pantopus.android.ui.screens.plans.components.PlanRowEnd
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** A Crew Day's own tile: home green for the household's side, business violet for the crew's. */
@Composable
fun CrewDayTile(crew: Boolean = false) {
    if (crew) {
        PlanIconTile(PantopusIcon.Truck, PantopusColors.businessBg, PantopusColors.business)
    } else {
        PlanIconTile(PantopusIcon.CalendarCheck, PantopusColors.homeBg, PantopusColors.home)
    }
}

/** A section of a Crew Day list: its overline over a card of rows. */
@Composable
fun CrewDaySection(
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PlanOverline(title)
        PlanFormCard { content() }
    }
}

/** The tones of a Crew Day status chip (boards `Route`, `DatesAnswers`): done, told, home, waiting, needs a look. */
enum class CrewDayTone(val background: Color, val ink: Color) {
    Ok(PantopusColors.successLight, PantopusColors.success),
    Info(PantopusColors.primary100, PantopusColors.info),
    Home(PantopusColors.homeBg, PantopusColors.home),
    Wait(PantopusColors.appSurfaceSunken, PantopusColors.appTextStrong),
    Warn(PantopusColors.warmAmberBg, PantopusColors.warningStrong),
}

/** A small status chip in one of the [CrewDayTone]s. */
@Composable
fun CrewDayToneChip(
    text: String,
    tone: CrewDayTone,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Medium),
        color = tone.ink,
        modifier =
            modifier
                .heightIn(min = 20.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(tone.background)
                .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

/** What a crew's street day is doing, in the spec's words (01-spec screen 13). */
fun crewDayStatusWord(item: CrewDayListItemDto): String =
    when (item.status) {
        "draft" -> "Draft"
        "pending_review" -> "Waiting for approval"
        "declined" -> "Not approved"
        "open" -> if (item.isFull) "Full" else "Open"
        "in_progress" -> "Today"
        "done" -> if (item.paidOut) "Paid out" else "Done"
        "cancelled" -> "Cancelled"
        else -> "Open"
    }

/** One street day in the crew's lists: "Tue, Nov 17 · 9 AM–1 PM · 6 of 10 booked", and its status. */
@Composable
fun CrewDayDayRow(
    item: CrewDayListItemDto,
    first: Boolean,
    onClick: () -> Unit,
    past: Boolean = false,
    /** Today's days (board `CrewList`): "9 AM–1 PM · 2 of 6 done" and **Open the route**. */
    onOpenRoute: (() -> Unit)? = null,
) {
    val counts =
        if (onOpenRoute != null) {
            "${item.doneCount} of ${item.bookedCount} done"
        } else if (past) {
            listOfNotNull(
                "${item.doneCount} ${if (item.doneCount == 1) "home" else "homes"}",
                item.chargedCents.takeIf { it > 0 }?.let { "${CrewDayFormat.price(it)} charged" },
            ).joinToString(" · ")
        } else {
            listOfNotNull(
                "${item.bookedCount} of ${item.capacity} booked",
                when (item.priceChecks) {
                    0 -> null
                    1 -> "1 price to confirm"
                    else -> "${item.priceChecks} prices to confirm"
                },
            ).joinToString(" · ")
        }
    val subtitle =
        listOf(
            if (onOpenRoute != null) {
                CrewDayFormat.window(item.windowStart, item.windowEnd).orEmpty()
            } else {
                CrewDayFormat.dateAndWindow(item.serviceDate, item.windowStart, item.windowEnd)
            },
            counts,
        )
    PlanRow(
        title = item.title,
        subtitle = subtitle.filter { it.isNotBlank() }.joinToString(" · "),
        // Today's rows carry the route button instead (board `CrewList`); the section already says Today.
        end = if (onOpenRoute != null) PlanRowEnd.None else PlanRowEnd.Status(crewDayStatusWord(item)),
        first = first,
        leading = { CrewDayTile(crew = true) },
        onClick = onClick,
        modifier = Modifier.testTag("crewDaysCrewRow_${item.id}"),
        below =
            when {
                onOpenRoute != null -> {
                    {
                        PrimaryButton(
                            title = "Open the route",
                            onClick = onOpenRoute,
                            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2).testTag("crewDaysCrewRoute_${item.id}"),
                        )
                    }
                }
                item.status == "declined" && item.reviewNote != null -> {
                    {
                        Text(
                            text = "Pantopus: ${item.reviewNote}",
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
                else -> null
            },
    )
}

/** Placeholder rows while a Crew Day list loads: the list's own shape, never a spinner. */
@Composable
fun CrewDayListPlaceholder(modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Shimmer(width = 120.dp, height = 12.dp)
        repeat(PLACEHOLDER_ROWS) {
            Row(
                modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 44.dp, height = 44.dp, cornerRadius = 13.dp)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Shimmer(width = 200.dp, height = 16.dp)
                    Shimmer(width = 150.dp, height = 12.dp)
                }
            }
        }
    }
}

/** A page title under the bar (board h2): "Crew Days". */
@Composable
fun CrewDayPageTitle(
    text: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = text,
            style = PantopusTextStyle.h2.copy(fontWeight = FontWeight.Bold),
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        subtitle?.let { Text(text = it, style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary) }
    }
}

private const val PLACEHOLDER_ROWS = 3
