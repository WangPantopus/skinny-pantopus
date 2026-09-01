package app.pantopus.android.ui.theme

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Canonical corner-radius ramp. Values mirror the design_system px scale at 1 px = 1 dp.
 */
@Suppress("MagicNumber")
object Radii {
    /** 4 dp. */
    val xs: Dp = 4.dp

    /** 6 dp. */
    val sm: Dp = 6.dp

    /** 8 dp. */
    val md: Dp = 8.dp

    /** 12 dp. */
    val lg: Dp = 12.dp

    /** 16 dp. */
    val xl: Dp = 16.dp

    /** 20 dp. */
    val xl2: Dp = 20.dp

    /** 24 dp. */
    val xl3: Dp = 24.dp

    /** Effectively-round pill corners. */
    val pill: Dp = 9999.dp
}
