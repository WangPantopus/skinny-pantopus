//
//  GuestPassesListViewModel.swift
//  Pantopus
//
//  A13.6 — Guest-pass management for a home. RN parity target:
//  `src/app/homes/[id]/share.tsx:37-90,152-190` (Active / Past sections
//  with time-remaining and a revoke action).
//
//  Endpoints (verified against the tree):
//    - `GET    /api/homes/:id/guest-passes`         backend/routes/homeIam.js:783
//    - `DELETE /api/homes/:id/guest-passes/:passId` backend/routes/homeIam.js:860
//
//  The list is fetched with `include_revoked=true` so a pass the user just
//  revoked stays visible under "Past" (the handler otherwise filters
//  `revoked_at IS NULL` — homeIam.js:797-799). The GET enriches every row
//  with a computed `status` of `active | expired | revoked`.
//
//  Built on the shared `ListOfRows` archetype: two sections
//  ("Active passes" / "Past passes"), a home-tinted secondary-create FAB
//  that opens the Add Guest form, and a per-row revoke button that raises
//  a confirm through `pendingEvent`.
//
//  Mirrors Android `GuestPassesListViewModel.kt` row-for-row.
//

import Foundation
import Observation
import SwiftUI

/// Outbound event the host view reacts to (push / alert presentation).
public enum GuestPassesEvent: Sendable, Equatable {
    /// Open the Add Guest form (issue a new pass).
    case openAddGuest
    /// Ask the user to confirm revoking `passId` (labelled `label`).
    case confirmRevoke(passId: String, label: String)
}

/// Stable section ids — exposed so tests and the Android mirror agree.
public enum GuestPassesSection {
    public static let active = "guestPasses.active"
    public static let past = "guestPasses.past"
}

@Observable
@MainActor
public final class GuestPassesListViewModel: ListOfRowsDataSource {
    // MARK: - ListOfRows chrome

    public let title = "Guest passes"

    public var topBarAction: TopBarAction? {
        nil
    }

    public var tabs: [ListOfRowsTab] {
        []
    }

    /// No tab strip on this screen — the two buckets are sections.
    public var selectedTab = ""

    public var fab: FABAction? {
        FABAction(
            icon: .userPlus,
            accessibilityLabel: "Add guest",
            variant: .secondaryCreate,
            tint: .home
        ) { @Sendable [weak self] in
            Task { @MainActor in self?.pendingEvent = .openAddGuest }
        }
    }

    public private(set) var state: ListOfRowsState = .loading

    /// Event the host view reacts to. Set by the FAB / row handlers;
    /// cleared by the view after dispatching.
    public var pendingEvent: GuestPassesEvent?

    /// Transient toast (revoke failure / revoke success).
    public var toast: ToastMessage?

    // MARK: - Dependencies

    private let homeId: String
    private let api: APIClient
    private let now: @Sendable () -> Date

    private var passes: [GuestPassDTO] = []
    private var loadedOnce = false

    init(
        homeId: String,
        api: APIClient = .shared,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.homeId = homeId
        self.api = api
        self.now = now
    }

    // MARK: - ListOfRowsDataSource

    public func load() async {
        // The shell's error banner retries through `load()`, so a
        // previously-loaded-then-failed screen must still re-fetch.
        if loadedOnce, !isErrored { return }
        state = .loading
        await fetch()
    }

    private var isErrored: Bool {
        if case .error = state { return true }
        return false
    }

    public func refresh() async {
        await fetch()
    }

    /// Re-fetch when the screen comes back to the foreground after the
    /// Add Guest form popped, so a brand-new pass shows up immediately.
    public func refreshIfLoaded() async {
        guard loadedOnce else { return }
        await fetch()
    }

    public func loadMoreIfNeeded() async {
        // Backend doesn't paginate /guest-passes.
    }

    // MARK: - Fetch

    private func fetch() async {
        do {
            let response: GuestPassesResponse = try await api.request(
                HomesEndpoints.listGuestPasses(homeId: homeId, includeRevoked: true)
            )
            passes = response.passes
            loadedOnce = true
            applyState()
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load guest passes. Try again."
            )
        }
    }

    // MARK: - Mutations

    /// RN parity — `share.tsx:84-90`: revoke, then refetch so the row
    /// moves from Active to Past. The confirm has already fired.
    public func revoke(passId: String) async {
        do {
            let _: RevokeGuestPassResponse = try await api.request(
                HomesEndpoints.revokeGuestPass(homeId: homeId, passId: passId)
            )
        } catch {
            toast = ToastMessage(text: "Failed to revoke pass", kind: .error)
            return
        }
        toast = ToastMessage(text: "Pass revoked", kind: .success)
        await fetch()
    }

    // MARK: - Buckets

    /// RN parity — `share.tsx:47`: `status == 'active'` AND either no end
    /// stamp or an end stamp still in the future.
    var activePasses: [GuestPassDTO] {
        passes.filter { Self.isActive($0, now: now()) }
    }

    /// RN parity — `share.tsx:48,172`: everything else, capped at 10.
    var pastPasses: [GuestPassDTO] {
        Array(passes.filter { !Self.isActive($0, now: now()) }.prefix(10))
    }

    static func isActive(_ pass: GuestPassDTO, now: Date) -> Bool {
        guard (pass.status ?? "active") == "active" else { return false }
        guard let endAt = pass.endAt, let end = parseISO(endAt) else { return true }
        return end > now
    }

    // MARK: - State projection

    private func applyState() {
        let active = activePasses
        let past = pastPasses
        guard !active.isEmpty || !past.isEmpty else {
            state = .empty(emptyContent())
            return
        }
        var sections: [RowSection] = []
        if !active.isEmpty {
            sections.append(
                RowSection(
                    id: GuestPassesSection.active,
                    header: "Active passes",
                    rows: active.map { activeRow(for: $0) },
                    count: active.count
                )
            )
        }
        if !past.isEmpty {
            sections.append(
                RowSection(
                    id: GuestPassesSection.past,
                    header: "Past passes",
                    rows: past.map { pastRow(for: $0) },
                    count: past.count
                )
            )
        }
        state = .loaded(sections: sections, hasMore: false)
    }

    private func emptyContent() -> ListOfRowsState.EmptyContent {
        ListOfRowsState.EmptyContent(
            icon: .keyRound,
            headline: "No guest passes",
            subcopy: "Issue a quick-share pass so a sitter, visitor, or contractor "
                + "can reach the wi-fi and entry details while they're around.",
            ctaTitle: "Add a guest"
        ) { @Sendable [weak self] in
            Task { @MainActor in self?.pendingEvent = .openAddGuest }
        }
    }

    // MARK: - Rows

    private func activeRow(for pass: GuestPassDTO) -> RowModel {
        let label = Self.displayLabel(pass)
        return RowModel(
            id: pass.id,
            title: label,
            subtitle: Self.kindLabel(pass.kind),
            template: .statusChip,
            leading: .typeIcon(
                .keyRound,
                background: Theme.Color.homeBg,
                foreground: Theme.Color.home
            ),
            trailing: .circularAction(
                icon: .xCircle,
                accessibilityLabel: "Revoke \(label)",
                background: Theme.Color.errorBg,
                foreground: Theme.Color.error
            ) { @Sendable [weak self] in
                Task { @MainActor in
                    self?.pendingEvent = .confirmRevoke(passId: pass.id, label: label)
                }
            },
            body: Self.expiryLabel(endAt: pass.endAt, now: now()),
            subtitleIcon: .userCheck,
            bodyIcon: .clock
        )
    }

    private func pastRow(for pass: GuestPassDTO) -> RowModel {
        RowModel(
            id: pass.id,
            title: Self.displayLabel(pass),
            subtitle: Self.kindLabel(pass.kind),
            template: .statusChip,
            leading: .typeIcon(
                .keyRound,
                background: Theme.Color.appSurfaceSunken,
                foreground: Theme.Color.appTextSecondary
            ),
            trailing: .statusChip(
                text: Self.pastStatusLabel(pass),
                variant: .neutral
            ),
            subtitleIcon: .userCheck,
            highlight: .muted
        )
    }

    // MARK: - Formatting (static — testable without the view layer)

    /// RN parity — `share.tsx:157`: `pass.label || 'Guest Pass'`.
    static func displayLabel(_ pass: GuestPassDTO) -> String {
        let trimmed = pass.label.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Guest Pass" : trimmed
    }

    /// Humanised `kind` — backend enum is
    /// `wifi_only | guest | airbnb | vendor` (homeIam.js:643-668).
    static func kindLabel(_ kind: String) -> String {
        switch kind {
        case "wifi_only": "Wi-Fi only"
        case "airbnb": "Airbnb / Custom"
        case "vendor": "Vendor / Service"
        case "guest": "Guest"
        default: kind.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    /// RN parity — `share.tsx:167`: "Revoked" for a revoked pass,
    /// "Expired" for everything else in the Past bucket.
    static func pastStatusLabel(_ pass: GuestPassDTO) -> String {
        if pass.status == "revoked" || pass.revokedAt != nil { return "Revoked" }
        return "Expired"
    }

    /// RN parity — `share.tsx:93-99` (`formatExpiry`).
    /// `nil` end stamp renders "No expiry"; a past stamp renders
    /// "Expired"; otherwise m / h / d remaining.
    static func expiryLabel(endAt: String?, now: Date) -> String {
        guard let endAt, let end = parseISO(endAt) else { return "No expiry" }
        let diff = end.timeIntervalSince(now)
        if diff < 0 { return "Expired" }
        let hours = Int(diff / 3600)
        if hours < 1 { return "\(Int(diff / 60))m remaining" }
        if hours < 24 { return "\(hours)h remaining" }
        return "\(hours / 24)d remaining"
    }

    /// Backend stamps are Postgres `timestamptz` serialised by Supabase —
    /// sometimes with fractional seconds, sometimes without.
    static func parseISO(_ value: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: value) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: value)
    }
}
