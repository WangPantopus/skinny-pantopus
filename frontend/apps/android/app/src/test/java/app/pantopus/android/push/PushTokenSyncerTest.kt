@file:Suppress("PackageNaming")

package app.pantopus.android.push

import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.notifications.NotificationsRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Hilt-injectable [PushTokenSyncer] is unit-tested at its three input
 * boundaries (FCM token, ack store, repository) — all interfaces, all
 * mocked. No Firebase + no Android framework needed.
 */
class PushTokenSyncerTest {
    private val tokenProvider: FcmTokenProvider = mockk()
    private val repository: NotificationsRepository = mockk()
    private val ackStore: PushTokenAckStore = mockk(relaxed = true)
    private lateinit var syncer: PushTokenSyncer

    @Before
    fun setUp() {
        syncer = PushTokenSyncer(tokenProvider, repository, ackStore)
    }

    @Test
    fun no_token_short_circuits_without_registering() =
        runTest {
            coEvery { tokenProvider.currentToken() } returns null

            val outcome = syncer.syncIfNeeded()

            assertEquals(PushTokenSyncer.Outcome.NoToken, outcome)
            coVerify(exactly = 0) { repository.registerPushToken(any(), any()) }
            verify(exactly = 0) { ackStore.markAcked(any()) }
        }

    @Test
    fun already_acked_token_is_a_no_op() =
        runTest {
            coEvery { tokenProvider.currentToken() } returns "fcm-token-a"
            every { ackStore.lastAckedToken() } returns "fcm-token-a"

            val outcome = syncer.syncIfNeeded()

            assertEquals(PushTokenSyncer.Outcome.AlreadyAcked, outcome)
            coVerify(exactly = 0) { repository.registerPushToken(any(), any()) }
            verify(exactly = 0) { ackStore.markAcked(any()) }
        }

    @Test
    fun first_open_with_no_prior_ack_registers_and_persists() =
        runTest {
            coEvery { tokenProvider.currentToken() } returns "fcm-token-a"
            every { ackStore.lastAckedToken() } returns null
            coEvery { repository.registerPushToken("fcm-token-a", "android") } returns
                NetworkResult.Success(Unit)

            val outcome = syncer.syncIfNeeded()

            assertEquals(PushTokenSyncer.Outcome.Registered, outcome)
            coVerify(exactly = 1) { repository.registerPushToken("fcm-token-a", "android") }
            verify(exactly = 1) { ackStore.markAcked("fcm-token-a") }
        }

    @Test
    fun rotated_token_triggers_re_registration() =
        runTest {
            // App had previously acked an older token. The FCM SDK
            // rotated the token while we were backgrounded — the syncer
            // must re-register the new value.
            coEvery { tokenProvider.currentToken() } returns "fcm-token-b"
            every { ackStore.lastAckedToken() } returns "fcm-token-a"
            coEvery { repository.registerPushToken("fcm-token-b", "android") } returns
                NetworkResult.Success(Unit)

            val outcome = syncer.syncIfNeeded()

            assertEquals(PushTokenSyncer.Outcome.Registered, outcome)
            coVerify(exactly = 1) { repository.registerPushToken("fcm-token-b", "android") }
            verify(exactly = 1) { ackStore.markAcked("fcm-token-b") }
        }

    @Test
    fun network_failure_does_not_persist_ack() =
        runTest {
            coEvery { tokenProvider.currentToken() } returns "fcm-token-c"
            every { ackStore.lastAckedToken() } returns null
            coEvery { repository.registerPushToken("fcm-token-c", "android") } returns
                NetworkResult.Failure(NetworkError.Server(503, "down"))

            val outcome = syncer.syncIfNeeded()

            assertTrue(outcome is PushTokenSyncer.Outcome.Failed)
            verify(exactly = 0) { ackStore.markAcked(any()) }
        }
}
