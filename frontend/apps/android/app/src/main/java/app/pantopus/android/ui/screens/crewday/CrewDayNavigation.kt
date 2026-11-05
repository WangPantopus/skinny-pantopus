@file:Suppress("MatchingDeclarationName", "LongMethod")

package app.pantopus.android.ui.screens.crewday

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
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

    /** 1 Invitation, by its share code. */
    const val INVITATION = "crew-day/{$CODE_KEY}"

    /** 5 Your Crew Day: one booking. */
    const val BOOKING = "crew-days/bookings/{$BOOKING_ID_KEY}"

    /** 10 Your Crew Days: bookings, street requests and past days. */
    const val MINE = "crew-days/mine"

    /** 11 Ask for a Crew Day on your street. */
    const val ASK = "crew-days/ask"

    /** 13 The crew's Crew Days; with no business it opens on the person's first business, with a picker. */
    const val CREW = "crew-days/crew?$BUSINESS_ID_KEY={$BUSINESS_ID_KEY}"

    /** 15 The crew's day (16, the route, on the day itself). */
    const val CREW_DAY = "crew-days/day/{$CREW_DAY_ID_KEY}?$BUSINESS_ID_KEY={$BUSINESS_ID_KEY}"

    fun invitation(code: String): String = "crew-day/${Uri.encode(code)}"

    fun booking(id: String): String = "crew-days/bookings/${Uri.encode(id)}"

    fun crew(businessId: String? = null): String = "crew-days/crew?$BUSINESS_ID_KEY=${Uri.encode(businessId.orEmpty())}"

    fun crewDay(
        id: String,
        businessId: String? = null,
    ): String = "crew-days/day/${Uri.encode(id)}?$BUSINESS_ID_KEY=${Uri.encode(businessId.orEmpty())}"
}

/** Registers every Crew Day page. Call inside the root `NavHost`. */
fun NavGraphBuilder.crewDayRoutes(nav: NavHostController) {
    val back: () -> Unit = { nav.popBackStack() }
    composable(
        route = CrewDayRoutes.INVITATION,
        arguments = listOf(navArgument(CrewDayRoutes.CODE_KEY) { type = NavType.StringType }),
    ) {
        CrewDayPlaceholder("Crew Day", back)
    }
    composable(
        route = CrewDayRoutes.BOOKING,
        arguments = listOf(navArgument(CrewDayRoutes.BOOKING_ID_KEY) { type = NavType.StringType }),
    ) {
        CrewDayPlaceholder("Your Crew Day", back)
    }
    composable(CrewDayRoutes.MINE) { CrewDayPlaceholder("Your Crew Days", back) }
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
        CrewDayPlaceholder("Crew Days", back, crew = true)
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
        CrewDayPlaceholder("Crew Day", back, crew = true)
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
