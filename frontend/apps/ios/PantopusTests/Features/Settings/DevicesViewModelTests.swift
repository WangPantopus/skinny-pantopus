//
//  DevicesViewModelTests.swift
//  PantopusTests
//
//  Settings → Security & devices: the registry projection (`GET
//  /api/auth/devices` + `/security-prefs`), the four render states, and
//  every step-up-gated mutation (remove device, sign out others, lockdown,
//  preference toggles) over `SequencedURLProtocol`. Step-up is injected
//  (`stepUpProvider`) so the tests assert the token reaches the wire as
//  `X-Step-Up` without a Secure Enclave or a password sheet.
//

// swiftlint:disable type_body_length

import XCTest
@testable import Pantopus

@MainActor
final class DevicesViewModelTests: XCTestCase {
    private var store: InMemorySecureStore!
    private var markerDirectory: URL!

    override func setUpWithError() throws {
        try super.setUpWithError()
        SequencedURLProtocol.reset()
        store = InMemorySecureStore()
        markerDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("devices-vm-tests-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDownWithError() throws {
        SequencedURLProtocol.reset()
        try? FileManager.default.removeItem(at: markerDirectory)
        try super.tearDownWithError()
    }

    // MARK: - Fixtures

    private static let devicesJSON = """
    {"devices":[
      {"id":"row-other","deviceId":"dev-other","platform":"android","name":"Pixel 8","model":"Pixel 8","osVersion":"15",
       "appVersion":"1.4.0 (20)","isCurrent":false,"trustLevel":"unverified","trustedAt":null,
       "lastSeenAt":"2026-08-17T10:00:00Z","lastIp":"10.0.0.2","createdAt":"2026-08-01T10:00:00Z"},
      {"id":"row-current","deviceId":"dev-current","platform":"ios","name":"Ying's iPhone","model":"iPhone16,2",
       "osVersion":"18.5","appVersion":"1.4.0 (312)","isCurrent":true,"trustLevel":"trusted",
       "trustedAt":"2026-08-10T10:00:00Z","lastSeenAt":"2026-08-18T10:00:00Z","lastIp":"10.0.0.1",
       "createdAt":"2026-08-01T10:00:00Z"}
    ],
    "sessions":[
      {"id":"web-1","platform":"web",
       "userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
       "isCurrent":false,"lastSeenAt":"2026-08-18T09:00:00Z","issuedAt":"2026-08-18T08:00:00Z"}
    ],
    "events":[
      {"id":12,"type":"login","createdAt":"2026-08-18T10:00:00Z","deviceId":"row-current","meta":{"platform":"ios"}},
      {"id":11,"type":"refresh_reuse","createdAt":"2026-08-17T10:00:00Z","deviceId":null,"meta":null}
    ]}
    """

    private static let prefsJSON = "{\"allowRestoreGrants\":true,\"newDeviceEmail\":true}"

    private func stubRegistry(devices: String = devicesJSON, prefs: String? = prefsJSON) {
        SequencedURLProtocol.routeResponses["/api/auth/devices"] = [.status(200, body: devices)]
        if let prefs {
            SequencedURLProtocol.routeResponses["/api/auth/security-prefs"] = [.status(200, body: prefs)]
        }
    }

    private func makeClient() -> APIClient {
        APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    private func makeSignedInAuth(client: APIClient) throws -> AuthManager {
        let manager = AuthManager(
            store: store,
            apiClient: client,
            installMarker: InstallMarker(directory: markerDirectory),
            presenceGate: FakePresenceGate(.verified),
            allowSecureEnclave: false
        )
        try store.set("at", for: SecureStoreKey.accessToken)
        try store.set("rt", for: SecureStoreKey.refreshToken)
        try store.set("u_123", for: SecureStoreKey.userId)
        _ = try DeviceIdentity.loadOrCreate(in: store, allowSecureEnclave: false)
        manager.setAccessToken("at")
        manager.setState(.signedIn(UserDTO(id: "u_123", email: "alice@example.com", displayName: "Alice", avatarURL: nil)))
        return manager
    }

    /// A view-model whose step-up returns `token` (or throws `error`) and
    /// records the purposes it was asked for.
    private func makeViewModel(
        token: String = "su-token",
        error: StepUpError? = nil
    ) throws -> Harness {
        let client = makeClient()
        let auth = try makeSignedInAuth(client: client)
        let viewModel = DevicesViewModel(api: client, auth: auth)
        let log = PurposeLog()
        viewModel.stepUpProvider = { purpose in
            log.purposes.append(purpose)
            if let error { throw error }
            return token
        }
        return Harness(viewModel: viewModel, auth: auth, log: log)
    }

    /// View-model + the manager behind it + the purposes step-up was asked
    /// for — a struct rather than a tuple (SwiftLint `large_tuple`).
    private struct Harness {
        let viewModel: DevicesViewModel
        let auth: AuthManager
        let log: PurposeLog
    }

    final class PurposeLog {
        var purposes: [StepUpPurpose] = []
    }

    private func loadedContent(_ vm: DevicesViewModel, file: StaticString = #filePath, line: UInt = #line) -> DevicesViewModel.Content? {
        switch vm.state {
        case let .loaded(content): return content
        default:
            XCTFail("Expected .loaded, got \(vm.state)", file: file, line: line)
            return nil
        }
    }

    // MARK: - Load / states

    func testLoadPinsCurrentDeviceFirstAndReadsPrefs() async throws {
        stubRegistry()
        let vm = try makeViewModel().viewModel
        XCTAssertEqual(vm.state, .loading)

        await vm.load()

        let content = try XCTUnwrap(loadedContent(vm))
        XCTAssertEqual(content.devices.map(\.id), ["row-current", "row-other"], "current device pinned first")
        XCTAssertEqual(content.currentDevice?.id, "row-current")
        XCTAssertEqual(content.otherDevices.map(\.id), ["row-other"])
        XCTAssertEqual(content.sessions.map(\.id), ["web-1"])
        XCTAssertEqual(content.events.map(\.id), ["12", "11"])
        XCTAssertEqual(content.prefs, SecurityPrefs(allowRestoreGrants: true, newDeviceEmail: true))
        XCTAssertTrue(content.hasOtherSessions)
        let devicesCall = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/auth/devices").first)
        XCTAssertEqual(devicesCall.httpMethod, "GET")
        XCTAssertEqual(devicesCall.value(forHTTPHeaderField: "Authorization"), "Bearer at")
    }

    func testPrefsFailureStillLoadsTheRegistry() async throws {
        stubRegistry(prefs: nil)
        SequencedURLProtocol.routeResponses["/api/auth/security-prefs"] = [.status(500, body: "{\"error\":\"x\"}")]
        let vm = try makeViewModel().viewModel

        await vm.load()

        let content = try XCTUnwrap(loadedContent(vm))
        XCTAssertNil(content.prefs, "toggles render disabled")
        XCTAssertEqual(content.devices.count, 2)
    }

    func testEmptyRegistryIsTheEmptyState() async throws {
        stubRegistry(devices: "{\"devices\":[],\"sessions\":[],\"events\":[]}")
        let vm = try makeViewModel().viewModel

        await vm.load()

        guard case let .empty(content) = vm.state else { return XCTFail("Expected .empty, got \(vm.state)") }
        XCTAssertTrue(content.devices.isEmpty)
        XCTAssertFalse(content.hasOtherSessions)
        XCTAssertNotNil(content.prefs, "actions + preferences still render")
    }

    func testLoadFailureIsTheErrorStateAndRetryRecovers() async throws {
        SequencedURLProtocol.routeResponses["/api/auth/devices"] = [
            .status(500, body: "{\"error\":\"Could not load devices\"}"),
            .status(200, body: Self.devicesJSON)
        ]
        SequencedURLProtocol.routeResponses["/api/auth/security-prefs"] = [
            .status(200, body: Self.prefsJSON),
            .status(200, body: Self.prefsJSON)
        ]
        let vm = try makeViewModel().viewModel

        await vm.load()
        guard case .error = vm.state else { return XCTFail("Expected .error, got \(vm.state)") }

        await vm.load()
        XCTAssertNotNil(loadedContent(vm))
    }

    func testRefreshFailureKeepsContentAndToasts() async throws {
        stubRegistry()
        let vm = try makeViewModel().viewModel
        await vm.load()
        SequencedURLProtocol.routeResponses["/api/auth/devices"] = [.status(503, body: "{\"error\":\"down\"}")]
        SequencedURLProtocol.routeResponses["/api/auth/security-prefs"] = [.status(200, body: Self.prefsJSON)]

        await vm.refresh()

        XCTAssertNotNil(loadedContent(vm), "stale content stays")
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    // MARK: - Remove a device

    func testRemoveDeviceStepsUpThenDeletesWithHeaderAndReloads() async throws {
        stubRegistry()
        let harness = try makeViewModel(token: "su-revoke")
        let (vm, log) = (harness.viewModel, harness.log)
        await vm.load()
        let other = try XCTUnwrap(loadedContent(vm)?.otherDevices.first)
        SequencedURLProtocol.routeResponses["/api/auth/devices/row-other"] = [.status(200, body: "{\"ok\":true,\"revokedSessions\":1}")]
        // The reload after the delete.
        SequencedURLProtocol.routeResponses["/api/auth/devices"] = [.status(200, body: Self.devicesJSON)]
        SequencedURLProtocol.routeResponses["/api/auth/security-prefs"] = [.status(200, body: Self.prefsJSON)]

        vm.requestRemove(other)
        XCTAssertEqual(vm.deviceToRemove?.id, "row-other", "confirmation first")
        await vm.removeDevice(other)

        XCTAssertEqual(log.purposes, [.revokeDevice])
        XCTAssertNil(vm.deviceToRemove)
        XCTAssertNil(vm.revokingDeviceId)
        let delete = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/auth/devices/row-other").first)
        XCTAssertEqual(delete.httpMethod, "DELETE")
        XCTAssertEqual(delete.value(forHTTPHeaderField: "X-Step-Up"), "su-revoke")
        XCTAssertEqual(delete.value(forHTTPHeaderField: "Authorization"), "Bearer at")
        XCTAssertEqual(vm.toast?.text, "Pixel 8 was signed out.")
        XCTAssertEqual(vm.toast?.kind, .success)
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/auth/devices").count, 2, "reloaded after the delete")
    }

    func testCurrentDeviceIsNeverRemovable() async throws {
        stubRegistry()
        let harness = try makeViewModel()
        let (vm, log) = (harness.viewModel, harness.log)
        await vm.load()
        let current = try XCTUnwrap(loadedContent(vm)?.currentDevice)

        vm.requestRemove(current)
        XCTAssertNil(vm.deviceToRemove)
        await vm.removeDevice(current)

        XCTAssertTrue(log.purposes.isEmpty)
        XCTAssertTrue(SequencedURLProtocol.captured(path: "/api/auth/devices/row-current").isEmpty)
    }

    func testRemoveDeviceCancelledStepUpSendsNothingSilently() async throws {
        stubRegistry()
        let harness = try makeViewModel(error: .cancelled)
        let (vm, log) = (harness.viewModel, harness.log)
        await vm.load()
        let other = try XCTUnwrap(loadedContent(vm)?.otherDevices.first)

        await vm.removeDevice(other)

        XCTAssertEqual(log.purposes, [.revokeDevice])
        XCTAssertNil(vm.toast, "a user cancel is silent")
        XCTAssertTrue(SequencedURLProtocol.captured(path: "/api/auth/devices/row-other").isEmpty)
        XCTAssertEqual(loadedContent(vm)?.otherDevices.count, 1, "row stays")
    }

    func testRemoveDeviceWrongPasswordToastsAndSendsNothing() async throws {
        stubRegistry()
        let vm = try makeViewModel(error: .invalidPassword).viewModel
        await vm.load()
        let other = try XCTUnwrap(loadedContent(vm)?.otherDevices.first)

        await vm.removeDevice(other)

        XCTAssertEqual(vm.toast?.text, "Incorrect password. Try again.")
        XCTAssertEqual(vm.toast?.kind, .error)
        XCTAssertTrue(SequencedURLProtocol.captured(path: "/api/auth/devices/row-other").isEmpty)
    }

    func testRemoveDeviceServerRefusalSurfacesMessage() async throws {
        stubRegistry()
        let vm = try makeViewModel().viewModel
        await vm.load()
        let other = try XCTUnwrap(loadedContent(vm)?.otherDevices.first)
        SequencedURLProtocol.routeResponses["/api/auth/devices/row-other"] = [
            .status(409, body: "{\"error\":\"Device already removed\",\"code\":\"CONFLICT\"}")
        ]

        await vm.removeDevice(other)

        XCTAssertEqual(vm.toast?.kind, .error)
        XCTAssertEqual(vm.toast?.text, "Device already removed")
    }

    // MARK: - Sign out others / lockdown

    func testSignOutOtherDevicesStepsUpAndPostsWithHeader() async throws {
        stubRegistry()
        let harness = try makeViewModel(token: "su-others")
        let (vm, log) = (harness.viewModel, harness.log)
        await vm.load()
        SequencedURLProtocol.routeResponses["/api/auth/sessions/revoke-others"] = [.status(200, body: "{\"revoked\":2}")]
        SequencedURLProtocol.routeResponses["/api/auth/devices"] = [.status(200, body: Self.devicesJSON)]
        SequencedURLProtocol.routeResponses["/api/auth/security-prefs"] = [.status(200, body: Self.prefsJSON)]

        vm.isSignOutOthersConfirmPresented = true
        await vm.signOutOtherDevices()

        XCTAssertEqual(log.purposes, [.revokeSessions])
        XCTAssertFalse(vm.isSignOutOthersConfirmPresented)
        XCTAssertFalse(vm.isSigningOutOthers)
        let post = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/auth/sessions/revoke-others").first)
        XCTAssertEqual(post.httpMethod, "POST")
        XCTAssertEqual(post.value(forHTTPHeaderField: "X-Step-Up"), "su-others")
        XCTAssertEqual(vm.toast?.text, "Signed out of 2 other sessions.")
    }

    func testLockdownRevokesAllThenSignsThisDeviceOut() async throws {
        stubRegistry()
        let harness = try makeViewModel(token: "su-all")
        let (vm, auth, log) = (harness.viewModel, harness.auth, harness.log)
        await vm.load()
        SequencedURLProtocol.routeResponses["/api/auth/sessions/revoke-all"] = [.status(200, body: "{\"ok\":true}")]
        SequencedURLProtocol.routeResponses["/api/users/logout"] = [.status(200, body: "{\"success\":true}")]

        await vm.lockdown()
        await auth.awaitBackgroundWork()

        XCTAssertEqual(log.purposes, [.revokeSessions])
        let post = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/auth/sessions/revoke-all").first)
        XCTAssertEqual(post.value(forHTTPHeaderField: "X-Step-Up"), "su-all")
        guard case .signedOut = auth.state else { return XCTFail("Expected .signedOut, got \(auth.state)") }
        XCTAssertNil(store.get(SecureStoreKey.accessToken))
        XCTAssertFalse(vm.isLockingDown)
    }

    func testLockdownFailureKeepsSessionAndToasts() async throws {
        stubRegistry()
        let harness = try makeViewModel()
        let (vm, auth) = (harness.viewModel, harness.auth)
        await vm.load()
        SequencedURLProtocol.routeResponses["/api/auth/sessions/revoke-all"] = [
            .status(500, body: "{\"error\":\"Could not sign out everywhere\"}")
        ]

        await vm.lockdown()

        guard case .signedIn = auth.state else { return XCTFail("Session must survive a failed lockdown") }
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    // MARK: - Security preferences

    func testToggleNewDeviceEmailPatchesOnlyThatKeyWithStepUp() async throws {
        stubRegistry()
        let harness = try makeViewModel(token: "su-prefs")
        let (vm, log) = (harness.viewModel, harness.log)
        await vm.load()
        SequencedURLProtocol.routeResponses["/api/auth/security-prefs"] = [
            .status(200, body: "{\"allowRestoreGrants\":true,\"newDeviceEmail\":false}")
        ]

        await vm.setNewDeviceEmail(false)

        XCTAssertEqual(log.purposes, [.changeSecurityPrefs])
        let patch = try XCTUnwrap(SequencedURLProtocol.capturedRequests.last { $0.httpMethod == "PATCH" })
        XCTAssertEqual(patch.url?.path, "/api/auth/security-prefs")
        XCTAssertEqual(patch.value(forHTTPHeaderField: "X-Step-Up"), "su-prefs")
        let body = try XCTUnwrap(patch.authTestJSONBody())
        XCTAssertEqual(body["newDeviceEmail"] as? Bool, false)
        XCTAssertNil(body["allowRestoreGrants"], "only the changed key — the schema rejects unknown/extra keys")
        XCTAssertEqual(loadedContent(vm)?.prefs, SecurityPrefs(allowRestoreGrants: true, newDeviceEmail: false))
        XCTAssertEqual(vm.toast?.text, "Security settings updated.")
        XCTAssertFalse(vm.isSavingPrefs)
    }

    func testPrefsStepUpTokenIsReusedWithinItsWindow() async throws {
        stubRegistry()
        let harness = try makeViewModel(token: "su-prefs")
        let (vm, log) = (harness.viewModel, harness.log)
        let clock = Date(timeIntervalSince1970: 1_755_500_000)
        vm.now = { clock }
        await vm.load()
        SequencedURLProtocol.routeResponses["/api/auth/security-prefs"] = [
            .status(200, body: "{\"allowRestoreGrants\":true,\"newDeviceEmail\":false}"),
            .status(200, body: "{\"allowRestoreGrants\":false,\"newDeviceEmail\":false}")
        ]

        await vm.setNewDeviceEmail(false)
        await vm.setAllowRestoreGrants(false)

        XCTAssertEqual(log.purposes, [.changeSecurityPrefs], "one prompt covers the burst")
        let patches = SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "PATCH" }
        XCTAssertEqual(patches.count, 2)
        XCTAssertEqual(patches.last?.value(forHTTPHeaderField: "X-Step-Up"), "su-prefs")
        XCTAssertEqual(loadedContent(vm)?.prefs, SecurityPrefs(allowRestoreGrants: false, newDeviceEmail: false))
    }

    func testPrefsPatchFailureRollsBack() async throws {
        stubRegistry()
        let vm = try makeViewModel().viewModel
        await vm.load()
        SequencedURLProtocol.routeResponses["/api/auth/security-prefs"] = [
            .status(500, body: "{\"error\":\"Could not save security preferences\"}")
        ]

        await vm.setAllowRestoreGrants(false)

        XCTAssertEqual(loadedContent(vm)?.prefs?.allowRestoreGrants, true, "rolled back")
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    func testPrefsToggleCancelledStepUpRollsBackSilently() async throws {
        stubRegistry()
        let vm = try makeViewModel(error: .cancelled).viewModel
        await vm.load()

        await vm.setNewDeviceEmail(false)

        XCTAssertEqual(loadedContent(vm)?.prefs?.newDeviceEmail, true)
        XCTAssertNil(vm.toast)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "PATCH" }.isEmpty)
    }

    // MARK: - Presentation helpers

    func testPresentationHelpers() throws {
        let data = Data(Self.devicesJSON.utf8)
        let registry = try JSONDecoder().decode(AuthDevicesResponse.self, from: data)
        let current = try XCTUnwrap(registry.devices.first { $0.isCurrent == true })
        let other = try XCTUnwrap(registry.devices.first { $0.isCurrent != true })
        XCTAssertEqual(DevicesViewModel.displayName(for: current), "Ying's iPhone")
        XCTAssertEqual(DevicesViewModel.detailLine(for: current), "iPhone16,2 · iOS 18.5 · Pantopus 1.4.0 (312)")
        XCTAssertEqual(DevicesViewModel.detailLine(for: other), "Android 15 · Pantopus 1.4.0 (20)", "model == name is not repeated")
        XCTAssertEqual(DevicesViewModel.lastSeenLabel(for: current), "This device · active now")
        XCTAssertTrue(DevicesViewModel.lastSeenLabel(for: other).hasPrefix("Last active "))
        XCTAssertEqual(DevicesViewModel.trustTone("trusted"), .trusted)
        XCTAssertEqual(DevicesViewModel.trustLabel("suspect"), "Suspicious")
        XCTAssertEqual(DevicesViewModel.trustTone(nil), .unknown)
        let web = try XCTUnwrap(registry.sessions.first)
        XCTAssertEqual(DevicesViewModel.sessionTitle(for: web), "Chrome on macOS")
        XCTAssertEqual(DevicesViewModel.eventTitle("refresh_reuse"), "Token reuse blocked")
        XCTAssertEqual(DevicesViewModel.eventTitle("some_new_type"), "Some New Type")
        XCTAssertTrue(DevicesViewModel.isSecurityEvent("device_mismatch"))
        XCTAssertFalse(DevicesViewModel.isSecurityEvent("login"))
        let login = try XCTUnwrap(registry.events.first)
        XCTAssertEqual(DevicesViewModel.eventDetail(login, devices: registry.devices), "Ying's iPhone", "resolved through deviceId")
        XCTAssertEqual(DevicesViewModel.relative(Date(timeIntervalSinceNow: -10), now: Date()), "just now")
    }

    /// CONTRACT conformance: every `AuthSecurityEvent.type` the backend writes
    /// must have copy, or the activity list renders raw snake_case. Source =
    /// the `authSessionService.recordSecurityEvent` call sites in
    /// `backend/services/{authDeviceService,authNotifyService}.js` and
    /// `backend/routes/{authDevices,users}.js`. Mirrored by the Android and
    /// web label maps.
    func testEveryBackendEventTypeHasCopy() {
        let backendEventTypes = [
            "login",
            "logout",
            "resume",
            "refresh_reuse",
            "device_mismatch",
            "device_revoked",
            "session_revoked",
            "inactivity_expired",
            "step_up",
            "step_up_key_enrolled",
            "security_prefs_changed",
            "revoke_others",
            "lockdown",
            "password_changed",
            "password_reset",
            "account_deleted",
            "new_device_email_sent",
            "device_removed_email_sent",
            "password_changed_email_sent",
            "security_signout_email_sent",
            "lockdown_email_sent"
        ]
        for type in backendEventTypes {
            let title = DevicesViewModel.eventTitle(type)
            XCTAssertFalse(title.contains("_"), "no copy for security event `\(type)`")
            XCTAssertNotEqual(title, type, "no copy for security event `\(type)`")
        }
        // No dead keys: every mapped type must be one the backend emits.
        for key in DevicesViewModel.eventTitles.keys {
            XCTAssertTrue(backendEventTypes.contains(key), "`\(key)` is never emitted by the backend")
        }
    }
}
