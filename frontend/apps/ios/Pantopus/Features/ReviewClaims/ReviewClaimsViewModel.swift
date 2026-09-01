//
//  ReviewClaimsViewModel.swift
//  Pantopus
//
//  P1.1 — Admin home-ownership claims review queue. Three-tab list
//  (Pending / Approved / Rejected) on top of the shared `ListOfRows`
//  shell. Pending tab carries a warning-tinted banner summarising the
//  queue depth + age of the oldest claim — mirrors the web
//  `/app/admin/review-claims` page.
//
//  Backend ground-truth:
//    GET /api/admin/claims?bucket=         backend/routes/admin.js:156
//    GET /api/admin/claims/counts          backend/routes/admin.js:230
//    POST /api/admin/claims/:id/review     backend/routes/admin.js:342
//

import Foundation
import Observation
import SwiftUI

/// Stable tab ids for the queue. Match the backend's `bucket` enum.
public enum ReviewClaimsTab {
    public static let pending = AdminClaimBucket.pending.rawValue
    public static let approved = AdminClaimBucket.approved.rawValue
    public static let rejected = AdminClaimBucket.rejected.rawValue
}

@Observable
@MainActor
public final class ReviewClaimsViewModel: ListOfRowsDataSource {
    // MARK: - ListOfRowsDataSource

    public var title: String {
        "Review claims"
    }

    public var topBarAction: TopBarAction? {
        nil
    }

    public var tabs: [ListOfRowsTab] {
        [
            ListOfRowsTab(id: ReviewClaimsTab.pending, label: "Pending", count: counts?.pending),
            ListOfRowsTab(id: ReviewClaimsTab.approved, label: "Approved", count: counts?.approved),
            ListOfRowsTab(id: ReviewClaimsTab.rejected, label: "Rejected", count: counts?.rejected)
        ]
    }

    public var selectedTab: String = ReviewClaimsTab.pending {
        didSet {
            guard selectedTab != oldValue else { return }
            // Re-render immediately with the bucket's cached state, then
            // refetch in the background so transitions feel snappy.
            rebuild()
            Task { await fetchClaims(for: bucket) }
        }
    }

    public var fab: FABAction? {
        nil
    }

    public private(set) var state: ListOfRowsState = .loading

    public var banner: BannerConfig? {
        // Only the Pending tab shows the triage banner — and only when
        // there's something to triage. Approved / Rejected get a clean
        // top of list.
        let cached = rowsCache[.pending] ?? []
        guard bucket == .pending, !cached.isEmpty else { return nil }
        let pending = counts?.pending ?? cached.count
        let title = "\(pending) \(pending == 1 ? "claim" : "claims") awaiting review"
        return BannerConfig(
            icon: .gavel,
            title: title,
            subtitle: "Oldest in queue: \(AdminClaimTimeFormat.oldestAge(oldestAgeSeconds))",
            tint: .warning
        )
    }

    // MARK: - Internals

    private var bucket: AdminClaimBucket {
        AdminClaimBucket(rawValue: selectedTab) ?? .pending
    }

    private let api: APIClient
    private let onOpenClaim: @MainActor @Sendable (String) -> Void
    private var rowsCache: [AdminClaimBucket: [AdminClaimDTO]] = [:]
    private var counts: AdminClaimCountsResponse?
    private var oldestAgeSeconds: Int?

    init(
        api: APIClient = .shared,
        onOpenClaim: @escaping @MainActor @Sendable (String) -> Void = { _ in }
    ) {
        self.api = api
        self.onOpenClaim = onOpenClaim
    }

    // MARK: - Lifecycle

    public func load() async {
        // Always (re)fetch on appear — admin claim state changes
        // server-side and the reviewer expects fresh counts every push.
        if rowsCache[bucket] == nil {
            state = .loading
        }
        await fetchCounts()
        await fetchClaims(for: bucket)
    }

    public func refresh() async {
        await fetchCounts()
        await fetchClaims(for: bucket)
    }

    public func loadMoreIfNeeded() async {
        // The list is capped at the server's default page size (50). A
        // separate pagination hook lands when admins request it.
    }

    // MARK: - Fetching

    private func fetchCounts() async {
        do {
            let response: AdminClaimCountsResponse = try await api.request(
                AdminEndpoints.claimCounts()
            )
            counts = response
        } catch {
            // Counts are decorative — fail silently and leave the badges blank.
        }
    }

    private func fetchClaims(for bucket: AdminClaimBucket) async {
        do {
            let response: AdminClaimsResponse = try await api.request(
                AdminEndpoints.claims(bucket: bucket)
            )
            rowsCache[bucket] = response.claims
            if bucket == .pending { oldestAgeSeconds = response.oldestAgeSeconds }
            // Only rerender if the bucket is still the one in view —
            // a fast tab swap shouldn't blow the user's current tab away.
            if bucket == self.bucket { rebuild() }
        } catch {
            if bucket == self.bucket {
                state = .error(message: "Couldn't load claims. Try again.")
            }
        }
    }

    // MARK: - Projection

    private func rebuild() {
        guard let cached = rowsCache[bucket] else {
            // Haven't fetched this bucket yet — keep showing the loading
            // shimmer; `fetchClaims` will land and call back.
            state = .loading
            return
        }
        if cached.isEmpty {
            state = .empty(emptyContent(for: bucket))
            return
        }
        let mapped = cached.map(row(for:))
        state = .loaded(
            sections: [RowSection(id: "claims", rows: mapped)],
            hasMore: false
        )
    }

    private func emptyContent(for bucket: AdminClaimBucket) -> ListOfRowsState.EmptyContent {
        switch bucket {
        case .pending:
            ListOfRowsState.EmptyContent(
                icon: .checkCheck,
                headline: "No claims to review",
                subcopy: "You're all caught up. New ownership claims will appear here when neighbors submit address verification.",
                ctaTitle: "View approved"
            ) { [weak self] in
                MainActor.assumeIsolated { self?.selectedTab = ReviewClaimsTab.approved }
            }
        case .approved:
            ListOfRowsState.EmptyContent(
                icon: .checkCircle,
                headline: "No approved claims yet",
                subcopy: "Approved ownership claims will appear here once the team works through the queue."
            )
        case .rejected:
            ListOfRowsState.EmptyContent(
                icon: .circleSlash,
                headline: "No rejected claims",
                subcopy: "Rejected claims will appear here. Rejecting a claim notifies the claimant."
            )
        }
    }

    private func row(for claim: AdminClaimDTO) -> RowModel {
        let chip = AdminClaimChip.descriptor(for: claim, bucket: bucket)
        let claimantName = claim.claimant?.name
            ?? claim.claimant?.username
            ?? "Unknown claimant"
        let address = AdminClaimAddressFormat.full(claim.home)
        let evidenceText = "\(claim.evidenceCount) doc\(claim.evidenceCount == 1 ? "" : "s")"
        let onOpen = onOpenClaim
        let id = claim.id

        let footer = RowFooter(actions: [
            RowFooterAction(
                title: "Review claim",
                icon: .arrowRight,
                variant: .primary
            ) {
                MainActor.assumeIsolated { onOpen(id) }
            }
        ])

        return RowModel(
            id: claim.id,
            title: claimantName,
            subtitle: address,
            template: .statusChip,
            leading: .avatarWithBadge(
                name: claimantName,
                imageURL: claim.claimant?.profilePictureURL.flatMap(URL.init(string:)),
                background: .gradient(
                    AdminClaimAvatarGradient.gradient(for: claim.claimantUserId.isEmpty ? claim.id : claim.claimantUserId)
                ),
                size: .medium,
                verified: false
            ),
            trailing: .none,
            onTap: {
                MainActor.assumeIsolated { onOpen(id) }
            },
            chips: [
                RowChip(text: chip.text, icon: chip.icon, tint: .status(chip.variant)),
                RowChip(text: evidenceText, icon: .paperclip, tint: .status(.neutral))
            ],
            timeMeta: AdminClaimTimeFormat.submittedAgo(claim.createdAt),
            highlight: bucket == .rejected ? .muted : nil,
            footer: footer
        )
    }
}
