package app.pantopus.android.ui.screens.plans

import android.net.Uri
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import app.pantopus.android.ui.screens.place.HubVerificationTarget
import app.pantopus.android.ui.screens.plans.change.PlanChangeScreen
import app.pantopus.android.ui.screens.plans.detail.PlanDetailScreen
import app.pantopus.android.ui.screens.plans.host.HostFlowScreen
import app.pantopus.android.ui.screens.plans.requests.PlanRequestsScreen

/** The Plans pages' routes. Kept out of `RootTabScreen` so the two grow without merge conflicts. */
object PlansRoutes {
    const val PLAN_ID_KEY = "planId"
    const val ASK_KEY = "ask"
    const val REVEAL_KEY = "reveal"
    const val KIND_KEY = "kind"
    const val GAME_KEY = "game"
    const val AGAIN_KEY = "again"

    /** A plan (J1 to J9 for guests, H9 for its host). `ask=true` opens "Ask to join" at once. */
    const val PLAN = "plans/{$PLAN_ID_KEY}?$ASK_KEY={$ASK_KEY}&$REVEAL_KEY={$REVEAL_KEY}"

    /** The host's requests (H10). */
    const val REQUESTS = "plans/{$PLAN_ID_KEY}/requests"

    /** Change the time or place (H11). */
    const val CHANGE = "plans/{$PLAN_ID_KEY}/change"

    /** Host a plan (H1 to H8); `kind` skips the type step, `game` fills a watch party, `again` copies a plan. */
    const val HOST = "plans-host?$KIND_KEY={$KIND_KEY}&$GAME_KEY={$GAME_KEY}&$AGAIN_KEY={$AGAIN_KEY}"

    fun plan(
        id: String,
        ask: Boolean = false,
        reveal: Boolean = false,
    ): String = "plans/${Uri.encode(id)}?$ASK_KEY=$ask&$REVEAL_KEY=$reveal"

    fun requests(id: String): String = "plans/${Uri.encode(id)}/requests"

    fun change(id: String): String = "plans/${Uri.encode(id)}/change"

    fun host(
        kind: String? = null,
        game: String? = null,
        again: String? = null,
    ): String =
        "plans-host?$KIND_KEY=${Uri.encode(
            kind.orEmpty(),
        )}&$GAME_KEY=${Uri.encode(game.orEmpty())}&$AGAIN_KEY=${Uri.encode(again.orEmpty())}"
}

/** Where Plans hands off to the rest of the app. */
data class PlansExternalRoutes(
    val openPulse: () -> Unit,
    val openConnections: () -> Unit,
    /** Opens a plan's group chat (A4). */
    val openChat: (roomId: String, title: String, planId: String) -> Unit,
    /** "Verify your address" (J9): the Home that waits on verification, or Add Home. */
    val openVerification: (HubVerificationTarget) -> Unit,
    /** Back to the Plans tab (the map), closing the Plans pages on top of it. */
    val openNearby: () -> Unit,
)

/** Registers every Plans page. Call inside the root `NavHost`. */
fun NavGraphBuilder.plansRoutes(
    nav: NavHostController,
    external: PlansExternalRoutes,
) {
    composable(
        route = PlansRoutes.PLAN,
        arguments =
            listOf(
                navArgument(PlansRoutes.PLAN_ID_KEY) { type = NavType.StringType },
                navArgument(PlansRoutes.ASK_KEY) {
                    type = NavType.BoolType
                    defaultValue = false
                },
                navArgument(PlansRoutes.REVEAL_KEY) {
                    type = NavType.BoolType
                    defaultValue = false
                },
            ),
    ) {
        PlanDetailScreen(
            onBack = { if (!nav.popBackStack()) external.openNearby() },
            onOpenPlan = { id -> nav.navigate(PlansRoutes.plan(id)) },
            onOpenRequests = { id -> nav.navigate(PlansRoutes.requests(id)) },
            onChange = { id -> nav.navigate(PlansRoutes.change(id)) },
            onHost = { kind, again -> nav.navigate(PlansRoutes.host(kind = kind, again = again)) },
            onOpenChat = external.openChat,
            onOpenVerification = external.openVerification,
            onSeeAllPlans = external.openNearby,
        )
    }
    composable(
        route = PlansRoutes.REQUESTS,
        arguments = listOf(navArgument(PlansRoutes.PLAN_ID_KEY) { type = NavType.StringType }),
    ) {
        PlanRequestsScreen(onBack = { if (!nav.popBackStack()) external.openNearby() })
    }
    composable(
        route = PlansRoutes.CHANGE,
        arguments = listOf(navArgument(PlansRoutes.PLAN_ID_KEY) { type = NavType.StringType }),
    ) {
        PlanChangeScreen(onDone = { nav.popBackStack() })
    }
    composable(
        route = PlansRoutes.HOST,
        arguments =
            listOf(
                navArgument(PlansRoutes.KIND_KEY) {
                    type = NavType.StringType
                    defaultValue = ""
                },
                navArgument(PlansRoutes.GAME_KEY) {
                    type = NavType.StringType
                    defaultValue = ""
                },
                navArgument(PlansRoutes.AGAIN_KEY) {
                    type = NavType.StringType
                    defaultValue = ""
                },
            ),
    ) {
        HostFlowScreen(
            onClose = { nav.popBackStack() },
            onDoneToMap = {
                nav.popBackStack()
                external.openNearby()
            },
            onOpenVerification = external.openVerification,
        )
    }
}
