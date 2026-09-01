@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.review_claims

import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * A13.3 Review Claim detail baseline tripwire. The actual PNGs are
 * recorded in a follow-up render pass; until then these tests skip when
 * baselines are absent, matching the platform snapshot convention.
 */
class ReviewClaimDetailSnapshotTest {
    private val baselineDir = File("src/test/snapshots/a13-3-review-claim")

    @Test fun review_claim_detail_pending_android_baseline_is_present() = assertBaselineOrSkip("detail-pending")

    @Test fun review_claim_detail_challenging_android_baseline_is_present() = assertBaselineOrSkip("detail-challenging")

    private fun assertBaselineOrSkip(screen: String) {
        val file = File(baselineDir, "$screen-android.png")
        assumeTrue("Baseline pending follow-up commit: ${file.path}", file.exists())
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
