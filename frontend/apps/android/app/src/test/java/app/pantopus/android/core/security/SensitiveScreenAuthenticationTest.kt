package app.pantopus.android.core.security

import android.app.KeyguardManager
import android.content.Context
import android.content.SharedPreferences
import androidx.biometric.BiometricManager
import androidx.fragment.app.FragmentActivity
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkAll
import io.mockk.verify
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class SensitiveScreenAuthenticationTest {
    private val context = mockk<Context>(relaxed = true)
    private val biometric = mockk<BiometricManager>()
    private val keyguard = mockk<KeyguardManager>()
    private val activity = mockk<FragmentActivity>(relaxed = true)
    private val prefs = mockk<SharedPreferences>(relaxed = true)
    private val editor = mockk<SharedPreferences.Editor>(relaxed = true)
    private var status = BiometricManager.BIOMETRIC_SUCCESS
    private lateinit var manager: AppLockManager

    @Before
    fun setUp() {
        mockkStatic(BiometricManager::class)
        every { BiometricManager.from(context) } returns biometric
        every { biometric.canAuthenticate(any()) } answers { status }
        every { context.getSystemService(KeyguardManager::class.java) } returns keyguard
        every { keyguard.isDeviceSecure } returns true
        every { prefs.edit() } returns editor
        every { editor.putBoolean(any(), any()) } returns editor
        manager = AppLockManager(context)
        manager.prefsOverride = prefs
    }

    @After
    fun tearDown() = unmockkAll()

    @Test
    fun transientAndUnknownErrorsNeverOpenMoneyScreen() =
        runTest {
            listOf(
                BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
                BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED,
                BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED,
                BiometricManager.BIOMETRIC_STATUS_UNKNOWN,
                12345,
            ).forEach {
                status = it
                assertTrue(manager.verifySensitiveScreen(activity, "Payments") is AppLockManager.SensitiveActionOutcome.Failed)
                assertFalse(manager.isWithinSensitiveGracePeriod())
            }
        }

    @Test
    fun biometricFailureWithDeviceCredentialCannotPassThrough() =
        runTest {
            listOf(BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED, BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE).forEach {
                status = it
                assertTrue(manager.verifySensitiveScreen(activity, "Payments") is AppLockManager.SensitiveActionOutcome.Failed)
            }
        }

    @Test
    fun confirmedNoCredentialKeepsExistingJourneyWithoutGrantingGrace() =
        runTest {
            every { keyguard.isDeviceSecure } returns false
            status = BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED
            assertEquals(AppLockManager.SensitiveActionOutcome.Verified, manager.verifySensitiveScreen(activity, "Payments"))
            assertEquals(AppLockManager.SensitiveActionOutcome.Verified, manager.verifySensitiveAction(activity, "Confirm"))
            assertFalse(manager.isWithinSensitiveGracePeriod())
        }

    @Test
    fun unavailableCredentialCheckIsNotEvidenceOfNoPasscode() =
        runTest {
            every { context.getSystemService(KeyguardManager::class.java) } returns null
            status = BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED
            assertTrue(manager.verifySensitiveScreen(activity, "Payments") is AppLockManager.SensitiveActionOutcome.Failed)
        }

    @Test
    fun missingActivityKeepsContentProtected() =
        runTest {
            assertTrue(manager.verifySensitiveScreen(null, "Payments") is AppLockManager.SensitiveActionOutcome.Failed)
            assertTrue(manager.verifySensitiveAction(null, "Withdraw") is AppLockManager.SensitiveActionOutcome.Failed)
        }

    @Test
    fun transientFailurePreservesAppLockPreferenceAndCover() {
        status = BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE
        every { prefs.getBoolean("appLock.first.enabled", false) } returns true
        every { prefs.getString("appLock.first.setupPrompt", null) } returns "enabled"
        manager.configure("first")
        assertTrue(manager.preferenceEnabled.value)
        assertTrue(manager.isLocked.value)
        verify(exactly = 0) { editor.putBoolean("appLock.first.enabled", false) }
    }

    @Test
    fun confirmedCredentialRemovalKeepsExistingAppLockPolicy() {
        status = BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED
        every { keyguard.isDeviceSecure } returns false
        every { prefs.getBoolean("appLock.first.enabled", false) } returns true
        manager.configure("first")
        assertFalse(manager.preferenceEnabled.value)
        assertFalse(manager.isLocked.value)
        verify(exactly = 1) { editor.putBoolean("appLock.first.enabled", false) }
    }

    @Test
    fun successfulPromptSupportsGraceAndZeroGraceRequiresAnotherCheck() =
        runTest {
            var prompts = 0
            manager.promptOverride = {
                prompts += 1
                true
            }
            assertEquals(AppLockManager.SensitiveActionOutcome.Verified, manager.verifySensitiveScreen(activity, "Wallet"))
            assertEquals(AppLockManager.SensitiveActionOutcome.Verified, manager.verifySensitiveScreen(activity, "Payments"))
            assertEquals(1, prompts)
            assertEquals(AppLockManager.SensitiveActionOutcome.Verified, manager.verifySensitiveScreen(activity, "Payments", 0))
            assertEquals(2, prompts)
        }

    @Test
    fun newCapabilityErrorCannotReuseGrace() =
        runTest {
            manager.promptOverride = { true }
            manager.verifySensitiveScreen(activity, "Wallet")
            status = BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE
            assertTrue(manager.verifySensitiveScreen(activity, "Payments") is AppLockManager.SensitiveActionOutcome.Failed)
        }

    @Test
    fun failedPromptDoesNotEarnGrace() =
        runTest {
            manager.promptOverride = { false }
            assertTrue(manager.verifySensitiveScreen(activity, "Payments") is AppLockManager.SensitiveActionOutcome.Failed)
            assertFalse(manager.isWithinSensitiveGracePeriod())
        }

    @Test
    fun delayedPromptCannotUnlockOrChangeAnotherAccount() =
        runTest {
            every { prefs.getBoolean(any(), false) } returns true
            every { prefs.getString(any(), null) } returns "enabled"
            listOf("unlock", "enable", "sensitive", "presence").forEach { operation ->
                val started = CompletableDeferred<Unit>()
                val answer = CompletableDeferred<Boolean>()
                manager = AppLockManager(context).also { it.prefsOverride = prefs }
                manager.promptOverride = {
                    started.complete(Unit)
                    answer.await()
                }
                manager.configure("first")
                val result =
                    async {
                        when (operation) {
                            "unlock" -> manager.unlockIfNeeded(activity)
                            "enable" -> manager.setEnabled(true, activity, AppLockManager.EnableSource.PostLoginPrompt)
                            "presence" -> manager.verifyPresence(activity, "Continue")
                            else -> manager.verifySensitiveAction(activity, "Withdraw")
                        }
                    }
                started.await()
                manager.configure("second")
                answer.complete(true)
                val outcome = result.await()
                assertTrue(manager.isLocked.value)
                assertTrue(manager.preferenceEnabled.value)
                assertFalse(manager.isWithinSensitiveGracePeriod())
                assertFalse(outcome == AppLockManager.SensitiveActionOutcome.Verified)
                assertFalse(outcome == AppLockManager.PresenceOutcome.Verified)
                assertFalse(outcome == true)
            }
            verify(exactly = 0) { editor.putBoolean(any(), any()) }
        }

    @Test
    fun logoutDiscardsPendingVerificationResult() =
        runTest {
            val started = CompletableDeferred<Unit>()
            val answer = CompletableDeferred<Boolean>()
            manager.configure("first")
            manager.promptOverride = {
                started.complete(Unit)
                answer.await()
            }
            val result = async { manager.verifySensitiveAction(activity, "Withdraw") }
            started.await()
            manager.clearTransientState()
            answer.complete(true)
            assertTrue(result.await() is AppLockManager.SensitiveActionOutcome.Failed)
            assertFalse(manager.isWithinSensitiveGracePeriod())
            assertFalse(manager.preferenceEnabled.value)
        }
}
