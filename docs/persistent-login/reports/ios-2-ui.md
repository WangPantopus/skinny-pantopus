# iOS stage 2 — UI + entitlements + wiring

Status: IN PROGRESS (run 2 of stage 2, 2026-08-19)

Layer: `frontend/apps/ios` only. Stage 1 (core) is DONE — see ios-1-core.md.

## On-disk state at start of run 2
- `git status` for frontend/apps/ios shows only the stage-1 files (Core/**, tests, App/PantopusApp.swift placeholder, project.yml applinks). Run 1 of stage 2 wrote nothing but the plan below — no Features/Auth/ContinueAs*, no Features/Settings/Security/*, no entitlements webcredentials, no LoginView / Privacy / Settings changes.
- Stage-1 hooks available (verified by reading the code): `AuthManager.State.resumable(AccountHint)`, `resume() -> ResumeOutcome`, `removeRememberedAccount()`, `rememberedAccounts`, `sessionEndReason?.message`, `stepUpPasswordPrompt` (nil until the root UI sets it), `stepUp(purpose:methods:)`, `canStepUpWithDeviceKey`, `signOut(scope:stepUpToken:)`, `AuthEndpoints.devices / revokeDevice / revokeOtherSessions / revokeAllSessions / securityPrefs / updateSecurityPrefs / securityEvents`, `APIClient.registerPushToken` already sends `deviceId` and calls `auth.pushTokenDidChange` (AppDelegate item is done in stage 1).

## Plan
1. Features/Auth/ContinueAsView.swift + ContinueAsViewModel.swift
2. Features/Auth/StepUpPasswordPrompt.swift (own-window password sheet → `AuthManager.stepUpPasswordPrompt`)
3. App/PantopusApp.swift RootView `.resumable` → ContinueAsView; install the step-up password prompt
4. Features/Auth/LoginView.swift: remembered-account card (hint only carries maskedEmail → placeholder + welcome-back, AutoFill via `.username`), security banner
5. Features/Settings/Security/DevicesView.swift + DevicesViewModel.swift + Settings row/route
6. PrivacyViewModel: password-first step-up before DELETE /account (X-Step-Up)
7. Core/Networking/Models/Settings/SettingsDTOs.swift: AuthMethodsResponse accepts `hasPassword` (backend's real key) and legacy `has_password`
8. Core/Routing/DeepLinkRouter.swift: `requestLoginPresentation()`
9. Entitlements + project.yml + Info.plist NSFaceIDUsageDescription
10. Tests: ContinueAsViewModelTests, DevicesViewModelTests, LoginViewModel prefill test, Privacy step-up test
11. make build / make test / make lint

## Files created / changed (appended live)
- (none yet this run)

## Commands run
- (none yet this run)
- NEW Features/Auth/ContinueAsViewModel.swift — @Observable VM: hint, phase (idle/resuming/removing), errorMessage, securityMessage, wantsDifferentAccount; continueSignedIn(using:) → auth.resume() outcome mapping; useDifferentAccount(); removeAccount(using:).
- NEW Features/Auth/ContinueAsView.swift — card (avatar/initials, headline, masked email, Continue, Use a different account, Not you? Remove, security banner, error line); ids auth.continueAs.{avatar,name,email,continue,differentAccount,remove,securityBanner,error}; "Use a different account" swaps to PlaceLaunchHost.
- CHANGED Core/Routing/DeepLinkRouter.swift — requestLoginPresentation() (sets prefersLoginPresentation so PlaceLaunchHost opens the Sign-in cover).
- NEW Features/Auth/StepUpPasswordPrompt.swift — StepUpPasswordPrompter (own UIWindow at .alert level, CheckedContinuation ask(purpose:) -> String?) + StepUpPasswordSheet (ids auth.stepUp.{passwordSheet,passwordField,cancel,confirm}); purpose copy.
- CHANGED App/PantopusApp.swift — RootView `.resumable(hint)` → ContinueAsView(hint:sessionEndReason:) (.id(userId)); installStepUpPrompt() on appear wires AuthManager.stepUpPasswordPrompt → StepUpPasswordPrompter.shared.ask. (`.active` → refreshIfExpiringSoon and AppLock Keychain pref were already done in stage 1.)
- CHANGED App/AppDelegate.swift — comment only: deviceId + re-register on APNs change live in APIClient.registerPushToken (stage 1).
- CHANGED Features/Auth/LoginView.swift — LoginViewModel.prepare(using:) (rememberedAccount + securityMessage), emailPlaceholder (masked email), lastUsedOAuthProvider, forgetRememberedAccount(using:), dismissSecurityMessage(); email field contentType .username; RememberedAccountCard (ids loginRememberedAccount{,Name,Email,Remove}); SecuritySignOutBanner (loginSecurityBanner); OAuthButtonGroup.lastUsed 'Last used' chip (<id>LastUsed).
- NEW Features/Settings/Security/DevicesViewModel.swift — State loading/empty(Content)/loaded(Content)/error; fetch devices+prefs; requestRemove/removeDevice (step-up revoke_device → DELETE), signOutOtherDevices (revoke_sessions → revoke-others), lockdown (revoke-all → auth.signOut()), setAllowRestoreGrants/setNewDeviceEmail (optimistic, change_security_prefs token reused 4 min, PATCH only changed key); stepUpProvider injectable; presentation helpers (displayName/detailLine/lastSeen/sessionTitle/trust/eventTitle).
- CHANGED Core/Networking/Models/Auth/AuthDeviceDTOs.swift — AuthSecurityEventDTO memberwise public init (local timeline rows / tests).
- NEW Features/Settings/Security/DevicesView.swift — SettingsTopBar + SensitiveScreenGuard; skeleton/empty/loaded/error; List sections This device / Other devices (swipe + trash Remove) / Web sessions / Sign out (others, Lockdown) / Security settings (toggles) / Recent activity; confirmation dialogs; toast; ids settings.security.*
- CHANGED Features/Settings/SettingsView.swift + SettingsViewModels.swift — SettingsStackRoute.securityDevices / SettingsRoute.securityDevices; index Account group row 'Security & devices' (id securityDevices, a11y settingsSecurityDevicesRow) → DevicesView.
- CHANGED Core/Networking/Models/Settings/SettingsDTOs.swift — AuthMethodsResponse decodes camelCase hasPassword/twoFactorEnabled (what users.js:1887 actually sends) and the legacy snake_case keys; memberwise init.
- CHANGED Features/Settings/Privacy/PrivacyViewModel.swift — confirmDeleteAccount: obtainDeleteStepUp() (GET auth-methods → hasPassword ⇒ methods [password], else AuthManager picks; .unavailable ⇒ nil ⇒ legacy local gate), DELETE /account with X-Step-Up via AuthMethodsEndpoints.deleteAccount(stepUpToken:); stepUpProvider injectable; message(forStepUp:).
- CHANGED Core/Networking/Endpoints/SettingsEndpoints.swift — deleteAccount(stepUpToken:) helper.
- CHANGED project.yml — associated-domains += webcredentials:{pantopus.com,www.pantopus.com,pantopus.app,www.pantopus.app} (applinks pantopus.com already re-added in stage 1); NSFaceIDUsageDescription mentions continuing signed in.
- CHANGED Pantopus/Resources/Pantopus.entitlements — same four webcredentials entries (applinks pantopus.com present).
- CHANGED Pantopus/Resources/Info.plist — NSFaceIDUsageDescription updated (xcodegen regenerates it from project.yml).
- NEW PantopusTests/Features/Auth/ContinueAsViewModelTests.swift (11 tests), NEW PantopusTests/Features/Settings/DevicesViewModelTests.swift (18 tests), CHANGED PantopusTests/LoginViewModelTests.swift (+3 prefill/security tests).
- CHANGED PantopusTests/Features/Settings/PrivacyViewModelTests.swift (+5 delete-account step-up tests).
- (run 2) make bootstrap → xcodegen OK; regenerated Pantopus.entitlements/Info.plist match the hand edits (git diff = only the intended lines).
