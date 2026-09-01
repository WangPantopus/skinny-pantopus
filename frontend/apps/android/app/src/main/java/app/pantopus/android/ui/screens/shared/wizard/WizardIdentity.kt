package app.pantopus.android.ui.screens.shared.wizard

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevation
import app.pantopus.android.ui.theme.PantopusElevations

/**
 * Identity pillar applied to a [WizardShell]. Drives the progress rail
 * fill, the primary CTA background + shadow tint, and the chip colours
 * callers can use for an inline identity chip or a selected-state
 * accent inside a step.
 *
 * The default identity is [Personal] (sky / `primary600`), so adding
 * this enum is fully additive — existing wizard call sites compile
 * unchanged and render identically.
 *
 * - [Personal] — sky / `primary600` (default).
 * - [Home] — green / `home` (home flows).
 * - [Business] — violet / `business` (A12.10 Create Business).
 * - [Warm] — porch amber / `warmAmber` (A12.11 Start Support Train).
 */
enum class WizardIdentity {
    Personal,
    Home,
    Business,
    Warm,
}

/** Fill colour for the progress rail and the primary CTA background. */
val WizardIdentity.accent: Color
    get() =
        when (this) {
            WizardIdentity.Personal -> PantopusColors.primary600
            WizardIdentity.Home -> PantopusColors.home
            WizardIdentity.Business -> PantopusColors.business
            WizardIdentity.Warm -> PantopusColors.warmAmber
        }

/**
 * Soft background paired with [accent] — the identity chip pill
 * background and the selected-state row tint inside a step.
 */
val WizardIdentity.accentBg: Color
    get() =
        when (this) {
            WizardIdentity.Personal -> PantopusColors.personalBg
            WizardIdentity.Home -> PantopusColors.homeBg
            WizardIdentity.Business -> PantopusColors.businessBg
            WizardIdentity.Warm -> PantopusColors.warmAmberBg
        }

/**
 * Identity-tinted shadow for the primary CTA. Mirrors the existing
 * [PantopusElevations.primary] recipe (`0 6px 16px rgba(accent, 0.18)`)
 * so the [WizardIdentity.Personal] variant is visually identical to the
 * legacy primary shadow callers got before this enum existed.
 */
val WizardIdentity.ctaShadow: PantopusElevation
    get() =
        PantopusElevation(
            color = accent,
            alpha = 0.18f,
            radius = 16.dp,
            offsetX = 0.dp,
            offsetY = 6.dp,
        )
