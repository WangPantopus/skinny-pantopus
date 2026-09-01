package app.pantopus.android.screenshots

import android.os.Environment
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Density
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import java.io.File

/**
 * P16 — Captures the six App Store / Play Store hero screens and writes
 * them as PNGs under
 * `fastlane/metadata/android/en-US/images/phoneScreenshots/`.
 *
 * Run via the convenience Gradle task wired in `app/build.gradle.kts`:
 *
 * ```
 * ./gradlew :app:captureStoreScreenshots
 * ```
 *
 * The Composables under test are mounted directly so screenshots don't
 * need a live backend. See `MockHubScreen`, `MockMailboxScreen`, etc. —
 * those will land in a follow-up that lifts every screen's preview-data
 * fixture into a screenshot-friendly variant.
 *
 * TODO(release): mount the real composables with stub Hilt graph + the
 * fixture data already used by `*ScreenshotPreview` previews; today the
 * test scaffolds a placeholder so the pipeline is wired end-to-end.
 */
class StoreScreenshotsTest {
    @get:Rule val compose = createComposeRule()

    // Compose's ComposeTestRule allows only one `setContent` per test, so
    // each hero screen lives in its own @Test method — JUnit gives every
    // test a fresh rule.

    @Test fun capture01HubPopulated() = captureScreen("01_Hub_populated") { Placeholder("Hub populated") }

    @Test fun capture02MyHomes() = captureScreen("02_MyHomes") { Placeholder("My homes") }

    @Test fun capture03HomeDashboard() = captureScreen("03_HomeDashboard") { Placeholder("Home dashboard") }

    @Test fun capture04MailboxList() = captureScreen("04_MailboxList") { Placeholder("Mailbox") }

    @Test fun capture05MailboxItemDetail() = captureScreen("05_MailboxItemDetail_package") { Placeholder("Package") }

    @Test fun capture06EditProfile() = captureScreen("06_EditProfile") { Placeholder("Edit profile") }

    private fun captureScreen(
        name: String,
        content: @androidx.compose.runtime.Composable () -> Unit,
    ) {
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(density = 3f, fontScale = 1f)) {
                content()
            }
        }
        compose.waitForIdle()

        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()

        val outDir =
            File(
                InstrumentationRegistry
                    .getInstrumentation()
                    .targetContext
                    .getExternalFilesDir(Environment.DIRECTORY_PICTURES),
                "store_screenshots",
            ).apply { mkdirs() }
        File(outDir, "$name.png").outputStream().use {
            bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
        }
        bitmap.recycle()
    }

    @androidx.compose.runtime.Composable
    private fun Placeholder(label: String) {
        // Stub composable. Replaced with the live screen + preview data
        // in a follow-up — the test scaffolding is wired so the pipeline
        // is shippable today.
        androidx.compose.material3.Text(label)
    }
}
