//
//  PrivacyViewModel.swift
//  Pantopus
//
//  P7.6 / A14.7 — Privacy preferences. Reshaped to the design's
//  full-vocabulary frame: two RadioCards (Profile visibility · Address
//  on profile), a "Map location fuzz" card hosting the `FuzzMap` stepped
//  slider, an Activity toggle card, and a "Your data" card of
//  leading-icon action rows + a detached destructive Delete row. A dark
//  `StealthBanner` rides above the first card in the stealth frame.
//
//  Backend-backed controls (T1 parity):
//    · "Find me in search" radios + "Find me by real name" toggle read
//      `GET /api/privacy/settings` and optimistically PATCH the same
//      route, rolling back and toasting on failure — RN
//      `src/app/settings/privacy.tsx:151-191`.
//    · "Delete account" opens `AccountDeleteSheet`, gates on a
//      device-credential re-auth, then `DELETE /api/users/account` and a
//      full sign-out — RN `src/app/settings.tsx:103-119`.
//
//  The design's own control set (Profile visibility · Address on profile
//  · Map location fuzz · Activity) has no column in
//  `UserPrivacySettings` — its four-way vocabularies don't map onto the
//  three-way `profile_default_visibility` enum — so those cards stay
//  local until the backend grows the fields. They are never presented as
//  saved. Copy is the parity contract, mirrored word-for-word on Android.
//
//  Two variant frames cover the design parity audit:
//    `.populated` — everyday defaults (verified-only, street, Block, on)
//    `.stealth`   — everything at its most private + the stealth banner
//

// swiftlint:disable type_body_length file_length

import Foundation
import Observation
import UIKit

@Observable
@MainActor
public final class PrivacySettingsViewModel: GroupedListDataSource {
    public var title: String {
        "Privacy"
    }

    public var footerCaption: String? {
        isStealth ? "Stealth · auto-applied May 26, 2026" : "Last updated · Mar 12, 2024"
    }

    public private(set) var state: GroupedListState = .loading
    public var toast: ToastMessage?

    public private(set) var isStealth: Bool
    private var visibility: String
    private var address: String
    private var fuzz: FuzzStop
    private var activity: [String: Bool]
    private let appLock: AppLockManager
    private let auth: AuthManager
    private let api: APIClient

    // MARK: - Search privacy (persisted)

    /// `search_visibility` — `everyone` · `mutuals` · `nobody`.
    private var searchVisibility = "everyone"
    private var findableByName = false
    /// `GET /api/privacy/settings` failed on the last load. RN keeps the
    /// screen up and swaps the helper line rather than blanking it.
    private var searchPrivacyLoadFailed = false
    /// A PATCH is in flight — the radios/toggle ignore taps meanwhile,
    /// matching RN's `privacySaving` guard.
    private var searchPrivacySaving = false

    // MARK: - Account deletion

    /// Drives the `AccountDeleteSheet` presentation from `PrivacyView`.
    public var isDeleteSheetPresented = false
    /// The DELETE is in flight (after a successful re-auth).
    public private(set) var isDeletingAccount = false
    /// Re-auth or DELETE failure, rendered inside the sheet.
    public var deleteAccountError: String?

    /// The re-auth gate in front of the DELETE. Defaults to the shared
    /// `AppLockManager` device-credential check; unit tests substitute a
    /// closure so they don't depend on a provisioned enrolment.
    @ObservationIgnored
    var sensitiveActionGate: @MainActor (String) async -> SensitiveActionOutcome

    public enum Variant: Sendable, Hashable { case populated, stealth }

    init(
        variant: Variant = .populated,
        appLock: AppLockManager = .shared,
        auth: AuthManager = .shared,
        api: APIClient = .shared
    ) {
        let stealth = (variant == .stealth)
        isStealth = stealth
        visibility = stealth ? "hidden" : "verified"
        address = stealth ? "hidden" : "street"
        fuzz = stealth ? .neighborhood : .halfMile
        activity = Self.seedActivity(stealth: stealth)
        self.appLock = appLock
        self.auth = auth
        self.api = api
        sensitiveActionGate = { reason in
            await appLock.verifySensitiveAction(reason: reason)
        }
    }

    // MARK: - GroupedListDataSource

    public var banner: GroupedListBanner? {
        guard isStealth else { return nil }
        return GroupedListBanner(
            icon: .eyeOff,
            title: "Stealth mode is on",
            subtitle: "Your profile is hidden from search. Existing connections still see you.",
            style: .stealth
        )
    }

    public func load() async {
        appLock.configure(userID: signedInUserID)
        appLock.refreshCapability()
        await fetchSearchPrivacy()
        state = .loaded(groups())
    }

    /// `GET /api/privacy/settings` — `backend/routes/privacy.js:50`.
    /// A failure never blanks the screen: RN keeps every other card and
    /// swaps the search-privacy helper for the "couldn't load" line.
    private func fetchSearchPrivacy() async {
        do {
            let response: PrivacySettingsResponse = try await api.request(PrivacyEndpoints.settings)
            searchVisibility = response.settings.searchVisibility ?? "everyone"
            findableByName = response.settings.findableByName ?? false
            searchPrivacyLoadFailed = false
        } catch {
            searchPrivacyLoadFailed = true
        }
    }

    public func tapRow(_ rowId: String) async {
        switch rowId {
        case "appLockOpenSettings":
            if let url = URL(string: UIApplication.openSettingsURLString) {
                await UIApplication.shared.open(url)
            }
        case "deleteAccount":
            deleteAccountError = nil
            isDeleteSheetPresented = true
        default:
            // Download your data / What we collect open dedicated GDPR
            // flows tracked outside this package.
            break
        }
    }

    public func toggleRow(_ rowId: String, isOn: Bool) async {
        if rowId == Row.findableByName {
            await setFindableByName(isOn)
            return
        }
        if rowId == "appLockToggle" {
            let changed = await appLock.setEnabled(isOn)
            if changed {
                toast = ToastMessage(
                    text: isOn
                        ? "\(appLock.biometricLabel) protection is on."
                        : "Biometric protection turned off.",
                    kind: .success
                )
            } else if isOn {
                toast = ToastMessage(text: "App lock setup was cancelled.", kind: .neutral)
            }
            state = .loaded(groups())
            return
        }
        guard activity[rowId] != nil else { return }
        activity[rowId] = isOn
        state = .loaded(groups())
    }

    public func selectRadio(_ rowId: String) async {
        if let value = rowId.dropPrefix("\(Row.searchVisibilityPrefix).") {
            await setSearchVisibility(value)
            return
        }
        if let value = rowId.dropPrefix("visibility.") {
            visibility = value
        } else if let value = rowId.dropPrefix("address.") {
            address = value
        } else {
            return
        }
        state = .loaded(groups())
    }

    public func setSlider(_: String, index _: Int) async {}

    // MARK: - Search privacy mutations (optimistic + rollback)

    /// Optimistic `PATCH /api/privacy/settings { search_visibility }`.
    /// Mirrors RN `handleSearchVisibilityChange` — flip locally, adopt
    /// the server's echoed value on success, restore the previous value
    /// and alert on failure.
    private func setSearchVisibility(_ next: String) async {
        guard next != searchVisibility, !searchPrivacySaving, !searchPrivacyLoadFailed else { return }
        let previous = searchVisibility
        searchVisibility = next
        searchPrivacySaving = true
        state = .loaded(groups())
        do {
            let response: PrivacySettingsResponse = try await api.request(
                PrivacyEndpoints.updateSettings(PrivacySettingsUpdate(searchVisibility: next))
            )
            searchVisibility = response.settings.searchVisibility ?? next
            toast = ToastMessage(text: "Search privacy updated.", kind: .success)
        } catch {
            searchVisibility = previous
            toast = ToastMessage(
                text: Self.message(for: error, fallback: "Failed to update search privacy."),
                kind: .error
            )
        }
        searchPrivacySaving = false
        state = .loaded(groups())
    }

    /// Optimistic `PATCH /api/privacy/settings { findable_by_name }`.
    /// Mirrors RN `handleFindableByNameChange`.
    private func setFindableByName(_ next: Bool) async {
        guard !searchPrivacySaving, !searchPrivacyLoadFailed else {
            state = .loaded(groups())
            return
        }
        let previous = findableByName
        findableByName = next
        searchPrivacySaving = true
        state = .loaded(groups())
        do {
            let response: PrivacySettingsResponse = try await api.request(
                PrivacyEndpoints.updateSettings(PrivacySettingsUpdate(findableByName: next))
            )
            findableByName = response.settings.findableByName ?? next
            toast = ToastMessage(text: "Name search privacy updated.", kind: .success)
        } catch {
            findableByName = previous
            toast = ToastMessage(
                text: Self.message(for: error, fallback: "Failed to update name search privacy."),
                kind: .error
            )
        }
        searchPrivacySaving = false
        state = .loaded(groups())
    }

    // MARK: - Account deletion

    public func dismissDeleteSheet() {
        guard !isDeletingAccount else { return }
        deleteAccountError = nil
        isDeleteSheetPresented = false
    }

    /// The sheet's "Delete My Account" CTA.
    ///
    /// Order matches RN `settings.tsx:103-119`: re-auth **first**, then
    /// `DELETE /api/users/account` (`backend/routes/users.js:3945`), then
    /// a full sign-out that drops the app back to the auth root. The
    /// backend answers 409 when the account still has in-progress gigs or
    /// escrowed payments — that message is surfaced verbatim and nothing
    /// is deleted.
    public func confirmDeleteAccount() async {
        guard !isDeletingAccount else { return }
        deleteAccountError = nil
        switch await sensitiveActionGate("Approve account deletion") {
        case .cancelled:
            return
        case let .failed(message):
            deleteAccountError = message
            return
        case .verified:
            break
        }

        isDeletingAccount = true
        do {
            _ = try await api.request(AuthMethodsEndpoints.deleteAccount)
            isDeletingAccount = false
            isDeleteSheetPresented = false
            await auth.signOut()
            appLock.clearTransientState()
        } catch {
            isDeletingAccount = false
            deleteAccountError = Self.message(
                for: error,
                fallback: "Failed to delete account. Please try again."
            )
        }
    }

    /// Server-supplied copy when there is one (the 409 bodies carry the
    /// only actionable explanation), otherwise `fallback`.
    private static func message(for error: any Error, fallback: String) -> String {
        guard let apiError = error as? APIError else { return fallback }
        switch apiError {
        case let .clientError(_, message):
            return APIError.friendlyClientMessage(message) ?? fallback
        default:
            return apiError.errorDescription ?? fallback
        }
    }

    public func setFuzz(_ rowId: String, stop: FuzzStop) async {
        guard rowId == Group.fuzz else { return }
        fuzz = stop
        state = .loaded(groups())
    }

    // MARK: - Group projection

    private func groups() -> [GroupedListGroup] {
        [
            biometricSecurityGroup(),
            searchPrivacyGroup(),
            visibilityGroup(),
            addressGroup(),
            fuzzGroup(),
            activityGroup(),
            dataGroup(),
            deleteGroup()
        ]
    }

    private func biometricSecurityGroup() -> GroupedListGroup {
        GroupedListGroup(
            id: Group.biometricSecurity,
            overline: "BIOMETRIC SECURITY",
            rows: [
                GroupedListRow(
                    id: "appLockToggle",
                    label: "Require \(appLock.biometricLabel) for sensitive actions",
                    subtext: "Protect payments, mailbox, and account changes with biometric verification.",
                    control: .toggle(isOn: appLock.preferenceEnabled),
                    accessibilityIdentifier: "appLockToggle"
                ),
                GroupedListRow(
                    id: "appLockCapabilityStatus",
                    label: "Current Capability",
                    control: .chipStatus(
                        label: appLock.capability.statusText,
                        tone: appLock.capability == .available ? .success : .warning,
                        includesChevron: false
                    ),
                    accessibilityIdentifier: "appLockCapabilityStatus"
                ),
                GroupedListRow(
                    id: "appLockOpenSettings",
                    label: "Open Device Settings",
                    control: .chevron,
                    accessibilityIdentifier: "appLockOpenSettings"
                )
            ]
        )
    }

    /// The only backend-backed card on this screen —
    /// `UserPrivacySettings.search_visibility` + `.findable_by_name`.
    /// Radio labels + helper copy are RN's
    /// (`settings/privacy.tsx:20-33`, `:476-556`) word for word.
    private func searchPrivacyGroup() -> GroupedListGroup {
        var rows = Self.searchVisibilityOptions.map { option in
            GroupedListRow(
                id: "\(Row.searchVisibilityPrefix).\(option.key)",
                label: option.label,
                control: .radio(isSelected: option.key == searchVisibility),
                accessibilityIdentifier: "search-visibility-\(option.key)"
            )
        }
        rows.append(
            GroupedListRow(
                id: Row.findableByName,
                label: "Find me by real name",
                subtext: "Let people search your account first, middle, or last name "
                    + "when your search visibility allows them.",
                control: .toggle(isOn: findableByName),
                accessibilityIdentifier: "findable-by-name-switch"
            )
        )
        return GroupedListGroup(
            id: Group.searchPrivacy,
            overline: "Find me in search",
            helper: searchPrivacyLoadFailed
                ? "Search privacy could not load. Pull to refresh before changing this setting."
                : Self.searchVisibilityHelp[searchVisibility],
            rows: rows
        )
    }

    private func visibilityGroup() -> GroupedListGroup {
        GroupedListGroup(
            id: Group.visibility,
            overline: "Profile visibility",
            helper: isStealth
                ? "Hidden — your profile won't show in search or recommendations."
                : "Verified neighbors can find you and start a conversation.",
            rows: Self.visibilityOptions.map { option in
                GroupedListRow(
                    id: "visibility.\(option.key)",
                    label: option.label,
                    subtext: option.sub,
                    control: .radio(isSelected: option.key == visibility)
                )
            }
        )
    }

    private func addressGroup() -> GroupedListGroup {
        GroupedListGroup(
            id: Group.address,
            overline: "Address on profile",
            helper: isStealth
                ? "Address hidden everywhere. Deliveries still route correctly."
                : "Street name shows on your profile; full address only to people you hire or sell to.",
            rows: Self.addressOptions.map { option in
                GroupedListRow(
                    id: "address.\(option.key)",
                    label: option.label,
                    subtext: option.sub,
                    control: .radio(isSelected: option.key == address)
                )
            }
        )
    }

    private func fuzzGroup() -> GroupedListGroup {
        GroupedListGroup(
            id: Group.fuzz,
            overline: "Map location fuzz",
            helper: isStealth
                ? "Pins fuzz to your neighborhood — buyers see only \"Park Slope\", never your block."
                : "Pins drop within a block of you. Exact address only shared after a task is accepted.",
            fuzz: GroupedListFuzz(
                leadIn: "How exact your task and listing pins appear on the map.",
                stop: fuzz
            ),
            rows: []
        )
    }

    private func activityGroup() -> GroupedListGroup {
        GroupedListGroup(
            id: Group.activity,
            overline: "Activity",
            rows: Self.activitySpecs.map { spec in
                GroupedListRow(
                    id: spec.key,
                    label: spec.label,
                    subtext: spec.sub,
                    control: .toggle(isOn: activity[spec.key] ?? false)
                )
            }
        )
    }

    private func dataGroup() -> GroupedListGroup {
        GroupedListGroup(
            id: Group.data,
            overline: "Your data",
            rows: [
                GroupedListRow(
                    id: "downloadData",
                    label: "Download your data",
                    subtext: "ZIP of profile, tasks, messages — emailed to you",
                    control: .chevron,
                    leadingIcon: .download
                ),
                GroupedListRow(
                    id: "whatWeCollect",
                    label: "What we collect",
                    subtext: "Full data policy & current categories",
                    control: .chevron,
                    leadingIcon: .fileText
                )
            ]
        )
    }

    private func deleteGroup() -> GroupedListGroup {
        GroupedListGroup(
            id: Group.delete,
            rows: [
                GroupedListRow(
                    id: "deleteAccount",
                    label: "Delete account",
                    // The design frame reads "Permanent. 30-day grace
                    // period." — `users.js:3945` has no grace window, it
                    // hard-deletes on the spot, so the row can't promise
                    // one. Mirrored on Android; flagged for design review.
                    subtext: "Permanent. This can't be undone.",
                    control: .chevron,
                    destructive: true
                )
            ]
        )
    }

    // MARK: - Stable identifiers

    public enum Group {
        public static let biometricSecurity = "biometricSecurity"
        public static let searchPrivacy = "searchPrivacy"
        public static let visibility = "visibility"
        public static let address = "address"
        public static let fuzz = "fuzz"
        public static let activity = "activity"
        public static let data = "data"
        public static let delete = "delete"
    }

    /// Row ids the view-model routes on by name.
    public enum Row {
        /// `searchVisibility.<everyone|mutuals|nobody>`.
        public static let searchVisibilityPrefix = "searchVisibility"
        public static let findableByName = "findableByName"
        public static let deleteAccount = "deleteAccount"
    }

    private var signedInUserID: String? {
        guard case let .signedIn(user) = auth.state else { return nil }
        return user.id
    }

    // MARK: - Seed data (parity contract — mirrored in Android)

    struct Option {
        let key: String
        let label: String
        let sub: String?
    }

    struct ActivitySpec {
        let key: String
        let label: String
        let sub: String?
    }

    /// `search_visibility` enum values + RN's labels
    /// (`settings/privacy.tsx:20-28`). Order is RN's.
    static let searchVisibilityOptions: [Option] = [
        Option(key: "everyone", label: "Everyone", sub: nil),
        Option(key: "mutuals", label: "Connections", sub: nil),
        Option(key: "nobody", label: "Hidden", sub: nil)
    ]

    /// Helper line under the card — describes the *selected* option, as
    /// RN does (`SEARCH_VISIBILITY_HELP`, `settings/privacy.tsx:30-33`).
    static let searchVisibilityHelp: [String: String] = [
        "everyone": "Your profile can appear when people search your handle or display name.",
        "mutuals": "Only connected people can find your profile in search.",
        "nobody": "Your profile is hidden from search and public discovery."
    ]

    static let visibilityOptions: [Option] = [
        Option(key: "public", label: "Public", sub: "Anyone with the link can see your profile"),
        Option(key: "verified", label: "Verified neighbors only", sub: "People with a verified address can see you"),
        Option(key: "connections", label: "Connections only", sub: "Only people you've interacted with"),
        Option(key: "hidden", label: "Hidden", sub: "Profile not browsable. Existing chats still work")
    ]

    static let addressOptions: [Option] = [
        Option(key: "full", label: "Full address", sub: "14 Elm Park Lane, Brooklyn NY"),
        Option(key: "street", label: "Street only", sub: "Elm Park Lane, Brooklyn"),
        Option(key: "neighborhood", label: "Neighborhood", sub: "Park Slope, Brooklyn"),
        Option(key: "hidden", label: "Hidden", sub: "Verified badge shown, address not")
    ]

    static let activitySpecs: [ActivitySpec] = [
        ActivitySpec(key: "online", label: "Show online status", sub: "Green dot when you're active"),
        ActivitySpec(key: "recent", label: "Show recent activity", sub: "\"Posted a task 2h ago\" on profile"),
        ActivitySpec(key: "nearby", label: "Appear in nearby search", sub: "Neighbors can find you by proximity"),
        ActivitySpec(key: "ratings", label: "Show ratings publicly", sub: nil)
    ]

    static func seedActivity(stealth: Bool) -> [String: Bool] {
        let value = !stealth
        return activitySpecs.reduce(into: [:]) { acc, spec in acc[spec.key] = value }
    }
}

private extension String {
    /// Returns the remainder after `prefix`, or `nil` if the prefix
    /// doesn't match — keeps the radio-id parsing in `selectRadio` tidy.
    func dropPrefix(_ prefix: String) -> String? {
        hasPrefix(prefix) ? String(dropFirst(prefix.count)) : nil
    }
}
