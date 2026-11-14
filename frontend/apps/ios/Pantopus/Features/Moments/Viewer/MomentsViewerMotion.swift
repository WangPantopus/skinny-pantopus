//
//  MomentsViewerMotion.swift
//  Pantopus
//
//  Where the finger has moved the viewer: down toward a close, or sideways
//  toward the person after or before (founder, 2026-11-13: closing and
//  changing person "not very smooth, lag, stuck even"). It is kept apart from
//  the viewer's own state and read only by the small modifiers here, so a
//  finger moving changes where the viewer sits and nothing else: the picture,
//  the header, the rail and the reply box are not built again on every move.
//

import SwiftUI

@Observable
@MainActor
final class MomentsViewerMotion {
    /// How far the viewer has been dragged down.
    var down: CGFloat = 0
    /// Let go far enough down: the viewer is on its way off the bottom, and takes no more touches.
    var leaving = false
    /// How far a sideways drag has turned the page toward the person after (negative) or before.
    var page: CGFloat = 0 {
        didSet {
            let toward = page < 0 ? 1 : page > 0 ? -1 : 0
            // Told only when it changes: the viewer builds the incoming page once, not on every move.
            if toward != step { step = toward }
        }
    }

    /// The person the page is turning toward: 1 the one after, -1 the one before, 0 while it rests.
    private(set) var step = 0
    /// How tall the viewer is, for how far it has to fall to leave the screen.
    @ObservationIgnored var height: CGFloat = 0

    /// Far enough down to be off the screen, shrunk as it is by then.
    var fall: CGFloat {
        max(height, 600) * 1.15
    }
}

/// The viewer follows a drag down: it moves with the finger and shrinks a little, and behind a cover the black
/// fades to show what opened it.
struct MomentsDragFollow: ViewModifier {
    let motion: MomentsViewerMotion
    /// A cover has the black behind it; a card has its own rounded black, which moves with it.
    let fades: Bool

    func body(content: Content) -> some View {
        let down = max(motion.down, 0)
        content
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { motion.height = $0 }
            .offset(y: down)
            .scaleEffect(1 - min(down, 400) / 2400)
            .background {
                if fades {
                    Color.black
                        .opacity(motion.leaving ? 0 : 1 - Double(min(down, 300)) / 600)
                        .ignoresSafeArea()
                }
            }
    }
}

/// A cover is clear behind the viewer's own black, so a drag down shows what opened it (the map, a chat, a
/// profile) instead of more black. A card is inside the tab and has nothing of the kind to say.
struct MomentsCoverBackdrop: ViewModifier {
    let isCover: Bool

    func body(content: Content) -> some View {
        if isCover {
            content.presentationBackground(.clear)
        } else {
            content
        }
    }
}

extension View {
    /// Says where the view's left edge is on the screen, for a gesture read in the screen's space.
    func readsLeftEdge(_ action: @escaping (CGFloat) -> Void) -> some View {
        onGeometryChange(for: CGFloat.self, of: { $0.frame(in: .global).minX }, action: action)
    }
}

/// One page of a sideways drag: the one showing, or the person coming in beside it.
struct MomentsPageFollow: ViewModifier {
    let motion: MomentsViewerMotion
    /// The page coming in sits a screen's width to the side of the one showing.
    let incoming: Bool
    let width: CGFloat
    let flat: Bool

    func body(content: Content) -> some View {
        content.modifier(MomentsPageTurn(
            position: motion.page + (incoming ? CGFloat(motion.step) * width : 0),
            width: width,
            flat: flat
        ))
    }
}

/// The bars over the Moment, read from the model here: a video says how far it has played 20 times a second, and
/// only the bars are drawn again for it.
struct MomentsPlayingBars: View {
    let model: MomentsViewerModel

    var body: some View {
        MomentsProgressBars(count: model.ring?.moments.count ?? 1, current: model.momentIndex, progress: model.progress)
    }
}
