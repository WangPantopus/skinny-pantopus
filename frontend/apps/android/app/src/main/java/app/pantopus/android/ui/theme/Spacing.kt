package app.pantopus.android.ui.theme

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Canonical spacing ramp. Values mirror the design_system px scale at 1 px = 1 dp.
 *
 * Feature code MUST reference these — never call `.dp` on a raw literal
 * inside a feature composable.
 */
@Suppress("MagicNumber")
object Spacing {
    /** 0 dp. */
    val s0: Dp = 0.dp

    /** 4 dp. */
    val s1: Dp = 4.dp

    /** 8 dp. */
    val s2: Dp = 8.dp

    /** 12 dp. */
    val s3: Dp = 12.dp

    /** 16 dp. */
    val s4: Dp = 16.dp

    /** 20 dp. */
    val s5: Dp = 20.dp

    /** 24 dp. */
    val s6: Dp = 24.dp

    /** 32 dp. */
    val s8: Dp = 32.dp

    /** 40 dp. */
    val s10: Dp = 40.dp

    /** 48 dp. */
    val s12: Dp = 48.dp

    /** 64 dp. */
    val s16: Dp = 64.dp
}
