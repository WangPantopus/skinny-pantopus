package app.pantopus.android.ui.theme

import org.junit.Assert.assertEquals
import org.junit.Test

class SpacingRadiiTest {
    @Test fun spacing_ramp() {
        assertEquals(0f, Spacing.s0.value)
        assertEquals(4f, Spacing.s1.value)
        assertEquals(8f, Spacing.s2.value)
        assertEquals(12f, Spacing.s3.value)
        assertEquals(16f, Spacing.s4.value)
        assertEquals(20f, Spacing.s5.value)
        assertEquals(24f, Spacing.s6.value)
        assertEquals(32f, Spacing.s8.value)
        assertEquals(40f, Spacing.s10.value)
        assertEquals(48f, Spacing.s12.value)
        assertEquals(64f, Spacing.s16.value)
    }

    @Test fun radii() {
        assertEquals(4f, Radii.xs.value)
        assertEquals(6f, Radii.sm.value)
        assertEquals(8f, Radii.md.value)
        assertEquals(12f, Radii.lg.value)
        assertEquals(16f, Radii.xl.value)
        assertEquals(20f, Radii.xl2.value)
        assertEquals(24f, Radii.xl3.value)
        assertEquals(9999f, Radii.pill.value)
    }

    @Test fun shadow_alpha_and_geometry() {
        assertEquals(0.04f, PantopusElevations.sm.alpha)
        assertEquals(3f, PantopusElevations.sm.radius.value)
        assertEquals(1f, PantopusElevations.sm.offsetY.value)

        assertEquals(0.06f, PantopusElevations.md.alpha)
        assertEquals(6f, PantopusElevations.md.radius.value)
        assertEquals(2f, PantopusElevations.md.offsetY.value)

        assertEquals(0.08f, PantopusElevations.lg.alpha)
        assertEquals(12f, PantopusElevations.lg.radius.value)
        assertEquals(4f, PantopusElevations.lg.offsetY.value)

        assertEquals(0.10f, PantopusElevations.xl.alpha)
        assertEquals(24f, PantopusElevations.xl.radius.value)
        assertEquals(8f, PantopusElevations.xl.offsetY.value)

        assertEquals(0.18f, PantopusElevations.primary.alpha)
        assertEquals(16f, PantopusElevations.primary.radius.value)
        assertEquals(6f, PantopusElevations.primary.offsetY.value)
    }
}
