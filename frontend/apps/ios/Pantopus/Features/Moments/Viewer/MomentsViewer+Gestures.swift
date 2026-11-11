//
//  MomentsViewer+Gestures.swift
//  Pantopus
//
//  The viewer's one gesture over the picture (tap on or back, hold to pause,
//  swipe to change ring or close) and the … menu.
//

import SwiftUI

// MARK: - Gestures and the … menu

extension MomentsViewer {
    /// One gesture for the whole picture: a tap moves on or back, a hold
    /// pauses, a swipe changes ring or closes.
    func pressGesture(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if pressStarted == nil {
                    pressStarted = Date()
                    pressMoved = false
                    holdTask = Task {
                        try? await Task.sleep(for: .milliseconds(220))
                        guard !Task.isCancelled, !pressMoved else { return }
                        model.holding = true
                    }
                }
                guard hypot(value.translation.width, value.translation.height) > 10 else { return }
                pressMoved = true
                holdTask?.cancel()
                if model.holding { model.holding = false }
                if value.translation.height > 0, abs(value.translation.height) > abs(value.translation.width) {
                    dragOffset = value.translation
                }
            }
            .onEnded { value in
                holdTask?.cancel()
                let wasHolding = model.holding
                model.holding = false
                pressStarted = nil
                defer { withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { dragOffset = .zero } }
                if isReplying {
                    closeReply()
                } else if pressMoved {
                    swipe(value.translation)
                } else if !wasHolding {
                    if value.location.x < width / 3 { model.previous() } else { model.next() }
                }
            }
    }

    /// Down closes, up opens Seen by (yours) or the reply (theirs), left and right change ring.
    private func swipe(_ translation: CGSize) {
        let dx = translation.width
        let dy = translation.height
        let vertical = abs(dy) > abs(dx)
        if vertical, dy > 110 {
            model.close()
        } else if vertical, dy < -70 {
            if model.isMine {
                session.showsSeenBy = true
            } else if model.ring?.author.kind != .pantopus {
                replyFocused = true
            }
        } else if !vertical, dx < -60 {
            model.nextRing()
        } else if !vertical, dx > 60 {
            model.previousRing()
        }
    }

    @ViewBuilder
    var menu: some View {
        Button("Report", role: .destructive) { showsReport = true }
            .accessibilityIdentifier("moments.menu.report")
        Button(muteLabel) {
            Task { await model.muteAuthor(onHide: onHideAuthor, onShow: onShowAuthor) }
        }
        .accessibilityIdentifier("moments.menu.mute")
        Button("Block", role: .destructive) { showsBlock = true }
            .accessibilityIdentifier("moments.menu.block")
        Button("Cancel", role: .cancel) {}
    }

    private var muteLabel: String {
        switch model.ring?.author.kind {
        case .business: "Mute this business's Moments"
        case .pantopus: "Mute Pantopus Moments"
        default: "Mute this person's Moments"
        }
    }
}
