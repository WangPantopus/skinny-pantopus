//
//  BusinessOwnerSampleData.swift
//  Pantopus
//
//  A10.7 — the hand-authored owner-view frame used by previews, the
//  snapshot reference, and Android parity. Marlow & Co. Cleaning, the
//  same business as the A10.6 sample (`BusinessProfileSampleData.populated`)
//  so the owner frame and its "preview as neighbor" describe one business
//  (the design's shared `MARLOW` const).
//
//  Insights / profile strength / reviews are sample-driven (no analytics or
//  review-reply backend in B3.2). The reply composer mutates this content in
//  local state via `BusinessOwnerContent.applyingReply(_:to:)`.
//
//  Design reference: `docs/designs/A10/business-owner-frames.jsx`.
//

import Foundation

enum BusinessOwnerSampleData {
    /// FrameOwnerEdit — Marlow & Co. Cleaning, owner dashboard. Reuses the
    /// A10.6 populated render as the shared public truth.
    static let marlow = BusinessOwnerContent(
        businessId: "marlow",
        isLive: true,
        editedMeta: "Edited 3d ago",
        insights: [
            OwnerInsightTile(id: "views", icon: .eye, value: "1.2k", label: "Views", delta: "18%"),
            OwnerInsightTile(id: "saves", icon: .bookmark, value: "84", label: "Saves", delta: "6%"),
            OwnerInsightTile(id: "contacts", icon: .messageCircle, value: "23", label: "Contacts")
        ],
        profileStrength: OwnerProfileStrength(
            percent: 92,
            caption: "One step from a complete page",
            steps: [
                OwnerStrengthStep(id: "basics", label: "Logo, banner & description", done: true),
                OwnerStrengthStep(id: "hours", label: "Hours & service area", done: true),
                OwnerStrengthStep(id: "photos", label: "Add 2 more work photos", done: false, ctaLabel: "Add")
            ]
        ),
        reviewsToReplyLabel: "2 to reply",
        reviews: [
            OwnerReviewItem(
                id: "dana",
                reviewerName: "Dana R.",
                reviewerAvatarURL: nil,
                meta: "2d · Deep clean",
                rating: 4,
                body: "Great job overall — only ding is they ran 20 min late. Place looked spotless though.",
                reply: nil
            ),
            OwnerReviewItem(
                id: "jamal",
                reviewerName: "Jamal T.",
                reviewerAvatarURL: nil,
                meta: "1w · Standard clean",
                rating: 5,
                body: "Same two folks every time, which I love. They remember the dog and shut the gate.",
                reply: "Thanks Jamal — Rosa and Mae always look forward to seeing Biscuit. "
                    + "See you next visit."
            )
        ],
        publicProfile: BusinessProfileSampleData.populated,
        canPostAsBusiness: true
    )
}
