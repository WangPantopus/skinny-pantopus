//
//  AccessCodesViewModel.swift
//  Pantopus
//
//  T6.4a — Access codes (per-home roster, category-grouped). Drives the
//  shared `ListOfRows` archetype with a chip-strip filter and one
//  `RowSection` per category (in `AccessCategory.displayOrder` when the
//  "All" chip is active). Per-row redaction + clipboard helpers live on
//  the VM so the shell-rendered `RowModel.subtitle` mirrors the
//  reveal/hide state without any in-row state of its own.
//
//  Routes: `GET / POST / PUT / DELETE /api/homes/:id/access[/:secretId]`
//  (`backend/routes/home.js:5487, 5527, 5586, 5624`).
//

import Foundation
import Observation
import SwiftUI
import UIKit

/// Stable chip ids. "all" is the default + matches the design's `key: 'all'`.
enum AccessCodesChip {
    static let all = "all"

    /// Per-category chip id == category raw value, so callers can map
    /// chip id ↔ enum without a side table.
    static func id(for category: AccessCategory) -> String {
        category.rawValue
    }
}

/// Stable a11y identifiers used by the screen + tests on both platforms.
enum AccessCodesA11y {
    static let screen = "accessCodes_screen"
    static let row = "accessCodes_row"
    static let copyAction = "accessCodes_copyAction"
    static let kebabAction = "accessCodes_kebabAction"
    static let toast = "accessCodes_toast"
    static let fab = "accessCodes_fab"
}

/// Outbound routing target. The host (`YouTabRoot`) maps these onto the
/// appropriate `YouRoute.*` push or a sheet present.
enum AccessCodesTarget: Hashable {
    case addCode(homeId: String, category: AccessCategory?)
    case editCode(homeId: String, secretId: String)
    case search(homeId: String)
}

@Observable
@MainActor
final class AccessCodesViewModel: ListOfRowsDataSource {
    // MARK: - Public state

    let homeId: String
    let homeName: String?

    let title = "Access codes"

    var topBarSubtitle: String? {
        homeName
    }

    var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .search,
            accessibilityLabel: "Search access codes"
        ) { [weak self] in
            guard let self else { return }
            MainActor.assumeIsolated { self.onSelect(.search(homeId: self.homeId)) }
        }
    }

    var tabs: [ListOfRowsTab] {
        []
    }

    var selectedTab: String = "" {
        didSet { /* unused — chip strip drives filtering */ }
    }

    var fab: FABAction? {
        FABAction(
            icon: .plus,
            accessibilityLabel: "Add access code",
            variant: .secondaryCreate,
            tint: .home
        ) { [weak self] in
            guard let self else { return }
            MainActor.assumeIsolated { self.onSelect(.addCode(homeId: self.homeId, category: nil)) }
        }
    }

    private(set) var state: ListOfRowsState = .loading

    /// Ephemeral toast message (e.g. "Code copied"). Observed by the
    /// view; cleared after a short window. Public so tests can assert.
    private(set) var toastMessage: String?

    var chipStrip: ChipStripConfig? {
        ChipStripConfig(
            chips: chipConfig(),
            selectedId: selectedChip
        ) { [weak self] id in
            MainActor.assumeIsolated { self?.selectChip(id) }
        }
    }

    /// Currently-selected filter chip id ("all" or a category raw value).
    private(set) var selectedChip: String = AccessCodesChip.all

    /// Ids of secrets currently in their revealed state.
    private(set) var revealedIds: Set<String> = []

    // MARK: - Dependencies

    private let api: APIClient
    private let onSelect: @MainActor (AccessCodesTarget) -> Void
    private let clipboard: @MainActor (String) -> Void

    private var secrets: [HomeAccessSecretDTO] = []
    private var loadedOnce = false
    private var toastTask: Task<Void, Never>?

    init(
        homeId: String,
        homeName: String? = nil,
        api: APIClient = .shared,
        onSelect: @escaping @MainActor (AccessCodesTarget) -> Void = { _ in },
        clipboard: @escaping @MainActor (String) -> Void = { value in
            UIPasteboard.general.string = value
        }
    ) {
        self.homeId = homeId
        self.homeName = homeName
        self.api = api
        self.onSelect = onSelect
        self.clipboard = clipboard
    }

    // MARK: - ListOfRowsDataSource

    func load() async {
        if loadedOnce { return }
        state = .loading
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    func loadMoreIfNeeded() async {
        // Single page — no pagination on the access-secrets endpoint.
    }

    // MARK: - Chip selection

    func selectChip(_ id: String) {
        guard selectedChip != id else { return }
        selectedChip = id
        rebuild()
    }

    // MARK: - Reveal toggle + clipboard

    /// Toggle redaction for a specific secret. Re-renders the row's
    /// subtitle as the literal value or the masked placeholder.
    func toggleReveal(_ secretId: String) {
        if revealedIds.contains(secretId) {
            revealedIds.remove(secretId)
        } else {
            revealedIds.insert(secretId)
        }
        rebuild()
    }

    /// Copy the secret's literal value to the system clipboard. Fires the
    /// "Code copied" toast on success — the toast clears after ~2 seconds.
    func copyValue(for secretId: String) {
        guard let secret = secrets.first(where: { $0.id == secretId }) else { return }
        clipboard(secret.secretValue)
        showToast("Code copied")
    }

    /// Wrapped by the kebab action — for now, treats the kebab as an
    /// "Edit code" entry-point. A follow-up PR will swap this for a
    /// real action-sheet (Edit / Rotate / Delete).
    func openKebab(for secretId: String) {
        onSelect(.editCode(homeId: homeId, secretId: secretId))
    }

    /// Quick-start CTA from the empty state — opens Add Code pre-set to
    /// the selected category (or no category when "all" is active).
    func startAddCode(in category: AccessCategory?) {
        onSelect(.addCode(homeId: homeId, category: category))
    }

    // MARK: - Fetching

    private func fetch() async {
        let endpoint = HomesEndpoints.accessSecrets(homeId: homeId)
        do {
            let response: HomeAccessSecretsResponse = try await api.request(endpoint)
            secrets = response.secrets
            loadedOnce = true
            rebuild()
        } catch {
            state = .error(message: "Couldn't load access codes. Try again.")
        }
    }

    // MARK: - Toast

    private func showToast(_ message: String) {
        toastMessage = message
        toastTask?.cancel()
        toastTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            await MainActor.run {
                guard let self else { return }
                self.toastMessage = nil
            }
        }
    }

    // MARK: - Chip config

    private func chipConfig() -> [ChipStripConfig.Chip] {
        let countsByCategory = countsByCategory()
        let total = secrets.count
        var chips: [ChipStripConfig.Chip] = [
            ChipStripConfig.Chip(id: AccessCodesChip.all, label: "All (\(total))")
        ]
        for category in AccessCategory.displayOrder {
            let count = countsByCategory[category] ?? 0
            chips.append(ChipStripConfig.Chip(
                id: AccessCodesChip.id(for: category),
                label: "\(category.label) (\(count))",
                icon: category.icon
            ))
        }
        return chips
    }

    private func countsByCategory() -> [AccessCategory: Int] {
        var counts: [AccessCategory: Int] = [:]
        for secret in secrets {
            let category = AccessCategory.from(accessType: secret.accessType)
            counts[category, default: 0] += 1
        }
        return counts
    }

    // MARK: - State projection

    /// Build the section list. When the "All" chip is active, render one
    /// section per category in `displayOrder`, hiding empties. When a
    /// category chip is selected, render only that category's section.
    /// When no codes match the filter, fall back to the whole-screen
    /// empty state.
    func rebuild() {
        let visibleCategories: [AccessCategory] = if selectedChip == AccessCodesChip.all {
            AccessCategory.displayOrder
        } else if let category = AccessCategory(rawValue: selectedChip) {
            [category]
        } else {
            AccessCategory.displayOrder
        }

        var sections: [RowSection] = []
        for category in visibleCategories {
            let rows = secrets.filter { AccessCategory.from(accessType: $0.accessType) == category }
            if rows.isEmpty { continue }
            sections.append(RowSection(
                id: "category-\(category.rawValue)",
                header: category.label,
                rows: rows.map { rowFor($0) },
                count: rows.count,
                onSeeAll: { [weak self] in
                    guard let self else { return }
                    MainActor.assumeIsolated { self.onSelect(.addCode(homeId: self.homeId, category: category)) }
                },
                style: .card
            ))
        }

        if sections.isEmpty {
            state = .empty(emptyContent())
            return
        }
        state = .loaded(sections: sections, hasMore: false)
    }

    private func emptyContent() -> ListOfRowsState.EmptyContent {
        let isFiltered = selectedChip != AccessCodesChip.all
        if isFiltered, let category = AccessCategory(rawValue: selectedChip) {
            return ListOfRowsState.EmptyContent(
                icon: .keyRound,
                headline: "No \(category.label.lowercased()) codes yet",
                subcopy: "Add a \(category.label.lowercased()) code so household members can find it when they need it.",
                ctaTitle: "Add \(category.label) code"
            ) { [weak self] in
                guard let self else { return }
                MainActor.assumeIsolated { self.onSelect(.addCode(homeId: self.homeId, category: category)) }
            }
        }
        return ListOfRowsState.EmptyContent(
            icon: .keyRound,
            headline: "No access codes yet",
            subcopy: "One vault for every code at this address. Codes are encrypted, masked by default, " +
                "and only shared with members you choose.",
            ctaTitle: "Add your first code"
        ) { [weak self] in
            guard let self else { return }
            MainActor.assumeIsolated { self.onSelect(.addCode(homeId: self.homeId, category: nil)) }
        }
    }

    // MARK: - Row mapping

    /// Build a single `RowModel` for a secret. The subtitle is the
    /// masked or revealed code value; the trailing slot carries the
    /// copy + kebab icon pair. Notes ride in `body` when present.
    func rowFor(_ secret: HomeAccessSecretDTO) -> RowModel {
        let category = AccessCategory.from(accessType: secret.accessType)
        let revealed = revealedIds.contains(secret.id)
        let display = revealed ? secret.secretValue : Self.mask(for: secret.secretValue)
        let secretId = secret.id
        return RowModel(
            id: secret.id,
            title: secret.label,
            subtitle: display,
            template: .fileChevron,
            leading: .typeIcon(
                category.icon,
                background: category.background,
                foreground: category.foreground
            ),
            trailing: .iconActions(
                primary: RowIconAction(
                    icon: .copy,
                    accessibilityLabel: "Copy \(secret.label)"
                ) { [weak self] in
                    guard let self else { return }
                    MainActor.assumeIsolated { self.copyValue(for: secretId) }
                },
                secondary: RowIconAction(
                    icon: .moreHorizontal,
                    accessibilityLabel: "More actions for \(secret.label)"
                ) { [weak self] in
                    guard let self else { return }
                    MainActor.assumeIsolated { self.openKebab(for: secretId) }
                }
            ),
            onTap: { [weak self] in
                guard let self else { return }
                MainActor.assumeIsolated { self.toggleReveal(secretId) }
            },
            body: secret.notes
        )
    }

    /// Mask a code value as a row of round bullet dots, capped at 12 to
    /// keep the row geometry stable. Empty strings render as 4 dots so
    /// the placeholder is always visible.
    static func mask(for value: String) -> String {
        let length = max(1, min(12, value.count))
        return String(repeating: "•", count: max(length, 4))
    }
}
