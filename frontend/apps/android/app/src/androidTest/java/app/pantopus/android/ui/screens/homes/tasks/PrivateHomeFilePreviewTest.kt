package app.pantopus.android.ui.screens.homes.tasks

import android.graphics.pdf.PdfDocument
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.test.platform.app.InstrumentationRegistry
import app.pantopus.android.ui.screens.homes.claim_evidence.PrivateHomeFilePreview
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicBoolean

class PrivateHomeFilePreviewTest {
    @get:Rule val compose = createComposeRule()

    @Test fun pdf_renders_from_the_unlinked_descriptor_without_a_named_private_cache_file() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val bytes =
            ByteArrayOutputStream().use { output ->
                val pdf = PdfDocument()
                try {
                    val page = pdf.startPage(PdfDocument.PageInfo.Builder(120, 120, 1).create())
                    page.canvas.drawColor(android.graphics.Color.BLUE)
                    pdf.finishPage(page)
                    pdf.writeTo(output)
                } finally {
                    pdf.close()
                }
                output.toByteArray()
            }
        val displayed = AtomicBoolean(false)
        try {
            compose.setContent { PrivateHomeFilePreview(bytes, "application/pdf") { displayed.set(true) } }
            compose.waitUntil(timeoutMillis = 10_000) { displayed.get() }
            compose.onNodeWithContentDescription("Private document page 1").assertIsDisplayed()
            assertTrue(context.cacheDir.listFiles().orEmpty().none { it.name.startsWith("private-claim-") })
        } finally {
            bytes.fill(0)
        }
    }
}
