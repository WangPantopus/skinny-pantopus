@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/**
 * Pantopus type ramp. Prefer [PantopusTextStyle] for call sites — it carries
 * the exact spec. [PantopusTypography] maps our roles onto the closest
 * Material 3 slots so Material components (`TextField`, `Button`, `TopAppBar`)
 * inherit Pantopus metrics.
 */
@Suppress("MagicNumber")
object PantopusTextStyle {
    /** h1 — 30/36 bold, -0.020em. */
    val h1 =
        TextStyle(
            fontFamily = FontFamily.Default,
            fontWeight = FontWeight.Bold,
            fontSize = 30.sp,
            lineHeight = 36.sp,
            letterSpacing = (-0.020).em,
        )

    /** h2 — 24/32 semibold, -0.015em. */
    val h2 =
        TextStyle(
            fontFamily = FontFamily.Default,
            fontWeight = FontWeight.SemiBold,
            fontSize = 24.sp,
            lineHeight = 32.sp,
            letterSpacing = (-0.015).em,
        )

    /** h3 — 20/28 semibold. */
    val h3 =
        TextStyle(
            fontFamily = FontFamily.Default,
            fontWeight = FontWeight.SemiBold,
            fontSize = 20.sp,
            lineHeight = 28.sp,
            letterSpacing = 0.em,
        )

    /** body — 16/24 regular. */
    val body =
        TextStyle(
            fontFamily = FontFamily.Default,
            fontWeight = FontWeight.Normal,
            fontSize = 16.sp,
            lineHeight = 24.sp,
            letterSpacing = 0.em,
        )

    /** small — 14/20 regular. */
    val small =
        TextStyle(
            fontFamily = FontFamily.Default,
            fontWeight = FontWeight.Normal,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            letterSpacing = 0.em,
        )

    /** caption — 12/16 regular. */
    val caption =
        TextStyle(
            fontFamily = FontFamily.Default,
            fontWeight = FontWeight.Normal,
            fontSize = 12.sp,
            lineHeight = 16.sp,
            letterSpacing = 0.em,
        )

    /**
     * overline — 11/16 semibold, +0.06em, UPPERCASE.
     *
     * NOTE: `TextStyle` cannot force upper-casing at render time — pass the
     * string pre-uppercased at the call site (e.g. `text.uppercase()`).
     */
    val overline =
        TextStyle(
            fontFamily = FontFamily.Default,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.sp,
            lineHeight = 16.sp,
            letterSpacing = 0.06.em,
            textDecoration = TextDecoration.None,
        )
}

/**
 * Material 3 typography mapping. Material slots don't cleanly correspond to
 * our 7-step ramp, so we map the closest pair for each role. Prefer
 * [PantopusTextStyle] directly when exactness matters.
 */
val PantopusTypography =
    Typography(
        displaySmall = PantopusTextStyle.h1,
        headlineLarge = PantopusTextStyle.h2,
        headlineSmall = PantopusTextStyle.h3,
        bodyLarge = PantopusTextStyle.body,
        bodyMedium = PantopusTextStyle.small,
        labelSmall = PantopusTextStyle.caption,
        labelMedium = PantopusTextStyle.overline,
    )
