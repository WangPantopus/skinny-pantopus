@file:Suppress("PackageNaming", "FunctionNaming", "TooManyFunctions", "LargeClass")

package app.pantopus.android.ui.screens.shared

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * B7.1 — new-design pack snapshot lockfile, batch 2 (Android half).
 *
 * Locks the batch-2 design hand-off (the screens that post-date the original
 * 44-screen audit in `NewDesignScreensSnapshotTest` — A17.11–A17.14, A10.6,
 * A10.7, A10.11, A18.4, A18.5, A19.1, A19.2) as the durable visual reference
 * for every screen built out across Phases B2–B6. One @Test per screen ×
 * designed variant — 22 rows total — each asserting that its committed
 * reference PNG stays checked in at:
 *
 *   app/src/test/snapshots/images/new-designs-batch2/<slug>.png
 *
 * This is a *presence tripwire* that mirrors the iOS
 * `T8ScreensSnapshotTests.swift` and lives under the Paparazzi snapshot
 * directory by convention. It deliberately does NOT use a `Paparazzi`
 * @get:Rule: the per-screen Paparazzi suites (e.g. `StampsSnapshotTest`,
 * `MailTaskSnapshotTest`, `EarnSnapshotTest`, `WaitingRoomSnapshotTest`,
 * `BusinessProfileSnapshotTest`, …) lock the on-device Compose render; this
 * file locks the *design pack* those screens target, so it needs no Android
 * SDK / layoutlib to verify and passes wherever the JVM unit tests run. The
 * reference PNGs are byte-identical to the iOS set (one design per screen ×
 * variant, shared across platforms). See
 * `frontend/apps/ios/PantopusTests/Features/Shared/NEW_DESIGNS_BATCH2.md` for
 * the regeneration policy.
 */
class NewDesignBatch2ScreensSnapshotTest {
    private val baselineDir: File =
        run {
            val candidates =
                listOf(
                    "src/test/snapshots/images/new-designs-batch2",
                    "app/src/test/snapshots/images/new-designs-batch2",
                    "frontend/apps/android/app/src/test/snapshots/images/new-designs-batch2",
                )
            candidates.map(::File).firstOrNull { it.isDirectory } ?: File(candidates.first())
        }

    // ---- A17 — Mailbox standalone screens (B2)
    @Test
    fun a17_11_stamps_populated() {
        assertBaseline("a17-11-stamps-populated")
    }

    @Test
    fun a17_11_stamps_empty() {
        assertBaseline("a17-11-stamps-empty")
    }

    @Test
    fun a17_12_mail_task_open() {
        assertBaseline("a17-12-mail-task-open")
    }

    @Test
    fun a17_12_mail_task_done() {
        assertBaseline("a17-12-mail-task-done")
    }

    @Test
    fun a17_13_translation_machine() {
        assertBaseline("a17-13-translation-machine")
    }

    @Test
    fun a17_13_translation_confirmed() {
        assertBaseline("a17-13-translation-confirmed")
    }

    @Test
    fun a17_14_unboxing_classified() {
        assertBaseline("a17-14-unboxing-classified")
    }

    @Test
    fun a17_14_unboxing_filed() {
        assertBaseline("a17-14-unboxing-filed")
    }

    // ---- A10 — Business surfaces + Earn (B3 / B4)
    @Test
    fun a10_6_business_profile_populated() {
        assertBaseline("a10-6-business-profile-populated")
    }

    @Test
    fun a10_6_business_profile_new() {
        assertBaseline("a10-6-business-profile-new")
    }

    @Test
    fun a10_7_business_owner_edit() {
        assertBaseline("a10-7-business-owner-edit")
    }

    @Test
    fun a10_7_business_owner_preview() {
        assertBaseline("a10-7-business-owner-preview")
    }

    @Test
    fun a10_11_earn_populated() {
        assertBaseline("a10-11-earn-populated")
    }

    @Test
    fun a10_11_earn_empty() {
        assertBaseline("a10-11-earn-empty")
    }

    // ---- A18 — Status / waiting / preview (B5)
    @Test
    fun a18_4_waiting_room_active() {
        assertBaseline("a18-4-waiting-room-active")
    }

    @Test
    fun a18_4_waiting_room_more_info() {
        assertBaseline("a18-4-waiting-room-more-info")
    }

    @Test
    fun a18_5_view_as_connection() {
        assertBaseline("a18-5-view-as-connection")
    }

    @Test
    fun a18_5_view_as_public() {
        assertBaseline("a18-5-view-as-public")
    }

    // ---- A19 — Legal long-form archetype (B6)
    @Test
    fun a19_1_privacy_top() {
        assertBaseline("a19-1-privacy-top")
    }

    @Test
    fun a19_1_privacy_reading() {
        assertBaseline("a19-1-privacy-reading")
    }

    @Test
    fun a19_2_terms_top() {
        assertBaseline("a19-2-terms-top")
    }

    @Test
    fun a19_2_terms_reading() {
        assertBaseline("a19-2-terms-reading")
    }

    // ---- Helper

    private fun assertBaseline(slug: String) {
        val png = File(baselineDir, "$slug.png")
        assertTrue("Missing batch-2 new-design baseline: ${png.path}", png.exists())
        val bytes = png.readBytes()
        assertTrue("Batch-2 new-design baseline too small (${bytes.size} B): ${png.path}", bytes.size > 4 * 1024)
        val magic = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
        assertTrue(
            "Batch-2 new-design baseline isn't a PNG: ${png.path}",
            bytes.size >= 8 && bytes.copyOfRange(0, 8).contentEquals(magic),
        )
    }
}
