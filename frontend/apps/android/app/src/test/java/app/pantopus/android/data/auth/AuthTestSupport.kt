package app.pantopus.android.data.auth

import android.content.Context
import androidx.fragment.app.FragmentActivity
import app.pantopus.android.data.api.ApiService
import app.pantopus.android.data.api.models.auth.DeviceDescriptorDto
import app.pantopus.android.data.api.services.AuthApi
import app.pantopus.android.data.feed.FeedModerationStore
import app.pantopus.android.data.observability.Observability
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.push.FcmTokenProvider
import io.mockk.every
import io.mockk.mockk

/**
 * Shared test doubles for the persistent-login layer so `AuthRepositoryTest`,
 * `AuthRepositoryResumeTest` and friends build the repository the same way.
 */
object AuthTestSupport {
    /** A software P-256 key standing in for the Keystore device key. */
    fun deviceKey(): SoftwareSigningKey = SoftwareSigningKey(keyBacking = "tee")

    /**
     * [DeviceKeyStore] double: `existing()` / `getOrCreate()` hand back [key]
     * (or `null` / throw when [key] is null — "Keystore unavailable").
     */
    fun deviceKeyStore(key: DeviceSigningKey? = deviceKey()): DeviceKeyStore =
        mockk<DeviceKeyStore>(relaxed = true).also { store ->
            every { store.existing() } returns key
            if (key != null) {
                every { store.getOrCreate(any()) } returns key
                every { store.getOrCreate() } returns key
            } else {
                every { store.getOrCreate(any()) } throws IllegalStateException("no keystore")
                every { store.getOrCreate() } throws IllegalStateException("no keystore")
            }
        }

    /** [DeviceDescriptorProvider] double producing a fixed descriptor. */
    fun descriptors(
        deviceIdentity: DeviceIdentity,
        appVersion: String = "1.0.0 (1)",
    ): DeviceDescriptorProvider =
        mockk<DeviceDescriptorProvider>().also { provider ->
            every { provider.appVersion() } returns appVersion
            every { provider.hasOsLock() } returns true
            every { provider.descriptor(any()) } answers {
                DeviceDescriptorDto(
                    deviceId = deviceIdentity.deviceId(),
                    platform = "android",
                    installId = deviceIdentity.installId(),
                    name = "Pixel 8",
                    model = "Google Pixel 8",
                    osVersion = "15",
                    appVersion = appVersion,
                    hasOsLock = true,
                    keyBacking = firstArg(),
                    attestation = null,
                )
            }
        }

    /** Real [DeviceIdentity] on in-memory prefs. */
    fun deviceIdentity(prefs: InMemorySharedPreferences = InMemorySharedPreferences()): DeviceIdentity =
        DeviceIdentity(mockk<Context>(relaxed = true)).apply { prefsOverride = prefs }

    /** Real [TokenStorage] on in-memory prefs (migration already done). */
    fun tokenStorage(prefs: InMemorySharedPreferences = InMemorySharedPreferences()): TokenStorage =
        TokenStorage(mockk<Context>(relaxed = true)).apply {
            prefsOverride = prefs
            migrationCompleted = true
        }

    fun activity(): FragmentActivity = mockk(relaxed = true)

    /** In-memory [AccountHintStore]; `available = false` mimics a GMS-less device. */
    class FakeAccountHintStore(
        var available: Boolean = true,
        var payload: AccountHintPayload? = null,
    ) : AccountHintStore {
        var writes = 0
        var deletes = 0

        override suspend fun isAvailable(): Boolean = available

        override suspend fun read(): AccountHintPayload? = if (available) payload else null

        override suspend fun write(payload: AccountHintPayload) {
            if (!available) return
            writes++
            this.payload = payload.copy(issuedAt = 1L)
        }

        override suspend fun delete() {
            if (!available) return
            deletes++
            payload = null
        }
    }

    /** [PresenceVerifier] whose answers are scripted by the test. */
    class FakePresenceVerifier(
        var canVerify: Boolean = true,
        var outcome: PresenceVerifier.Outcome = PresenceVerifier.Outcome.Verified,
    ) : PresenceVerifier {
        var prompts = 0

        override fun canVerify(): Boolean = canVerify

        override suspend fun verifyPresence(
            activity: FragmentActivity,
            title: String,
            subtitle: String?,
        ): PresenceVerifier.Outcome {
            prompts++
            return outcome
        }
    }

    class FakeFcmTokenProvider(
        var token: String? = "fcm-token",
    ) : FcmTokenProvider {
        override suspend fun currentToken(): String? = token
    }

    /** Builds an [AuthRepository] with test doubles for everything not supplied. */
    @Suppress("LongParameterList")
    fun repository(
        api: ApiService = mockk(relaxed = true),
        authApi: AuthApi = mockk(relaxed = true),
        refreshApi: AuthApi = authApi,
        storage: TokenStorage = mockk(relaxed = true),
        obs: Observability = mockk(relaxed = true),
        socketManager: SocketManager = mockk(relaxed = true),
        feedModeration: FeedModerationStore = FeedModerationStore(),
        deviceIdentity: DeviceIdentity = deviceIdentity(),
        deviceKeyStore: DeviceKeyStore = deviceKeyStore(),
        stepUpKeyStore: StepUpKeyStore = mockk(relaxed = true),
        dpop: DPoPProofBuilder = DPoPProofBuilder(),
        descriptors: DeviceDescriptorProvider = descriptors(deviceIdentity),
        accountHints: AccountHintStore = FakeAccountHintStore(),
        presenceVerifier: PresenceVerifier = FakePresenceVerifier(),
        fcmTokenProvider: FcmTokenProvider = FakeFcmTokenProvider(),
    ): AuthRepository =
        AuthRepository(
            api = api,
            authApi = authApi,
            refreshApi = refreshApi,
            tokenStorage = storage,
            observability = obs,
            socketManager = socketManager,
            feedModeration = feedModeration,
            deviceIdentity = deviceIdentity,
            deviceKeyStore = deviceKeyStore,
            stepUpKeyStore = stepUpKeyStore,
            dpop = dpop,
            deviceDescriptors = descriptors,
            accountHints = accountHints,
            presenceVerifier = presenceVerifier,
            fcmTokenProvider = fcmTokenProvider,
        )
}
