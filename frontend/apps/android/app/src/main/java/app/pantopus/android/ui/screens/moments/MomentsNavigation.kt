package app.pantopus.android.ui.screens.moments

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeScreen
import app.pantopus.android.ui.screens.moments.viewer.MomentsViewerScreen
import kotlinx.coroutines.flow.StateFlow

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

/**
 * Set by `RootTabScreen` while Moments is on: opens the viewer on one Moment, by its id (the quote above a chat reply
 * and the small picture in the conversation list). The second argument is called instead when the Moment has ended or
 * can't be seen any more. Null while Moments is off and outside the tabs, where the quote is just a picture.
 */
object MomentOpenHolder {
    var current: ((momentId: String, onEnded: () -> Unit) -> Unit)? by mutableStateOf(null)
}

/**
 * Set by `RootTabScreen` while Moments is on: the rings around profile pictures. [rings] holds the ring of each person
 * who has Moments the signed-in person may see, by account id; [want] says a circle showing that person is on screen;
 * [play] opens the viewer on a person's ring. Null while Moments is off and outside the tabs: no rings are drawn.
 */
class MomentRingsEntry(
    val rings: StateFlow<Map<String, MomentRingDto>>,
    val watched: StateFlow<Set<String>>,
    val want: (userId: String) -> Unit,
    val play: (MomentRingDto) -> Unit,
)

object MomentRingsHolder {
    var current: MomentRingsEntry? by mutableStateOf(null)
}

/** Where Moments hands off to the rest of the app. */
data class MomentsExternalRoutes(
    /** Back to the Moments map, closing the Moments pages over it. */
    val openMap: () -> Unit,
    /** A person's profile, or a business's page (`business`), over the viewer. */
    val openProfile: (userId: String, business: Boolean) -> Unit = { _, _ -> },
)

/** Registers every Moments page. Call inside the root `NavHost`. */
fun NavGraphBuilder.momentsRoutes(
    nav: NavHostController,
    external: MomentsExternalRoutes,
) {
    composable(MomentsRoutes.WATCH) {
        MomentsViewerScreen(onClose = { if (!nav.popBackStack()) external.openMap() }, onOpenProfile = external.openProfile)
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
