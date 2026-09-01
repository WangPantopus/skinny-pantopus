//
//  HomeSecurityViewModel.swift
//  Pantopus
//
//  P5.1 / A14.2 — Per-home Security toggles. Pure switchgear: 3
//  groups × 3 toggles = 9 toggles total. The helper line under each
//  card mirrors the design's "shifts based on current state" rule —
//  default mixed-state copy when at least the headline toggle of the
//  group is on, all-on consequence copy when every toggle in the
//  group is on, and an "off" warning when the headline toggle is
//  flipped off.
//
//  Two variant frames cover the design parity audit:
//    `.balanced`  — 5 of 9 toggles on, helpers read calm
//    `.strict`    — all 9 on, helpers shift to consequence language
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

    public var footerCaption: String? {
        "\(footerHomeName) · Last audit 2h ago"
    }

    public private(set) var state: GroupedListState = .loading

    public let homeId: String
    /// Snapshot of every toggle's current value. Indexed by row id
    /// so the projection + helper logic stay in lockstep.
    public private(set) var toggles: [String: Bool]

    private let footerHomeName: String
    private let api: APIClient

    /// Source variant when the view-model boots. Seeds the in-flight /
    /// offline baseline; the live toggle set replaces it once `load()`
    /// returns from the backend.
    public enum Variant: Sendable, Hashable { case balanced, strict }

    public convenience init(
        homeId: String,
        variant: Variant = .balanced,
        homeName: String = "14 Elm Park Lane"
    ) {
        self.init(
            homeId: homeId,
            api: .shared,
            variant: variant,
            homeName: homeName
        )
    }

    init(
        homeId: String,
        api: APIClient,
        variant: Variant = .balanced,
        homeName: String = "14 Elm Park Lane"
    ) {
        self.homeId = homeId
        self.api = api
        footerHomeName = homeName
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

    private func groups() -> [GroupedListGroup] {
        [
            accessControlGroup(),
            privacyGroup(),
            documentsGroup()
        ]
    }

    private func accessControlGroup() -> GroupedListGroup {
        GroupedListGroup(
            id: "accessControl",
            overline: "Access control",
            helper: Self.helperForAccessControl(toggles: toggles),
            rows: [
                toggleRow(id: Toggles.guestApproval, label: "Guest approval", sub: "Ask before letting in new passes"),
                toggleRow(id: Toggles.memberNameVisibility, label: "Member name visibility", sub: "Show only your home name to outsiders"),
                toggleRow(id: Toggles.addressPrecision, label: "Address precision", sub: "Street only · hide unit number")
            ]
        )
    }

    private func privacyGroup() -> GroupedListGroup {
        GroupedListGroup(
            id: "privacy",
            overline: "Privacy",
            helper: Self.helperForPrivacy(toggles: toggles),
            rows: [
                toggleRow(id: Toggles.activityVisibility, label: "Activity visibility", sub: "Show check-ins to verified neighbors"),
                toggleRow(id: Toggles.mapOptOut, label: "Map opt-out", sub: "Hide from the neighborhood map"),
                toggleRow(id: Toggles.notificationPreviews, label: "Notification previews", sub: "Suppress preview text on the lock screen")
            ]
        )
    }

    private func documentsGroup() -> GroupedListGroup {
        GroupedListGroup(
            id: "documents",
            overline: "Documents",
            helper: Self.helperForDocuments(toggles: toggles),
            rows: [
                toggleRow(id: Toggles.docLock, label: "Doc lock", sub: "Require unlock to view household docs"),
                toggleRow(id: Toggles.photoBlur, label: "Photo blur", sub: "Blur doc thumbnails until tapped"),
                toggleRow(id: Toggles.vaultAutoLock, label: "Vault auto-lock", sub: "Lock the vault after 5 minutes idle")
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
        let approval = toggles[Toggles.guestApproval] ?? false
        let allOn = (toggles[Toggles.guestApproval] ?? false)
            && (toggles[Toggles.memberNameVisibility] ?? false)
            && (toggles[Toggles.addressPrecision] ?? false)
        if allOn {
            return "All guest activity requires your explicit approval. Names and street precision are hidden from outsiders."
        } else if approval {
            return "Guest approval is on, so guests need an owner-tap to enter."
        } else {
            return "Guest approval is off — anyone with a code is in. Tighten this if you're away."
        }
    }

    static func helperForPrivacy(toggles: [String: Bool]) -> String {
        let activity = toggles[Toggles.activityVisibility] ?? false
        let allOn = (toggles[Toggles.activityVisibility] ?? false)
            && (toggles[Toggles.mapOptOut] ?? false)
            && (toggles[Toggles.notificationPreviews] ?? false)
        if allOn {
            return "Hidden from the neighborhood map, previews suppressed. Outsiders only see your home name."
        } else if activity {
            return "Visible to verified neighbors only. Address used for deliveries."
        } else {
            return "Activity is hidden — even verified neighbors can't see your check-ins."
        }
    }

    static func helperForDocuments(toggles: [String: Bool]) -> String {
        let lock = toggles[Toggles.docLock] ?? false
        let allOn = (toggles[Toggles.docLock] ?? false)
            && (toggles[Toggles.photoBlur] ?? false)
            && (toggles[Toggles.vaultAutoLock] ?? false)
        if allOn {
            return "All docs require Face ID. Previews stay blurred everywhere, including notifications."
        } else if lock {
            return "Docs unlock with Face ID. Previews still appear in chat."
        } else {
            return "Docs open without unlock — anyone with your phone can read them."
        }
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
