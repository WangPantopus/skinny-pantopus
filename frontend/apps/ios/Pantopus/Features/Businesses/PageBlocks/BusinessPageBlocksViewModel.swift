//
//  BusinessPageBlocksViewModel.swift
//  Pantopus
//
//  C4 — view-model for the business page **block builder** (distinct from
//  `EditBusinessPageViewModel`, which edits business profile fields). Mirrors
//  RN `src/app/businesses/[id]/page-editor.tsx:58-196`: load blocks, add from
//  a picker, move up/down, delete, preview toggle, save draft, publish.
//

import Foundation
import Observation

/// Render state for the block builder.
public enum BusinessPageBlocksState: Sendable, Equatable {
    case loading
    case loaded(blocks: [BusinessPageBlock])
    case error(message: String)
}

@Observable
@MainActor
public final class BusinessPageBlocksViewModel {
    public private(set) var state: BusinessPageBlocksState = .loading
    /// Blocks as currently edited. Empty is a legitimate loaded state (the
    /// screen renders the "No blocks yet" empty state around it).
    public private(set) var blocks: [BusinessPageBlock] = []
    public private(set) var draftRevision: Int = 0
    public private(set) var publishedRevision: Int = 0
    public private(set) var hasChanges = false
    public private(set) var isSaving = false
    public private(set) var isPublishing = false

    /// Preview toggle — renders the blocks the way visitors will see them.
    public var isPreviewing = false
    /// Transient toast text.
    public var toastMessage: String?
    /// Index of the block whose editor sheet is open.
    public var editingIndex: Int?
    /// Drives the "Add block" picker sheet.
    public var showsPicker = false
    /// Index queued for deletion — drives the confirm dialog.
    public var pendingDeleteIndex: Int?

    private let businessId: String
    private let pageId: String
    private let api: APIClient

    init(
        businessId: String,
        pageId: String,
        api: APIClient = .shared
    ) {
        self.businessId = businessId
        self.pageId = pageId
        self.api = api
    }

    // MARK: - Load

    public func load() async {
        if case .loaded = state, !blocks.isEmpty { return }
        await fetch(showLoading: true)
    }

    public func refresh() async {
        await fetch(showLoading: false)
    }

    private func fetch(showLoading: Bool) async {
        if showLoading { state = .loading }
        do {
            let response: BusinessPageBlocksResponse = try await api.request(
                BusinessPagesEndpoints.blocks(businessId: businessId, pageId: pageId)
            )
            blocks = response.blocks.enumerated().map { index, dto in
                BusinessPageBlock(dto: dto, index: index)
            }
            draftRevision = response.draftRevision ?? response.revision ?? 0
            publishedRevision = response.publishedRevision ?? 0
            hasChanges = false
            state = .loaded(blocks: blocks)
        } catch {
            state = .error(message: message(for: error, fallback: "Failed to load blocks"))
        }
    }

    // MARK: - Mutations (local until Save draft / Publish)

    /// Appends a block seeded from the registry defaults and opens its editor,
    /// matching RN's auto-open-on-add.
    public func addBlock(kind: BusinessPageBlockKind) {
        let block = BusinessPageBlock.newBlock(kind: kind, sortOrder: blocks.count)
        blocks.append(block)
        hasChanges = true
        state = .loaded(blocks: blocks)
        editingIndex = blocks.count - 1
    }

    public func update(at index: Int, to block: BusinessPageBlock) {
        guard blocks.indices.contains(index) else { return }
        blocks[index] = block
        hasChanges = true
        state = .loaded(blocks: blocks)
    }

    /// Confirmed delete — RN asks "Remove this block?" first.
    public func deleteBlock(at index: Int) {
        guard blocks.indices.contains(index) else { return }
        blocks.remove(at: index)
        renumber()
        hasChanges = true
        state = .loaded(blocks: blocks)
    }

    public func move(from index: Int, to target: Int) {
        guard blocks.indices.contains(index), target >= 0, target < blocks.count else { return }
        let moved = blocks.remove(at: index)
        blocks.insert(moved, at: target)
        renumber()
        hasChanges = true
        state = .loaded(blocks: blocks)
    }

    public func moveUp(_ index: Int) {
        move(from: index, to: index - 1)
    }

    public func moveDown(_ index: Int) {
        move(from: index, to: index + 1)
    }

    private func renumber() {
        for index in blocks.indices {
            blocks[index].sortOrder = index
        }
    }

    // MARK: - Save / publish

    public func saveDraft() async {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            try await pushDraft()
            hasChanges = false
            toastMessage = "Draft saved"
        } catch {
            toastMessage = message(for: error, fallback: "Failed to save")
        }
    }

    /// RN auto-saves any pending edits before publishing so the snapshot is
    /// never a revision behind what the editor shows.
    public func publish() async {
        guard !isPublishing else { return }
        guard !blocks.isEmpty else {
            toastMessage = "Add a block before publishing."
            return
        }
        isPublishing = true
        defer { isPublishing = false }
        do {
            if hasChanges { try await pushDraft() }
            let response: PublishBusinessPageResponse = try await api.request(
                BusinessPagesEndpoints.publishPage(businessId: businessId, pageId: pageId)
            )
            if let revision = response.publishedRevision { publishedRevision = revision }
            hasChanges = false
            toastMessage = "Page published as v\(publishedRevision)"
        } catch {
            toastMessage = message(for: error, fallback: "Failed to publish")
        }
    }

    private func pushDraft() async throws {
        let payload = SaveBusinessPageBlocksRequest(
            blocks: blocks.enumerated().map { index, block in
                block.saveRequest(sortOrder: index)
            }
        )
        let response: SaveBusinessPageBlocksResponse = try await api.request(
            BusinessPagesEndpoints.saveDraftBlocks(
                businessId: businessId,
                pageId: pageId,
                body: payload
            )
        )
        if let revision = response.draftRevision { draftRevision = revision }
        // Adopt the server ids so a second save updates instead of duplicating.
        blocks = response.blocks.enumerated().map { index, dto in
            BusinessPageBlock(dto: dto, index: index)
        }
        state = .loaded(blocks: blocks)
    }

    private func message(for error: Error, fallback: String) -> String {
        (error as? APIError)?.errorDescription ?? fallback
    }
}
