//
//  SavedPostsModel.swift
//  Pantopus
//
//  My posts' Saved tab: the posts the viewer bookmarked and can still open
//  (`GET /api/posts/saved`), newest save first, each with Remove. Kept apart
//  from `MyPostsViewModel` because it reads a different list (other people's
//  posts, paged by save offset) with a different row action; the rows reuse
//  that model's row helpers, and `MyPostsViewModel` hands the list shell to
//  this model while the Saved tab is selected.
//

import Foundation
import Observation

@Observable
@MainActor
public final class SavedPostsModel {
    public private(set) var state: ListOfRowsState = .loading
    public private(set) var loadMoreError: String?
    /// A failed Remove says so; the row stays.
    public var toastMessage: String?

    private let api: APIClient
    private let onOpenPost: @MainActor (MyPostDTO) -> Void
    private let now: @Sendable () -> Date
    private var posts: [MyPostDTO] = []
    private var nextOffset: Int?
    private var loadedOnce = false
    private var loadingMore = false
    /// Bumped by every first-page load so a page that lands later can't append to its replacement.
    private var generation = 0
    private var removing: Set<String> = []

    static let pageSize = 50

    init(
        api: APIClient,
        onOpenPost: @escaping @MainActor (MyPostDTO) -> Void,
        now: @escaping @Sendable () -> Date
    ) {
        self.api = api
        self.onOpenPost = onOpenPost
        self.now = now
    }

    /// Every visit to the tab re-reads it, so posts saved elsewhere since show up.
    func load() async {
        generation += 1
        let current = generation
        loadingMore = false
        loadMoreError = nil
        if !loadedOnce { state = .loading }
        do {
            let response: SavedPostsResponse = try await api.request(
                PostsEndpoints.savedPosts(limit: Self.pageSize, offset: 0)
            )
            guard current == generation else { return }
            posts = response.posts
            nextOffset = Self.nextOffset(after: response)
            loadedOnce = true
            await rebuild()
        } catch {
            guard current == generation else { return }
            // A failed read is not an empty list: keep what's shown, or say so.
            if loadedOnce {
                await rebuild()
            } else {
                state = .error(message: (error as? APIError)?.errorDescription ?? "Couldn't load your saved posts.")
            }
        }
    }

    /// Footer reached: append the next page of saves. A failed page keeps the rows and offers Try again.
    func loadMoreIfNeeded() async {
        guard !loadingMore, let offset = nextOffset else { return }
        let current = generation
        loadingMore = true
        loadMoreError = nil
        do {
            let response: SavedPostsResponse = try await api.request(
                PostsEndpoints.savedPosts(limit: Self.pageSize, offset: offset)
            )
            guard current == generation else { return }
            let seen = Set(posts.map(\.id))
            posts += response.posts.filter { !seen.contains($0.id) }
            nextOffset = Self.nextOffset(after: response)
        } catch {
            guard current == generation else { return }
            loadMoreError = "Couldn't load more saved posts."
        }
        loadingMore = false
        await rebuild()
    }

    /// Remove from saved: the server toggles the save, and the row leaves once it confirms.
    func remove(postId: String) async {
        guard !removing.contains(postId) else { return }
        removing.insert(postId)
        defer { removing.remove(postId) }
        do {
            let response: PostSaveResponse = try await api.request(PostsEndpoints.toggleSave(id: postId))
            if response.saved {
                // The toggle saved it again (it had been unsaved elsewhere): re-read the list.
                await load()
                return
            }
            // A Pulse card still showing it saved would re-save it on its next tap: lists refetch.
            PulsePostsRefresh.notifyPostsDidChange()
            if posts.contains(where: { $0.id == postId }) {
                posts.removeAll { $0.id == postId }
                // The saves after it move up one, so the next page starts one earlier or it would skip one.
                nextOffset = nextOffset.map { max(0, $0 - 1) }
                await rebuild()
            }
        } catch {
            toastMessage = "Couldn't remove it. Try again."
        }
    }

    private func rebuild() async {
        if posts.isEmpty, nextOffset != nil {
            if loadMoreError != nil {
                // Reading on failed, which isn't "nothing saved": say so, with Try again.
                state = .error(message: "Couldn't load your saved posts.")
            } else {
                // A page the visibility check emptied isn't the end of the list.
                state = .loading
                await loadMoreIfNeeded()
            }
            return
        }
        if posts.isEmpty {
            state = .empty(ListOfRowsState.EmptyContent(
                icon: .bookmark,
                headline: "Nothing saved yet",
                subcopy: "Tap the bookmark on a post to keep it here."
            ))
            return
        }
        let snapshot = now()
        state = .loaded(
            sections: [RowSection(id: MyPostsTab.saved, rows: posts.map { row(for: $0, now: snapshot) })],
            hasMore: nextOffset != nil
        )
    }

    private func row(for dto: MyPostDTO, now: Date) -> RowModel {
        let intent = PulseIntent.from(postType: dto.postType)
        let time = MyPostsViewModel.timeMetaLabel(for: dto, now: now)
        // Saved posts are other people's: the meta line names who wrote it.
        let meta = [dto.authorName, time.isEmpty ? nil : time]
            .compactMap { $0?.isEmpty == false ? $0 : nil }
            .joined(separator: " · ")
        return RowModel(
            id: dto.id,
            title: "",
            template: .statusChip,
            leading: .none,
            trailing: .none,
            onTap: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onOpenPost(dto) }
            },
            body: MyPostsViewModel.postBody(for: dto),
            bodyEmphasis: .primary,
            headerChips: [MyPostsViewModel.intentChip(for: intent, isArchived: false)],
            timeMeta: meta,
            engagement: RowEngagement(
                items: MyPostsViewModel.engagementItems(for: dto, intent: intent),
                cta: RowEngagementCTA(
                    label: "Remove",
                    icon: .bookmark,
                    accessibilityLabel: "Remove from saved"
                ) { [weak self] in
                    guard let self else { return }
                    Task { @MainActor in await self.remove(postId: dto.id) }
                }
            )
        )
    }

    /// Where the next page starts, or nil when the server read the last saves.
    static func nextOffset(after response: SavedPostsResponse) -> Int? {
        guard response.pagination?.hasMore == true else { return nil }
        return response.pagination?.nextOffset
    }
}
