package app.pantopus.android.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle

/**
 * Pantopus-specific design tokens exposed via [LocalPantopusTokens]. Material
 * 3's `ColorScheme` can't represent identity pillars or category accents, so
 * call sites reach for those through this holder.
 */
data class PantopusTokens(
    val identity: IdentityColors,
    val category: CategoryColors,
    val elevation: ElevationTokens,
    val textStyle: TextStyleTokens,
)

/** Identity-pillar color pairs. */
data class IdentityColors(
    val personal: Color,
    val personalBg: Color,
    val home: Color,
    val homeBg: Color,
    val business: Color,
    val businessBg: Color,
)

/** Category-accent color scale. */
data class CategoryColors(
    val handyman: Color,
    val cleaning: Color,
    val moving: Color,
    val petCare: Color,
    val childCare: Color,
    val tutoring: Color,
    val delivery: Color,
    val tech: Color,
    val goods: Color,
    val gigs: Color,
    val rentals: Color,
    val vehicles: Color,
)

/** Elevation ramp mirrored from [PantopusElevations]. */
data class ElevationTokens(
    val sm: PantopusElevation,
    val md: PantopusElevation,
    val lg: PantopusElevation,
    val xl: PantopusElevation,
    val primary: PantopusElevation,
)

/** Exact type-ramp text styles. */
data class TextStyleTokens(
    val h1: TextStyle,
    val h2: TextStyle,
    val h3: TextStyle,
    val body: TextStyle,
    val small: TextStyle,
    val caption: TextStyle,
    val overline: TextStyle,
)

/**
 * CompositionLocal holding the current [PantopusTokens]. Always provided by
 * `PantopusTheme` — reading outside a theme scope throws.
 */
val LocalPantopusTokens =
    staticCompositionLocalOf<PantopusTokens> {
        error(
            "PantopusTokens requested outside a PantopusTheme { } scope — wrap " +
                "your composable in PantopusTheme first.",
        )
    }

/** Accessor namespace so call sites can read tokens as `PantopusTheme.tokens.category.handyman`. */
object PantopusTheme {
    /** Current design tokens. Must be called inside a [app.pantopus.android.ui.theme.PantopusTheme] scope. */
    val tokens: PantopusTokens
        @Composable
        @ReadOnlyComposable
        get() = LocalPantopusTokens.current
}
