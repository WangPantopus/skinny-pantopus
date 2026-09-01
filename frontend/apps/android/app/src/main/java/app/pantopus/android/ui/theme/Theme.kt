package app.pantopus.android.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DefaultTokens: PantopusTokens =
    PantopusTokens(
        identity =
            IdentityColors(
                personal = PantopusColors.personal,
                personalBg = PantopusColors.personalBg,
                home = PantopusColors.home,
                homeBg = PantopusColors.homeBg,
                business = PantopusColors.business,
                businessBg = PantopusColors.businessBg,
            ),
        category =
            CategoryColors(
                handyman = PantopusColors.handyman,
                cleaning = PantopusColors.cleaning,
                moving = PantopusColors.moving,
                petCare = PantopusColors.petCare,
                childCare = PantopusColors.childCare,
                tutoring = PantopusColors.tutoring,
                delivery = PantopusColors.delivery,
                tech = PantopusColors.tech,
                goods = PantopusColors.goods,
                gigs = PantopusColors.gigs,
                rentals = PantopusColors.rentals,
                vehicles = PantopusColors.vehicles,
            ),
        elevation =
            ElevationTokens(
                sm = PantopusElevations.sm,
                md = PantopusElevations.md,
                lg = PantopusElevations.lg,
                xl = PantopusElevations.xl,
                primary = PantopusElevations.primary,
            ),
        textStyle =
            TextStyleTokens(
                h1 = PantopusTextStyle.h1,
                h2 = PantopusTextStyle.h2,
                h3 = PantopusTextStyle.h3,
                body = PantopusTextStyle.body,
                small = PantopusTextStyle.small,
                caption = PantopusTextStyle.caption,
                overline = PantopusTextStyle.overline,
            ),
    )

private val PantopusLightColorScheme: ColorScheme =
    lightColorScheme(
        primary = PantopusColors.primary600,
        onPrimary = PantopusColors.appTextInverse,
        primaryContainer = PantopusColors.primary100,
        onPrimaryContainer = PantopusColors.primary900,
        secondary = PantopusColors.primary500,
        onSecondary = PantopusColors.appTextInverse,
        secondaryContainer = PantopusColors.primary50,
        onSecondaryContainer = PantopusColors.primary800,
        tertiary = PantopusColors.business,
        onTertiary = PantopusColors.appTextInverse,
        tertiaryContainer = PantopusColors.businessBg,
        onTertiaryContainer = PantopusColors.business,
        background = PantopusColors.appBg,
        onBackground = PantopusColors.appText,
        surface = PantopusColors.appSurface,
        onSurface = PantopusColors.appText,
        surfaceVariant = PantopusColors.appSurfaceSunken,
        onSurfaceVariant = PantopusColors.appTextSecondary,
        surfaceTint = PantopusColors.primary600,
        inverseSurface = PantopusColors.appText,
        inverseOnSurface = PantopusColors.appTextInverse,
        inversePrimary = PantopusColors.primary300,
        error = PantopusColors.error,
        onError = PantopusColors.appTextInverse,
        errorContainer = PantopusColors.errorLight,
        onErrorContainer = PantopusColors.error,
        outline = PantopusColors.appBorder,
        outlineVariant = PantopusColors.appBorderSubtle,
        scrim = Color.Black,
    )

// Dark shell neutrals mirror iOS `Neutral/*` asset-catalog dark appearances.
private val PantopusDarkColorScheme: ColorScheme =
    darkColorScheme(
        primary = PantopusColors.primary600,
        onPrimary = PantopusColors.appTextInverse,
        primaryContainer = PantopusColors.primary100,
        onPrimaryContainer = PantopusColors.primary900,
        secondary = PantopusColors.primary500,
        onSecondary = PantopusColors.appTextInverse,
        secondaryContainer = PantopusColors.primary50,
        onSecondaryContainer = PantopusColors.primary800,
        tertiary = PantopusColors.business,
        onTertiary = PantopusColors.appTextInverse,
        tertiaryContainer = PantopusColors.businessBg,
        onTertiaryContainer = PantopusColors.business,
        background = PantopusColors.appBgDark,
        onBackground = PantopusColors.appTextDark,
        surface = PantopusColors.appSurfaceDark,
        onSurface = PantopusColors.appTextStrongDark,
        surfaceVariant = PantopusColors.appSurfaceSunkenDark,
        onSurfaceVariant = PantopusColors.appTextSecondaryDark,
        surfaceTint = PantopusColors.primary600,
        error = PantopusColors.error,
        onError = PantopusColors.appTextInverse,
        errorContainer = PantopusColors.errorLight,
        onErrorContainer = PantopusColors.error,
        outline = PantopusColors.appBorderDark,
        outlineVariant = PantopusColors.appBorderStrongDark,
        scrim = Color.Black,
    )

/**
 * Root Pantopus theme. Wraps Material 3 with the Pantopus `ColorScheme`,
 * typography, and a [CompositionLocalProvider] for [LocalPantopusTokens].
 *
 * Feature composables MUST be nested inside this — reading
 * `PantopusTheme.tokens` or a token defined outside the theme scope throws.
 *
 * @param darkTheme Honour the system dark-mode setting. Shell neutrals
 *     (`background`, `surface`, text, borders) switch to the dark palette;
 *     accent/category tokens stay shared with light for now.
 * @param content Composable content.
 */
@Composable
fun PantopusTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) PantopusDarkColorScheme else PantopusLightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            // Guarded cast: Paparazzi snapshot tests host the view in a
            // non-Activity context, so `as Activity` would throw. We skip
            // status-bar tinting in that case — the snapshot content is
            // what's under test.
            (view.context as? Activity)?.window?.let { window ->
                WindowCompat
                    .getInsetsController(window, view)
                    .isAppearanceLightStatusBars = !darkTheme
            }
        }
    }

    CompositionLocalProvider(LocalPantopusTokens provides DefaultTokens) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = PantopusTypography,
            content = content,
        )
    }
}
