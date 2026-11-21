//
//  PulsePostDetailRepost.swift
//  Pantopus
//
//  Repost on the post page (PULSEREPOST contract §2, §8): the ⋯ menu's
//  Repost opens the Repost chooser, whose "Repost with your words" opens
//  the Pulse composer with this post quoted under the text box.
//

import SwiftUI

extension PulsePostDetailViewModel {
    /// Repost (or Undo repost) in the ⋯ menu: the chooser opens.
    func openRepostChooser() {
        repostChooser = PulseRepostTarget(postId: postId, isReposted: isReposted)
    }

    /// "Repost with your words": the composer opens with the post on screen quoted.
    func beginQuote() {
        guard case let .loaded(content) = state else { return }
        quoteDraft = PulseComposeQuote(card: PulseQuotedCard(detail: content.post))
    }
}

/// The post page's Repost chooser and the composer it opens.
@MainActor
struct PulsePostDetailRepostSurfaces: ViewModifier {
    @Bindable var viewModel: PulsePostDetailViewModel

    func body(content: Content) -> some View {
        content
            .pulseRepostChooser(
                $viewModel.repostChooser,
                onToggle: { _ in Task { await viewModel.toggleRepost() } },
                onQuote: { _ in viewModel.beginQuote() }
            )
            .fullScreenCover(item: $viewModel.quoteDraft) { quote in
                // After posting the composer does what it always does: its toast, and lists read again. The quote
                // leaves this post's repost and count as they are.
                PulseComposeFlowView(
                    quoting: quote,
                    onCancel: { viewModel.quoteDraft = nil },
                    onPosted: { _ in viewModel.quoteDraft = nil }
                )
                .readableColumn()
            }
    }
}
