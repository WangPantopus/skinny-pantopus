@file:Suppress("PackageNaming")

package app.pantopus.android.push

import android.Manifest
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented coverage of the Android-13+ POST_NOTIFICATIONS flow.
 *
 * Mirrors what `AppDelegate.requestNotificationPermission()` exercises
 * on iOS — that the manifest carries the permission and the OS treats
 * it as granted after the user accepts the prompt. We can't actually
 * tap the system dialog from a deterministic test, so we use
 * [GrantPermissionRule] to skip it and assert the post-grant state
 * MainActivity expects.
 *
 * The full activity-launch path stays out of this test on purpose:
 * MainActivity is `@AndroidEntryPoint`, so a real launch needs the
 * Hilt test runner — the rest of this suite (see `RootTabTest`) opts
 * to stub Hilt callers instead of wiring HiltAndroidRule.
 */
@RunWith(AndroidJUnit4::class)
class NotificationPermissionTest {
    /**
     * Auto-grants POST_NOTIFICATIONS on Android 13+. On older versions
     * the rule is a no-op (the permission was implicit) so the same
     * test runs on every API the app targets.
     */
    @get:Rule
    val grant: GrantPermissionRule = GrantPermissionRule.grant(Manifest.permission.POST_NOTIFICATIONS)

    @Test
    fun manifest_declares_post_notifications_permission() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val info: PackageInfo =
            context.packageManager.getPackageInfo(
                context.packageName,
                PackageManager.GET_PERMISSIONS,
            )
        val declared = info.requestedPermissions?.toList() ?: emptyList()
        assertTrue(
            "Expected POST_NOTIFICATIONS in <uses-permission> set: $declared",
            declared.contains(Manifest.permission.POST_NOTIFICATIONS),
        )
    }

    @Test
    fun permission_is_granted_after_rule_runs_on_tiramisu_or_later() {
        assumeTrue(
            "Runtime POST_NOTIFICATIONS only exists on Android 13+",
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU,
        )
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val granted =
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            )
        assertEquals(
            "GrantPermissionRule should auto-grant POST_NOTIFICATIONS",
            PackageManager.PERMISSION_GRANTED,
            granted,
        )
    }

    @Test
    fun firebase_messaging_service_is_registered() {
        // Catches accidental removal of the FCM <service> from the
        // manifest — without it, push tokens never refresh.
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val pkg = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SERVICES)
        val serviceClass = "app.pantopus.android.push.PantopusMessagingService"
        val found = pkg.services?.any { it.name == serviceClass } == true
        assertTrue("Expected $serviceClass in <service> set", found)
    }
}
