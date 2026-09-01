package app.pantopus.android.ui.theme

import androidx.compose.ui.text.font.FontWeight
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Asserts each PantopusTextStyle role matches the design-system spec
 * (size, line height, weight, letter spacing).
 */
class TypographyTest {
    @Test fun h1() {
        val t = PantopusTextStyle.h1
        assertEquals(30f, t.fontSize.value)
        assertEquals(36f, t.lineHeight.value)
        assertEquals(FontWeight.Bold.weight, t.fontWeight?.weight)
        assertEquals(-0.020f, t.letterSpacing.value, 0.0001f)
    }

    @Test fun h2() {
        val t = PantopusTextStyle.h2
        assertEquals(24f, t.fontSize.value)
        assertEquals(32f, t.lineHeight.value)
        assertEquals(FontWeight.SemiBold.weight, t.fontWeight?.weight)
        assertEquals(-0.015f, t.letterSpacing.value, 0.0001f)
    }

    @Test fun h3() {
        val t = PantopusTextStyle.h3
        assertEquals(20f, t.fontSize.value)
        assertEquals(28f, t.lineHeight.value)
        assertEquals(FontWeight.SemiBold.weight, t.fontWeight?.weight)
        assertEquals(0f, t.letterSpacing.value, 0.0001f)
    }

    @Test fun body() {
        val t = PantopusTextStyle.body
        assertEquals(16f, t.fontSize.value)
        assertEquals(24f, t.lineHeight.value)
        assertEquals(FontWeight.Normal.weight, t.fontWeight?.weight)
    }

    @Test fun small() {
        val t = PantopusTextStyle.small
        assertEquals(14f, t.fontSize.value)
        assertEquals(20f, t.lineHeight.value)
        assertEquals(FontWeight.Normal.weight, t.fontWeight?.weight)
    }

    @Test fun caption() {
        val t = PantopusTextStyle.caption
        assertEquals(12f, t.fontSize.value)
        assertEquals(16f, t.lineHeight.value)
        assertEquals(FontWeight.Normal.weight, t.fontWeight?.weight)
    }

    @Test fun overline() {
        val t = PantopusTextStyle.overline
        assertEquals(11f, t.fontSize.value)
        assertEquals(16f, t.lineHeight.value)
        assertEquals(FontWeight.SemiBold.weight, t.fontWeight?.weight)
        assertEquals(0.06f, t.letterSpacing.value, 0.0001f)
    }
}
