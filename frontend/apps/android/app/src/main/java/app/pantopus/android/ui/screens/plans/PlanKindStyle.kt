@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.ui.screens.plans

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/** A plan type's accent (pin, swatch, glyph on a tile) and its soft tint (tiles, tags, notes). */
data class PlanKindColors(
    val accent: Color,
    val tint: Color,
)

/** True when the surrounding theme is dark. The app renders light today; Plans follows the app's theme. */
val plansDark: Boolean
    @Composable
    @ReadOnlyComposable
    get() = MaterialTheme.colorScheme.background.luminance() < DARK_LUMINANCE

private const val DARK_LUMINANCE = 0.5f

/** Board P1: one color pair per plan type, light and dark. */
val PlanKind.colors: PlanKindColors
    @Composable
    @ReadOnlyComposable
    get() {
        val dark = plansDark
        return when (this) {
            PlanKind.WATCH_PARTY ->
                if (dark) {
                    PlanKindColors(PantopusColors.catPlanWatchDark, PantopusColors.catPlanWatchTintDark)
                } else {
                    PlanKindColors(PantopusColors.catPlanWatch, PantopusColors.catPlanWatchTint)
                }
            PlanKind.PLAYDATE ->
                if (dark) {
                    PlanKindColors(PantopusColors.catPlanPlaydateDark, PantopusColors.catPlanPlaydateTintDark)
                } else {
                    PlanKindColors(PantopusColors.catPlanPlaydate, PantopusColors.catPlanPlaydateTint)
                }
            PlanKind.PICKUP_GAME ->
                if (dark) {
                    PlanKindColors(PantopusColors.catPlanPickupDark, PantopusColors.catPlanPickupTintDark)
                } else {
                    PlanKindColors(PantopusColors.catPlanPickup, PantopusColors.catPlanPickupTint)
                }
            PlanKind.WALK_COFFEE ->
                if (dark) {
                    PlanKindColors(PantopusColors.catPlanWalkDark, PantopusColors.catPlanWalkTintDark)
                } else {
                    PlanKindColors(PantopusColors.catPlanWalk, PantopusColors.catPlanWalkTint)
                }
        }
    }

/** The light-theme accent, for places outside composition (a border built in a modifier). */
val PlanKind.accentLight: Color
    get() =
        when (this) {
            PlanKind.WATCH_PARTY -> PantopusColors.catPlanWatch
            PlanKind.PLAYDATE -> PantopusColors.catPlanPlaydate
            PlanKind.PICKUP_GAME -> PantopusColors.catPlanPickup
            PlanKind.WALK_COFFEE -> PantopusColors.catPlanWalk
        }

/** Board P1: the type's glyph (Material Tv, EscalatorWarning, SportsBaseball, LocalCafe). */
val PlanKind.icon: PantopusIcon
    get() =
        when (this) {
            PlanKind.WATCH_PARTY -> PantopusIcon.Tv
            PlanKind.PLAYDATE -> PantopusIcon.AdultChild
            PlanKind.PICKUP_GAME -> PantopusIcon.Ball
            PlanKind.WALK_COFFEE -> PantopusIcon.Coffee
        }

/** The glyph's ink on a colored pin head or swatch: white in light, near-black in dark. */
val planPinInk: Color
    @Composable
    @ReadOnlyComposable
    get() = if (plansDark) PantopusColors.planPinInkDark else PantopusColors.appSurface

/** The ring around a pin head: the surface color, so the pin lifts off the map. */
val planPinRing: Color
    @Composable
    @ReadOnlyComposable
    get() = if (plansDark) PantopusColors.appSurfaceDark else PantopusColors.appSurface

/** Glass over the map. */
val planGlass: Color
    @Composable
    @ReadOnlyComposable
    get() = if (plansDark) PantopusColors.mapGlassDark else PantopusColors.mapGlass

/** Stronger glass, for the privacy chip over a map. */
val planGlassStrong: Color
    @Composable
    @ReadOnlyComposable
    get() = if (plansDark) PantopusColors.mapGlassStrongDark else PantopusColors.mapGlassStrong
