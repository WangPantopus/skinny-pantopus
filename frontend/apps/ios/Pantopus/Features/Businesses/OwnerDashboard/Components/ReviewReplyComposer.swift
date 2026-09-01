//
//  ReviewReplyComposer.swift
//  Pantopus
//
//  A10.7 — a recent-review card in the owner frame with an inline reply
//  affordance. A review the owner has already answered renders the
//  published reply (violet left-border, "<Business> replied"); an
//  unanswered one shows a "Reply" button that expands into an inline
//  composer. Submitting stubs to local state in B3.2 (no review-reply
//  backend) via the host's `onSubmit`.
//
//  Design reference: `docs/designs/A10/business-owner-frames.jsx`
//  (OwnerReview).
//

import SwiftUI

@MainActor
struct ReviewReplyComposer: View {
    let review: OwnerReviewItem
    let businessName: String
    /// Submit the reply text for `review.id`. Host applies it to local state.
    let onSubmit: @MainActor (String) -> Void

    @State private var isComposing = false
    @State private var draft = ""
    @FocusState private var fieldFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            headerRow
            Text(review.body)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
            footer
        }
        .padding(.horizontal, 14)
        .padding(.top, Spacing.s3)
        .padding(.bottom, 13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("businessOwner.review.\(review.id)")
    }

    private var headerRow: some View {
        HStack(spacing: Spacing.s2) {
            AvatarWithIdentityRing(
                name: review.reviewerName,
                imageURL: review.reviewerAvatarURL,
                identity: .personal,
                ringProgress: 1,
                size: 32
            )
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text(review.reviewerName)
                    .font(.system(size: 12.5, weight: .semibold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appText)
                Text(review.meta)
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            HStack(spacing: 1) {
                ForEach(0..<5) { index in
                    StarShape()
                        .fill(index < review.rating ? Theme.Color.star : Theme.Color.appBorder)
                        .frame(width: 12, height: 12)
                }
            }
            .accessibilityLabel("\(review.rating) stars")
        }
    }

    @ViewBuilder private var footer: some View {
        if let reply = review.reply {
            repliedBox(reply)
        } else if isComposing {
            composer
        } else {
            replyButton
        }
    }

    private func repliedBox(_ reply: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: Spacing.s1) {
                Icon(.reply, size: 11, color: Theme.Color.businessDark)
                Text("\(businessName) replied")
                    .font(.system(size: 10.5, weight: .bold))
                    .foregroundStyle(Theme.Color.businessDark)
            }
            Text(reply)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            Theme.Color.appSurfaceSunken,
            in: RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
        )
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(Theme.Color.business)
                .frame(width: 2)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .padding(.top, 3)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(businessName) replied: \(reply)")
    }

    private var replyButton: some View {
        Button {
            isComposing = true
            fieldFocused = true
        } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.reply, size: 12, color: Theme.Color.appText)
                Text("Reply")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
            }
            .padding(.horizontal, 11)
            .padding(.vertical, 6)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.top, 3)
        .accessibilityLabel("Reply to \(review.reviewerName)")
        .accessibilityIdentifier("businessOwner.review.\(review.id).reply")
    }

    private var composer: some View {
        VStack(alignment: .trailing, spacing: Spacing.s2) {
            TextField("Reply as \(businessName)…", text: $draft, axis: .vertical)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appText)
                .tint(Theme.Color.business)
                .lineLimit(2...5)
                .focused($fieldFocused)
                .padding(.horizontal, 11)
                .padding(.vertical, 9)
                .background(
                    Theme.Color.appSurfaceSunken,
                    in: RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .accessibilityIdentifier("businessOwner.review.\(review.id).field")
            HStack(spacing: Spacing.s2) {
                Button("Cancel") {
                    isComposing = false
                    draft = ""
                    fieldFocused = false
                }
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .buttonStyle(.plain)

                Button {
                    submit()
                } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.send, size: 12, color: Theme.Color.appTextInverse)
                        Text("Send")
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 6)
                    .background(
                        trimmedDraft.isEmpty ? Theme.Color.appTextMuted : Theme.Color.business,
                        in: RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    )
                }
                .buttonStyle(.plain)
                .disabled(trimmedDraft.isEmpty)
                .accessibilityIdentifier("businessOwner.review.\(review.id).send")
            }
        }
        .padding(.top, 3)
    }

    private var trimmedDraft: String {
        draft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func submit() {
        let text = trimmedDraft
        guard !text.isEmpty else { return }
        fieldFocused = false
        isComposing = false
        onSubmit(text)
    }
}

#Preview("ReviewReplyComposer") {
    VStack(spacing: Spacing.s2) {
        ReviewReplyComposer(
            review: OwnerReviewItem(
                id: "dana",
                reviewerName: "Dana R.",
                reviewerAvatarURL: nil,
                meta: "2d · Deep clean",
                rating: 4,
                body: "Great job overall — only ding is they ran 20 min late. Place looked spotless though.",
                reply: nil
            ),
            businessName: "Marlow & Co."
        ) { _ in }
        ReviewReplyComposer(
            review: OwnerReviewItem(
                id: "jamal",
                reviewerName: "Jamal T.",
                reviewerAvatarURL: nil,
                meta: "1w · Standard clean",
                rating: 5,
                body: "Same two folks every time, which I love. They remember the dog and shut the gate.",
                reply: "Thanks Jamal — Rosa and Mae always look forward to seeing Biscuit."
            ),
            businessName: "Marlow & Co."
        ) { _ in }
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
