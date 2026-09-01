//
//  PrivacyViewModelTests.swift
//  PantopusTests
//
//  P7.6 / A14.7 — the reshaped Privacy matrix. Covers the defaults +
//  stealth frames, the RadioCard / fuzz / activity / data projection,
//  the stealth banner, optimistic radio / toggle / fuzz mutations, and
//  the helper-line parity contract (mirrored on Android).
//
//  T1 adds the backend-backed surfaces: the search-privacy card wired to
//  `GET/PATCH /api/privacy/settings`, and the delete-account gate in
//  front of `DELETE /api/users/account`.
//

// swiftlint:disable type_body_length file_length

import XCTest
@testable import Pantopus

@MainActor
final class PrivacyViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    /// `GET /api/privacy/settings` body the happy-path frames load from.
    private func stubSettings(searchVisibility: String = "everyone", findableByName: Bool = false) {
        SequencedURLProtocol.routeResponses["/api/privacy/settings"] = [
            .status(200, body: settingsBody(searchVisibility, findableByName))
        ]
    }

    private func settingsBody(_ visibility: String, _ findable: Bool) -> String {
        """
        {"settings":{"user_id":"u1","search_visibility":"\(visibility)",
        "findable_by_name":\(findable ? "true" : "false")}}
        """
    }

    private func makeViewModel(variant: PrivacySettingsViewModel.Variant = .populated) -> PrivacySettingsViewModel {
        let client = APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
        return PrivacySettingsViewModel(
            variant: variant,
            // A throwaway AuthManager over an in-memory keychain: the
            // delete path signs out, and that must not touch the shared
            // singleton other tests read.
            auth: AuthManager(store: InMemorySecureStore(), apiClient: client),
            api: client
        )
    }

    private func loadedGroups(_ vm: PrivacySettingsViewModel) async -> [GroupedListGroup] {
        await vm.load()
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return []
        }
        return groups
    }

    private func group(_ groups: [GroupedListGroup], _ id: String) -> GroupedListGroup? {
        groups.first { $0.id == id }
    }

    private func currentGroups(_ vm: PrivacySettingsViewModel) -> [GroupedListGroup] {
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return []
        }
        return groups
    }

    private func selectedRadioId(_ group: GroupedListGroup?) -> String? {
        group?.rows.first { row in
            if case let .radio(isSelected) = row.control { return isSelected }
            return false
        }?.id
    }

    private func toggleValue(_ group: GroupedListGroup?, _ rowId: String) -> Bool? {
        guard case let .toggle(isOn) = group?.row(id: rowId)?.control else { return nil }
        return isOn
    }

    // MARK: - Defaults frame

    func testPopulatedProducesEightGroupsInDesignOrder() async {
        stubSettings()
        let vm = makeViewModel()
        let groups = await loadedGroups(vm)
        XCTAssertEqual(
            groups.map(\.id),
            [
                "biometricSecurity", "searchPrivacy", "visibility",
                "address", "fuzz", "activity", "data", "delete"
            ]
        )
        XCTAssertNil(vm.banner)
        XCTAssertFalse(vm.contentDimmed)
    }

    func testVisibilityAndAddressAreFourOptionRadioCards() async {
        stubSettings()
        let groups = await loadedGroups(makeViewModel())
        let visibility = group(groups, "visibility")
        let address = group(groups, "address")
        XCTAssertEqual(visibility?.rows.count, 4)
        XCTAssertEqual(address?.rows.count, 4)
        XCTAssertEqual(selectedRadioId(visibility), "visibility.verified")
        XCTAssertEqual(selectedRadioId(address), "address.street")
        for row in visibility?.rows ?? [] {
            guard case .radio = row.control else { return XCTFail("\(row.id) should be a radio row") }
        }
    }

    func testFuzzGroupDefaultsToHalfMile() async {
        stubSettings()
        let groups = await loadedGroups(makeViewModel())
        let fuzz = group(groups, "fuzz")
        XCTAssertEqual(fuzz?.fuzz?.stop, .halfMile)
        XCTAssertEqual(fuzz?.fuzz?.leadIn, "How exact your task and listing pins appear on the map.")
        XCTAssertTrue(fuzz?.rows.isEmpty ?? false)
    }

    func testActivityHasFourTogglesAllOn() async {
        stubSettings()
        let groups = await loadedGroups(makeViewModel())
        let activity = group(groups, "activity")
        XCTAssertEqual(activity?.rows.map(\.id), ["online", "recent", "nearby", "ratings"])
        for row in activity?.rows ?? [] {
            guard case let .toggle(isOn) = row.control else { return XCTFail("\(row.id) should be a toggle") }
            XCTAssertTrue(isOn, "\(row.id) defaults on in the populated frame")
        }
    }

    func testDataRowsCarryLeadingIconsAndDeleteIsDestructive() async {
        stubSettings()
        let groups = await loadedGroups(makeViewModel())
        let data = group(groups, "data")
        XCTAssertEqual(data?.row(id: "downloadData")?.leadingIcon, .download)
        XCTAssertEqual(data?.row(id: "whatWeCollect")?.leadingIcon, .fileText)
        let delete = group(groups, "delete")?.rows.first
        XCTAssertEqual(delete?.id, "deleteAccount")
        XCTAssertTrue(delete?.destructive ?? false)
    }

    // MARK: - Mutations (local-only design cards)

    func testSelectRadioUpdatesSelection() async {
        stubSettings()
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        await vm.selectRadio("visibility.connections")
        XCTAssertEqual(selectedRadioId(group(currentGroups(vm), "visibility")), "visibility.connections")
    }

    func testToggleActivityFlipsLocalState() async {
        stubSettings()
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        await vm.toggleRow("online", isOn: false)
        XCTAssertEqual(toggleValue(group(currentGroups(vm), "activity"), "online"), false)
    }

    func testSetFuzzUpdatesStop() async {
        stubSettings()
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        await vm.setFuzz(PrivacySettingsViewModel.Group.fuzz, stop: .exact)
        XCTAssertEqual(group(currentGroups(vm), "fuzz")?.fuzz?.stop, .exact)
    }

    // MARK: - Search privacy (GET / PATCH /api/privacy/settings)

    func testSearchPrivacyCardReflectsLoadedSettings() async {
        stubSettings(searchVisibility: "mutuals", findableByName: true)
        let groups = await loadedGroups(makeViewModel())
        let card = group(groups, "searchPrivacy")
        XCTAssertEqual(
            card?.rows.map(\.id),
            [
                "searchVisibility.everyone", "searchVisibility.mutuals",
                "searchVisibility.nobody", "findableByName"
            ]
        )
        XCTAssertEqual(selectedRadioId(card), "searchVisibility.mutuals")
        XCTAssertEqual(toggleValue(card, "findableByName"), true)
        XCTAssertEqual(card?.helper, "Only connected people can find your profile in search.")
        XCTAssertEqual(
            card?.row(id: "searchVisibility.everyone")?.accessibilityIdentifier,
            "search-visibility-everyone"
        )
        XCTAssertEqual(
            card?.row(id: "findableByName")?.accessibilityIdentifier,
            "findable-by-name-switch"
        )
    }

    func testSelectingSearchVisibilityPatchesAndAdoptsServerValue() async {
        SequencedURLProtocol.routeResponses["/api/privacy/settings"] = [
            .status(200, body: settingsBody("everyone", false)),
            .status(
                200,
                body: "{\"message\":\"Privacy settings updated\","
                    + "\"settings\":{\"search_visibility\":\"nobody\",\"findable_by_name\":false}}"
            )
        ]
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        await vm.selectRadio("searchVisibility.nobody")
        XCTAssertEqual(selectedRadioId(group(currentGroups(vm), "searchPrivacy")), "searchVisibility.nobody")
        XCTAssertEqual(vm.toast?.text, "Search privacy updated.")
    }

    func testFailedSearchVisibilityPatchRollsBack() async {
        SequencedURLProtocol.routeResponses["/api/privacy/settings"] = [
            .status(200, body: settingsBody("everyone", false)),
            .status(500, body: "{\"error\":\"Failed to update privacy settings\"}")
        ]
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        await vm.selectRadio("searchVisibility.nobody")
        XCTAssertEqual(selectedRadioId(group(currentGroups(vm), "searchPrivacy")), "searchVisibility.everyone")
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    func testFailedFindableByNamePatchRollsBack() async {
        SequencedURLProtocol.routeResponses["/api/privacy/settings"] = [
            .status(200, body: settingsBody("everyone", false)),
            .status(500, body: "{\"error\":\"Failed to update privacy settings\"}")
        ]
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        await vm.toggleRow("findableByName", isOn: true)
        XCTAssertEqual(toggleValue(group(currentGroups(vm), "searchPrivacy"), "findableByName"), false)
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    func testSearchPrivacyLoadFailureKeepsScreenAndSwapsHelper() async {
        SequencedURLProtocol.routeResponses["/api/privacy/settings"] = [
            .status(500, body: "{\"error\":\"Failed to load privacy settings\"}")
        ]
        let vm = makeViewModel()
        let groups = await loadedGroups(vm)
        XCTAssertEqual(groups.count, 8, "a failed settings fetch must not blank the screen")
        XCTAssertEqual(
            group(groups, "searchPrivacy")?.helper,
            "Search privacy could not load. Pull to refresh before changing this setting."
        )
    }

    // MARK: - Delete account (DELETE /api/users/account)

    func testTappingDeleteRowOpensTheConfirmSheet() async {
        stubSettings()
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        XCTAssertFalse(vm.isDeleteSheetPresented)
        await vm.tapRow("deleteAccount")
        XCTAssertTrue(vm.isDeleteSheetPresented)
    }

    func testCancelledReauthLeavesTheAccountAlone() async {
        stubSettings()
        SequencedURLProtocol.routeResponses["/api/users/account"] = [
            .status(200, body: "{\"message\":\"Account deleted successfully\"}")
        ]
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        vm.sensitiveActionGate = { _ in .cancelled }
        await vm.tapRow("deleteAccount")
        await vm.confirmDeleteAccount()
        XCTAssertTrue(vm.isDeleteSheetPresented, "sheet stays up when the user dismisses the OS prompt")
        XCTAssertNil(vm.deleteAccountError)
        XCTAssertTrue(
            SequencedURLProtocol.capturedRequests.allSatisfy { $0.url?.path != "/api/users/account" },
            "no DELETE may be sent without a verified identity"
        )
    }

    func testFailedReauthSurfacesTheMessageAndSendsNothing() async {
        stubSettings()
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        vm.sensitiveActionGate = { _ in .failed(message: "Device passcode not set") }
        await vm.tapRow("deleteAccount")
        await vm.confirmDeleteAccount()
        XCTAssertEqual(vm.deleteAccountError, "Device passcode not set")
        XCTAssertTrue(vm.isDeleteSheetPresented)
        XCTAssertTrue(
            SequencedURLProtocol.capturedRequests.allSatisfy { $0.url?.path != "/api/users/account" }
        )
    }

    func testVerifiedDeleteSendsDeleteAndClosesTheSheet() async {
        stubSettings()
        SequencedURLProtocol.routeResponses["/api/users/account"] = [
            .status(200, body: "{\"message\":\"Account deleted successfully\"}")
        ]
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        vm.sensitiveActionGate = { _ in .verified }
        await vm.tapRow("deleteAccount")
        await vm.confirmDeleteAccount()
        XCTAssertFalse(vm.isDeleteSheetPresented)
        XCTAssertNil(vm.deleteAccountError)
        XCTAssertFalse(vm.isDeletingAccount)
        let deleteRequest = SequencedURLProtocol.capturedRequests.first { $0.url?.path == "/api/users/account" }
        XCTAssertEqual(deleteRequest?.httpMethod, "DELETE")
    }

    func testBlockingConflictSurfacesTheServerMessage() async {
        stubSettings()
        SequencedURLProtocol.routeResponses["/api/users/account"] = [
            .status(
                409,
                body: "{\"error\":\"Cannot delete account while you have gigs in progress. "
                    + "Please complete or cancel them first.\",\"activeGigCount\":2}"
            )
        ]
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        vm.sensitiveActionGate = { _ in .verified }
        await vm.tapRow("deleteAccount")
        await vm.confirmDeleteAccount()
        XCTAssertEqual(
            vm.deleteAccountError,
            "Cannot delete account while you have gigs in progress. Please complete or cancel them first."
        )
        XCTAssertTrue(vm.isDeleteSheetPresented, "the sheet stays up so the 409 stays readable")
    }

    // MARK: - Account deletion: step-up (persistent login)

    func testDeleteWithPasswordAccountUsesPasswordStepUpAndSendsHeader() async throws {
        stubSettings()
        SequencedURLProtocol.routeResponses["/api/users/auth-methods"] = [
            .status(200, body: "{\"providers\":[\"email\"],\"hasPassword\":true}")
        ]
        SequencedURLProtocol.routeResponses["/api/users/account"] = [
            .status(200, body: "{\"message\":\"Account deleted successfully\"}")
        ]
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        var asked: [(StepUpPurpose, [String])] = []
        vm.stepUpProvider = { purpose, methods in
            asked.append((purpose, methods))
            return "su-delete"
        }
        vm.sensitiveActionGate = { _ in
            XCTFail("local gate must not run when a server step-up is available")
            return .cancelled
        }
        await vm.tapRow("deleteAccount")
        await vm.confirmDeleteAccount()

        XCTAssertEqual(asked.count, 1)
        XCTAssertEqual(asked.first?.0, .deleteAccount)
        XCTAssertEqual(asked.first?.1, ["password"], "password-first when the account has one")
        XCTAssertFalse(vm.isDeleteSheetPresented)
        XCTAssertNil(vm.deleteAccountError)
        let deleteRequest = try XCTUnwrap(SequencedURLProtocol.capturedRequests.first { $0.url?.path == "/api/users/account" })
        XCTAssertEqual(deleteRequest.httpMethod, "DELETE")
        XCTAssertEqual(deleteRequest.value(forHTTPHeaderField: "X-Step-Up"), "su-delete")
    }

    func testDeleteWithoutPasswordLetsAuthManagerPickTheMethod() async throws {
        stubSettings()
        SequencedURLProtocol.routeResponses["/api/users/auth-methods"] = [
            .status(200, body: "{\"providers\":[\"google\"],\"hasPassword\":false}")
        ]
        SequencedURLProtocol.routeResponses["/api/users/account"] = [
            .status(200, body: "{\"message\":\"Account deleted successfully\"}")
        ]
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        var askedMethods: [[String]] = []
        vm.stepUpProvider = { _, methods in
            askedMethods.append(methods)
            return "su-device"
        }
        await vm.tapRow("deleteAccount")
        await vm.confirmDeleteAccount()

        XCTAssertEqual(askedMethods, [[]], "no restriction ⇒ device key if enrolled, else password")
        let deleteRequest = try XCTUnwrap(SequencedURLProtocol.capturedRequests.first { $0.url?.path == "/api/users/account" })
        XCTAssertEqual(deleteRequest.value(forHTTPHeaderField: "X-Step-Up"), "su-device")
    }

    func testDeleteStepUpCancelledSendsNothingAndKeepsSheet() async {
        stubSettings()
        SequencedURLProtocol.routeResponses["/api/users/account"] = [
            .status(200, body: "{\"message\":\"Account deleted successfully\"}")
        ]
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        vm.stepUpProvider = { _, _ in throw StepUpError.cancelled }
        vm.sensitiveActionGate = { _ in
            XCTFail("cancel ends the flow")
            return .verified
        }
        await vm.tapRow("deleteAccount")
        await vm.confirmDeleteAccount()

        XCTAssertTrue(vm.isDeleteSheetPresented)
        XCTAssertNil(vm.deleteAccountError, "a user cancel is silent")
        XCTAssertFalse(vm.isDeletingAccount)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.allSatisfy { $0.url?.path != "/api/users/account" })
    }

    func testDeleteWrongPasswordShowsErrorInSheet() async {
        stubSettings()
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        vm.stepUpProvider = { _, _ in throw StepUpError.invalidPassword }
        await vm.tapRow("deleteAccount")
        await vm.confirmDeleteAccount()

        XCTAssertEqual(vm.deleteAccountError, "Incorrect password. Try again.")
        XCTAssertTrue(vm.isDeleteSheetPresented)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.allSatisfy { $0.url?.path != "/api/users/account" })
    }

    func testDeleteFallsBackToLocalGateWhenStepUpUnavailable() async throws {
        stubSettings()
        SequencedURLProtocol.routeResponses["/api/users/account"] = [
            .status(200, body: "{\"message\":\"Account deleted successfully\"}")
        ]
        let vm = makeViewModel()
        _ = await loadedGroups(vm)
        vm.stepUpProvider = { _, _ in throw StepUpError.unavailable }
        var gateRan = false
        vm.sensitiveActionGate = { _ in
            gateRan = true
            return .verified
        }
        await vm.tapRow("deleteAccount")
        await vm.confirmDeleteAccount()

        XCTAssertTrue(gateRan)
        let deleteRequest = try XCTUnwrap(SequencedURLProtocol.capturedRequests.first { $0.url?.path == "/api/users/account" })
        XCTAssertNil(deleteRequest.value(forHTTPHeaderField: "X-Step-Up"), "bare request — the server decides")
        XCTAssertFalse(vm.isDeleteSheetPresented)
    }

    // MARK: - Stealth frame

    func testStealthShowsBannerAndStrictestControls() async {
        stubSettings()
        let vm = makeViewModel(variant: .stealth)
        let groups = await loadedGroups(vm)
        XCTAssertEqual(vm.banner?.title, "Stealth mode is on")
        XCTAssertEqual(vm.banner?.subtitle, "Your profile is hidden from search. Existing connections still see you.")
        XCTAssertEqual(vm.banner?.icon, .eyeOff)
        XCTAssertEqual(vm.banner?.style, .stealth)
        XCTAssertEqual(selectedRadioId(group(groups, "visibility")), "visibility.hidden")
        XCTAssertEqual(selectedRadioId(group(groups, "address")), "address.hidden")
        XCTAssertEqual(group(groups, "fuzz")?.fuzz?.stop, .neighborhood)
        for row in group(groups, "activity")?.rows ?? [] {
            if case let .toggle(isOn) = row.control { XCTAssertFalse(isOn, "\(row.id) off in stealth") }
        }
        XCTAssertEqual(vm.footerCaption, "Stealth · auto-applied May 26, 2026")
    }

    // MARK: - Copy parity contract

    func testFooterDefault() {
        XCTAssertEqual(makeViewModel().footerCaption, "Last updated · Mar 12, 2024")
    }

    func testHelperCopyMatchesDesign() async {
        stubSettings()
        let populated = await loadedGroups(makeViewModel())
        XCTAssertEqual(
            group(populated, "visibility")?.helper,
            "Verified neighbors can find you and start a conversation."
        )
        XCTAssertEqual(
            group(populated, "address")?.helper,
            "Street name shows on your profile; full address only to people you hire or sell to."
        )
        XCTAssertEqual(
            group(populated, "fuzz")?.helper,
            "Pins drop within a block of you. Exact address only shared after a task is accepted."
        )
        XCTAssertNil(group(populated, "activity")?.helper, "Activity card has no helper in the design")

        stubSettings()
        let stealth = await loadedGroups(makeViewModel(variant: .stealth))
        XCTAssertEqual(
            group(stealth, "visibility")?.helper,
            "Hidden — your profile won't show in search or recommendations."
        )
        XCTAssertEqual(
            group(stealth, "address")?.helper,
            "Address hidden everywhere. Deliveries still route correctly."
        )
        XCTAssertEqual(
            group(stealth, "fuzz")?.helper,
            "Pins fuzz to your neighborhood — buyers see only \"Park Slope\", never your block."
        )
    }
}
