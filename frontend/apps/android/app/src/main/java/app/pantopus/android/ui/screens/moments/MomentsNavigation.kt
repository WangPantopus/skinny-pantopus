package app.pantopus.android.ui.screens.moments

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeScreen
import app.pantopus.android.ui.screens.moments.viewer.MomentsViewerScreen

/** The Moments pages' routes. Kept out of `RootTabScreen` so the two grow without merge conflicts, as Plans' are. */
object MomentsRoutes {
    const val MODE_KEY = "mode"

    /** The full-screen viewer (V1 to V5). Its queue comes from the map ([app.pantopus.android.data.moments.MomentsPlayback]). */
    const val WATCH = "moments/watch"

    /** Posting (P1 to P4): the camera first, or the Library or Text tab with `mode`. */
    const val COMPOSE = "moments/compose?$MODE_KEY={$MODE_KEY}"

    fun compose(mode: String = "camera"): String = "moments/compose?$MODE_KEY=$mode"

    /** Screens with the whole window: no tab bar under the viewer or the camera. */
    val fullScreen: Set<String> = setOf(WATCH, COMPOSE)
}

/** Where Moments hands off to the rest of the app. */
data class MomentsExternalRoutes(
    /** Back to the Moments map, closing the Moments pages over it. */
    val openMap: () -> Unit,
)

/** Registers every Moments page. Call inside the root `NavHost`. */
fun NavGraphBuilder.momentsRoutes(
    nav: NavHostController,
    external: MomentsExternalRoutes,
) {
    composable(MomentsRoutes.WATCH) {
        MomentsViewerScreen(onClose = { if (!nav.popBackStack()) external.openMap() })
    }
    composable(
        route = MomentsRoutes.COMPOSE,
        arguments =
            listOf(
                navArgument(MomentsRoutes.MODE_KEY) {
                    type = NavType.StringType
                    defaultValue = "camera"
                },
            ),
    ) {
        MomentsComposeScreen(onClose = { if (!nav.popBackStack()) external.openMap() })
    }
}
