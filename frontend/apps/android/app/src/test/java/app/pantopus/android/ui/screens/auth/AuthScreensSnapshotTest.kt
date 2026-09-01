@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.auth

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * T6.1b — auth design-reference baseline tripwire. Mirrors the T5 pattern
 * in `T5ScreensSnapshotTest`: asserts each baseline PNG exists at
 *
 *   `frontend/apps/android/app/src/test/snapshots/auth/<screen>-android.png`
 *
 * and is a valid PNG. Catches accidental deletion of the visual contract
 * until real Paparazzi tests for the auth surfaces land.
 *
 * To regenerate the baselines:
 *   `cd /tmp/auth-screenshots && node render.mjs`
 */
class AuthScreensSnapshotTest {
    private val baselineDir = File("src/test/snapshots/auth")

    @Test
    fun login_android_baseline_is_present() = assertBaseline("login")

    @Test
    fun signup_android_baseline_is_present() = assertBaseline("signup")

    @Test
    fun error_android_baseline_is_present() = assertBaseline("error")

    // T6.1c P5 — Forgot / Reset / Verify baselines.

    @Test
    fun forgot_android_baseline_is_present() = assertBaseline("forgot")

    @Test
    fun setpassword_android_baseline_is_present() = assertBaseline("setpassword")

    @Test
    fun verify_android_baseline_is_present() = assertBaseline("verify")

    private fun assertBaseline(screen: String) {
        val file = File(baselineDir, "$screen-android.png")
        assertTrue("Missing baseline: ${file.path}", file.exists())
        val bytes = file.readBytes()
        assertTrue(
            "Baseline too small (${bytes.size} bytes): ${file.path}",
            bytes.size > 8 * 1024,
        )
        assertTrue(
            "Not a PNG: ${file.path}",
            bytes[0] == 0x89.toByte() &&
                bytes[1] == 'P'.code.toByte() &&
                bytes[2] == 'N'.code.toByte() &&
                bytes[3] == 'G'.code.toByte(),
        )
    }
}
