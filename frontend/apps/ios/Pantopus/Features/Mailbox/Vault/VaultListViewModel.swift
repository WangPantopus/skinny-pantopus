//
//  VaultListViewModel.swift
//  Pantopus
//
//  T6.5e (P19.5) — Backs the Mailbox Vault list. The vault is the
//  user's "keep pile" of saved mail — a personal-pillar surface (sky
//  blue) under the Mailbox stack, not scoped to a home. The VM
//  fetches the user's vault folders, then aggregates items across
//  folders into a single flat list sorted by save date desc.
//
//  Per the design (`vault-frames.jsx`), rows render with a colored
//  type tile, item title, sender · saved-date subtitle, and a
//  folder chip. The view-model produces shell-friendly `RowModel`s
//  so the screen plugs into the shared `ListOfRowsView` shell.
//

// swiftlint:disable file_length type_body_length

import Foundation
import Observation
import SwiftUI

/// View-model for the Mailbox Vault list-of-rows surface.
@Observable
@MainActor
public final class VaultListViewModel: ListOfRowsDataSource {
    // MARK: - ListOfRowsDataSource

    public let title = "Vault"
    public var topBarSubtitle: String? {
        guard case let .loaded(_, total) = phase else { return "Saved from Mailbox" }
        return total == 0
            ? "Saved from Mailbox"
            : "Saved from Mailbox · \(total) item\(total == 1 ? "" : "s")"
    }

    public var topBarAction: TopBarAction? {
        nil
    }

    /// RN's `DRAWER_TABS` (`src/app/mailbox/vault.tsx:12`) — the vault is
    /// drawer-scoped and the strip switches which drawer's folders load.
    public let tabs: [ListOfRowsTab] = [
        ListOfRowsTab(id: "personal", label: "Me"),
        ListOfRowsTab(id: "home", label: "Home"),
        ListOfRowsTab(id: "business", label: "Business")
    ]

    public var selectedTab: String = "personal" {
        didSet {
            guard oldValue != selectedTab else { return }
            allRows = []
            phase = .loading
            Task { @MainActor [weak self] in await self?.fetch() }
        }
    }

    public var fab: FABAction? {
        FABAction(
            icon: .plus,
            accessibilityLabel: "Save mail to vault",
            variant: .secondaryCreate,
            tint: .sky
        ) { @Sendable in
            Task { @MainActor in self.onAddTapped() }
        }
    }

    public var state: ListOfRowsState {
        switch phase {
        case .loading:
            return .loading
        case let .searchLoaded(results, total):
            guard !results.isEmpty else {
                return .empty(
                    ListOfRowsState.EmptyContent(
                        icon: .search,
                        headline: "No matches found",
                        subcopy: "Nothing in your archive matches that. Try a sender name, an amount "
                            + "like $87, or a month like March 2025."
                    )
                )
            }
            return .loaded(
                sections: [
                    RowSection(
                        id: "vaultSearch",
                        header: "\(total) result\(total == 1 ? "" : "s") · All drawers",
                        rows: results.map(searchRow(for:))
                    )
                ],
                hasMore: false
            )
        case let .loaded(rows, _):
            guard !rows.isEmpty else {
                return .empty(
                    ListOfRowsState.EmptyContent(
                        icon: .archive,
                        headline: "Your vault is empty",
                        subcopy: "Save mail to keep it. Anything you bookmark from your Mailbox lands here — "
                            + "civic notices, permits, receipts, scanned letters.",
                        ctaTitle: "Open Mailbox"
                    ) { @Sendable in
                        Task { @MainActor in self.onOpenMailbox() }
                    }
                )
            }
            return .loaded(
                sections: [RowSection(rows: rows.map(row(for:)))],
                hasMore: false
            )
        case let .error(message):
            return .error(message: message)
        }
    }

    public var searchBar: SearchBarConfig? {
        SearchBarConfig(
            placeholder: "Search sender, amount, date…",
            text: query,
            onChange: { @Sendable text in
                Task { @MainActor in self.onQueryChange(text) }
            },
            onSubmit: { @Sendable in
                Task { @MainActor in await self.performSearch() }
            }
        )
    }

    // MARK: - Internal state

    /// Local phase — finer-grained than `ListOfRowsState` because the
    /// shell's `state` is recomputed from this on every observation.
    private enum Phase {
        case loading
        case loaded(rows: [VaultListRow], total: Int)
        /// Server-side search results (`GET …/vault/search`) — replaces the
        /// folder view for as long as the query is ≥ 2 characters.
        case searchLoaded(results: [VaultSearchResultDTO], total: Int)
        case error(message: String)
    }

    /// RN debounces the search field by 300 ms
    /// (`src/app/mailbox/vault.tsx:56`).
    private static let searchDebounceNanos: UInt64 = 300_000_000
    /// RN only searches once the trimmed query is longer than one
    /// character (`src/app/mailbox/vault.tsx:55`).
    private static let minimumSearchLength = 2

    private var phase: Phase = .loading
    private var searchTask: Task<Void, Never>?
    /// Unfiltered union of every row fetched on the last load. The
    /// `phase`'s rows are the post-filter view.
    private var allRows: [VaultListRow] = []
    private(set) var folders: [VaultFolderDTO] = []
    public var query: String = ""

    private let api: APIClient
    private let onOpenItem: (String) -> Void
    private let onAddTapped: () -> Void
    private let onOpenMailbox: () -> Void

    init(
        api: APIClient = .shared,
        drawer: String = "personal",
        onOpenItem: @escaping (String) -> Void = { _ in },
        onAddTapped: @escaping () -> Void = {},
        onOpenMailbox: @escaping () -> Void = {}
    ) {
        self.api = api
        self.onOpenItem = onOpenItem
        self.onAddTapped = onAddTapped
        self.onOpenMailbox = onOpenMailbox
        // Assigned after the stored callbacks so the `didSet` refetch —
        // which only fires on a *change* — never runs during init.
        selectedTab = drawer
    }

    /// The drawer the folder pane is scoped to. Driven by the tab strip.
    private var drawer: String {
        selectedTab
    }

    // MARK: - Load

    public func load() async {
        if case .loaded = phase { return }
        phase = .loading
        await fetch()
    }

    public func refresh() async {
        if isSearching {
            await performSearch()
            return
        }
        await fetch()
    }

    public func loadMoreIfNeeded() async {} // Pagination handled per folder; not yet exposed in UI.

    /// `true` once the trimmed query clears RN's two-character threshold —
    /// the point at which the vault stops filtering the fetched folder rows
    /// and starts asking the server to search the whole archive.
    public var isSearching: Bool {
        query.trimmingCharacters(in: .whitespacesAndNewlines).count >= Self.minimumSearchLength
    }

    public func onQueryChange(_ text: String) {
        query = text
        searchTask?.cancel()
        guard isSearching else {
            // Below the threshold we're back on the folder view — drop any
            // stale server results and re-apply the local filter.
            if case .searchLoaded = phase {
                phase = .loaded(rows: Self.filter(rows: allRows, query: query), total: allRows.count)
            } else {
                recomputeFromCache()
            }
            return
        }
        // Narrow the already-fetched rows straight away so the field feels
        // live, then let the debounced server search replace them.
        recomputeFromCache()
        searchTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: Self.searchDebounceNanos)
            guard !Task.isCancelled else { return }
            await self?.performSearch()
        }
    }

    /// `GET /api/mailbox/v2/p2/vault/search` — searches every drawer, not
    /// just the rows the folder pane already fetched.
    public func performSearch() async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= Self.minimumSearchLength else { return }
        do {
            let response: VaultSearchResponse = try await api.request(
                MailboxVaultEndpoints.search(query: trimmed)
            )
            // A slower in-flight search must not clobber a newer query.
            guard query.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed else { return }
            phase = .searchLoaded(
                results: response.results,
                total: response.total ?? response.results.count
            )
        } catch {
            guard query.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed else { return }
            phase = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't search your vault."
            )
        }
    }

    /// Public so tests can inject decoded payloads without standing
    /// the whole network stack up.
    public func ingest(folders: [VaultFolderDTO], itemsByFolder: [String: [VaultMailItemDTO]]) {
        self.folders = folders
        allRows = Self.flatten(folders: folders, itemsByFolder: itemsByFolder)
        let filtered = Self.filter(rows: allRows, query: query)
        phase = .loaded(rows: filtered, total: allRows.count)
    }

    // MARK: - Helpers

    private func fetch() async {
        do {
            let folderResp: VaultFoldersResponse = try await api.request(
                MailboxVaultEndpoints.folders(drawer: drawer)
            )
            let folders = folderResp.folders
            self.folders = folders

            // Fetch up to 20 items per folder in parallel and union the
            // results. The design's "Recent" pane shows the freshest
            // items across folders; client-side aggregation keeps the
            // request count modest for the common case.
            let perFolderLimit = 20
            var itemsByFolder: [String: [VaultMailItemDTO]] = [:]
            await withTaskGroup(of: (String, [VaultMailItemDTO]).self) { group in
                for folder in folders {
                    group.addTask { [api, folder] in
                        do {
                            let resp: VaultFolderItemsResponse = try await api.request(
                                MailboxVaultEndpoints.folderItems(
                                    folderId: folder.id,
                                    limit: perFolderLimit
                                )
                            )
                            return (folder.id, resp.items)
                        } catch {
                            return (folder.id, [])
                        }
                    }
                }
                for await (folderId, items) in group {
                    itemsByFolder[folderId] = items
                }
            }
            ingest(folders: folders, itemsByFolder: itemsByFolder)
        } catch {
            phase = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load your vault."
            )
        }
    }

    private func recomputeFromCache() {
        guard case .loaded = phase else { return }
        let filtered = Self.filter(rows: allRows, query: query)
        phase = .loaded(rows: filtered, total: allRows.count)
    }

    static func flatten(
        folders: [VaultFolderDTO],
        itemsByFolder: [String: [VaultMailItemDTO]]
    ) -> [VaultListRow] {
        let folderById = Dictionary(uniqueKeysWithValues: folders.map { ($0.id, $0) })
        let allRows: [VaultListRow] = itemsByFolder.flatMap { folderId, items in
            items.map { item in
                VaultListRow(
                    id: item.id,
                    item: item,
                    folder: folderById[folderId] ?? folderById[item.vaultFolderId ?? ""]
                )
            }
        }
        return allRows.sorted { lhs, rhs -> Bool in
            (lhs.item.createdAt ?? "") > (rhs.item.createdAt ?? "")
        }
    }

    static func filter(rows: [VaultListRow], query: String) -> [VaultListRow] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return rows }
        let needle = trimmed.lowercased()
        return rows.filter { row in
            let haystack = [
                row.title,
                row.subtitle,
                row.folder?.label
            ].compactMap { $0 }.joined(separator: " ").lowercased()
            return haystack.contains(needle)
        }
    }

    private func row(for vaultRow: VaultListRow) -> RowModel {
        let mailType = MailboxVaultMailType.fromRaw(vaultRow.item.mailType ?? vaultRow.item.type)
        let typeIcon = mailType.icon
        let typeTint = mailType.accent
        let folderChip: RowChip? = vaultRow.folder.map { folder in
            RowChip(
                text: folder.label,
                icon: MailboxVaultFolderIcon.fromRaw(folder.icon).icon,
                tint: .status(.neutral)
            )
        }
        let itemId = vaultRow.id
        return RowModel(
            id: itemId,
            title: vaultRow.title,
            subtitle: vaultRow.subtitle,
            template: .fileChevron,
            leading: .icon(typeIcon, tint: typeTint),
            trailing: .kebab,
            onTap: { @Sendable in Task { @MainActor in self.onOpenItem(itemId) } },
            onSecondary: { @Sendable in Task { @MainActor in self.onOpenItem(itemId) } },
            chips: folderChip.map { [$0] }
        )
    }

    /// Row projection for a server-side search hit. Mirrors RN's result
    /// card (`src/app/mailbox/vault.tsx:134`): sender + date on the top
    /// line, preview underneath, and a drawer chip plus a "→ subject"
    /// matched-field chip.
    private func searchRow(for result: VaultSearchResultDTO) -> RowModel {
        let mailType = MailboxVaultMailType.fromRaw(result.mailType ?? result.type)
        var chips: [RowChip] = []
        if let drawer = result.drawer, !drawer.isEmpty {
            chips.append(RowChip(text: drawer.capitalized, tint: .status(.neutral)))
        }
        if let matchField = result.matchField, !matchField.isEmpty {
            chips.append(RowChip(text: "→ \(matchField)", tint: .status(.success)))
        }
        let title = result.senderDisplay
            ?? result.senderBusinessName
            ?? result.subject
            ?? "Saved mail"
        let preview = result.matchExcerpt?.isEmpty == false
            ? result.matchExcerpt
            : (result.previewText ?? result.subject)
        let subtitle = [preview, VaultListRow.savedAtLabel(result.createdAt)]
            .compactMap { $0?.isEmpty == false ? $0 : nil }
            .joined(separator: " · ")
        let itemId = result.id
        return RowModel(
            id: itemId,
            title: title,
            subtitle: subtitle.isEmpty ? nil : subtitle,
            template: .fileChevron,
            leading: .icon(mailType.icon, tint: mailType.accent),
            trailing: .chevron,
            onTap: { @Sendable in Task { @MainActor in self.onOpenItem(itemId) } },
            chips: chips.isEmpty ? nil : chips
        )
    }
}

/// Projected flat row — survives the cross-folder union with enough
/// context for the row mapping helper.
public struct VaultListRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let item: VaultMailItemDTO
    public let folder: VaultFolderDTO?

    public init(id: String, item: VaultMailItemDTO, folder: VaultFolderDTO?) {
        self.id = id
        self.item = item
        self.folder = folder
    }

    public var title: String {
        item.displayTitle
            ?? item.subject
            ?? item.previewText
            ?? "Saved mail"
    }

    public var subtitle: String {
        let sender = item.senderBusinessName ?? item.senderAddress ?? "Unknown sender"
        if let saved = Self.savedAtLabel(item.createdAt) {
            return "\(sender) · \(saved)"
        }
        return sender
    }

    static func savedAtLabel(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let isoFull = ISO8601DateFormatter()
        isoFull.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        guard let date = isoFull.date(from: iso) ?? plain.date(from: iso) else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return "Saved \(formatter.string(from: date))"
    }
}

/// Classification for the leading type-icon tile. Maps the backend's
/// `mail.mail_type` / `mail.type` strings to a Pantopus icon + accent
/// from the design's mail-type palette.
public enum MailboxVaultMailType: Sendable, Hashable {
    case letter
    case notice
    case permit
    case receipt
    case parcel
    case scan
    case doc

    public static func fromRaw(_ raw: String?) -> MailboxVaultMailType {
        guard let raw = raw?.lowercased() else { return .letter }
        switch raw {
        case "notice", "civic", "community", "announcement": return .notice
        case "permit", "license", "certified": return .permit
        case "receipt", "invoice", "bill": return .receipt
        case "package", "parcel", "delivery": return .parcel
        case "scan", "scanned", "scanned_letter": return .scan
        case "doc", "document", "booklet", "coupon": return .doc
        default: return .letter
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .letter: .mail
        case .notice: .megaphone
        case .permit: .stamp
        case .receipt: .receiptText
        case .parcel: .package
        case .scan: .scanLine
        case .doc: .fileText
        }
    }

    public var accent: Color {
        switch self {
        case .letter: Theme.Color.primary600
        case .notice: Theme.Color.business
        case .permit: Theme.Color.warning
        case .receipt: Theme.Color.success
        case .parcel: Theme.Color.warning
        case .scan: Theme.Color.error
        case .doc: Theme.Color.appTextSecondary
        }
    }
}

/// Classification for the folder chip icon. Backend stores `icon` as
/// an emoji on the system folders; we map the common labels to a
/// Pantopus icon so the chip renders with the design's glyph.
public enum MailboxVaultFolderIcon: Sendable, Hashable {
    case civic
    case receipts
    case health
    case finance
    case travel
    case keepsakes
    case generic

    public static func fromRaw(_ raw: String?) -> MailboxVaultFolderIcon {
        guard let raw = raw?.lowercased() else { return .generic }
        if raw.contains("📋") || raw.contains("📜") || raw.contains("🏛") || raw.contains("civic") || raw.contains("permit") {
            return .civic
        }
        if raw.contains("🧾") || raw.contains("receipt") || raw.contains("invoice") {
            return .receipts
        }
        if raw.contains("🏥") || raw.contains("health") || raw.contains("medical") {
            return .health
        }
        if raw.contains("🏦") || raw.contains("💳") || raw.contains("bank") || raw.contains("finance") || raw.contains("tax") {
            return .finance
        }
        if raw.contains("✈") || raw.contains("plane") || raw.contains("travel") {
            return .travel
        }
        if raw.contains("📩") || raw.contains("keepsake") || raw.contains("letter") {
            return .keepsakes
        }
        return .generic
    }

    public var icon: PantopusIcon {
        switch self {
        case .civic: .landmark
        case .receipts: .receipt
        case .health: .heartPulse
        case .finance: .piggyBank
        case .travel: .plane
        case .keepsakes: .mailOpen
        case .generic: .folderLock
        }
    }
}
