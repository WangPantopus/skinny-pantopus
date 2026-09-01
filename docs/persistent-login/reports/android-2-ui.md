# Android stage 2 — UI + wiring

Status: IN PROGRESS (2026-08-19, run 2 of stage 2 — resumed)

Layer: /frontend/apps/android only. Stage 1 (data/auth core) is DONE — see android-1-core.md.

## On-disk state at resume (run 2)
Verified with `git status --short frontend/apps/android` + reading every file. Run 1 of stage 2 had only landed:
- CHANGED core/security/AppLockManager.kt — prefs → EncryptedSharedPreferences `app_lock_prefs_secure` (lazy, one-shot
  migration from plain `app_lock_prefs`, plain fallback on Keystore failure; `prefsOverride` test seam);
  `verifyPresence(activity, reason): PresenceOutcome` (strict, no pass-through); `promptWithCrypto(activity, cryptoObject,
  reason, subtitle)` (BIOMETRIC_STRONG-only CryptoObject prompt on Main, shares app-lock bookkeeping) — this is the
  `StepUpKeyStore.PromptLauncher` for device_key step-up. (complete; compiled in this run, see below)
- CHANGED res/xml/backup_rules.xml + data_extraction_rules.xml — exclude sharedpref/app_lock_prefs_secure.xml.
- CHANGED data/auth/AuthRepository.kt — `stepUpWithDeviceKey` maps a 403 (`STEP_UP_REQUIRED`) to `StepUpResult.Unavailable`.
- NEW core/security/StepUpCoordinator.kt — @Singleton StepUpTokenProvider: device_key (via AppLockManager.promptWithCrypto)
  → password (verifySensitiveAction + in-app password sheet via `passwordRequest` StateFlow); attach/detach(activity);
  registers itself on StepUpTokenProviderRegistry. References `StepUpHost` / `StepUpPasswordSheet` which did NOT exist yet.
- NOT on disk: ContinueAsScreen/VM, DevicesScreen/VM, StepUpHost, LoginScreen changes, NavHost/RootViewModel changes,
  push deviceId, tests. PantopusNavHost still had `Resumable -> PlaceLaunchHost` placeholder.

## Plan (design §9 + CONTRACT)
1. ui/screens/auth/ContinueAsScreen.kt + ContinueAsViewModel.kt
2. PantopusNavHost Resumable -> ContinueAsScreen; RootViewModel refreshIfExpiringSoon() on ON_START; session-end banner
   routing; welcome-back toast; StepUpHost mounted in the signed-in branch
3. LoginScreen remembered-account prefill (hint holds maskedEmail only per CONTRACT → header + "Not you?"), autofill
   semantics on email/password, security-sign-out banner
4. ui/screens/settings/security/DevicesScreen.kt + DevicesViewModel.kt (GroupedList archetype); Settings index row;
   RootTabScreen route; AccountDeleteSheet flow sends X-Step-Up (password if account has one, else device_key)
5. core/security/StepUpHost.kt (password sheet for StepUpCoordinator)
6. PushTokenSyncer / PantopusMessagingService deviceId + /devices/register after token change
7. Tests: ContinueAsViewModelTest, DevicesViewModelTest, LoginViewModel prefill test, + update Privacy/Settings/PushTokenSyncer tests

## Files created/changed (run 2, appended as work proceeds)

## Commands run (run 2)
- RUN baseline `./gradlew :app:compileDebugKotlin` (JAVA_HOME=zulu-17, ANDROID_HOME=~/Library/Android/sdk) on the resumed tree → EXIT 0 (stage 1 + AppLockManager/StepUpCoordinator compile).
- NEW ui/screens/auth/ContinueAsViewModel.kt — UiState(hint, isResuming, isRemoving, errorMessage, sessionEndReason) combined from AuthRepository.state/sessionEndReason; autoContinue (one-shot), continueAs(activity) → AuthRepository.resume outcome mapping, useDifferentAccount, removeAccount, dismissSessionEndBanner.
- NEW ui/screens/auth/ContinueAsScreen.kt — card UI (avatar, Continue / Use a different account / Not you? Remove + confirm dialog, error row, SessionEndBanner shared composable); testTags auth.continueAs.*; auto-prompt once via LaunchedEffect.
- NEW core/security/StepUpHost.kt — StepUpHost(coordinator) attaches/detaches the Activity + renders StepUpPasswordSheet from coordinator.passwordRequest; tags stepUp.*
- CHANGED ui/screens/RootViewModel.kt — injects StepUpCoordinator (exposed), exposes sessionEndReason, onAppStart() → refreshIfExpiringSoon() when signed in.
- CHANGED ui/navigation/PantopusNavHost.kt — Resumable → ContinueAsScreen; ON_START observer → RootViewModel.onAppStart(); SignedOut → PlaceLaunchHost(openAuth = sessionEndReason != null); StepUpHost mounted in the signed-in AppLockHost branch; welcome-back toast (auth.welcomeBackToast) on Resumable → SignedIn.
- CHANGED ui/screens/auth/LoginViewModel.kt — UiState.rememberedAccount (from AuthRepository.rememberedAccounts.first) + sessionEndReason + lastUsedOAuthProvider; dismissSessionEndBanner(), forgetRememberedAccount(); banner consumed on successful password / OAuth sign-in.
- NEW ui/screens/auth/AuthAutofill.kt — Modifier.authAutofill(types, onFill) over Compose 1.7 AutofillNode/LocalAutofill (ContentType semantics need Compose 1.8; documented swap).
- CHANGED ui/screens/auth/LoginScreen.kt — SessionEndBanner (loginSessionEndBanner), RememberedAccountHeader (loginRememberedAccount + Not you? → forgetRememberedAccount), 'Last used' pill on the last OAuth method, authAutofill on email (EmailAddress+Username) and password fields.
- NEW data/auth/DevicesRepository.kt — safeApiCall wrappers: devices(), securityPrefs(), updateSecurityPrefs(prefs, stepUp), securityEvents(limit).
- NEW ui/screens/settings/security/DevicesViewModel.kt — GroupedList projection (thisDevice pinned / otherDevices / webSessions / security toggles / actions / activity), confirmation flow, removeDevice / signOutOthers / lockdown via StepUpCoordinator.obtainToken → AuthRepository.revoke*, optimistic prefs PATCH with change_security_prefs step-up, relativeTime/eventLabel/trust helpers; tags settings.devices.*
- NEW ui/screens/settings/security/DevicesScreen.kt — GroupedListScreen wrapper + confirm dialog (remove / sign out others / lockdown) + toast; tags settings.devices.root/confirm/toast.
- CHANGED ui/screens/settings/SettingsViewModels.kt — SettingsRoute.Devices + 'Security' group row 'Devices & sessions' (id devices, tag settings.devices.row) on the index.
- CHANGED ui/screens/root/RootTabScreen.kt — ChildRoutes.SETTINGS_DEVICES + composable → DevicesScreen; SettingsRoute.Devices nav.
- CHANGED data/api/services/AccountDeletionApi.kt + data/account/AccountDeletionRepository.kt — deleteAccount(stepUpToken?) sends X-Step-Up.
- CHANGED ui/screens/settings/SettingsViewModels.kt (PrivacySettingsViewModel) — injects StepUpCoordinator + AccountRepository; confirmDeleteAccount → authMethods().hasPassword → obtainToken(delete_account, methods password|device_key) → deleteAccount(token) → eraseAllLocalState().
- CHANGED data/api/models/feed/FeedDtos.kt (RegisterPushTokenRequest.deviceId), data/notifications/NotificationsRepository.kt (registerPushToken deviceId param), push/PushTokenSyncer.kt (DeviceIdentity + Lazy<AuthRepository>; sends deviceId; /devices/register after a (re)registration), push/PantopusMessagingService.kt (deviceId on onNewToken registration; session_revoked + registerDevice already from stage 1).
- RUN :app:compileDebugKotlin after UI wiring → EXIT 0 (main sources compile).
- CHANGED test/.../LoginViewModelTest.kt — repo stub now provides rememberedAccounts/sessionEndReason flows; +4 prefill/banner tests.
- CHANGED tests: PrivacyViewModelTest (ctor + 4 step-up deletion tests), PrivacySnapshotTest (ctor), SettingsViewModelsTest (security group), PushTokenSyncerTest (deviceId + registerDevice).
- NEW test/.../ui/screens/auth/ContinueAsViewModelTest.kt (10 tests), test/.../ui/screens/settings/security/DevicesViewModelTest.kt (16 tests).
