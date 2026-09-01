//
//  BusinessOwnerViewModel.swift
//  Pantopus
//
//  A10.7 / P1-C — View-model for the single-business owner dashboard. The
//  owner-scoped data is now live:
//    · the shared public render (`publicProfile`) is built by reusing
//      `BusinessProfileViewModel` so the owner frame and "preview as neighbor"
//      describe exactly one business (no projection duplication);
//    · live status + edit recency + the profile-strength checklist come from
//      `GET /:businessId/dashboard`;
//    · the "This week" tiles come from `GET /:businessId/insights`;
//    · the reply composer reads `GET /:businessId/reviews` and commits via
//      `POST /:businessId/reviews/:reviewId/respond` (optimistic + rollback).
//
//  The `BusinessOwnerSampleData` fixture is retained as the preview / snapshot
//  seam — inject `content:` for `#Preview` and tests to skip the network.
//

import Foundation
import Logging
import Observation

/// View-model for the owner dashboard.
@MainActor
@Observable
public final class BusinessOwnerViewModel {
    /// Render state.
    public private(set) var state: BusinessOwnerState = .loading
    /// Transient confirmation / error copy for the founding-offer claim.
    /// RN raises an `Alert`; native surfaces the same strings in a toast.
    public var toast: String?

    private let businessId: String
    private let injectedContent: BusinessOwnerContent?
    private let client: APIClient
    private let defaults: UserDefaults
    private let logger = Logger(label: "app.pantopus.ios.BusinessOwner")

    /// Per-business dismissal flag for the founding banner. Mirrors RN's
    /// `AsyncStorage` key `pantopus_founding_dismissed_<businessId>`
    /// (`src/app/businesses/[id]/index.tsx:109`).
    private var foundingDismissedKey: String {
        "business.foundingBanner.dismissed.\(businessId)"
    }

    /// - Parameters:
    ///   - businessId: The owned business id.
    ///   - content: Pre-built content for previews / snapshots / tests. When
    ///     `nil` the view-model fetches live owner data.
    public convenience init(
        businessId: String,
        content: BusinessOwnerContent? = nil
    ) {
        self.init(businessId: businessId, client: .shared, content: content)
    }

    /// Designated initializer. `client` is injectable for tests, and this
    /// initializer stays internal because `APIClient` is module-internal.
    init(
        businessId: String,
        client: APIClient,
        content: BusinessOwnerContent? = nil,
        defaults: UserDefaults = .standard
    ) {
        self.businessId = businessId
        self.client = client
        self.defaults = defaults
        injectedContent = content
    }

    public func load() async {
        state = .loading
        if let injectedContent {
            state = .loaded(injectedContent)
            return
        }
        await fetch()
    }

    public func refresh() async {
        if let injectedContent {
            state = .loaded(injectedContent)
            return
        }
        await fetch()
    }

    /// Commit a review reply: optimistic local update, then `POST …/respond`.
    /// On failure the optimistic change is rolled back. Fire-and-forget so the
    /// view's non-async closure stays unchanged.
    public func submitReply(reviewId: String, text: String) {
        guard case let .loaded(content) = state else { return }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        // Optimistic update.
        state = .loaded(content.applyingReply(trimmed, to: reviewId))

        Task { [weak self] in
            guard let self else { return }
            do {
                _ = try await client.request(
                    BusinessesEndpoints.respondToReview(
                        businessId: businessId,
                        reviewId: reviewId,
                        response: trimmed
                    )
                )
            } catch {
                logger.warning("Review reply failed for \(reviewId): \(error)")
                // Roll back to the pre-optimistic content.
                if case .loaded = state {
                    state = .loaded(content)
                }
            }
        }
    }

    // MARK: - Founding offer

    /// Dismiss the founding banner for this business — persisted so it
    /// stays hidden across launches (RN writes the same per-business flag
    /// to `AsyncStorage`).
    public func dismissFoundingBanner() {
        defaults.set(true, forKey: foundingDismissedKey)
        guard case let .loaded(content) = state else { return }
        state = .loaded(content.withFoundingOffer(nil))
    }

    /// Claim a numbered founding slot. On success RN alerts
    /// "You claimed founding slot #N!", hides the banner, and refreshes the
    /// dashboard so the founding badge appears.
    public func claimFoundingOffer() async {
        guard case let .loaded(content) = state,
              let offer = content.foundingOffer,
              !offer.isClaiming else { return }
        state = .loaded(
            content.withFoundingOffer(
                OwnerFoundingOffer(slotsRemaining: offer.slotsRemaining, isClaiming: true)
            )
        )
        do {
            let claim: FoundingSlotClaimDTO = try await client.request(
                BusinessFoundingEndpoints.claimFoundingOffer(businessId: businessId)
            )
            if let number = claim.slotNumber {
                toast = "You claimed founding slot #\(number)!"
            } else {
                toast = claim.message ?? "You claimed a founding slot!"
            }
            // The banner is gone for good once claimed — persist so a
            // refresh race can't bring it back.
            defaults.set(true, forKey: foundingDismissedKey)
            await refresh()
        } catch {
            logger.warning("Founding claim failed: \(error)")
            toast = (error as? APIError)?.errorDescription ?? "Failed to claim founding offer"
            if case let .loaded(current) = state {
                state = .loaded(
                    current.withFoundingOffer(
                        OwnerFoundingOffer(slotsRemaining: offer.slotsRemaining, isClaiming: false)
                    )
                )
            }
        }
    }

    /// `GET /founding-offer/status`, gated on the dismissal flag. Returns
    /// `nil` (no banner) when dismissed, when the offer is over, or when
    /// this business already holds a slot — RN's exact three-way gate.
    private func loadFoundingOffer() async -> OwnerFoundingOffer? {
        guard !defaults.bool(forKey: foundingDismissedKey) else { return nil }
        guard let status = try? await client.request(
            BusinessFoundingEndpoints.foundingOfferStatus,
            as: FoundingOfferStatusDTO.self
        ) else { return nil }
        return Self.foundingOffer(from: status, businessId: businessId)
    }

    /// Pure projection of the status payload (exposed for unit tests).
    static func foundingOffer(
        from status: FoundingOfferStatusDTO,
        businessId: String
    ) -> OwnerFoundingOffer? {
        let alreadyClaimed = (status.userBusinesses ?? []).contains { $0.businessUserId == businessId }
        let remaining = status.slotsRemaining ?? 0
        guard status.isOfferActive == true, !alreadyClaimed, remaining > 0 else { return nil }
        return OwnerFoundingOffer(slotsRemaining: remaining)
    }

    // MARK: - Fetch

    private func fetch() async {
        // 1. Public render (primary) — reuse the Business Profile projection so
        //    the owner frame reads exactly the public page. This also gives the
        //    not-found / error semantics for the whole screen.
        let profileViewModel = BusinessProfileViewModel(businessId: businessId, client: client)
        await profileViewModel.load()
        let publicProfile: BusinessProfileContent
        switch profileViewModel.state {
        case let .loaded(content):
            publicProfile = content
        case .notFound:
            state = .notFound
            return
        case let .error(message):
            state = .error(message: message)
            return
        case .loading:
            state = .error(message: "Couldn't load your business")
            return
        }

        // 2. Owner-scoped dashboard (required) — publish state + strength.
        let dashboard: BusinessDashboardResponse
        do {
            dashboard = try await client.request(
                BusinessesEndpoints.dashboard(businessId: businessId),
                as: BusinessDashboardResponse.self
            )
        } catch let error as APIError {
            switch error {
            case .forbidden:
                state = .error(message: "You don't have access to this business.")
            case .notFound:
                state = .notFound
            default:
                state = .error(message: "Couldn't load your business")
            }
            return
        } catch {
            state = .error(message: "Couldn't load your business")
            return
        }

        // 3. Tiles + reviews (best-effort overlays; sequential so the request
        //    order stays deterministic for the stubbed-network tests).
        let insights = try? await client.request(
            BusinessesEndpoints.insights(businessId: businessId),
            as: BusinessInsightsResponse.self
        )
        let reviewsResponse = try? await client.request(
            BusinessesEndpoints.reviews(businessId: businessId),
            as: BusinessOwnerReviewsResponse.self
        )
        // 4. Founding-offer banner (best-effort; RN fetches it on the same
        //    dashboard load and hides the banner on any failure).
        let founding = await loadFoundingOffer()

        state = .loaded(
            makeContent(
                publicProfile: publicProfile,
                dashboard: dashboard,
                insights: insights,
                reviews: reviewsResponse?.reviews ?? [],
                foundingOffer: founding
            )
        )
    }

    // MARK: - Projection (pure; testable)

    /// Compose the owner content from the public render + the owner-scoped
    /// fetches. Exposed `internal` so the projection can be unit-tested
    /// without sequencing six network responses.
    func makeContent(
        publicProfile: BusinessProfileContent,
        dashboard: BusinessDashboardResponse,
        insights: BusinessInsightsResponse?,
        reviews: [BusinessOwnerReviewDTO],
        foundingOffer: OwnerFoundingOffer? = nil
    ) -> BusinessOwnerContent {
        let isLive = dashboard.profile?.isPublished ?? false
        let mappedReviews = reviews.map(ownerReview)
        let pending = mappedReviews.filter { $0.reply == nil }.count
        return BusinessOwnerContent(
            businessId: businessId,
            isLive: isLive,
            editedMeta: editedMeta(updatedAt: dashboard.profile?.updatedAt, isLive: isLive),
            insights: insightTiles(from: insights),
            profileStrength: profileStrength(from: dashboard.onboarding),
            reviewsToReplyLabel: pending > 0 ? "\(pending) to reply" : nil,
            reviews: mappedReviews,
            publicProfile: publicProfile,
            canPostAsBusiness: canPost(dashboard.access?.roleBase),
            foundingOffer: foundingOffer
        )
    }

    /// RN gate: `access.role_base && ['owner','admin','editor'].includes(...)`
    /// (`src/app/businesses/[id]/index.tsx:67`).
    private func canPost(_ roleBase: String?) -> Bool {
        guard let roleBase, !roleBase.isEmpty else { return false }
        return BusinessOwnerContent.postingRoles.contains(roleBase)
    }

    private func insightTiles(from insights: BusinessInsightsResponse?) -> [OwnerInsightTile] {
        guard let insights else { return [] }
        return [
            OwnerInsightTile(
                id: "views",
                icon: .eye,
                value: formatCount(insights.views.total),
                label: "Views",
                delta: trendLabel(insights.views.trend)
            ),
            OwnerInsightTile(
                id: "followers",
                icon: .users,
                value: formatCount(insights.followers.total),
                label: "Followers",
                delta: trendLabel(insights.followers.trend)
            ),
            OwnerInsightTile(
                id: "reviews",
                icon: .star,
                value: formatCount(insights.reviews.count),
                label: "Reviews",
                delta: trendLabel(insights.reviews.trend)
            )
        ]
    }

    private func profileStrength(from onboarding: BusinessOnboardingDTO?) -> OwnerProfileStrength {
        guard let onboarding, onboarding.totalCount > 0 else {
            return OwnerProfileStrength(percent: 0, caption: "Finish setting up your page", steps: [])
        }
        let percent = Int((Double(onboarding.completedCount) / Double(onboarding.totalCount) * 100).rounded())
        let remaining = max(0, onboarding.totalCount - onboarding.completedCount)
        let caption = switch remaining {
        case 0: "Your page is complete"
        case 1: "One step from a complete page"
        default: "\(remaining) steps from a complete page"
        }
        let steps = onboarding.checklist.map { item in
            OwnerStrengthStep(id: item.key, label: item.label, done: item.done, ctaLabel: item.done ? nil : "Add")
        }
        return OwnerProfileStrength(percent: percent, caption: caption, steps: steps)
    }

    private func ownerReview(_ dto: BusinessOwnerReviewDTO) -> OwnerReviewItem {
        let meta = [relativeTimestamp(dto.createdAt), dto.gigTitle]
            .compactMap { $0?.isEmpty == false ? $0 : nil }
            .joined(separator: " · ")
        return OwnerReviewItem(
            id: dto.id,
            reviewerName: nonEmpty(dto.reviewerName) ?? "Anonymous",
            reviewerAvatarURL: dto.reviewerAvatar.flatMap(URL.init(string:)),
            meta: meta,
            rating: dto.rating,
            body: dto.comment ?? "",
            reply: nonEmpty(dto.ownerResponse)
        )
    }

    // MARK: - Formatting

    private func editedMeta(updatedAt: String?, isLive: Bool) -> String {
        if let relative = relativeTimestamp(updatedAt), !relative.isEmpty {
            return "Edited \(relative)"
        }
        return isLive ? "Live" : "Draft"
    }

    /// `1234 → "1.2k"`, `84 → "84"`.
    private func formatCount(_ value: Int) -> String {
        guard value >= 1000 else { return "\(value)" }
        let truncated = Double(value) / 1000
        return String(format: "%.1fk", truncated).replacingOccurrences(of: ".0k", with: "k")
    }

    /// Only positive trends render a pill — the tile draws a fixed up-arrow.
    private func trendLabel(_ trend: Int) -> String? {
        trend > 0 ? "\(trend)%" : nil
    }

    private func nonEmpty(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    private func relativeTimestamp(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return nil
        }
        let elapsed = Date().timeIntervalSince(date)
        switch elapsed {
        case ..<60: return "just now"
        case ..<3600: return "\(Int(elapsed / 60))m ago"
        case ..<86400: return "\(Int(elapsed / 3600))h ago"
        case ..<604_800: return "\(Int(elapsed / 86400))d ago"
        default: return "\(Int(elapsed / 604_800))w ago"
        }
    }
}
