//
//  ReviewSignupsViewModel.swift
//  Pantopus
//
//  T6.6c (P26.5) — Review signups. Organizer-only review queue for one
//  Support Train. Reads from
//  `GET /api/support-trains/:id/reservations` and projects each row
//  into the avatar-first `ListOfRows` template with a status chip on
//  the trailing edge and the per-reservation note as the row body.
//
//  Filter strip (replaces tabs on this surface):
//    All · Pending · Confirmed · Edited · Canceled
//
//  Backend ground-truth: the `:id/reservations` handler returns
//  `id / slot_id / user_id / guest_name / status / contribution_mode /
//  dish_title / restaurant_name / estimated_arrival_at /
//  note_to_recipient / private_note_to_organizer /
//  created_at / updated_at / canceled_at / User`. The design's diet
//  flag, conflict marker, and relationship chip are not yet projected
//  — the VM omits them gracefully. "Edited" is derived client-side
//  from `updated_at != created_at`.
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable type_body_length

public enum ReviewSignupsFilter {
    public static let all = "all"
    public static let pending = "pending"
    public static let confirmed = "confirmed"
    public static let edited = "edited"
    public static let canceled = "canceled"
}

@Observable
@MainActor
public final class ReviewSignupsViewModel: ListOfRowsDataSource {
    // MARK: - ListOfRowsDataSource

    public var title: String {
        "Review signups"
    }

    public var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .share,
            accessibilityLabel: "Share train"
        ) { [weak self] in
            MainActor.assumeIsolated { self?.onShareTrain() }
        }
    }

    public var tabs: [ListOfRowsTab] {
        []
    }

    public var selectedTab: String = ""

    public var fab: FABAction? {
        nil
    }

    public private(set) var state: ListOfRowsState = .loading

    public var chipStrip: ChipStripConfig? {
        ChipStripConfig(
            chips: [
                ChipStripConfig.Chip(id: ReviewSignupsFilter.all, label: "All", icon: .listChecks),
                ChipStripConfig.Chip(id: ReviewSignupsFilter.pending, label: "Pending", icon: .clock),
                ChipStripConfig.Chip(id: ReviewSignupsFilter.confirmed, label: "Confirmed", icon: .check),
                ChipStripConfig.Chip(id: ReviewSignupsFilter.edited, label: "Edited", icon: .pencil),
                ChipStripConfig.Chip(id: ReviewSignupsFilter.canceled, label: "Canceled", icon: .x)
            ],
            selectedId: selectedFilter
        ) { [weak self] id in
            MainActor.assumeIsolated { self?.updateFilter(id) }
        }
    }

    // MARK: - Filter state

    /// Live filter chip selection — defaults to `All`.
    public private(set) var selectedFilter: String = ReviewSignupsFilter.all

    public func updateFilter(_ id: String) {
        guard selectedFilter != id else { return }
        selectedFilter = id
        rebuild()
    }

    // MARK: - Dependencies

    private let api: APIClient
    private let supportTrainId: String
    private let onShareTrain: @MainActor () -> Void
    private let onConfirm: @MainActor (String) -> Void
    private let onMessage: @MainActor (String) -> Void
    /// Hands the host the full reservation so it can push the
    /// `EditSignupFormView` prefilled — the form needs the seed DTO,
    /// so threading only the id would force a redundant re-fetch.
    private let onEdit: @MainActor (SupportTrainReservationDTO) -> Void

    private var reservations: [SupportTrainReservationDTO] = []
    private var loadedOnce = false

    init(
        supportTrainId: String,
        api: APIClient = .shared,
        onShareTrain: @escaping @MainActor () -> Void = {},
        onConfirm: @escaping @MainActor (String) -> Void = { _ in },
        onMessage: @escaping @MainActor (String) -> Void = { _ in },
        onEdit: @escaping @MainActor (SupportTrainReservationDTO) -> Void = { _ in }
    ) {
        self.api = api
        self.supportTrainId = supportTrainId
        self.onShareTrain = onShareTrain
        self.onConfirm = onConfirm
        self.onMessage = onMessage
        self.onEdit = onEdit
    }

    // MARK: - Lifecycle

    public func load() async {
        if loadedOnce { return }
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    public func loadMoreIfNeeded() async {
        // Single-train surface — no pagination.
    }

    // MARK: - Fetching

    private func fetch() async {
        guard !supportTrainId.isEmpty else {
            state = .error(message: "Missing support train id.")
            return
        }
        do {
            let response: SupportTrainReservationsResponse = try await api.request(
                SupportTrainsEndpoints.reservations(supportTrainId: supportTrainId)
            )
            reservations = response.reservations
            loadedOnce = true
            rebuild()
        } catch {
            state = .error(message: "Couldn't load signups. Try again.")
        }
    }

    // MARK: - Projection

    private func rebuild() {
        let filtered = filteredReservations
        if filtered.isEmpty {
            let isAll = selectedFilter == ReviewSignupsFilter.all
            let ctaTitle: String? = isAll ? "Share train" : nil
            let onCTA: (@Sendable () -> Void)? = if isAll {
                { [weak self] in
                    MainActor.assumeIsolated { self?.onShareTrain() }
                }
            } else {
                nil
            }
            state = .empty(ListOfRowsState.EmptyContent(
                icon: .clipboardList,
                headline: emptyHeadline,
                subcopy: emptySubcopy,
                ctaTitle: ctaTitle,
                onCTA: onCTA
            ))
            return
        }
        let mapped = filtered.map(rowModel(for:))
        state = .loaded(sections: [RowSection(id: "signups", rows: mapped)], hasMore: false)
    }

    /// Visible-to-the-organizer filter projection. `canceled` rows are
    /// hidden from every filter except `.canceled` so the queue reads
    /// clean.
    private var filteredReservations: [SupportTrainReservationDTO] {
        switch selectedFilter {
        case ReviewSignupsFilter.pending:
            reservations.filter { ($0.status ?? "") == "pending" }
        case ReviewSignupsFilter.confirmed:
            reservations.filter { ($0.status ?? "") == "confirmed" }
        case ReviewSignupsFilter.edited:
            reservations.filter { $0.wasEdited && ($0.status ?? "") != "canceled" }
        case ReviewSignupsFilter.canceled:
            reservations.filter { ($0.status ?? "") == "canceled" }
        default:
            reservations.filter { ($0.status ?? "") != "canceled" }
        }
    }

    private var emptyHeadline: String {
        switch selectedFilter {
        case ReviewSignupsFilter.pending: "No pending signups"
        case ReviewSignupsFilter.confirmed: "No confirmed signups yet"
        case ReviewSignupsFilter.edited: "No recent edits"
        case ReviewSignupsFilter.canceled: "No canceled signups"
        default: "No signups yet"
        }
    }

    private var emptySubcopy: String {
        switch selectedFilter {
        case ReviewSignupsFilter.pending:
            "When a neighbor signs up for a slot, they'll appear here for you to review."
        case ReviewSignupsFilter.confirmed:
            "Confirmed slots will show up here once you approve their signup."
        case ReviewSignupsFilter.edited:
            "When a helper updates their slot, the edit will appear here for confirmation."
        case ReviewSignupsFilter.canceled:
            "When a helper cancels their slot, it moves here so you can backfill."
        default:
            "Share the train so neighbors can grab a slot. You'll see new signups here for review before they're confirmed."
        }
    }

    private func rowModel(for r: SupportTrainReservationDTO) -> RowModel {
        let chip = statusChipFor(r)
        let metaParts: [String] = [
            dropWindowLabel(for: r),
            contributionMetaLabel(for: r)
        ].compactMap { $0 }
        let footerActions = footer(for: r)

        return RowModel(
            id: r.id,
            title: r.displayName,
            subtitle: subtitleLine(for: r),
            template: .statusChip,
            leading: .avatarWithBadge(
                name: r.displayName,
                imageURL: r.helper?.profilePictureUrl.flatMap(URL.init(string:)),
                background: .gradient(avatarGradient(for: r.helper?.id ?? r.id)),
                size: .medium,
                verified: false
            ),
            trailing: .statusChip(text: chip.text, variant: chip.variant),
            onTap: { [weak self] in
                MainActor.assumeIsolated { self?.onEdit(r) }
            },
            body: r.noteToRecipient.map { "\u{201C}\($0)\u{201D}" },
            bodyIcon: nil,
            timeMeta: shortDateLabel(for: r),
            metaTail: metaParts.isEmpty ? nil : metaParts.joined(separator: " · "),
            footer: footerActions
        )
    }

    /// Subtitle line — dish title (meals) or restaurant name (restaurant
    /// trains) sits here as a small caption between the name and the
    /// public note. Falls back to the contribution mode label when both
    /// are nil.
    private func subtitleLine(for r: SupportTrainReservationDTO) -> String? {
        if let dish = r.dishTitle, !dish.isEmpty { return dish }
        if let restaurant = r.restaurantName, !restaurant.isEmpty { return restaurant }
        return r.contributionMode.map { humanize($0) }
    }

    /// Maps `estimated_arrival_at` (ISO-8601) onto a readable
    /// `Drop 6:00 pm` label. Returns `nil` when the field is missing or
    /// unparseable so the row collapses cleanly instead of showing
    /// "Drop —".
    private func dropWindowLabel(for r: SupportTrainReservationDTO) -> String? {
        guard let iso = r.estimatedArrivalAt,
              let date = Self.isoFormatter.date(from: iso) else { return nil }
        return "Drop \(Self.timeFormatter.string(from: date))"
    }

    private func shortDateLabel(for r: SupportTrainReservationDTO) -> String? {
        guard let iso = r.estimatedArrivalAt,
              let date = Self.isoFormatter.date(from: iso) else { return nil }
        return Self.dateFormatter.string(from: date)
    }

    private func contributionMetaLabel(for r: SupportTrainReservationDTO) -> String? {
        guard let mode = r.contributionMode else { return nil }
        if r.dishTitle != nil || r.restaurantName != nil { return nil }
        return humanize(mode)
    }

    private func statusChipFor(
        _ r: SupportTrainReservationDTO
    ) -> (text: String, variant: StatusChipVariant) {
        switch r.status ?? "" {
        case "confirmed":
            if r.wasEdited { return ("Edited", .info) }
            return ("Confirmed", .success)
        case "pending":
            return ("Pending", .warning)
        case "canceled":
            return ("Canceled", .neutral)
        default:
            return ("Pending", .warning)
        }
    }

    private func footer(for r: SupportTrainReservationDTO) -> RowFooter? {
        switch r.status ?? "" {
        case "pending":
            RowFooter(actions: [
                RowFooterAction(
                    title: "Confirm",
                    icon: .check,
                    variant: .primary
                ) { [weak self] in
                    MainActor.assumeIsolated { self?.confirm(r.id) }
                },
                RowFooterAction(
                    title: "Edit",
                    icon: .pencil,
                    variant: .ghost
                ) { [weak self] in
                    MainActor.assumeIsolated { self?.onEdit(r) }
                }
            ])
        case "confirmed":
            RowFooter(actions: [
                RowFooterAction(
                    title: "Message",
                    icon: .messageCircle,
                    variant: .ghost
                ) { [weak self] in
                    MainActor.assumeIsolated { self?.onMessage(r.id) }
                }
            ])
        default:
            nil
        }
    }

    private func avatarGradient(for seed: String) -> GradientPair {
        let palette: [GradientPair] = [
            GradientPair(start: Theme.Color.primary500, end: Theme.Color.primary700),
            GradientPair(start: Theme.Color.success, end: Theme.Color.home),
            GradientPair(start: Theme.Color.warning, end: Theme.Color.handyman),
            GradientPair(start: Theme.Color.error, end: Theme.Color.business),
            GradientPair(start: Theme.Color.business, end: Theme.Color.goods)
        ]
        let hash = seed.unicodeScalars.reduce(0) { $0 &+ Int($1.value) }
        return palette[abs(hash) % palette.count]
    }

    private func humanize(_ snakeCase: String) -> String {
        snakeCase
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
    }

    // MARK: - Optimistic mutations

    /// Drain pending optimistic patches from the shared store and
    /// replay them into the in-memory cache. Called by the view on
    /// `.onAppear` and whenever the store's revision bumps so an Edit
    /// committed in `EditSignupFormView` is reflected the moment the
    /// user lands back on this screen.
    public func applyPendingEdits(from store: SupportTrainReservationsStore) {
        var changed = false
        for (idx, current) in reservations.enumerated() {
            if let patch = store.consumePatch(forId: current.id) {
                reservations[idx] = patch
                changed = true
            }
        }
        if changed { rebuild() }
    }

    /// Optimistic confirm: bump local row to "confirmed" and hand the
    /// network round-trip off to the host (`onConfirm`). The host is
    /// responsible for the POST + rollback strategy — keeps this VM
    /// platform-agnostic about retry behaviour.
    public func confirm(_ reservationId: String) {
        if let idx = reservations.firstIndex(where: { $0.id == reservationId }) {
            let original = reservations[idx]
            reservations[idx] = SupportTrainReservationDTO(
                id: original.id,
                slotId: original.slotId,
                userId: original.userId,
                guestName: original.guestName,
                status: "confirmed",
                contributionMode: original.contributionMode,
                dishTitle: original.dishTitle,
                restaurantName: original.restaurantName,
                estimatedArrivalAt: original.estimatedArrivalAt,
                noteToRecipient: original.noteToRecipient,
                privateNoteToOrganizer: original.privateNoteToOrganizer,
                createdAt: original.createdAt,
                updatedAt: original.updatedAt,
                canceledAt: original.canceledAt,
                helper: original.helper
            )
            rebuild()
        }
        onConfirm(reservationId)
    }

    // MARK: - Date formatters

    /// ISO-8601 with optional fractional seconds — matches Postgres'
    /// `timestamp with time zone` JSON encoding.
    private nonisolated(unsafe) static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return f
    }()

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEE MMM d"
        return f
    }()
}
