//
//  HomeSecurityViewModel.swift
//  Pantopus
//
//  P5.1 / A14.2 — Per-home Security. Nine toggles are stored per Home, but
//  only address precision changes anything (the server drops the unit
//  number from Place), so it is the only one offered, and its helper line
//  says what it does. The other eight are read by nothing on the server or
//  any client; they're hidden and their stored values are left as they are.
//
//  Two seed frames (previews, tests and the offline baseline):
//    `.balanced`  — 5 of 9 toggles on
//    `.strict`    — all 9 on
//
//  P3F wiring: `load()` reads the persisted toggle set from
//  `GET /api/homes/:id/privacy`; each flip optimistically updates and
//  PATCHes the single key, rolling back on failure. The `variant` seed is
//  kept as the in-flight/offline baseline (and for previews/tests).
//

import Foundation
import Observation

@Observable
@MainActor
public final class HomeSecurityViewModel: GroupedListDataSource {
    public var title: String {
        "Security"
    }

    /// No footer: it used to show a sample address ("14 Elm Park Lane") and a
    /// made-up "Last audit 2h ago" for every Home.
    public var footerCaption: String? {
        nil
    }

    public private(set) var state: GroupedListState = .loading

    public let homeId: String
    /// Snapshot of every toggle's current value. Indexed by row id
    /// so the projection + helper logic stay in lockstep.
    public private(set) var toggles: [String: Bool]

    private let api: APIClient

    /// Source variant when the view-model boots. Seeds the in-flight /
    /// offline baseline; the live toggle set replaces it once `load()`
    /// returns from the backend.
    public enum Variant: Sendable, Hashable { case balanced, strict }

    public convenience init(
        homeId: String,
        variant: Variant = .balanced
    ) {
        self.init(
            homeId: homeId,
            api: .shared,
            variant: variant
        )
    }

    init(
        homeId: String,
        api: APIClient,
        variant: Variant = .balanced
    ) {
        self.homeId = homeId
        self.api = api
        toggles = Self.seedToggles(for: variant)
    }

    // MARK: - GroupedListDataSource

    public func load() async {
        // Render the seeded baseline immediately so the grouped list shows
        // while the fetch is in flight.
        state = .loaded(groups())
        do {
            let response: HomePrivacyResponse = try await api.request(
                HomePrivacyEndpoints.get(homeId: homeId)
            )
            toggles = response.privacy.toggles
        } catch {
            // Settings tolerate offline: keep the seeded baseline rather
            // than blanking the whole screen with an error.
        }
        state = .loaded(groups())
    }

    public func tapRow(_: String) async {}
    public func selectRadio(_: String) async {}
    public func setSlider(_: String, index _: Int) async {}

    public func toggleRow(_ rowId: String, isOn: Bool) async {
        guard let previous = toggles[rowId] else { return }
        // Optimistic flip.
        toggles[rowId] = isOn
        state = .loaded(groups())
        do {
            _ = try await api.request(
                HomePrivacyEndpoints.update(
                    homeId: homeId,
                    request: UpdateHomePrivacyRequest(toggles: [rowId: isOn])
                )
            )
        } catch {
            // Roll back the single key on failure.
            toggles[rowId] = previous
            state = .loaded(groups())
        }
    }

    // MARK: - Group projection

    /// Only the control something enforces is offered: address precision.
    private func groups() -> [GroupedListGroup] {
        [accessControlGroup()]
    }

    private func accessControlGroup() -> GroupedListGroup {
        GroupedListGroup(
            id: "accessControl",
            overline: "Access control",
            helper: Self.helperForAccessControl(toggles: toggles),
            rows: [
                toggleRow(id: Toggles.addressPrecision, label: "Address precision", sub: "Street only · hide unit number")
            ]
        )
    }

    private func toggleRow(id: String, label: String, sub: String) -> GroupedListRow {
        GroupedListRow(
            id: id,
            label: label,
            subtext: sub,
            control: .toggle(isOn: toggles[id] ?? false)
        )
    }

    // MARK: - Helper-line copy (parity contract — mirrored in Android)

    static func helperForAccessControl(toggles: [String: Bool]) -> String {
        (toggles[Toggles.addressPrecision] ?? false)
            ? "Place shows this Home's street without the unit number."
            : "Place shows this Home's full street address, including the unit number."
    }

    // MARK: - Seed data

    public enum Toggles {
        public static let guestApproval = "guestApproval"
        public static let memberNameVisibility = "memberNameVisibility"
        public static let addressPrecision = "addressPrecision"
        public static let activityVisibility = "activityVisibility"
        public static let mapOptOut = "mapOptOut"
        public static let notificationPreviews = "notificationPreviews"
        public static let docLock = "docLock"
        public static let photoBlur = "photoBlur"
        public static let vaultAutoLock = "vaultAutoLock"
    }

    public static func seedToggles(for variant: Variant) -> [String: Bool] {
        switch variant {
        case .balanced:
            // 5 of 9 on — matches the audit's "balanced setup" frame.
            [
                Toggles.guestApproval: true,
                Toggles.memberNameVisibility: true,
                Toggles.addressPrecision: false,
                Toggles.activityVisibility: true,
                Toggles.mapOptOut: false,
                Toggles.notificationPreviews: true,
                Toggles.docLock: true,
                Toggles.photoBlur: false,
                Toggles.vaultAutoLock: false
            ]
        case .strict:
            // All 9 on — matches the audit's "strict lockdown" frame.
            Dictionary(uniqueKeysWithValues: [
                Toggles.guestApproval,
                Toggles.memberNameVisibility,
                Toggles.addressPrecision,
                Toggles.activityVisibility,
                Toggles.mapOptOut,
                Toggles.notificationPreviews,
                Toggles.docLock,
                Toggles.photoBlur,
                Toggles.vaultAutoLock
            ].map { ($0, true) })
        }
    }
}
