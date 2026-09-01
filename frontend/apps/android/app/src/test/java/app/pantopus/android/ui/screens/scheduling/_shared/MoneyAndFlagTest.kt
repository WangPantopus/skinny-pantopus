@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling._shared

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Locale

class MoneyAndFlagTest {
    @Test
    fun `parseCents handles dot and comma decimals`() {
        assertEquals(24000, MoneyAndFlag.parseCents("240"))
        assertEquals(24000, MoneyAndFlag.parseCents("240.00"))
        assertEquals(24050, MoneyAndFlag.parseCents("240,50"))
        assertEquals(24050, MoneyAndFlag.parseCents("240.5"))
        assertEquals(24000, MoneyAndFlag.parseCents("$240.00"))
        assertEquals(123456, MoneyAndFlag.parseCents("1.234,56"))
        assertEquals(123456, MoneyAndFlag.parseCents("1,234.56"))
        assertNull(MoneyAndFlag.parseCents(""))
        assertNull(MoneyAndFlag.parseCents("abc"))
    }

    @Test
    fun `editText keeps cents and round-trips through parseCents`() {
        assertEquals("49", MoneyAndFlag.editText(4900))
        assertEquals("49.99", MoneyAndFlag.editText(4999))
        assertEquals(4999, MoneyAndFlag.parseCents(MoneyAndFlag.editText(4999)))
        assertEquals(22000, MoneyAndFlag.parseCents(MoneyAndFlag.editText(22000)))
    }

    @Test
    fun `seed and parse are stable under a comma-decimal default locale`() {
        // de-DE formats 220.0 as "220,00" through unpinned formatters; the money
        // helpers must not let that inflate 220.00 into 22000.00 on save.
        val previous = Locale.getDefault()
        try {
            Locale.setDefault(Locale.GERMANY)
            assertEquals("220", MoneyAndFlag.editText(22000))
            assertEquals("220.45", MoneyAndFlag.editText(22045))
            assertEquals(22045, MoneyAndFlag.parseCents(MoneyAndFlag.editText(22045)))
            // A user typing the locale-native comma decimal still parses right.
            assertEquals(22045, MoneyAndFlag.parseCents("220,45"))
        } finally {
            Locale.setDefault(previous)
        }
    }
}
