//
//  PulseFeedRepostSurfaces.swift
//  Pantopus
//
//  The Pulse feed's Repost chooser (PULSEREPOST contract §2), opened from a
//  card's ↻ or its ⋯ menu's Repost, and the Pulse composer its "Repost with
//  your words" opens with the post quoted under the text box (contract §8).
//  Split out of `FeedPostActionSurfaces` for SwiftLint's body-length rule.
//

import SwiftUI

@MainActor
struct PulseFeedRepostSurfaces: ViewModifier {
    @Bindable var viewModel: PulseFeedViewModel

    func body(content: Content) -> some View {
        // The chooser itself is presented by each card's ↻ (PulseCardRepostChooser), so it points at the button.
        content
            .fullScreenCover(item: $viewModel.quoteDraft) { quote in
                // After posting the composer does what it always does: its toast, and the feed reads again. The
                // quote leaves the original's ↻ and count as they are.
                PulseComposeFlowView(
                    quoting: quote,
                    onCancel: { viewModel.quoteDraft = nil },
                    onPosted: { _ in viewModel.quoteDraft = nil }
                )
                .readableColumn()
            }
    }
}
