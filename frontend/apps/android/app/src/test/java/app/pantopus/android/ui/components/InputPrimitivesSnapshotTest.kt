@file:Suppress("LongMethod", "MagicNumber", "UnusedPrivateMember", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Coverage for the P1.2 input + indicator primitives:
 *
 * - **Paparazzi snapshots** for each primitive at its render-relevant
 *   states. Visual regression goes through `./gradlew paparazziVerify`.
 * - **JVM unit tests** for [PasswordStrength.evaluate] (16 rule-mask
 *   combinations × 2 breach states = 32 cases) and the
 *   [processCodeInputChange] helper (auto-advance, uppercase, cap-at-6,
 *   onComplete-fires-once contract).
 *
 * Interaction tests that need a live Compose runtime (tap on
 * [ChannelChip] etc.) live in the `androidTest` mirror.
 */
class InputPrimitivesSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(softButtons = false),
        )

    // MARK: - Paparazzi snapshots

    @Test
    fun codeInput_states() {
        paparazzi.snapshot { CodeInputGallery() }
    }

    @Test
    fun strengthMeter_states() {
        paparazzi.snapshot { StrengthMeterGallery() }
    }

    @Test
    fun channelChip_states() {
        paparazzi.snapshot { ChannelChipGallery() }
    }

    @Test
    fun envelopeOcrBox_tones() {
        paparazzi.snapshot { EnvelopeOcrBoxGallery() }
    }

    // MARK: - StrengthMeter rule matrix (16 combos × 2 breach states)

    @Test
    fun strengthMeter_allCombinations() {
        for (mask in 0 until 16) {
            val wantMin = (mask and 0b0001) != 0
            val wantCase = (mask and 0b0010) != 0
            val wantNumber = (mask and 0b0100) != 0
            val wantSymbol = (mask and 0b1000) != 0

            val password = buildPassword(wantMin, wantCase, wantNumber, wantSymbol)

            for (breached in listOf(false, true)) {
                val strength = PasswordStrength.evaluate(password, breached = breached)

                assertEquals(
                    "mask=$mask breached=$breached min-length",
                    wantMin,
                    strength.hasMinLength,
                )
                assertEquals(
                    "mask=$mask breached=$breached mixed-case",
                    wantCase,
                    strength.hasMixedCase,
                )
                assertEquals(
                    "mask=$mask breached=$breached number",
                    wantNumber,
                    strength.hasNumber,
                )
                assertEquals(
                    "mask=$mask breached=$breached symbol",
                    wantSymbol,
                    strength.hasSymbol,
                )
                assertEquals(
                    "mask=$mask breached=$breached breach passthrough",
                    breached,
                    strength.breached,
                )

                val expectedCount =
                    (if (wantMin) 1 else 0) +
                        (if (wantCase) 1 else 0) +
                        (if (wantNumber) 1 else 0) +
                        (if (wantSymbol) 1 else 0)
                assertEquals("mask=$mask rulesMet", expectedCount, strength.rulesMet)

                val expectedStrong = expectedCount == 4 && !breached
                assertEquals(
                    "mask=$mask breached=$breached isStrong",
                    expectedStrong,
                    strength.isStrong,
                )
            }
        }
    }

    private fun buildPassword(
        hasMinLength: Boolean,
        hasMixedCase: Boolean,
        hasNumber: Boolean,
        hasSymbol: Boolean,
    ): String {
        val sb = StringBuilder(if (hasMixedCase) "aB" else "ab")
        if (hasNumber) sb.append('3')
        if (hasSymbol) sb.append('!')
        if (hasMinLength) {
            while (sb.length < 12) sb.append('x')
        } else if (sb.length >= 12) {
            return sb.substring(0, 11)
        }
        return sb.toString()
    }

    // MARK: - processCodeInputChange contract

    @Test
    fun codeInput_uppercasesAndAutoAdvances() {
        val applied = mutableListOf<String>()
        processCodeInputChange(current = "", incoming = "a", onValueChange = applied::add)
        processCodeInputChange(current = "A", incoming = "Ab", onValueChange = applied::add)
        assertEquals(listOf("A", "AB"), applied)
    }

    @Test
    fun codeInput_capsAtSixChars() {
        val applied = mutableListOf<String>()
        processCodeInputChange(current = "", incoming = "ABCDEFGHIJ", onValueChange = applied::add)
        assertEquals(listOf("ABCDEF"), applied)
    }

    @Test
    fun codeInput_backspaceTriggersValueChange() {
        val applied = mutableListOf<String>()
        processCodeInputChange(current = "ABC", incoming = "AB", onValueChange = applied::add)
        assertEquals(listOf("AB"), applied)
    }

    @Test
    fun codeInput_completionFiresOnceOnFill() {
        val completed = mutableListOf<String>()
        val applied = mutableListOf<String>()
        val onValueChange: (String) -> Unit = applied::add
        val onComplete: (String) -> Unit = completed::add

        processCodeInputChange(current = "", incoming = "AB", onValueChange = onValueChange, onComplete = onComplete)
        assertTrue("No completion before fill", completed.isEmpty())

        processCodeInputChange(current = "AB", incoming = "ABCDEF", onValueChange = onValueChange, onComplete = onComplete)
        assertEquals(listOf("ABCDEF"), completed)

        // No-op set with same value must not refire.
        processCodeInputChange(current = "ABCDEF", incoming = "ABCDEF", onValueChange = onValueChange, onComplete = onComplete)
        assertEquals(listOf("ABCDEF"), completed)

        // Trim → re-fill should fire again on the <6 → 6 transition.
        processCodeInputChange(current = "ABCDEF", incoming = "ABCDE", onValueChange = onValueChange, onComplete = onComplete)
        processCodeInputChange(current = "ABCDE", incoming = "ABCDEX", onValueChange = onValueChange, onComplete = onComplete)
        assertEquals(listOf("ABCDEF", "ABCDEX"), completed)
    }

    @Test
    fun codeInput_noChangeDoesNotInvoke() {
        val applied = mutableListOf<String>()
        val completed = mutableListOf<String>()
        // Same string after uppercasing → no onValueChange call.
        processCodeInputChange(
            current = "ABCDEF",
            incoming = "abcdef",
            onValueChange = applied::add,
            onComplete = completed::add,
        )
        assertTrue("Identity update suppressed", applied.isEmpty())
        assertFalse("No completion on no-op", completed.isNotEmpty())
    }
}

@Composable
private fun CodeInputGallery() {
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("empty", style = PantopusTextStyle.caption)
        CodeInput(value = "", onValueChange = {})
        Text("partial", style = PantopusTextStyle.caption)
        CodeInput(value = "4Q2", onValueChange = {})
        Text("filled", style = PantopusTextStyle.caption)
        CodeInput(value = "4Q2K7B", onValueChange = {})
        Text("locked", style = PantopusTextStyle.caption)
        CodeInput(value = "", onValueChange = {}, isDisabled = true)
    }
}

@Composable
private fun StrengthMeterGallery() {
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        listOf(
            "Empty" to PasswordStrength.evaluate(""),
            "Short" to PasswordStrength.evaluate("abc"),
            "Letters only" to PasswordStrength.evaluate("abcdefghijkl"),
            "Mixed case" to PasswordStrength.evaluate("abcDefghijkl"),
            "+ number" to PasswordStrength.evaluate("abcDefghij12"),
            "Strong" to PasswordStrength.evaluate("abcDef1234!@"),
            "Breached" to PasswordStrength.evaluate("password12", breached = true),
        ).forEach { (label, strength) ->
            Text(label, style = PantopusTextStyle.caption)
            StrengthMeter(strength)
        }
    }
}

@Composable
private fun ChannelChipGallery() {
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("Triads", style = PantopusTextStyle.caption)
        ChannelTriad(p = true, e = false, s = false)
        ChannelTriad(p = true, e = true, s = false)
        ChannelTriad(p = true, e = true, s = true)
        ChannelTriad(p = ChannelState.Locked, e = ChannelState.On, s = ChannelState.Off)
        Text("Individual chips", style = PantopusTextStyle.caption)
        androidx.compose.foundation.layout.Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            ChannelChip(glyph = ChannelGlyph.P, state = ChannelState.On)
            ChannelChip(glyph = ChannelGlyph.E, state = ChannelState.Off)
            ChannelChip(glyph = ChannelGlyph.S, state = ChannelState.Locked)
        }
    }
}

@Composable
private fun EnvelopeOcrBoxGallery() {
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("clean (sky)", style = PantopusTextStyle.caption)
        Box(
            modifier =
                Modifier
                    .size(width = 320.dp, height = 120.dp)
                    .background(PantopusColors.appSurfaceMuted),
        ) {
            EnvelopeOcrBox(
                rect =
                    DpRect(
                        left = Spacing.s4,
                        top = Spacing.s5,
                        right = Spacing.s4 + 160.dp,
                        bottom = Spacing.s5 + 22.dp,
                    ),
                tone = EnvelopeOcrTone.Clean,
                label = "name · 97%",
            )
        }
        Text("unclear (amber + stain)", style = PantopusTextStyle.caption)
        Box(
            modifier =
                Modifier
                    .size(width = 320.dp, height = 120.dp)
                    .background(PantopusColors.appSurfaceMuted),
        ) {
            EnvelopeOcrBox(
                rect =
                    DpRect(
                        left = Spacing.s4,
                        top = Spacing.s5,
                        right = Spacing.s4 + 160.dp,
                        bottom = Spacing.s5 + 22.dp,
                    ),
                tone = EnvelopeOcrTone.Unclear,
                label = "name · 31%",
            )
        }
    }
}
