# Android stage 1 — data/auth core (no UI)

Status: DONE (2026-08-18, third run) — stage 1 Android data/auth core complete, compiled, unit tests + ktlint + detekt green

Layer: /frontend/apps/android only.

## Plan
1. Gradle: play-services-auth-blockstore 16.4.0 — DONE (libs.versions.toml + app/build.gradle.kts)
2. New: DeviceKeyStore, StepUpKeyStore, DPoPProofBuilder, DeviceIdentity, AccountHintStore (+ EcKeyCodec, KeystoreBacking, PresenceVerifier, DeviceDescriptorProvider) — DONE
3. TokenStorage: expires_at / session_id / session_context (+ userId()) — DONE
4. AuthRepository: Resumable state, restore L1->L2->L3, resume(), refresh w/ DPoP(rth), codes -> SessionEndReason StateFlow, logout w/ proof, hints, registerDevice, step-up (password/device_key), enrolStepUpKey, revokeOtherSessions/revokeAllSessions/revokeDevice, confirmSessionRevoked, removeRememberedAccount, eraseAllLocalState — DONE
5. TokenAuthenticator code parsing; DeviceIdentityInterceptor (X-Client-Platform + X-Device-Id, both clients); AuthInterceptor pre-flight refresh; StepUpInterceptor + StepUpTokenProviderRegistry; NetworkModule — DONE
6. AuthApi + AuthDtos/DeviceAuthDtos (all CONTRACT endpoints + AuthErrorCodes + AuthErrorBodyParser) — DONE
7. backup rules exclude device_identity.xml — DONE
8. Unit tests — DONE, 105/105 green in data.auth (DPoPProofBuilderTest 8, DeviceIdentityTest 6, AuthRepositoryResumeTest 11, AuthRepositorySecurityTest 10, AccountHintStoreTest 6, AuthInterceptorsTest 7, TokenAuthenticatorTest 9, AuthRepositoryTest 38, TokenStorageTest 10)
9. push/PantopusMessagingService.kt: FCM rotation -> registerDevice(); `session_revoked` push -> confirmSessionRevoked() — DONE (small in-layer, non-UI)

## Files created/changed (on disk at resume, all uncommitted)
- gradle/libs.versions.toml — playServicesBlockstore = 16.4.0 + alias
- app/build.gradle.kts — implementation(libs.play.services.auth.blockstore)
- data/api/models/auth/AuthDtos.kt — modified (+37)
- data/api/models/auth/DeviceAuthDtos.kt — NEW
- data/api/services/AuthApi.kt — modified (+168)
- data/auth/AuthRepository.kt — modified (+704)
- data/auth/TokenStorage.kt — modified (+50)
- data/auth/AccountHintStore.kt — NEW
- data/auth/DPoPProofBuilder.kt — NEW
- data/auth/DeviceDescriptorProvider.kt — NEW
- data/auth/DeviceIdentity.kt — NEW
- data/auth/DeviceKeyStore.kt — NEW
- data/auth/EcKeyCodec.kt — NEW
- data/auth/KeystoreBacking.kt — NEW
- data/auth/PresenceVerifier.kt — NEW
- data/auth/StepUpKeyStore.kt — NEW

## Commands run
- run 2: `./gradlew :app:compileDebugKotlin` BUILD SUCCESSFUL (before tests were written)
- run 3: see progress log below

## Remaining (for stage 2 UI / later stages — NOT stage 1)
- ContinueAsScreen (+VM) wired to `AuthRepository.resume(activity)` / `useDifferentAccount()` / `removeRememberedAccount()`; PantopusNavHost `Resumable` branch currently degrades to PlaceLaunchHost (placeholder).
- RootViewModel: call `authRepository.refreshIfExpiringSoon()` on ON_START (design §9); show `sessionEndReason` banner once (`consumeSessionEndReason()`).
- LoginScreen prefill from `rememberedAccounts`; autofill ContentType.
- Step-up UI coordinator: register a `StepUpTokenProvider` in `StepUpTokenProviderRegistry.delegate` (uses `canStepUpWithDeviceKey()`, `stepUpWithDeviceKey(purpose, launcher)` w/ `AppLockManager.promptWithCrypto`, `stepUpWithPassword`); AccountDeleteSheet sends X-Step-Up (or relies on the interceptor).
- DevicesScreen (+VM) over `authApi.devices()`, `revokeDevice`, `revokeOtherSessions`, `revokeAllSessions`, security prefs/events.
- Instrumented DeviceKeyStoreTest / AccountHintStoreTest (GMS-guarded) — optional.

## Progress log (resumed run)
- Reviewed all on-disk files (AuthRepository, DeviceKeyStore, StepUpKeyStore, DPoPProofBuilder, DeviceIdentity, AccountHintStore, PresenceVerifier, DeviceDescriptorProvider, EcKeyCodec, KeystoreBacking, DeviceAuthDtos, AuthApi, AuthDtos, TokenStorage) — logic complete; nothing compiled yet.
- CHANGED data/auth/TokenAuthenticator.kt — AuthRejected now carries SessionEndReason -> signOut(reason); give-up branch peeks 401 body code.
- CHANGED data/auth/AuthInterceptor.kt — bearer + pre-flight refresh (expiresAt within 120 s, never for /refresh, never signs out itself); platform header moved to DeviceIdentityInterceptor.
- NEW data/auth/DeviceIdentityInterceptor.kt — X-Client-Platform + X-Device-Id on both clients.
- NEW data/auth/StepUpInterceptor.kt — StepUpTokenProvider (fun interface) + StepUpTokenProviderRegistry (@Singleton slot for the stage-2 UI coordinator) + 403 STEP_UP_REQUIRED retry-once interceptor.
- CHANGED di/NetworkModule.kt — identity interceptor on main + authRefresh clients; StepUpInterceptor on main client.
- CHANGED res/xml/backup_rules.xml + data_extraction_rules.xml — exclude sharedpref/device_identity.xml.
- CHANGED data/auth/PresenceVerifier.kt — prompt driven on Dispatchers.Main.immediate.
- CHANGED ui/screens/RootViewModel.kt + ui/navigation/PantopusNavHost.kt — minimal `is Resumable` branches (Resumable -> PlaceLaunchHost placeholder; stage 2 replaces with ContinueAsScreen) so the app compiles.
- RUN `./gradlew :app:compileDebugKotlin` (needs JAVA_HOME=zulu-17 + ANDROID_HOME=~/Library/Android/sdk): first run only 2 errors (non-exhaustive when over State) — fixed; recompiling.
- compileDebugKotlin: BUILD SUCCESSFUL (11 min cold).
- CHANGED AuthRepository.kt — refreshIfExpiringSoon ignores expiresAt<=0; restore() success now calls registerDevice() (fingerprint-gated re-registration on app update / FCM rotation).
- NEW tests: test/.../data/auth/SoftwareSigningKey.kt, InMemorySharedPreferences.kt (shared fake, TokenStorageTest switched to it), AuthTestSupport.kt (fakes + repository builder), DPoPProofBuilderTest.kt, DeviceIdentityTest.kt, AuthRepositoryResumeTest.kt.
- CHANGED tests: TokenStorageTest (+expires_at/session_id/session_context cases), AuthRepositoryTest (new ctor via AuthTestSupport, authApi.login+DPoP, AuthRejected data class, +logout proof/hint retention/refresh code/proactive refresh/register-device cases), TokenAuthenticatorTest (+code propagation, give-up branch peeks body).
- NEXT: run :app:testDebugUnitTest, then ktlintCheck + detekt.

## Progress log (third run, resumed)
- Re-read CONTRACT/design §9/WORKLOG/android.md/CLAUDE.md and every on-disk file in the layer (main + test). Also on disk but unlogged by run 2: test/.../AccountHintStoreTest.kt, AuthInterceptorsTest.kt.
- NEXT: compileDebugKotlin + compileDebugUnitTestKotlin + testDebugUnitTest; fix; ktlint/detekt.
- RUN `./gradlew :app:compileDebugUnitTestKotlin` → EXIT 0 (main + test sources compile).
- RUN `./gradlew :app:testDebugUnitTest --tests 'app.pantopus.android.data.auth.*'` → 97 tests, 1 failing (AuthInterceptorsTest "rotated pre-flight token wins": mockk default-arg matcher `refreshIfExpiringSoon()` recorded a fixed nowMillis). FIXED test → `refreshIfExpiringSoon(any())`.
- AuthInterceptorsTest re-run: 7/7 green.
- RUN `./gradlew ktlintCheck detekt` → ktlint: 4 main + 6 test long-line/wrapping violations; detekt: 14 issues (EcKeyCodec TooManyFunctions, ReturnCount in StepUpKeyStore.sign / StepUpInterceptor.intercept / AuthRepository.resume, SwallowedException x2 in StepUpKeyStore, test LargeClass/LongParameterList/MaxLineLength).
- FIXED: wrapped long lines (AuthRepository.kt fromCode + stepUpWithPassword, DPoPProofBuilder.refreshTokenHash, PresenceVerifier.canVerify, 5 test files); targeted @Suppress per repo convention (EcKeyCodec TooManyFunctions; ReturnCount on resume/intercept/sign; AuthRepositoryTest @file:Suppress LargeClass/LongParameterList); StepUpKeyStore.sign now logs the two previously-swallowed exceptions.
- CHANGED data/auth/DeviceKeyStore.kt — getOrCreate() regenerates (and rotates deviceId) ONLY when load() positively reports no usable key; a transient Keystore failure now propagates (callers already degrade: unbound login / refresh without proof / resume Transient) instead of rotating the device identity over a hiccup.
- NEXT: re-run ktlintCheck detekt, then full :app:testDebugUnitTest.
- ktlintCheck + detekt: BUILD SUCCESSFUL (after fixes above).
- CHANGED data/auth/AuthRepository.kt — added public `enrolStepUpKey(): Boolean` (interactive session + BIOMETRIC_STRONG + device key; used by the post-login auto-enrol), `revokeOtherSessions(stepUpToken): Int`, `revokeAllSessions(stepUpToken)` (Lockdown → local sign-out w/o /logout, hint kept, no banner), `revokeDevice(rowId, stepUpToken)`, `confirmSessionRevoked()` (silent `session_revoked` push → /refresh probe → sign out only on 401).
- CHANGED push/PantopusMessagingService.kt — onNewToken also runs `AuthRepository.registerDevice()` (fingerprint-gated re-link of the rotated FCM token); `data.type == "session_revoked"` → `confirmSessionRevoked()` instead of posting a notification (push is never the authority).
- NEW test/.../AuthRepositorySecurityTest.kt — device_key step-up gating (enrolled key + same user + interactive session), challenge signing + payload, cancelled/invalidated mapping, password step-up 401 → InvalidCredentials, revoke-others count, revoke-all local sign-out (no /logout, hint kept), revoke-all failure keeps session, confirmSessionRevoked (transient/rotated/401), enrolStepUpKey interactive-only.
- Full `:app:testDebugUnitTest` running (background) — result below.
- Full `./gradlew :app:testDebugUnitTest`: 3431 tests, 1 flaky failure unrelated to this layer (NearbyMapViewModelTest apply_category_filter — passed on retry, BUILD SUCCESSFUL).
- Fixed detekt ReturnCount in the new enrolStepUpKey(); removed 4 always-true warnings in TokenAuthenticatorTest.
- FINAL: `ktlintCheck detekt :app:compileDebugKotlin` BUILD SUCCESSFUL; data.auth unit tests 105/105 green.

## Notes for the next stages
- All new AuthRepository entry points are documented in-code; sealed results: `ResumeOutcome`, `StepUpResult`, `RefreshOutcome`; flows: `state`, `sessionEndReason`, `rememberedAccounts`, `lastInteractiveSignInAt`.
- Security invariants honoured: bindings only at issuance (`issuanceProof` in login/oauth/native + resume); `/refresh` DPoP carries `rth` and `deviceId/sessionId`; `/logout local` sends Bearer + refreshToken + DPoP(rth); resume sessions persisted as `restored`; `device_key` step-up gated on interactive-enrolled key AND interactive session (client) — server enforces too; DPoP key never user-auth-bound; step-up key `setUserAuthenticationRequired(true)` + BIOMETRIC_STRONG per-use + invalidated on enrolment change.
- DeviceKeyStore rotates `deviceId` whenever the key is (re)generated; transient Keystore failures propagate (no rotation).
- Block Store entry `pantopus.account_hint` JSON `{v:1, accounts[≤3], resumeGrant?, grantUserId?, issuedAt}`, `setShouldBackupToCloud(false)`; no-op without GMS.
