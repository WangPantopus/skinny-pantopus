package app.pantopus.android.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Verify every PantopusColors entry resolves to the exact ARGB value from
 * the design-system token inventory.
 */
class ColorTokenTest {
    @Test fun primary_scale() {
        assertHex(0xFFF0F9FF, PantopusColors.primary50)
        assertHex(0xFFE0F2FE, PantopusColors.primary100)
        assertHex(0xFFBAE6FD, PantopusColors.primary200)
        assertHex(0xFF7DD3FC, PantopusColors.primary300)
        assertHex(0xFF38BDF8, PantopusColors.primary400)
        assertHex(0xFF0EA5E9, PantopusColors.primary500)
        assertHex(0xFF0284C7, PantopusColors.primary600)
        assertHex(0xFF0369A1, PantopusColors.primary700)
        assertHex(0xFF075985, PantopusColors.primary800)
        assertHex(0xFF0C4A6E, PantopusColors.primary900)
    }

    @Test fun semantic() {
        assertHex(0xFF059669, PantopusColors.success)
        assertHex(0xFFD1FAE5, PantopusColors.successLight)
        assertHex(0xFFF0FDF4, PantopusColors.successBg)
        assertHex(0xFFD97706, PantopusColors.warning)
        assertHex(0xFFFDE68A, PantopusColors.warningLight)
        assertHex(0xFFFFFBEB, PantopusColors.warningBg)
        assertHex(0xFFDC2626, PantopusColors.error)
        assertHex(0xFFFECACA, PantopusColors.errorLight)
        assertHex(0xFFFEF2F2, PantopusColors.errorBg)
        assertHex(0xFF0284C7, PantopusColors.info)
        assertHex(0xFFBAE6FD, PantopusColors.infoLight)
        assertHex(0xFFF0F9FF, PantopusColors.infoBg)
    }

    @Test fun identity() {
        assertHex(0xFF0284C7, PantopusColors.personal)
        assertHex(0xFFDBEAFE, PantopusColors.personalBg)
        assertHex(0xFF16A34A, PantopusColors.home)
        assertHex(0xFFDCFCE7, PantopusColors.homeBg)
        assertHex(0xFF7C3AED, PantopusColors.business)
        assertHex(0xFFF3E8FF, PantopusColors.businessBg)
    }

    @Test fun pulse_intent_accents() {
        assertHex(0xFFBE123C, PantopusColors.rose)
        assertHex(0xFFFFE4E6, PantopusColors.roseBg)
        assertHex(0xFF475569, PantopusColors.slate)
        assertHex(0xFFE2E8F0, PantopusColors.slateBg)
    }

    @Test fun neutrals() {
        assertHex(0xFFF6F7F9, PantopusColors.appBg)
        assertHex(0xFFFFFFFF, PantopusColors.appSurface)
        assertHex(0xFFF9FAFB, PantopusColors.appSurfaceRaised)
        assertHex(0xFFF3F4F6, PantopusColors.appSurfaceSunken)
        assertHex(0xFFF8FAFC, PantopusColors.appSurfaceMuted)
        assertHex(0xFFE5E7EB, PantopusColors.appBorder)
        assertHex(0xFFD1D5DB, PantopusColors.appBorderStrong)
        assertHex(0xFFF3F4F6, PantopusColors.appBorderSubtle)
        assertHex(0xFF111827, PantopusColors.appText)
        assertHex(0xFF374151, PantopusColors.appTextStrong)
        assertHex(0xFF6B7280, PantopusColors.appTextSecondary)
        assertHex(0xFF9CA3AF, PantopusColors.appTextMuted)
        assertHex(0xFFFFFFFF, PantopusColors.appTextInverse)
        assertHex(0xFFF3F4F6, PantopusColors.appHover)
    }

    @Test fun categories() {
        assertHex(0xFFF97316, PantopusColors.handyman)
        assertHex(0xFF27AE60, PantopusColors.cleaning)
        assertHex(0xFF8E44AD, PantopusColors.moving)
        assertHex(0xFFE74C3C, PantopusColors.petCare)
        assertHex(0xFFF39C12, PantopusColors.childCare)
        assertHex(0xFF2980B9, PantopusColors.tutoring)
        assertHex(0xFF374151, PantopusColors.delivery)
        assertHex(0xFF3498DB, PantopusColors.tech)
        assertHex(0xFF7C3AED, PantopusColors.goods)
        assertHex(0xFFF97316, PantopusColors.gigs)
        assertHex(0xFF16A34A, PantopusColors.rentals)
        assertHex(0xFFDC2626, PantopusColors.vehicles)
    }

    @Test fun rating() {
        assertHex(0xFFF59E0B, PantopusColors.star)
    }

    private fun assertHex(
        expected: Long,
        actual: Color,
    ) {
        assertEquals(expected.toInt(), actual.toArgb())
    }
}
