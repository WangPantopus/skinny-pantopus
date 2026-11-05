@file:Suppress("LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.crewday.invite

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.crewday.CrewDayPublicDto
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.crewday.components.CrewDayCrewRow
import app.pantopus.android.ui.screens.crewday.components.CrewDayListPlaceholder
import app.pantopus.android.ui.screens.crewday.components.CrewDayServiceTag
import app.pantopus.android.ui.screens.crewday.components.CrewDayStreetMap
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.detail.PlanFooterCaption
import app.pantopus.android.ui.screens.plans.detail.PlanPlainScaffold
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/** Where the invitation hands off. */
data class CrewDayInvitationActions(
    val onBack: () -> Unit,
    /** "See my price": Your price (screen 2). */
    val onSeePrice: (code: String) -> Unit,
    /** "Open my Crew Day": the viewer's own booking (screen 5). */
    val onOpenBooking: (bookingId: String) -> Unit,
    /** "Open the dashboard": the crew's own day (screen 15). */
    val onOpenCrewDay: (crewDayId: String, businessId: String?) -> Unit,
    /** "Ask for the next one" (screen 11). */
    val onAsk: () -> Unit,
    /** "How Crew Day works" and "Who sees what": the web's two short pages. */
    val onOpenWeb: (path: String) -> Unit,
)

/**
 * The invitation (screen 1, boards `Main` and `InvitationDark`) as the app draws it: the street, the day, the crew,
 * the price from, the count (never who), See my price, how it works and what the crew does. Every state of the web
 * page: full, closed, cancelled, done, not available, already booked, and the crew's own day.
 */
@Composable
fun CrewDayInvitationScreen(
    actions: CrewDayInvitationActions,
    viewModel: CrewDayInvitationViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    val loaded = state as? CrewDayInvitationUiState.Loaded
    PlanPlainScaffold(
        onBack = actions.onBack,
        title = "Crew Day",
        modifier = Modifier.testTag("crewDayInvitation"),
        footer = loaded?.let { current -> { InvitationFooter(current.day, actions) } },
    ) {
        when (val current = state) {
            CrewDayInvitationUiState.Loading -> CrewDayListPlaceholder(modifier = Modifier.testTag("crewDayLoading"))
            CrewDayInvitationUiState.Unavailable ->
                EmptyState(
                    icon = PantopusIcon.CalendarX,
                    headline = "This Crew Day isn't available",
                    subcopy = "The link may be old, or the day isn't open yet. Ask for a Crew Day on your street instead.",
                    ctaTitle = "Ask for a Crew Day",
                    onCta = actions.onAsk,
                    modifier = Modifier.heightIn(min = 420.dp).testTag("crewDayInvitationUnavailable"),
                    tint = PantopusColors.homeBg,
                    accent = PantopusColors.home,
                )
            is CrewDayInvitationUiState.Error ->
                ErrorState(
                    headline = "Couldn't load this Crew Day",
                    message = current.message,
                    onRetry = viewModel::retry,
                    modifier = Modifier.heightIn(min = 420.dp).testTag("crewDayLoadError"),
                )
            is CrewDayInvitationUiState.Loaded -> InvitationContent(current.day, actions)
        }
    }
}

@Composable
private fun InvitationContent(
    day: CrewDayPublicDto,
    actions: CrewDayInvitationActions,
) {
    val street = day.streetLabel ?: day.title
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        Text(
            text = "A local crew is coming to $street${day.city?.let { " in $it" }.orEmpty()}.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
        Column(modifier = Modifier.fillMaxWidth().planCard()) {
            CrewDayStreetMap(street = street)
            Column(
                modifier = Modifier.fillMaxWidth().padding(start = Spacing.s4, end = Spacing.s4, top = 14.dp, bottom = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                CrewDayServiceTag(service = day.service, label = day.serviceLabel ?: CrewDayFormat.service(day.service))
                Text(
                    text = day.title,
                    style = PantopusTextStyle.h3.copy(lineHeight = 26.sp, fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                Text(text = whenLine(day), style = PantopusTextStyle.small, color = PantopusColors.appTextStrong)
                day.priceFromCents?.let {
                    Text(
                        text = "From ${CrewDayFormat.price(it)} a home, including tax",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextStrong,
                    )
                }
                CrewDayCrewRow(crew = day.crew, modifier = Modifier.padding(top = Spacing.s1))
                Text(
                    text = countLine(day),
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.testTag("crewDayInvitationCount"),
                )
            }
        }
        StateNote(day)
        HowItWorks()
        WhatTheCrewDoes(day)
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = "Pantopus organizes this Crew Day. ${day.crew?.name ?: "The crew"} does the work.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PlanTextButton(
                    title = "How Crew Day works",
                    onClick = { actions.onOpenWeb("/crew-day/how-it-works") },
                    modifier = Modifier.weight(1f).testTag("crewDayInvitationHowItWorks"),
                )
                PlanTextButton(
                    title = "Who sees what",
                    onClick = { actions.onOpenWeb("/crew-day/who-sees-what") },
                    modifier = Modifier.weight(1f).testTag("crewDayInvitationWhoSees"),
                )
            }
        }
    }
}

/** "Tuesday, Nov 17 · Arriving 9 AM–1 PM". */
private fun whenLine(day: CrewDayPublicDto): String =
    listOfNotNull(
        CrewDayFormat.longDate(CrewDayFormat.date(day.serviceDate)),
        CrewDayFormat.window(day.windowStart, day.windowEnd)?.let { "Arriving $it" },
    ).joinToString(" · ")

/** "6 homes booked · room for 4 more": counts only, never which homes. */
private fun countLine(day: CrewDayPublicDto): String {
    val booked = if (day.bookedCount == 1) "1 home booked" else "${day.bookedCount} homes booked"
    return when {
        day.spotsLeft <= 0 -> "$booked · no room left"
        day.bookedCount == 0 -> "Room for ${day.spotsLeft} homes"
        else -> "$booked · room for ${day.spotsLeft} more"
    }
}

/** Full, closed, cancelled or done: one line that says so, above how it works. */
@Composable
private fun StateNote(day: CrewDayPublicDto) {
    val zone = CrewDayFormat.zone(day.timezone)
    val closes = CrewDayFormat.shortDate(CrewDayFormat.instant(day.bookingClosesAt), zone)
    val text =
        when (day.availability) {
            "full" -> "All ${day.capacity} spots are taken."
            "closed" -> closes?.let { "Booking closed on $it." } ?: "Booking is closed."
            "cancelled" -> "This Crew Day was cancelled. Nobody was charged."
            "done" -> "This Crew Day is over."
            else -> null
        } ?: return
    Text(
        text = text,
        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
        color = PantopusColors.appText,
        modifier = Modifier.testTag("crewDayInvitationState"),
    )
}

/** The main action: See my price, Open my Crew Day, Open the dashboard, or Ask for the next one. */
@Composable
private fun InvitationFooter(
    day: CrewDayPublicDto,
    actions: CrewDayInvitationActions,
) {
    val zone = CrewDayFormat.zone(day.timezone)
    val closes = CrewDayFormat.instant(day.bookingClosesAt)
    val bookingId = day.viewer?.bookingId
    when {
        day.viewer?.role == "crew" -> {
            Text(
                text = "This is your Crew Day",
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
            PrimaryButton(
                title = "Open the dashboard",
                onClick = { actions.onOpenCrewDay(day.id, day.crew?.businessUserId) },
                modifier = Modifier.fillMaxWidth().testTag("crewDayInvitationDashboard"),
            )
        }
        bookingId != null ->
            PrimaryButton(
                title = "Open my Crew Day",
                onClick = { actions.onOpenBooking(bookingId) },
                modifier = Modifier.fillMaxWidth().testTag("crewDayInvitationOpenBooking"),
            )
        day.availability == "open" -> {
            PrimaryButton(
                title = "See my price",
                onClick = { day.code?.let(actions.onSeePrice) },
                modifier = Modifier.fillMaxWidth().testTag("crewDayInvitationSeePrice"),
            )
            closes?.let {
                PlanFooterCaption("Booking closes ${CrewDayFormat.weekday(it.atZone(zone).toLocalDate())}, ${shortMonthDay(it, zone)}.")
            }
        }
        day.availability == "full" || day.availability == "done" ->
            PrimaryButton(
                title = "Ask for the next one",
                onClick = actions.onAsk,
                modifier = Modifier.fillMaxWidth().testTag("crewDayInvitationAsk"),
            )
        else ->
            PrimaryButton(
                title = "Ask for a Crew Day on my street",
                onClick = actions.onAsk,
                modifier = Modifier.fillMaxWidth().testTag("crewDayInvitationAsk"),
            )
    }
}

/** "Nov 15". */
private fun shortMonthDay(
    instant: java.time.Instant,
    zone: java.time.ZoneId,
): String = CrewDayFormat.shortDate(instant, zone).orEmpty().substringAfter(", ")

private data class HowRow(
    val icon: PantopusIcon,
    val title: String,
    val body: String,
)

private val HOW_IT_WORKS =
    listOf(
        HowRow(PantopusIcon.Home, "Your home, your own price", "It's set by your home's size, never by how many neighbors join."),
        HowRow(
            PantopusIcon.CreditCard,
            "Pay once it's done",
            "Your card is saved when you book and charged the day after the crew finishes your home, unless you tell us something's wrong.",
        ),
        HowRow(
            PantopusIcon.CloudRain,
            "Rain never changes your price",
            "If the day moves, you pick a new date or cancel at no charge. Cancelling is free until 48 hours before.",
        ),
        HowRow(
            PantopusIcon.Lock,
            "Your address stays private",
            "Only the crew and Pantopus see it. Neighbors see how many homes booked, never which ones.",
        ),
    )

@Composable
private fun HowItWorks() {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PlanOverline("How it works for you")
        Column(
            modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            HOW_IT_WORKS.forEach { row ->
                Row(
                    modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    PlanIconTile(
                        row.icon,
                        PantopusColors.appSurfaceSunken,
                        PantopusColors.appTextStrong,
                        size = 32.dp,
                        glyph = 16.dp,
                        corner = 9.dp,
                    )
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            text = row.title,
                            style = PantopusTextStyle.body.copy(fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),
                            color = PantopusColors.appText,
                        )
                        Text(text = row.body, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
                    }
                }
            }
        }
    }
}

@Composable
private fun WhatTheCrewDoes(day: CrewDayPublicDto) {
    if (day.included.isEmpty() && !day.outsideOnly) return
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PlanOverline("What the crew does")
        Column(
            modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                day.included.forEach { item ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.semantics(mergeDescendants = true) {}) {
                        PantopusIconImage(
                            icon = PantopusIcon.Check,
                            contentDescription = null,
                            size = 16.dp,
                            tint = PantopusColors.home,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                        Text(text = item, style = PantopusTextStyle.small, color = PantopusColors.appTextStrong)
                    }
                }
            }
            if (day.outsideOnly) {
                if (day.included.isNotEmpty()) HorizontalDivider(color = PantopusColors.appBorder)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.semantics(mergeDescendants = true) {}) {
                    PantopusIconImage(
                        icon = PantopusIcon.Home,
                        contentDescription = null,
                        size = 16.dp,
                        tint = PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                    Text(
                        text = "Outside only. You don't need to be home.",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextStrong,
                    )
                }
            }
        }
    }
}
