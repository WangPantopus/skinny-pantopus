@file:Suppress("PackageNaming")

package app.pantopus.android.push

import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.DeviceIdentity
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.notifications.NotificationsRepository
import com.google.firebase.messaging.FirebaseMessaging
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Abstracts `FirebaseMessaging.getInstance().token.await()` so tests can
 * inject a fixed string (or null for "not registered yet") without
 * pulling in Firebase initialization on the JVM.
 */
interface FcmTokenProvider {
    suspend fun currentToken(): String?

    /** Deletes this phone's token, so FCM stops delivering here. False when that failed: it needs a network. */
    suspend fun deleteToken(): Boolean
}

/** Production implementation — delegates to FirebaseMessaging. */
@Singleton
class FirebaseFcmTokenProvider
    @Inject
    constructor() : FcmTokenProvider {
        // A read waits for a delete in flight: the token it would get is about to die.
        private val tokenLock = Mutex()

        override suspend fun currentToken(): String? =
            tokenLock.withLock {
                runCatching { FirebaseMessaging.getInstance().token.await() }
                    .onFailure { Timber.w(it, "FirebaseMessaging.token failed") }
                    .getOrNull()
            }

        override suspend fun deleteToken(): Boolean =
            tokenLock.withLock {
                runCatching { withTimeout(DELETE_TIMEOUT_MS) { FirebaseMessaging.getInstance().deleteToken().await() } }
                    .onFailure { Timber.w(it, "FirebaseMessaging.deleteToken failed") }
                    .isSuccess
            }

        private companion object {
            /** Firebase gives up on its own well before this; it only keeps a stuck call from holding [tokenLock]. */
            const val DELETE_TIMEOUT_MS = 60_000L
        }
    }

/** Hilt binding for the production provider. */
@Module
@InstallIn(SingletonComponent::class)
abstract class PushTokenSyncerModule {
    @Binds
    @Singleton
    abstract fun bindFcmTokenProvider(impl: FirebaseFcmTokenProvider): FcmTokenProvider
}

/**
 * Re-registers the device's FCM token with the backend on app open when
 * the last server-side ACK is missing (cold install) or no longer
 * matches the current FCM token (token rotation that we missed because
 * the service callback was throttled / crashed).
 *
 * The [PantopusMessagingService.onNewToken] callback handles the live
 * path; this syncer is the safety net.
 *
 * Persistent login (design §9, CONTRACT §"Client behaviour"): the
 * registration carries this device's `deviceId` so the `PushToken` row is
 * linked to the trusted-device row, and a (re)registered token is also
 * re-linked through `POST /api/auth/devices/register` (fingerprint-gated
 * inside [AuthRepository.registerDevice]; no-op when signed out).
 *
 * It also deletes the token when an account leaves this phone
 * ([deleteTokenAfterSignOut]): the logout that removes the server's row may
 * never get there, and FCM would keep delivering that account's pushes.
 */
@Singleton
class PushTokenSyncer
    @Inject
    constructor(
        private val tokenProvider: FcmTokenProvider,
        private val repository: NotificationsRepository,
        private val ackStore: PushTokenAckStore,
        private val deviceIdentity: DeviceIdentity,
        // Lazy: the auth graph is heavy; only touched after a successful registration.
        private val authRepository: dagger.Lazy<AuthRepository>,
        private val tokens: TokenStorage,
    ) {
        // Not a screen's scope: a delete must finish even when the screen that asked goes away.
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        /**
         * Every sign-out, however the session ended. Deleting needs a network, so it's written down first and
         * tried again whenever there's a chance: each time the app opens ([syncIfNeeded]) and when a push still
         * arrives (`PantopusMessagingService`). The next sign-in gets a fresh token, or keeps this one when the
         * delete never went through: registering it moves the server's row to whoever signed in.
         */
        fun deleteTokenAfterSignOut() {
            ackStore.setTokenDeletePending(true)
            retryTokenDelete()
        }

        fun retryTokenDelete(): Job = scope.launch { deletePendingToken() }

        private suspend fun deletePendingToken() {
            if (!ackStore.tokenDeletePending()) return
            if (isSignedIn()) {
                ackStore.setTokenDeletePending(false)
                return
            }
            val deleted = tokenProvider.deleteToken()
            Timber.d("FCM token delete after sign-out: deleted=$deleted")
            if (deleted) {
                ackStore.clear()
                ackStore.setTokenDeletePending(false)
            }
            // Signed in during the delete: that sign-in's registration may have given up waiting for the token.
            if (isSignedIn()) syncIfNeeded()
        }

        private suspend fun isSignedIn() = !tokens.accessToken().isNullOrBlank()

        /**
         * Finishes a token delete that's still pending. Then, signed in, reads
         * the current FCM token, compares to the last ACK'd value, and
         * re-registers if they differ. Returns the [Outcome] so the caller (or
         * a unit test) can assert what happened.
         */
        suspend fun syncIfNeeded(): Outcome {
            retryTokenDelete().join()
            if (!isSignedIn()) return Outcome.SignedOut
            val token = tokenProvider.currentToken()
            if (token.isNullOrBlank()) return Outcome.NoToken
            val lastAck = ackStore.lastAckedToken()
            if (lastAck == token) {
                // The token ACK can outlive logout or a failed login-time
                // device registration. The registry has its own fingerprint
                // gate and retries pending linkage without another login.
                return if (authRepository.get().registerDevice()) {
                    Outcome.AlreadyAcked
                } else {
                    Outcome.Failed("Device registration is pending")
                }
            }
            val result =
                repository.registerPushToken(
                    token = token,
                    platform = "android",
                    deviceId = deviceIdentity.deviceId(),
                )
            return when (result) {
                is NetworkResult.Success -> {
                    ackStore.markAcked(token)
                    runCatching { authRepository.get().registerDevice() }
                        .onFailure { Timber.w(it, "device re-registration after push token sync failed") }
                    Outcome.Registered
                }
                is NetworkResult.Failure -> Outcome.Failed(result.error.message)
            }
        }

        /**
         * Possible terminal states of a single [syncIfNeeded] run. Modeled
         * as a sealed hierarchy so tests can match exhaustively.
         */
        sealed interface Outcome {
            /** Nobody to register a token for; the next sign-in does it. */
            data object SignedOut : Outcome

            /** FCM hadn't issued a token yet — nothing to register. */
            data object NoToken : Outcome

            /** The current token already matches the last ACK. */
            data object AlreadyAcked : Outcome

            /** A fresh /register call succeeded; ack store now holds the new token. */
            data object Registered : Outcome

            /** Registration failed; ack store is unchanged. */
            data class Failed(val message: String) : Outcome
        }
    }
