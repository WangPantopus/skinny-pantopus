//
//  SupportTrainsSearchViewModel.swift
//  Pantopus
//
//  P4.6 — Support Trains search. Reuses the shared `SearchListShell`
//  scaffold; the only per-surface customization is the data-source
//  filter (this VM) and the row template (mirrors the Support Trains
//  list row — category-gradient tile + status chip).
//
//  The corpus is the same `/me/support-trains` feed the list screen
//  loads. Filtering is client-side over the already-fetched rows, so the
//  shell never sees a per-keystroke fetch — `isLoading` only reflects the
//  one-shot corpus load.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
public final class SupportTrainsSearchViewModel {
    /// Live query text. Bound to the shell's search field.
    public var query: String = ""

    /// True only while the one-shot corpus fetch is in flight. Client-side
    /// filtering is synchronous, so the shell shows the typing shimmer just
    /// for the initial load, never per keystroke.
    public private(set) var isLoading = false

    private var corpus: [SupportTrainListItemDTO] = []
    private var loadedOnce = false

    private let api: APIClient
    private let onOpenTrain: @MainActor (String) -> Void
    private let onCancelSearch: @MainActor () -> Void

    init(
        api: APIClient = .shared,
        onOpenTrain: @escaping @MainActor (String) -> Void = { _ in },
        onCancel: @escaping @MainActor () -> Void = {}
    ) {
        self.api = api
        self.onOpenTrain = onOpenTrain
        onCancelSearch = onCancel
    }

    /// Trains matching the current query, case-insensitive over the
    /// recipient / title / train-type label. An empty query yields no
    /// results so the shell renders the recent phase rather than the full
    /// corpus.
    public var results: [SupportTrainListItemDTO] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return [] }
        return corpus.filter { Self.searchableText(for: $0).contains(needle) }
    }

    // MARK: - Lifecycle

    public func load() async {
        if loadedOnce { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let response: SupportTrainsListResponse = try await api.request(
                SupportTrainsEndpoints.mine()
            )
            corpus = response.supportTrains
            loadedOnce = true
        } catch {
            // A failed corpus load degrades to "no matches" — the user can
            // cancel and retry from the list. The list screen owns the
            // first-class error/retry surface; search stays inside the
            // shell's four-phase contract.
            corpus = []
        }
    }

    // MARK: - Intents

    public func openResult(_ train: SupportTrainListItemDTO) {
        onOpenTrain(train.id)
    }

    public func cancel() {
        onCancelSearch()
    }

    // MARK: - Filtering

    static func searchableText(for train: SupportTrainListItemDTO) -> String {
        [
            train.recipientName,
            train.title,
            train.supportTrainType.map { _ in SupportTrainType.from(train.supportTrainType).label }
        ]
        .compactMap { $0 }
        .joined(separator: " ")
        .lowercased()
    }

    // MARK: - Row mapping

    /// Mirrors `SupportTrainsViewModel.rowModel(for:)` — category-gradient
    /// leading tile + recipient/title headline + "type · role" subtitle +
    /// status chip. Tapping a result opens the train.
    func rowModel(for train: SupportTrainListItemDTO) -> RowModel {
        let type = SupportTrainType.from(train.supportTrainType)
        let chip = statusChip(for: train.status)
        return RowModel(
            id: train.id,
            title: train.recipientName ?? train.title ?? "Support train",
            subtitle: subtitleLine(for: train, type: type),
            template: .statusChip,
            leading: .categoryGradientIcon(type.icon, gradient: type.gradient),
            trailing: .statusChip(text: chip.text, variant: chip.variant),
            onTap: { [weak self] in
                MainActor.assumeIsolated { self?.openResult(train) }
            },
            metaTail: metaTail(for: train)
        )
    }

    private func subtitleLine(
        for train: SupportTrainListItemDTO,
        type: SupportTrainType
    ) -> String? {
        let parts: [String?] = [
            train.supportTrainType.map { _ in type.label },
            roleLabel(for: train.myRole)
        ]
        let flattened = parts.compactMap { $0 }.filter { !$0.isEmpty }
        return flattened.isEmpty ? nil : flattened.joined(separator: " · ")
    }

    private func roleLabel(for role: String?) -> String? {
        switch role ?? "" {
        case "organizer": "You organize"
        case "co_organizer": "You co-organize"
        case "helper": "Helper"
        default: nil
        }
    }

    private func metaTail(for train: SupportTrainListItemDTO) -> String? {
        if let total = train.slotsTotal {
            let filled = train.slotsFilled ?? 0
            let left = max(0, total - filled)
            return left == 0 ? "\(filled) / \(total) slots" : "\(filled) / \(total) slots · \(left) open"
        }
        if let starts = train.startsOn, let ends = train.endsOn {
            return "\(starts) — \(ends)"
        }
        return nil
    }

    private func statusChip(for status: String?) -> (text: String, variant: StatusChipVariant) {
        switch status ?? "" {
        case "active": ("Active", .success)
        case "filling": ("Filling up", .info)
        case "full": ("Slots full", .neutral)
        case "wrapping": ("Wrapping up", .warning)
        case "complete": ("Complete", .neutral)
        case "invited": ("Invited", .business)
        case "proposed": ("Proposed", .neutral)
        default: ("Active", .info)
        }
    }
}
