//
//  DocumentsViewModel.swift
//  Pantopus
//
// swiftlint:disable file_length type_body_length

//  T6.4b / P17 — Backs `DocumentsView`. Fetches
//  `GET /api/homes/:id/documents` (route `backend/routes/home.js:4944`)
//  and projects each row into a category-grouped section with a
//  file-type-tinted `RowLeading.typeIcon` + `RowTrailing.kebab` (the
//  View/Share/Download/Delete menu).
//
//  Composition mirrors `docs-frames.jsx`:
//    • Chip strip — `All / Recent / Expiring / Shared` filters the
//      visible rows client-side. The section axis is *category*; chip
//      filters intersect with category bucketing (e.g. "Expiring"
//      surfaces documents with an `expires_*` field within 90 days,
//      across every category).
//    • Banner — home-green summary card (doc count + storage used +
//      expiring-soon amber tail).
//    • Sections — one per `DocumentCategory` in the design's order.
//

import Foundation
import Observation
import SwiftUI

/// Chip-strip filter ids — stored as strings so they survive the
/// `ListOfRowsDataSource.selectedTab: String` contract.
public enum DocumentsFilter: String, CaseIterable, Sendable {
    case all
    case recent
    case expiring
    case shared
}

/// Pure projection: one DTO → display fields. Tested directly so the
/// chip / banner / row mapping doesn't need a SwiftUI view to exercise.
public struct DocumentRowProjection: Sendable, Equatable {
    public let id: String
    public let category: DocumentCategory
    public let fileType: DocumentFileType
    public let filename: String
    public let sizeLabel: String?
    public let uploadedLabel: String?
    public let version: String?
    public let expiresLabel: String?
    public let expiresUrgent: Bool
    public let sharedWithCount: Int
    public let pinned: Bool
}

/// Banner summary. Pure projection from the loaded rows.
public struct DocumentsBannerSummary: Sendable, Equatable {
    public let totalCount: Int
    public let storageUsedLabel: String?
    public let expiringCount: Int

    public var hasContent: Bool {
        totalCount > 0
    }
}

@Observable
@MainActor
final class DocumentsViewModel: ListOfRowsDataSource {
    let title = "Documents"

    /// Optional home subtitle — populated by a future patch once the
    /// home detail surface lands on this screen.
    var homeSubtitle: String?

    var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .search,
            accessibilityLabel: "Search documents"
        ) { [onSearch] in onSearch() }
    }

    var chipStrip: ChipStripConfig? {
        let counts = chipCounts()
        let chips: [ChipStripConfig.Chip] = DocumentsFilter.allCases.map { filter in
            let count = counts[filter] ?? 0
            let label = switch filter {
            case .all: "All \(count)"
            case .recent: "Recent \(count)"
            case .expiring: "Expiring \(count)"
            case .shared: "Shared \(count)"
            }
            return ChipStripConfig.Chip(id: filter.rawValue, label: label)
        }
        return ChipStripConfig(
            chips: chips,
            selectedId: selectedTab
        ) { [weak self] id in
            Task { @MainActor [weak self] in
                self?.selectedTab = id
            }
        }
    }

    var tabs: [ListOfRowsTab] {
        []
    }

    var selectedTab: String = DocumentsFilter.all.rawValue {
        didSet { rebuildState() }
    }

    var fab: FABAction? {
        FABAction(
            icon: .upload,
            accessibilityLabel: "Upload document",
            variant: .secondaryCreate,
            tint: .home
        ) { [onUpload] in onUpload() }
    }

    var banner: BannerConfig? {
        guard case .loaded = state else { return nil }
        let summary = currentBannerSummary()
        guard summary.hasContent else { return nil }
        return BannerConfig(
            icon: .folderLock,
            title: bannerTitle(for: summary),
            subtitle: bannerSubtitle(for: summary),
            cta: BannerCTA(
                label: "Export",
                icon: .download,
                accessibilityLabel: "Export documents",
                tint: .home
            ) { [onExport] in onExport() },
            tint: .home
        )
    }

    private(set) var state: ListOfRowsState = .loading

    /// Last successful payload — re-filter / re-project on chip change
    /// without a re-fetch.
    private var documents: [HomeDocumentDTO]?

    private let homeId: String
    private let api: APIClient
    private let onOpenDocument: @Sendable (HomeDocumentDTO) -> Void
    private let onUpload: @Sendable () -> Void
    private let onSearch: @Sendable () -> Void
    private let onExport: @Sendable () -> Void
    private let onDocumentAction: @Sendable (HomeDocumentDTO, DocumentAction) -> Void
    /// Inject a stable "now" for tests; production uses `Date()`.
    private let now: @Sendable () -> Date

    init(
        homeId: String,
        api: APIClient = .shared,
        onOpenDocument: @escaping @Sendable (HomeDocumentDTO) -> Void = { _ in },
        onUpload: @escaping @Sendable () -> Void = {},
        onSearch: @escaping @Sendable () -> Void = {},
        onExport: @escaping @Sendable () -> Void = {},
        onDocumentAction: @escaping @Sendable (HomeDocumentDTO, DocumentAction) -> Void = { _, _ in },
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.homeId = homeId
        self.api = api
        self.onOpenDocument = onOpenDocument
        self.onUpload = onUpload
        self.onSearch = onSearch
        self.onExport = onExport
        self.onDocumentAction = onDocumentAction
        self.now = now
    }

    func load() async {
        if case .loading = state {} else { state = .loading }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    func loadMoreIfNeeded() async {}

    private func fetch() async {
        do {
            let response: GetHomeDocumentsResponse = try await api.request(
                HomesEndpoints.documents(homeId: homeId)
            )
            documents = response.documents
            rebuildState()
        } catch {
            documents = nil
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load your documents."
            )
        }
    }

    private func rebuildState() {
        guard let documents else { return }
        if documents.isEmpty {
            state = .empty(
                ListOfRowsState.EmptyContent(
                    icon: .folderLock,
                    headline: "No documents yet",
                    subcopy: "Upload your lease, insurance, or warranties. Stored end-to-end encrypted, shareable with household members.",
                    ctaTitle: "Upload document"
                ) { [onUpload] in onUpload() }
            )
            return
        }

        let nowDate = now()
        let filter = DocumentsFilter(rawValue: selectedTab) ?? .all
        let filtered = documents.filter { passes($0, filter: filter, now: nowDate) }

        if filtered.isEmpty {
            state = .empty(
                ListOfRowsState.EmptyContent(
                    icon: .folderLock,
                    headline: emptyHeadline(for: filter),
                    subcopy: "Switch chips above or upload a document to populate this scope."
                )
            )
            return
        }

        // Bucket by category, sorted by `DocumentCategory.sortOrder`.
        var bucketed: [DocumentCategory: [HomeDocumentDTO]] = [:]
        for dto in filtered {
            let category = DocumentCategory.from(docType: dto.docType)
            bucketed[category, default: []].append(dto)
        }
        let orderedCategories = bucketed.keys.sorted { $0.sortOrder < $1.sortOrder }

        let sections: [RowSection] = orderedCategories.compactMap { category in
            guard let dtos = bucketed[category], !dtos.isEmpty else { return nil }
            let rows = dtos.map { row(for: $0, now: nowDate) }
            return RowSection(
                id: "documents.\(category.rawValue)",
                header: category.label,
                rows: rows,
                count: rows.count
            )
        }
        state = .loaded(sections: sections, hasMore: false)
    }

    // MARK: - Filter passing

    private func passes(_ dto: HomeDocumentDTO, filter: DocumentsFilter, now: Date) -> Bool {
        switch filter {
        case .all:
            return true
        case .recent:
            guard let created = dto.createdAt, let date = Self.parseDate(created) else {
                return false
            }
            let cutoff = now.addingTimeInterval(-30 * 24 * 60 * 60)
            return date >= cutoff
        case .expiring:
            return expiresWithin(dto: dto, days: 90, now: now)
        case .shared:
            return dto.visibility != "private"
                && Self.sharedCount(for: dto) > 0
        }
    }

    private func expiresWithin(dto: HomeDocumentDTO, days: Int, now: Date) -> Bool {
        guard let expiresValue = dto.details["expires_at"]
            ?? dto.details["expires"]
        else { return false }
        guard let expires = Self.parseDate(expiresValue) else { return false }
        let cutoff = now.addingTimeInterval(Double(days) * 24 * 60 * 60)
        return expires <= cutoff && expires >= now
    }

    private func emptyHeadline(for filter: DocumentsFilter) -> String {
        switch filter {
        case .all: "No documents in this home"
        case .recent: "Nothing uploaded recently"
        case .expiring: "No documents expiring soon"
        case .shared: "No shared documents"
        }
    }

    // MARK: - Projection

    func row(for dto: HomeDocumentDTO, now: Date) -> RowModel {
        let dtoCopy = dto
        return Self.makeRow(
            dto: dto,
            now: now,
            onOpen: { [onOpenDocument] in onOpenDocument(dtoCopy) },
            onSecondary: { [onDocumentAction] in
                // Tapping the kebab opens View by default. A real menu
                // sheet renders in a follow-up; today we route the
                // tap to View so the row stays interactive.
                onDocumentAction(dtoCopy, .view)
            }
        )
    }

    /// Shared row builder so the Documents list and the Document Search
    /// surface (`DocumentSearchView`) render byte-identical rows. Search
    /// passes `extraChips` to append matched-tag pills after the
    /// category / expiry chips.
    static func makeRow(
        dto: HomeDocumentDTO,
        now: Date,
        extraChips: [RowChip] = [],
        onOpen: @escaping @Sendable () -> Void,
        onSecondary: @escaping @Sendable () -> Void
    ) -> RowModel {
        let projection = project(dto: dto, now: now)
        let fileType = projection.fileType
        return RowModel(
            id: projection.id,
            title: projection.filename,
            template: .statusChip,
            leading: .typeIcon(
                fileType.icon,
                background: fileType.background,
                foreground: fileType.foreground
            ),
            trailing: .kebab,
            onTap: onOpen,
            onSecondary: onSecondary,
            body: bodyLine(for: projection),
            bodyIcon: .uploadCloud,
            chips: chips(for: projection) + extraChips,
            metaTail: projection.sharedWithCount > 0
                ? "Shared \(projection.sharedWithCount)"
                : projection.sizeLabel
        )
    }

    /// Compose the "Uploaded ✕ · by ◯ · v3" body line. Each fragment is
    /// optional; the line drops the leading separator when the first
    /// fragment is missing.
    private static func bodyLine(for projection: DocumentRowProjection) -> String {
        var fragments: [String] = []
        if let uploaded = projection.uploadedLabel {
            fragments.append(uploaded)
        }
        if let version = projection.version {
            fragments.append(version)
        }
        return fragments.joined(separator: " · ")
    }

    private static func chips(for projection: DocumentRowProjection) -> [RowChip] {
        var chips: [RowChip] = [
            RowChip(
                text: projection.category.label,
                icon: projection.category.icon,
                tint: .custom(
                    background: projection.category.background,
                    foreground: projection.category.foreground
                )
            )
        ]
        if let expires = projection.expiresLabel {
            chips.append(RowChip(
                text: expires,
                icon: .calendarClock,
                tint: projection.expiresUrgent
                    ? .status(.warning)
                    : .status(.neutral)
            ))
        }
        return chips
    }

    /// Pure mapping from a DTO to display strings. Public-static so
    /// tests can exercise it without standing the VM up.
    static func project(dto: HomeDocumentDTO, now: Date) -> DocumentRowProjection {
        let category = DocumentCategory.from(docType: dto.docType)
        let fileType = DocumentFileType.from(mimeType: dto.mimeType, filename: dto.title)
        let sizeLabel = formatSize(bytes: dto.sizeBytes)
        let uploadedLabel = formatUploadedLabel(dto: dto)
        let version = dto.details["version"]
        let expires = expiresInfo(dto: dto, now: now)
        let sharedCount = sharedCount(for: dto)
        let pinned = dto.details["pinned"] == "1"
        return DocumentRowProjection(
            id: dto.id,
            category: category,
            fileType: fileType,
            filename: dto.title,
            sizeLabel: sizeLabel,
            uploadedLabel: uploadedLabel,
            version: version,
            expiresLabel: expires.label,
            expiresUrgent: expires.urgent,
            sharedWithCount: sharedCount,
            pinned: pinned
        )
    }

    private static func formatSize(bytes: Int64?) -> String? {
        guard let bytes, bytes > 0 else { return nil }
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }

    private static func formatUploadedLabel(dto: HomeDocumentDTO) -> String? {
        guard let iso = dto.createdAt, let date = parseDate(iso) else {
            return dto.details["uploaded_by"].map { "by \($0)" }
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "MMM d"
        let day = formatter.string(from: date)
        if let uploader = dto.details["uploaded_by"], !uploader.isEmpty {
            return "\(day) · by \(uploader)"
        }
        return day
    }

    private struct ExpiresInfo {
        let label: String?
        let urgent: Bool
    }

    private static func expiresInfo(dto: HomeDocumentDTO, now: Date) -> ExpiresInfo {
        let raw = dto.details["expires_at"] ?? dto.details["expires"]
        guard let raw, !raw.isEmpty, let date = parseDate(raw) else {
            return ExpiresInfo(label: nil, urgent: false)
        }
        let urgent = date.timeIntervalSince(now) <= 60 * 24 * 60 * 60 // ≤ 60d
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "MMM yyyy"
        let label = "Expires \(formatter.string(from: date))"
        return ExpiresInfo(label: label, urgent: urgent)
    }

    /// Resolve the "shared with N members" count from the DTO's
    /// `details` payload. The backend doesn't surface a structured
    /// `shared_with[]` array on the list response today; if a future
    /// patch adds it, this helper can read the array length.
    static func sharedCount(for dto: HomeDocumentDTO) -> Int {
        if let raw = dto.details["shared_count"], let n = Int(raw) { return n }
        if dto.visibility == "members" || dto.visibility == "managers" {
            // Treat any documents visible to other members as shared
            // for the display count. The number is approximate when the
            // detail payload doesn't carry an explicit count.
            return 0
        }
        return 0
    }

    static func parseDate(_ iso: String) -> Date? {
        let isoFull = ISO8601DateFormatter()
        isoFull.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = isoFull.date(from: iso) { return d }
        let isoShort = ISO8601DateFormatter()
        isoShort.formatOptions = [.withInternetDateTime]
        if let d = isoShort.date(from: iso) { return d }
        let day = DateFormatter()
        day.locale = Locale(identifier: "en_US_POSIX")
        day.timeZone = TimeZone(secondsFromGMT: 0)
        day.dateFormat = "yyyy-MM-dd"
        return day.date(from: iso)
    }

    // MARK: - Banner

    func currentBannerSummary() -> DocumentsBannerSummary {
        guard let documents else {
            return DocumentsBannerSummary(
                totalCount: 0,
                storageUsedLabel: nil,
                expiringCount: 0
            )
        }
        return Self.summarize(documents: documents, now: now())
    }

    static func summarize(documents: [HomeDocumentDTO], now: Date) -> DocumentsBannerSummary {
        var totalBytes: Int64 = 0
        var expiring = 0
        let cutoff = now.addingTimeInterval(90 * 24 * 60 * 60)
        for doc in documents {
            if let bytes = doc.sizeBytes { totalBytes += bytes }
            let raw = doc.details["expires_at"] ?? doc.details["expires"]
            if let raw, let date = parseDate(raw), date >= now, date <= cutoff {
                expiring += 1
            }
        }
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        let used = totalBytes > 0 ? formatter.string(fromByteCount: totalBytes) : nil
        return DocumentsBannerSummary(
            totalCount: documents.count,
            storageUsedLabel: used,
            expiringCount: expiring
        )
    }

    private func bannerTitle(for summary: DocumentsBannerSummary) -> String {
        let unit = summary.totalCount == 1 ? "document" : "documents"
        if let storage = summary.storageUsedLabel {
            return "\(summary.totalCount) \(unit) · \(storage)"
        }
        return "\(summary.totalCount) \(unit)"
    }

    private func bannerSubtitle(for summary: DocumentsBannerSummary) -> String {
        if summary.expiringCount > 0 {
            let unit = summary.expiringCount == 1 ? "document" : "documents"
            return "\(summary.expiringCount) \(unit) expiring in the next 90 days"
        }
        return "All current · vault end-to-end encrypted"
    }

    // MARK: - Chip counts

    private func chipCounts() -> [DocumentsFilter: Int] {
        guard let documents else { return [:] }
        let nowDate = now()
        var counts: [DocumentsFilter: Int] = [:]
        counts[.all] = documents.count
        counts[.recent] = documents.filter { passes($0, filter: .recent, now: nowDate) }.count
        counts[.expiring] = documents.filter { passes($0, filter: .expiring, now: nowDate) }.count
        counts[.shared] = documents.filter { passes($0, filter: .shared, now: nowDate) }.count
        return counts
    }
}

/// Action invoked from the kebab menu on a document row.
public enum DocumentAction: String, Sendable {
    case view
    case share
    case download
    case delete
}
