@file:Suppress("PackageNaming")

package app.pantopus.android.ui.components

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Pure StateFlow contract for [ToastController] — no Compose runtime
 * needed. Mirrors the iOS `ToastMessage` state-machine intent.
 */
class ToastControllerTest {
    @Test
    fun initialStateIsNull() {
        val controller = ToastController()
        assertNull(controller.current.value)
    }

    @Test
    fun showSetsCurrentMessage() {
        val controller = ToastController()
        controller.show("Saved")
        val current = controller.current.value
        assertEquals("Saved", current?.text)
        assertEquals(ToastKind.Neutral, current?.kind)
    }

    @Test
    fun typedHelpersTagTheKind() {
        val controller = ToastController()
        controller.success("ok")
        assertEquals(ToastKind.Success, controller.current.value?.kind)

        controller.warning("watch out")
        assertEquals(ToastKind.Warning, controller.current.value?.kind)

        controller.error("nope")
        assertEquals(ToastKind.Error, controller.current.value?.kind)

        controller.info("fyi")
        assertEquals(ToastKind.Info, controller.current.value?.kind)
    }

    @Test
    fun dismissClearsState() {
        val controller = ToastController()
        controller.success("Saved")
        controller.dismiss()
        assertNull(controller.current.value)
    }

    @Test
    fun newShowReplacesCurrent() {
        val controller = ToastController()
        controller.show("First")
        val first = controller.current.value
        controller.show("Second")
        val second = controller.current.value
        assertEquals("Second", second?.text)
        assertNotEquals(first?.id, second?.id)
    }

    @Test
    fun showByMessagePreservesId() =
        runTest {
            val controller = ToastController()
            val message = ToastMessage(text = "Hello", kind = ToastKind.Success)
            controller.show(message)
            assertEquals(message.id, controller.current.value?.id)
        }
}
