//
//  BusinessPagesViewModel.swift
//  Pantopus
//
//  C4 — the custom-pages CMS index for a business. Mirrors RN
//  `src/components/business/tabs/PagesTab.tsx:30-108`: create page, delete
//  page, revision history, restore revision. Each row opens the block
//  builder (`BusinessPageBlocksView`).
//

import Foundation
import Observation

/// One row in the pages list.
public struct BusinessPageRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let slug: String
    public let isDefault: Bool
    public let publishedRevision: Int

    public init(dto: BusinessPageDTO) {
        id = dto.id
        title = dto.title
        slug = dto.slug
        isDefault = dto.isDefault == true
        publishedRevision = dto.publishedRevision ?? 0
    }

    /// `v3` once published, otherwise "Unpublished" — RN's badge copy.
    public var statusLabel: String {
        publishedRevision > 0 ? "v\(publishedRevision)" : "Unpublished"
    }

    public var isPublished: Bool {
        publishedRevision > 0
    }
}

/// One revision-history entry.
public struct BusinessPageRevisionRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let revision: Int
    public let title: String
    public let subtitle: String

    public init(dto: BusinessPageRevisionDTO) {
        id = dto.id
        revision = dto.revision
        let notes = dto.notes?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        title = notes.isEmpty ? "v\(dto.revision)" : "v\(dto.revision) — \(notes)"
        let publisher = dto.publisher?.name
            ?? dto.publisher?.username
            ?? "Unknown"
        let date = BusinessPageRevisionRow.formatted(dto.publishedAt)
        subtitle = date.isEmpty ? publisher : "\(publisher) · \(date)"
    }

    /// Supabase emits both `…Z` and `…​.123456Z`, so try the fractional
    /// parser first and fall back to the plain one.
    private static func formatted(_ iso: String?) -> String {
        guard let iso else { return "" }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        guard let date = fractional.date(from: iso) ?? plain.date(from: iso) else { return "" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

/// Render state for the pages list.
public enum BusinessPagesState: Sendable, Equatable {
    case loading
    case loaded(rows: [BusinessPageRow])
    case empty
    case error(message: String)
}

@Observable
@MainActor
public final class BusinessPagesViewModel {
    public private(set) var state: BusinessPagesState = .loading
    public private(set) var isCreating = false
    public private(set) var isLoadingRevisions = false
    public private(set) var revisions: [BusinessPageRevisionRow] = []
    /// Page id whose revision history is expanded, nil when collapsed.
    public private(set) var expandedRevisionsPageId: String?
    public private(set) var restoringRevision: Int?

    /// Add-page form.
    public var showsAddForm = false
    public var draftTitle = ""
    public var draftSlug = ""
    public var toastMessage: String?
    /// Page queued for deletion — drives the confirm dialog.
    public var pendingDelete: BusinessPageRow?

    private let businessId: String
    private let api: APIClient

    init(businessId: String, api: APIClient = .shared) {
        self.businessId = businessId
        self.api = api
    }

    // MARK: - Load

    public func load() async {
        if case .loaded = state { return }
        await fetch(showLoading: true)
    }

    public func refresh() async {
        await fetch(showLoading: false)
    }

    private func fetch(showLoading: Bool) async {
        if showLoading { state = .loading }
        do {
            let response: BusinessPagesResponse = try await api.request(
                BusinessPagesEndpoints.pages(businessId: businessId)
            )
            let rows = response.pages.map(BusinessPageRow.init(dto:))
            state = rows.isEmpty ? .empty : .loaded(rows: rows)
        } catch {
            state = .error(message: message(for: error, fallback: "Failed to load pages"))
        }
    }

    // MARK: - Create

    /// Slugs are lowercase `[a-z0-9-]` — RN sanitises as you type.
    public func setSlug(_ raw: String) {
        draftSlug = raw.lowercased().filter { $0.isLowercase || $0.isNumber || $0 == "-" }
    }

    public func createPage() async {
        let title = draftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let slug = draftSlug.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, !slug.isEmpty else {
            toastMessage = "Title and slug are required"
            return
        }
        guard !isCreating else { return }
        isCreating = true
        defer { isCreating = false }
        do {
            _ = try await api.request(
                BusinessPagesEndpoints.createPage(
                    businessId: businessId,
                    body: CreateBusinessPageRequest(slug: slug, title: title, showInNav: true)
                ),
                as: BusinessPageEnvelope.self
            )
            draftTitle = ""
            draftSlug = ""
            showsAddForm = false
            await fetch(showLoading: false)
        } catch {
            toastMessage = message(for: error, fallback: "Failed to create page")
        }
    }

    // MARK: - Delete

    public func deletePage(_ row: BusinessPageRow) async {
        do {
            _ = try await api.request(
                BusinessPagesEndpoints.deletePage(businessId: businessId, pageId: row.id),
                as: EmptyResponse.self
            )
            if expandedRevisionsPageId == row.id { collapseRevisions() }
            await fetch(showLoading: false)
        } catch {
            toastMessage = message(for: error, fallback: "Failed to delete")
        }
    }

    // MARK: - Revisions

    /// Second tap on the same page collapses the panel — RN's toggle.
    public func toggleRevisions(for row: BusinessPageRow) async {
        if expandedRevisionsPageId == row.id {
            collapseRevisions()
            return
        }
        expandedRevisionsPageId = row.id
        revisions = []
        isLoadingRevisions = true
        defer { isLoadingRevisions = false }
        do {
            let response: BusinessPageRevisionsResponse = try await api.request(
                BusinessPagesEndpoints.revisions(businessId: businessId, pageId: row.id)
            )
            revisions = response.revisions.map(BusinessPageRevisionRow.init(dto:))
        } catch {
            revisions = []
            toastMessage = message(for: error, fallback: "Failed to load revisions")
        }
    }

    public func collapseRevisions() {
        expandedRevisionsPageId = nil
        revisions = []
    }

    public func restore(revision: Int, pageId: String) async {
        guard restoringRevision == nil else { return }
        restoringRevision = revision
        defer { restoringRevision = nil }
        do {
            _ = try await api.request(
                BusinessPagesEndpoints.restoreRevision(
                    businessId: businessId,
                    pageId: pageId,
                    revision: revision
                ),
                as: RestoreBusinessPageRevisionResponse.self
            )
            toastMessage = "Revision v\(revision) restored to draft"
            collapseRevisions()
            await fetch(showLoading: false)
        } catch {
            toastMessage = message(for: error, fallback: "Failed to restore")
        }
    }

    private func message(for error: Error, fallback: String) -> String {
        (error as? APIError)?.errorDescription ?? fallback
    }
}
