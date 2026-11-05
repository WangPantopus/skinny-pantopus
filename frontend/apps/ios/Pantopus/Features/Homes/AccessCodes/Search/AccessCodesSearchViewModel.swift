//
//  AccessCodesSearchViewModel.swift
//  Pantopus
//
//  P4.6 — Access codes search. Reuses the shared `SearchListShell`
//  scaffold; the only per-surface customization is the data-source
//  filter (this VM) and the row template (type tile + label + masked
//  value + chevron). Values stay masked in the transient search surface
//  — tapping a result opens the code's editor where it can be revealed
//  and copied.
//
//  The corpus is the same `GET /api/homes/:id/access` roster the Access
//  codes list loads; filtering is client-side over label / notes /
//  category, so `isLoading` only covers the one-shot corpus fetch.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class AccessCodesSearchViewModel {
    let homeId: String

    /// Live query text. Bound to the shell's search field.
    var query: String = ""

    /// True only while the one-shot corpus fetch is in flight.
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    private var corpus: [HomeAccessSecretDTO] = []
    private var loadedOnce = false
    private var readGeneration = 0

    private let api: APIClient
    private let onOpenCode: @MainActor (String) -> Void
    private let onCancelSearch: @MainActor () -> Void

    init(
        homeId: String,
        api: APIClient = .shared,
        onOpenCode: @escaping @MainActor (String) -> Void = { _ in },
        onCancel: @escaping @MainActor () -> Void = {}
    ) {
        self.homeId = homeId
        self.api = api
        self.onOpenCode = onOpenCode
        onCancelSearch = onCancel
    }

    /// Codes matching the current query, case-insensitive over the label /
    /// notes / category label. The secret value is intentionally excluded
    /// from the searchable text. An empty query yields no results so the
    /// shell renders the recent phase.
    var results: [HomeAccessSecretDTO] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return [] }
        return corpus.filter { Self.searchableText(for: $0).contains(needle) }
    }

    // MARK: - Lifecycle

    func load() async {
        if loadedOnce { return }
        readGeneration &+= 1
        let generation = readGeneration
        isLoading = true
        errorMessage = nil
        defer { if generation == readGeneration { isLoading = false } }
        do {
            let response: HomeAccessSecretsResponse = try await api.request(
                HomesEndpoints.accessSecrets(homeId: homeId)
            )
            guard generation == readGeneration, !Task.isCancelled else { return }
            corpus = response.secrets
            loadedOnce = true
        } catch {
            guard generation == readGeneration, !Task.isCancelled else { return }
            corpus = []
            errorMessage = "Couldn't load access codes. Try again."
        }
    }

    func suspend() {
        readGeneration &+= 1
        corpus = []
        loadedOnce = false
        isLoading = true
        errorMessage = nil
    }

    // MARK: - Intents

    func openResult(_ secret: HomeAccessSecretDTO) {
        guard corpus.contains(where: { $0.id == secret.id }) else { return }
        onOpenCode(secret.id)
    }

    func cancel() {
        onCancelSearch()
    }

    // MARK: - Filtering

    static func searchableText(for secret: HomeAccessSecretDTO) -> String {
        [
            secret.label,
            secret.notes,
            AccessCategory.from(accessType: secret.accessType).label
        ]
        .compactMap { $0 }
        .joined(separator: " ")
        .lowercased()
    }

    // MARK: - Row mapping

    /// Mirrors the Access codes list row visual (category tile + label +
    /// masked value) but with a drill-in chevron: search is a find-then-
    /// open surface, so the value reveal + copy live on the editor it
    /// pushes to, keeping secrets masked in the transient results list.
    func rowModel(for secret: HomeAccessSecretDTO) -> RowModel {
        let category = AccessCategory.from(accessType: secret.accessType)
        return RowModel(
            id: secret.id,
            title: secret.label,
            subtitle: AccessCodesViewModel.mask(for: secret.secretValue),
            template: .fileChevron,
            leading: .typeIcon(
                category.icon,
                background: category.background,
                foreground: category.foreground
            ),
            trailing: .chevron,
            onTap: { [weak self] in
                MainActor.assumeIsolated { self?.openResult(secret) }
            },
            body: secret.notes
        )
    }
}
