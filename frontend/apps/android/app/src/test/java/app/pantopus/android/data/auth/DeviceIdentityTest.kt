package app.pantopus.android.data.auth

import android.content.Context
import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID

/**
 * [DeviceIdentity] against the in-memory prefs: ids are minted once, are
 * well-formed (UUIDv4 / 32-hex), survive an instance recreation on the same
 * prefs (same install), and `regenerateDeviceId` rotates the id while
 * dropping the registration fingerprint + step-up enrolment marker.
 */
class DeviceIdentityTest {
    private lateinit var prefs: InMemorySharedPreferences

    @Before
    fun setUp() {
        prefs = InMemorySharedPreferences()
    }

    private fun identity(): DeviceIdentity = DeviceIdentity(mockk<Context>(relaxed = true)).apply { prefsOverride = prefs }

    @Test
    fun `deviceId is a UUID minted once and persisted`() {
        val id = identity()
        val first = id.deviceId()
        UUID.fromString(first) // throws when malformed
        assertEquals(first, id.deviceId())
        assertEquals(first, prefs.getString("device_id", null))
    }

    @Test
    fun `installId is 32 lowercase hex chars minted once and persisted`() {
        val id = identity()
        val first = id.installId()
        assertEquals(32, first.length)
        assertTrue(first.matches(Regex("[0-9a-f]{32}")))
        assertEquals(first, id.installId())
        assertEquals(first, prefs.getString("install_id", null))
    }

    @Test
    fun `same prefs file means same identity across instances (same install)`() {
        val a = identity()
        val deviceId = a.deviceId()
        val installId = a.installId()

        val b = identity()
        assertEquals(deviceId, b.deviceId())
        assertEquals(installId, b.installId())
    }

    @Test
    fun `fresh prefs (reinstall) yield a new identity`() {
        val a = identity()
        val prev = a.deviceId() to a.installId()

        prefs = InMemorySharedPreferences()
        val b = identity()
        assertNotEquals(prev.first, b.deviceId())
        assertNotEquals(prev.second, b.installId())
    }

    @Test
    fun `regenerateDeviceId rotates the id and clears registration + step-up markers`() {
        val id = identity()
        val before = id.deviceId()
        id.markRegistered("u|1.0 (1)|fcm")
        id.markStepUpEnrolled("u")

        val after = id.regenerateDeviceId()

        assertNotEquals(before, after)
        assertEquals(after, id.deviceId())
        assertNull(id.lastRegistrationFingerprint())
        assertNull(id.stepUpEnrolledFor())
        // installId is untouched — it tracks the install, not the key.
        assertEquals(id.installId(), identity().installId())
    }

    @Test
    fun `registration fingerprint and step-up marker round-trip`() {
        val id = identity()
        assertNull(id.lastRegistrationFingerprint())
        id.markRegistered("fp")
        assertEquals("fp", id.lastRegistrationFingerprint())

        assertNull(id.stepUpEnrolledFor())
        id.markStepUpEnrolled("u_1")
        assertEquals("u_1", id.stepUpEnrolledFor())
        id.markStepUpEnrolled(null)
        assertNull(id.stepUpEnrolledFor())
    }
}
