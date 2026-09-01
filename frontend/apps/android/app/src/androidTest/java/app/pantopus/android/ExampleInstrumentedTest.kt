package app.pantopus.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Sanity check: the instrumentation context is our debug package.
 * Real behavior tests live alongside the screens they cover — see
 * `ui/screens/auth/LoginScreenTest.kt` for the Compose UI test pattern.
 */
@RunWith(AndroidJUnit4::class)
class ExampleInstrumentedTest {
    @Test
    fun useAppContext() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("app.pantopus.android.debug", context.packageName)
    }
}
