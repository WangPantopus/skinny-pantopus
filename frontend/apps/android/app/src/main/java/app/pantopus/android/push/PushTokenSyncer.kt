@file:Suppress("PackageNaming")

package app.pantopus.android.push

import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.notifications.NotificationsRepository
import com.google.firebase.messaging.FirebaseMessaging
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.tasks.await
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
}

/** Production implementation — delegates to FirebaseMessaging. */
@Singleton
class FirebaseFcmTokenProvider
    @Inject
    constructor() : FcmTokenProvider {
        override suspend fun currentToken(): String? =
            runCatching { FirebaseMessaging.getInstance().token.await() }
                .onFailure { Timber.w(it, "FirebaseMessaging.token failed") }
                .getOrNull()
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
 */
@Singleton
class PushTokenSyncer
    @Inject
    constructor(
        private val tokenProvider: FcmTokenProvider,
        private val repository: NotificationsRepository,
        private val ackStore: PushTokenAckStore,
    ) {
        /**
         * Reads the current FCM token, compares to the last ACK'd value,
         * and re-registers if they differ. Returns the [Outcome] so the
         * caller (or a unit test) can assert what happened.
         */
        suspend fun syncIfNeeded(): Outcome {
            val token = tokenProvider.currentToken()
            if (token.isNullOrBlank()) return Outcome.NoToken
            val lastAck = ackStore.lastAckedToken()
            if (lastAck == token) return Outcome.AlreadyAcked
            return when (val result = repository.registerPushToken(token = token, platform = "android")) {
                is NetworkResult.Success -> {
                    ackStore.markAcked(token)
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
