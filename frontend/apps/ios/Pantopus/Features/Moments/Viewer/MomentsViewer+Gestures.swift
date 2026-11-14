//
//  MomentsViewer+Gestures.swift
//  Pantopus
//
//  The viewer's one gesture over the picture (tap on or back, hold to pause,
//  swipe to change ring or close) and the … menu. On a phone a sideways drag
//  turns the page with the finger (`MomentsViewer+Paging.swift`).
//

import SwiftUI

// MARK: - Gestures and the … menu

extension MomentsViewer {
    /// One gesture for the whole picture: a tap moves on or back, a hold
    /// pauses, a swipe changes ring or closes. The finger is read in the screen's own space. Read in the
    /// picture's, a drag that moves the picture moves what the finger is measured against: the next reading comes
    /// back short by as far as the picture went, the one after long again, and the viewer shakes between two places
    /// under a moving finger (founder, 2026-11-13: "not smooth, lag, stuck even").
    func pressGesture(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .onChanged { value in pressChanged(value) }
            .onEnded { value in pressEnded(value, width: width) }
    }

    private func pressChanged(_ value: DragGesture.Value) {
        // The page is finishing its turn, the viewer is on its way out, or two fingers are on a photo: neither is a
        // tap or a swipe.
        guard !turning, !motion.leaving, !pressZoomed else { return }
        if pressStarted == nil {
            pressStarted = Date()
            pressMoved = false
            pressAxis = nil
            holdTask = Task {
                try? await Task.sleep(for: .milliseconds(220))
                guard !Task.isCancelled, !pressMoved else { return }
                model.holding = true
            }
        }
        if !pressMoved {
            guard hypot(value.translation.width, value.translation.height) > 10 else { return }
            pressMoved = true
            holdTask?.cancel()
            // The viewer moves from where the finger is now, so it starts under it without a jump.
            pressOrigin = value.translation
            // The way it first goes is the way it keeps: a turn of the page never wanders into a close.
            pressAxis = abs(value.translation.height) > abs(value.translation.width) ? .vertical : .horizontal
        }
        if pressAxis == .vertical {
            let down = max(0, value.translation.height - max(pressOrigin.height, 0))
            // Under the finger it waits, as it does for a turn of the page; let go short of a close, it plays on.
            if down > 0, !model.handling { model.handling = true }
            if motion.down != down { motion.down = down }
        } else if pagesWithFinger, !isReplying {
            if !model.handling { model.handling = true }
            motion.page = pull(value.translation.width - pressOrigin.width)
        }
        // After `handling`, so a hold that becomes a drag stays paused instead of playing for a moment between.
        if model.holding { model.holding = false }
    }

    private func pressEnded(_ value: DragGesture.Value, width: CGFloat) {
        holdTask?.cancel()
        let wasHolding = model.holding
        let axis = pressAxis
        pressStarted = nil
        pressAxis = nil
        guard !motion.leaving else { return }
        if pressMoved, axis == .vertical, !turning, !pressZoomed, !isReplying, closes(value) {
            model.holding = false
            return leave()
        }
        model.holding = false
        if motion.down != 0 {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { motion.down = 0 }
        }
        guard !turning else { return }
        if pressMoved, axis == .horizontal, pagesWithFinger, !pressZoomed, !isReplying {
            return turnPage(value)
        }
        // Anything else leaves the page where it belongs, so the Moment plays on (a turn let go half way, then a tap).
        settlePage()
        if pressZoomed {
            pressZoomed = false
        } else if isReplying {
            closeReply()
        } else if pressMoved {
            swipe(value.translation, axis: axis)
        } else if !wasHolding {
            if value.startLocation.x - pressLeft < width / 3 { model.previous() } else { model.next() }
        }
    }

    /// Dragged far enough down, or flicked down, to close.
    private func closes(_ value: DragGesture.Value) -> Bool {
        let moved = value.translation.height
        return moved > 110 || (moved > 30 && value.predictedEndTranslation.height > 280)
    }

    /// Let go far enough down: the viewer goes on down off the screen from where the finger left it, keeping its
    /// picture, and then closes. It never comes back up first.
    private func leave() {
        model.handling = true
        withAnimation(.easeOut(duration: 0.22)) {
            motion.leaving = true
            motion.down = max(motion.fall, motion.down)
        } completion: {
            model.close()
        }
    }

    /// The viewer is done: whoever opened it takes it down. Dragged off the bottom, it has already left the
    /// screen, so its cover goes at once instead of sliding down empty.
    func finish() {
        guard motion.leaving else { return onClose() }
        var plain = Transaction()
        plain.disablesAnimations = true
        withTransaction(plain) { onClose() }
    }

    /// Up opens Seen by (yours) or the reply (theirs), left and right change ring. Down is a close, and has
    /// already left (`leave`).
    private func swipe(_ translation: CGSize, axis: Axis?) {
        let dx = translation.width
        let dy = translation.height
        let vertical = axis.map { $0 == .vertical } ?? (abs(dy) > abs(dx))
        if vertical, dy < -70 {
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

    /// The … menu and the report reasons. On a wide screen they're popovers pointing at the view they're attached
    /// to: the whole screen for a cover, the More button for a card.
    func menuDialogs(on view: some View, active: Bool) -> some View {
        view
            .confirmationDialog(
                "Moment options",
                isPresented: Binding(get: { showsMenu && active }, set: { if active { showsMenu = $0 } }),
                titleVisibility: .hidden
            ) { menu }
            .confirmationDialog(
                "Report this Moment?",
                isPresented: Binding(get: { showsReport && active }, set: { if active { showsReport = $0 } }),
                titleVisibility: .visible
            ) {
                ForEach(Self.reportReasons, id: \.token) { reason in
                    Button(reason.label) { Task { await model.report(reason: reason.token) } }
                        .accessibilityIdentifier("moments.report.\(reason.token)")
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Reports go to the Pantopus team. The person isn't told who reported.")
            }
    }

    /// The post report reasons (`reportPostSchema`), as Pulse offers them.
    static let reportReasons: [(token: String, label: String)] = [
        ("spam", "Spam"),
        ("harassment", "Harassment"),
        ("inappropriate", "Inappropriate content"),
        ("misinformation", "Misinformation"),
        ("safety", "Safety concern"),
        ("other", "Something else")
    ]

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
