@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.shared.list_of_rows

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * T5 — screen-level snapshot lockfile.
 *
 * Verifies the 12 design-reference baseline PNGs (one per new T5 screen)
 * stay checked in at their canonical location:
 *
 *   `frontend/apps/android/app/src/test/snapshots/t5/<screen>-android.png`
 *
 * Each baseline is generated from the design package via the static HTML
 * harness at `tools/t5-screenshots/` (kept in `/tmp` — regenerable). They
 * are the **visual contract** that the on-device Compose render targets;
 * row-level drift is caught by [ListOfRowsScreenSnapshotTest], which
 * already exercises every `RowLeading` / `RowTrailing` / chip / footer
 * combination via Paparazzi.
 *
 * Drift at the screen level — a missing tab, a wrong FAB variant, a
 * dropped banner — gets caught by this test failing because someone
 * accidentally removed the PNG. **Until** screen-level Paparazzi tests
 * land (a T6 candidate that requires constructing fixture
 * `ListOfRowsUiState.Loaded` for each of the 12 screens), this tripwire
 * is the minimum lockfile guard against PNG loss.
 *
 * To regenerate the baselines:
 *   `cd /tmp/t5-tool && node render.mjs`   # writes all 36 platform PNGs
 *
 * To upgrade to real Paparazzi snapshot tests in T6: write
 * `T5<Feature>ScreenSnapshotTest.kt` per screen with a fixture
 * `ListOfRowsUiState.Loaded(...)` and call
 * `paparazzi.snapshot { PantopusTheme { ListOfRowsScreen(...) } }`.
 * Record baselines with `./gradlew paparazziRecord`. CI verifies on
 * every PR via `./gradlew paparazziVerify`.
 */
class T5ScreensSnapshotTest {
    private val baselineDir =
        File("src/test/snapshots/t5")

    @Test
    fun notifications_android_baseline_is_present() = assertBaseline("notifications")

    @Test
    fun bills_android_baseline_is_present() = assertBaseline("bills")

    @Test
    fun pets_android_baseline_is_present() = assertBaseline("pets")

    @Test
    fun connections_android_baseline_is_present() = assertBaseline("connections")

    @Test
    fun offers_android_baseline_is_present() = assertBaseline("offers")

    @Test
    fun my_bids_android_baseline_is_present() = assertBaseline("my-bids")

    @Test
    fun my_tasks_android_baseline_is_present() = assertBaseline("my-tasks")

    @Test
    fun my_pulse_android_baseline_is_present() = assertBaseline("my-pulse")

    @Test
    fun listing_offers_android_baseline_is_present() = assertBaseline("listing-offers")

    @Test
    fun discover_hub_android_baseline_is_present() = assertBaseline("discover-hub")

    @Test
    fun discover_businesses_android_baseline_is_present() = assertBaseline("discover-businesses")

    @Test
    fun review_claims_android_baseline_is_present() = assertBaseline("review-claims")

    private fun assertBaseline(screen: String) {
        val file = File(baselineDir, "$screen-android.png")
        assertTrue("Missing baseline: ${file.path}", file.exists())
        val bytes = file.readBytes()
        assertTrue(
            "Baseline too small (${bytes.size} bytes): ${file.path}",
            bytes.size > 8 * 1024,
        )
        // PNG magic: \x89 P N G \r \n \x1a \n
        assertTrue(
            "Not a PNG: ${file.path}",
            bytes[0] == 0x89.toByte() &&
                bytes[1] == 'P'.code.toByte() &&
                bytes[2] == 'N'.code.toByte() &&
                bytes[3] == 'G'.code.toByte(),
        )
    }
}
