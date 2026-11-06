@file:Suppress("MatchingDeclarationName", "LongMethod")

package app.pantopus.android.ui.screens.crewday

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import app.pantopus.android.ui.screens.crewday.book.CrewDayBookActions
import app.pantopus.android.ui.screens.crewday.book.CrewDayBookScreen
import app.pantopus.android.ui.screens.crewday.booking.CrewDayBookingActions
import app.pantopus.android.ui.screens.crewday.booking.CrewDayBookingScreen
import app.pantopus.android.ui.screens.crewday.create.NewCrewDayScreen
import app.pantopus.android.ui.screens.crewday.crew.CrewDaysCrewActions
import app.pantopus.android.ui.screens.crewday.crew.CrewDaysCrewScreen
import app.pantopus.android.ui.screens.crewday.invite.CrewDayInvitationActions
import app.pantopus.android.ui.screens.crewday.invite.CrewDayInvitationScreen
import app.pantopus.android.ui.screens.crewday.mine.MyCrewDaysActions
import app.pantopus.android.ui.screens.crewday.mine.MyCrewDaysScreen
import app.pantopus.android.ui.screens.crewday.prep.CrewDayPrepActions
import app.pantopus.android.ui.screens.crewday.prep.CrewDayPrepScreen
import app.pantopus.android.ui.screens.crewday.problem.CrewDayProblemScreen
import app.pantopus.android.ui.screens.root.NotYetAvailableView
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Crew Day's pages (docs/product/crew-day-build/01-spec.md): the household's, the organizer's and the crew's. Every
 * one is behind the `crew_day` launch key; nothing navigates here while it is off. Kept out of `RootTabScreen` so the
 * two grow without merge conflicts. Each page is a placeholder until its slice lands.
 */
object CrewDayRoutes {
    const val CODE_KEY = "code"
    const val BOOKING_ID_KEY = "bookingId"
    const val CREW_DAY_ID_KEY = "crewDayId"
    const val BUSINESS_ID_KEY = "businessId"
    const val REPEAT_OF_KEY = "repeatOf"

    /** 1 Invitation, by its share code. */
    const val INVITATION = "crew-day/{$CODE_KEY}"

    /** 2 to 4: Your price, Review and book, You're on the route, for an invitation's day. */
    const val BOOK = "crew-day/{$CODE_KEY}/book"

    /** 5 Your Crew Day: one booking. */
    const val BOOKING = "crew-days/bookings/{$BOOKING_ID_KEY}"

    /** 7 Something needs attention, for a booking. */
    const val PROBLEM = "crew-days/bookings/{$BOOKING_ID_KEY}/problem"

    /** 10 Your Crew Days: bookings, street requests and past days. */
    const val MINE = "crew-days/mine"

    /** 11 Ask for a Crew Day on your street. */
    const val ASK = "crew-days/ask"

    /** 13 The crew's Crew Days; with no business it opens on the person's first business, with a picker. */
    const val CREW = "crew-days/crew?$BUSINESS_ID_KEY={$BUSINESS_ID_KEY}"

    /** 15 The crew's day (16, the route, on the day itself). */
    const val CREW_DAY = "crew-days/day/{$CREW_DAY_ID_KEY}?$BUSINESS_ID_KEY={$BUSINESS_ID_KEY}"

    /** 14 New Crew Day for a business; `repeatOf` prefills it from a finished day. */
    const val NEW = "crew-days/new?$BUSINESS_ID_KEY={$BUSINESS_ID_KEY}&$REPEAT_OF_KEY={$REPEAT_OF_KEY}"

    /** 18 Propose new dates for a day. */
    const val PROPOSE_DATES = "crew-days/day/{$CREW_DAY_ID_KEY}/propose-dates"

    fun invitation(code: String): String = "crew-day/${Uri.encode(code)}"

    fun book(code: String): String = "crew-day/${Uri.encode(code)}/book"

    fun booking(id: String): String = "crew-days/bookings/${Uri.encode(id)}"

    fun problem(id: String): String = "crew-days/bookings/${Uri.encode(id)}/problem"

    fun crew(businessId: String? = null): String = "crew-days/crew?$BUSINESS_ID_KEY=${Uri.encode(businessId.orEmpty())}"

    fun crewDay(
        id: String,
        businessId: String? = null,
    ): String = "crew-days/day/${Uri.encode(id)}?$BUSINESS_ID_KEY=${Uri.encode(businessId.orEmpty())}"

    fun newDay(
        businessId: String,
        repeatOf: String? = null,
    ): String = "crew-days/new?$BUSINESS_ID_KEY=${Uri.encode(businessId)}&$REPEAT_OF_KEY=${Uri.encode(repeatOf.orEmpty())}"

    fun proposeDates(id: String): String = "crew-days/day/${Uri.encode(id)}/propose-dates"
}

/** Where Crew Day hands off to the rest of the app (routes `RootTabScreen` owns). */
data class CrewDayExternalRoutes(
    /** A business's own page (the owner view), where it is published. */
    val openBusiness: (businessId: String) -> Unit,
    /** The business's payouts: the existing Stripe onboarding. */
    val openPayouts: (businessId: String) -> Unit,
    /** The business's legal and verification page (insurance and registration). */
    val openLegal: (businessId: String) -> Unit,
    /** The system share sheet with [message] (which carries the link). */
    val share: (message: String, title: String) -> Unit,
    /** A web page in the browser (the printable flyer, the explainers). */
    val openWeb: (url: String) -> Unit,
    /** A path on the web app (`/crew-day/how-it-works`), in the browser. */
    val openWebPath: (path: String) -> Unit,
    /** The conversation with a person or a business page (the crew, the household). */
    val openChat: (userId: String, name: String) -> Unit,
    /** The existing invoice page: the receipt, and paying it. */
    val openInvoice: (invoiceId: String) -> Unit,
)

/** Registers every Crew Day page. Call inside the root `NavHost`. */
fun NavGraphBuilder.crewDayRoutes(
    nav: NavHostController,
    external: CrewDayExternalRoutes,
) {
    val back: () -> Unit = { nav.popBackStack() }
    composable(
        route = CrewDayRoutes.INVITATION,
        arguments = listOf(navArgument(CrewDayRoutes.CODE_KEY) { type = NavType.StringType }),
    ) {
        CrewDayInvitationScreen(
            actions =
                CrewDayInvitationActions(
                    onBack = back,
                    onSeePrice = { code -> nav.navigate(CrewDayRoutes.book(code)) },
                    onOpenBooking = { id -> nav.navigate(CrewDayRoutes.booking(id)) },
                    onOpenCrewDay = { id, businessId -> nav.navigate(CrewDayRoutes.crewDay(id, businessId)) },
                    onAsk = { nav.navigate(CrewDayRoutes.ASK) },
                    onOpenWeb = external.openWebPath,
                ),
        )
    }
    composable(
        route = CrewDayRoutes.BOOK,
        arguments = listOf(navArgument(CrewDayRoutes.CODE_KEY) { type = NavType.StringType }),
    ) {
        CrewDayBookScreen(
            actions =
                CrewDayBookActions(
                    onClose = back,
                    // The booking's page replaces the flow, so Back from it lands on the invitation.
                    onOpenBooking = { id ->
                        nav.navigate(CrewDayRoutes.booking(id)) {
                            popUpTo(CrewDayRoutes.BOOK) { inclusive = true }
                        }
                    },
                    onAsk = { nav.navigate(CrewDayRoutes.ASK) },
                ),
        )
    }
    composable(
        route = CrewDayRoutes.BOOKING,
        arguments = listOf(navArgument(CrewDayRoutes.BOOKING_ID_KEY) { type = NavType.StringType }),
    ) {
        CrewDayBookingScreen(
            actions =
                CrewDayBookingActions(
                    onBack = back,
                    onProblem = { id -> nav.navigate(CrewDayRoutes.problem(id)) },
                    onMessageCrew = external.openChat,
                    onOpenInvoice = external.openInvoice,
                    onShare = external.share,
                    onOpenWebPath = external.openWebPath,
                    onOpenWeb = external.openWeb,
                    onFindAnother = { nav.navigate(CrewDayRoutes.MINE) },
                    onAsk = { nav.navigate(CrewDayRoutes.ASK) },
                ),
        )
    }
    composable(
        route = CrewDayRoutes.PROBLEM,
        arguments = listOf(navArgument(CrewDayRoutes.BOOKING_ID_KEY) { type = NavType.StringType }),
    ) {
        CrewDayProblemScreen(onClose = back)
    }
    composable(CrewDayRoutes.MINE) {
        MyCrewDaysScreen(
            actions =
                MyCrewDaysActions(
                    onBack = back,
                    onOpenBooking = { id -> nav.navigate(CrewDayRoutes.booking(id)) },
                    onOpenInvitation = { code -> nav.navigate(CrewDayRoutes.invitation(code)) },
                    onAsk = { nav.navigate(CrewDayRoutes.ASK) },
                ),
        )
    }
    composable(CrewDayRoutes.ASK) { CrewDayPlaceholder("Ask for a Crew Day", back) }
    composable(
        route = CrewDayRoutes.CREW,
        arguments =
            listOf(
                navArgument(CrewDayRoutes.BUSINESS_ID_KEY) {
                    type = NavType.StringType
                    defaultValue = ""
                },
            ),
    ) {
        CrewDaysCrewScreen(
            actions =
                CrewDaysCrewActions(
                    onBack = back,
                    onOpenDay = { id, businessId -> nav.navigate(CrewDayRoutes.crewDay(id, businessId)) },
                    onNewDay = { businessId -> nav.navigate(CrewDayRoutes.newDay(businessId)) },
                    onOpenBusiness = external.openBusiness,
                    onOpenPayouts = external.openPayouts,
                    onOpenLegal = external.openLegal,
                ),
        )
    }
    composable(
        route = CrewDayRoutes.NEW,
        arguments =
            listOf(
                navArgument(CrewDayRoutes.BUSINESS_ID_KEY) {
                    type = NavType.StringType
                    defaultValue = ""
                },
                navArgument(CrewDayRoutes.REPEAT_OF_KEY) {
                    type = NavType.StringType
                    defaultValue = ""
                },
            ),
    ) {
        // Done (or Close) goes back to the crew's list, which shows the new day.
        NewCrewDayScreen(onClose = back)
    }
    composable(
        route = CrewDayRoutes.PROPOSE_DATES,
        arguments = listOf(navArgument(CrewDayRoutes.CREW_DAY_ID_KEY) { type = NavType.StringType }),
    ) {
        CrewDayPlaceholder("Propose new dates", back, crew = true)
    }
    composable(
        route = CrewDayRoutes.CREW_DAY,
        arguments =
            listOf(
                navArgument(CrewDayRoutes.CREW_DAY_ID_KEY) { type = NavType.StringType },
                navArgument(CrewDayRoutes.BUSINESS_ID_KEY) {
                    type = NavType.StringType
                    defaultValue = ""
                },
            ),
    ) {
        CrewDayPrepScreen(
            actions =
                CrewDayPrepActions(
                    onBack = back,
                    onShare = { _, message -> external.share(message, "Share the Crew Day") },
                    onOpenFlyer = external.openWeb,
                    onProposeDates = { id -> nav.navigate(CrewDayRoutes.proposeDates(id)) },
                ),
        )
    }
}

@Composable
private fun CrewDayPlaceholder(
    name: String,
    onBack: () -> Unit,
    crew: Boolean = false,
) {
    NotYetAvailableView(
        tabName = name,
        icon = if (crew) PantopusIcon.Truck else PantopusIcon.CalendarCheck,
        accent = if (crew) PantopusColors.businessBg else PantopusColors.homeBg,
        foreground = if (crew) PantopusColors.business else PantopusColors.home,
        onBack = onBack,
    )
}
