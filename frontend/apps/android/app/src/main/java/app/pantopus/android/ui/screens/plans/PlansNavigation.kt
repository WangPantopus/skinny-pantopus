package app.pantopus.android.ui.screens.plans

import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import app.pantopus.android.data.ai.AIScreenContext
import app.pantopus.android.ui.screens.place.HubVerificationTarget
import app.pantopus.android.ui.screens.plans.change.PlanChangeScreen
import app.pantopus.android.ui.screens.plans.detail.PlanDetailScreen
import app.pantopus.android.ui.screens.plans.host.HostFlowScreen
import app.pantopus.android.ui.screens.plans.requests.PlanRequestsScreen
import androidx.compose.runtime.Composable

/** The Plans pages' routes. Kept out of `RootTabScreen` so the two grow without merge conflicts. */
object PlansRoutes {
    const val PLAN_ID_KEY = "planId"
    const val ASK_KEY = "ask"
    const val REVEAL_KEY = "reveal"
    const val INVITE_KEY = "invite"
    const val KIND_KEY = "kind"
    const val GAME_KEY = "game"
    const val AGAIN_KEY = "again"

    /**
     * A plan (J1 to J9 for guests, H9 for its host). `ask=true` opens "Ask to join" at once; `invite` is an email or
     * text invitation's token, which the plan opens for this account first.
     */
    const val PLAN = "plans/{$PLAN_ID_KEY}?$ASK_KEY={$ASK_KEY}&$REVEAL_KEY={$REVEAL_KEY}&$INVITE_KEY={$INVITE_KEY}"

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
        invite: String? = null,
    ): String = "plans/${Uri.encode(id)}?$ASK_KEY=$ask&$REVEAL_KEY=$reveal" + invite?.let { "&$INVITE_KEY=${Uri.encode(it)}" }.orEmpty()

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
    /** Ask Pantopus about a plan (AI assistant phase 1); null hides the button. */
    val askPantopus: ((AIScreenContext) -> Unit)? = null,
    /** A person's profile: the host's, a guest's or a requester's, from their photo and name. */
    val openProfile: ((userId: String) -> Unit)? = null,
    /** A business's page: the host card of a business's plan (Plans with businesses). */
    val openBusiness: ((businessUserId: String) -> Unit)? = null,
)

/** Opens a person's profile from the Plans pages; null leaves people plain. */
val LocalPlanOpenProfile = staticCompositionLocalOf<((String) -> Unit)?> { null }

/** Opens a business's page from the Plans pages; null leaves the business's card plain. */
val LocalPlanOpenBusiness = staticCompositionLocalOf<((String) -> Unit)?> { null }

/** A tap opens [userId]'s profile through [open] (the Plans pages' [LocalPlanOpenProfile]); no change when either is null. */
fun Modifier.opensPlanProfile(
    userId: String?,
    open: ((String) -> Unit)?,
): Modifier = if (userId != null && open != null) clickable(onClickLabel = "Open profile", role = Role.Button) { open(userId) } else this

/** A tap opens the business [businessUserId]'s page through [open] ([LocalPlanOpenBusiness]); no change when either is null. */
fun Modifier.opensPlanBusiness(
    businessUserId: String?,
    open: ((String) -> Unit)?,
): Modifier =
    if (businessUserId != null && open != null) {
        clickable(onClickLabel = "Open the business's page", role = Role.Button) { open(businessUserId) }
    } else {
        this
    }

/** The Plans pages' ways out to a person's profile and a business's page. */
@Composable
private fun PlansLocals(
    external: PlansExternalRoutes,
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(
        LocalPlanOpenProfile provides external.openProfile,
        LocalPlanOpenBusiness provides external.openBusiness,
        content = content,
    )
}

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
                navArgument(PlansRoutes.INVITE_KEY) {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                },
            ),
    ) {
        PlansLocals(external) {
            PlanDetailScreen(
                onBack = { if (!nav.popBackStack()) external.openNearby() },
                onOpenPlan = { id -> nav.navigate(PlansRoutes.plan(id)) },
                onOpenRequests = { id -> nav.navigate(PlansRoutes.requests(id)) },
                onChange = { id -> nav.navigate(PlansRoutes.change(id)) },
                onHost = { kind, again -> nav.navigate(PlansRoutes.host(kind = kind, again = again)) },
                onOpenChat = external.openChat,
                onOpenVerification = external.openVerification,
                onSeeAllPlans = external.openNearby,
                onAskPantopus = external.askPantopus,
            )
        }
    }
    composable(
        route = PlansRoutes.REQUESTS,
        arguments = listOf(navArgument(PlansRoutes.PLAN_ID_KEY) { type = NavType.StringType }),
    ) {
        PlansLocals(external) {
            PlanRequestsScreen(onBack = { if (!nav.popBackStack()) external.openNearby() })
        }
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
        )
    }
}
