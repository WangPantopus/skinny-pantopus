//
//  BusinessOwnerContent.swift
//  Pantopus
//
//  A10.7 — Render-only models for the single-business owner dashboard.
//  The owner view is the owner-facing twin of A10.6: it reuses the exact
//  public render (`BusinessProfileContent`, from B3.1) for the
//  "preview as neighbor" frame, and overlays owner-only chrome — live
//  status, insight tiles, a profile-strength card, edit-affordance rows,
//  and a per-review reply composer — for the owner / edit frame.
//
//  The shared business truth lives in `publicProfile`; the owner frame
//  reads its header / status / categories / about / hours / service area /
//  services / gallery / rating summary from there, so the two frames can
//  never describe different businesses (the design's shared `MARLOW`
//  const).
//
//  Design reference: `docs/designs/A10/business-owner-frames.jsx`
//  (FrameOwnerEdit + FramePreviewPublic) and
//  `docs/new-design-parity-batch2.md` § A10.7. Business violet throughout.
//

import Foundation

// MARK: - Insights

/// One "This week" insight tile — views / saves / contacts, each with an
/// optional week-over-week delta. Drives `InsightTiles`.
public struct OwnerInsightTile: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let value: String
    public let label: String
    /// Week-over-week delta ("18%"); `nil` renders no trend pill.
    public let delta: String?

    public init(id: String, icon: PantopusIcon, value: String, label: String, delta: String? = nil) {
        self.id = id
        self.icon = icon
        self.value = value
        self.label = label
        self.delta = delta
    }
}

// MARK: - Profile strength

/// One checklist row in the profile-strength card. Done rows strike through;
/// pending rows surface an inline CTA ("Add").
public struct OwnerStrengthStep: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let done: Bool
    /// Inline CTA label on a pending step ("Add"); `nil` on done steps.
    public let ctaLabel: String?

    public init(id: String, label: String, done: Bool, ctaLabel: String? = nil) {
        self.id = id
        self.label = label
        self.done = done
        self.ctaLabel = ctaLabel
    }
}

/// Profile-strength card content: a percentage + caption + completion
/// checklist. Mirrors the existing strength-meter idiom (a progress bar
/// over a per-rule list) for the owner's "finish these" page-completion.
public struct OwnerProfileStrength: Sendable, Hashable {
    /// 0...100 completeness.
    public let percent: Int
    /// "One step from a complete page".
    public let caption: String
    public let steps: [OwnerStrengthStep]

    public init(percent: Int, caption: String, steps: [OwnerStrengthStep]) {
        self.percent = max(0, min(100, percent))
        self.caption = caption
        self.steps = steps
    }
}

// MARK: - Owner reviews (reply composer)

/// One recent review in the owner frame. When `reply` is non-nil the card
/// renders the business's published reply (violet left-border); otherwise it
/// renders the inline `ReviewReplyComposer` ("Reply").
public struct OwnerReviewItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let reviewerName: String
    public let reviewerAvatarURL: URL?
    /// Relative time + service context ("2d · Deep clean").
    public let meta: String
    public let rating: Int
    public let body: String
    /// The owner's reply, if already sent. `nil` → show the reply composer.
    public let reply: String?

    public init(
        id: String,
        reviewerName: String,
        reviewerAvatarURL: URL?,
        meta: String,
        rating: Int,
        body: String,
        reply: String? = nil
    ) {
        self.id = id
        self.reviewerName = reviewerName
        self.reviewerAvatarURL = reviewerAvatarURL
        self.meta = meta
        self.rating = max(0, min(5, rating))
        self.body = body
        self.reply = reply
    }
}

// MARK: - Founding offer

/// First-50 "Founding Business" offer banner. Present only when the offer
/// is still active, this business has not already claimed a slot, and the
/// owner has not dismissed the banner — the same three-way gate RN applies
/// (`src/app/businesses/[id]/index.tsx:108-119`).
public struct OwnerFoundingOffer: Sendable, Hashable {
    /// `slots_remaining` from `GET /api/businesses/founding-offer/status`.
    public let slotsRemaining: Int
    /// True while `POST …/founding-offer/claim` is in flight.
    public let isClaiming: Bool

    public init(slotsRemaining: Int, isClaiming: Bool = false) {
        self.slotsRemaining = slotsRemaining
        self.isClaiming = isClaiming
    }
}

// MARK: - Top-level payload

/// Top-level content for the owner dashboard. `publicProfile` is the exact
/// A10.6 render reused by the preview frame and read by the owner frame's
/// shared sections; the remaining fields are owner-only overlays.
public struct BusinessOwnerContent: Sendable, Hashable {
    public let businessId: String
    /// Whether the page is published / live ("Page is live").
    public let isLive: Bool
    /// Edit-recency meta ("Edited 3d ago").
    public let editedMeta: String
    public let insights: [OwnerInsightTile]
    public let profileStrength: OwnerProfileStrength
    /// Section-header affordance on Reviews ("2 to reply"); `nil` when none.
    public let reviewsToReplyLabel: String?
    public let reviews: [OwnerReviewItem]
    /// The shared public render — reused verbatim for "preview as neighbor"
    /// and read by the owner frame for the business's own data.
    public let publicProfile: BusinessProfileContent
    /// True when `access.role_base` ∈ `owner | admin | editor` — the same
    /// gate React Native puts on its "Post as this business" composer
    /// (`src/app/businesses/[id]/index.tsx:67`). `POST
    /// /api/businesses/:businessId/posts` requires `profile.edit`, so a
    /// staff / viewer seat never sees the affordance.
    public let canPostAsBusiness: Bool
    /// Founding-business offer banner; `nil` renders nothing.
    public let foundingOffer: OwnerFoundingOffer?

    public init(
        businessId: String,
        isLive: Bool,
        editedMeta: String,
        insights: [OwnerInsightTile],
        profileStrength: OwnerProfileStrength,
        reviewsToReplyLabel: String?,
        reviews: [OwnerReviewItem],
        publicProfile: BusinessProfileContent,
        canPostAsBusiness: Bool = false,
        foundingOffer: OwnerFoundingOffer? = nil
    ) {
        self.foundingOffer = foundingOffer
        self.businessId = businessId
        self.isLive = isLive
        self.editedMeta = editedMeta
        self.insights = insights
        self.profileStrength = profileStrength
        self.reviewsToReplyLabel = reviewsToReplyLabel
        self.reviews = reviews
        self.publicProfile = publicProfile
        self.canPostAsBusiness = canPostAsBusiness
    }

    /// Roles the backend's `profile.edit` permission resolves to for the
    /// business-post route (`backend/routes/businesses.js:4198`).
    public static let postingRoles: Set<String> = ["owner", "admin", "editor"]

    /// Returns a copy with `reply` set on the review matching `reviewId`.
    /// Backs the local-state reply stub (no backend in B3.2).
    public func applyingReply(_ reply: String, to reviewId: String) -> BusinessOwnerContent {
        let updated = reviews.map { review -> OwnerReviewItem in
            guard review.id == reviewId else { return review }
            return OwnerReviewItem(
                id: review.id,
                reviewerName: review.reviewerName,
                reviewerAvatarURL: review.reviewerAvatarURL,
                meta: review.meta,
                rating: review.rating,
                body: review.body,
                reply: reply
            )
        }
        return BusinessOwnerContent(
            businessId: businessId,
            isLive: isLive,
            editedMeta: editedMeta,
            insights: insights,
            profileStrength: profileStrength,
            reviewsToReplyLabel: recomputeReplyLabel(after: updated),
            reviews: updated,
            publicProfile: publicProfile,
            canPostAsBusiness: canPostAsBusiness,
            foundingOffer: foundingOffer
        )
    }

    /// Returns a copy with a different founding-offer banner state — used
    /// for the dismiss (`nil`) and the in-flight claim spinner.
    public func withFoundingOffer(_ offer: OwnerFoundingOffer?) -> BusinessOwnerContent {
        BusinessOwnerContent(
            businessId: businessId,
            isLive: isLive,
            editedMeta: editedMeta,
            insights: insights,
            profileStrength: profileStrength,
            reviewsToReplyLabel: reviewsToReplyLabel,
            reviews: reviews,
            publicProfile: publicProfile,
            canPostAsBusiness: canPostAsBusiness,
            foundingOffer: offer
        )
    }

    private func recomputeReplyLabel(after updated: [OwnerReviewItem]) -> String? {
        let pending = updated.filter { $0.reply == nil }.count
        return pending > 0 ? "\(pending) to reply" : nil
    }
}

/// Top-level render state for the owner dashboard.
public enum BusinessOwnerState: Sendable, Equatable {
    case loading
    case loaded(BusinessOwnerContent)
    case notFound
    case error(message: String)
}
