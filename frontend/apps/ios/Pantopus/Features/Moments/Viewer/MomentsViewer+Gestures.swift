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
    /// pauses, a swipe changes ring or closes.
    func pressGesture(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in pressChanged(value) }
            .onEnded { value in pressEnded(value, width: width) }
    }

    private func pressChanged(_ value: DragGesture.Value) {
        // The page is finishing its turn, or two fingers are on a photo: neither is a tap or a swipe.
        guard !turning, !pressZoomed else { return }
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
        guard hypot(value.translation.width, value.translation.height) > 10 else { return }
        pressMoved = true
        holdTask?.cancel()
        if model.holding { model.holding = false }
        // The way it first goes is the way it keeps: a turn of the page never wanders into a close.
        let axis = pressAxis ?? (abs(value.translation.height) > abs(value.translation.width) ? .vertical : .horizontal)
        pressAxis = axis
        if axis == .vertical {
            if value.translation.height > 0 { dragOffset = value.translation }
        } else if pagesWithFinger, !isReplying {
            model.handling = true
            pageOffset = pull(value.translation.width)
        }
    }

    private func pressEnded(_ value: DragGesture.Value, width: CGFloat) {
        holdTask?.cancel()
        let wasHolding = model.holding
        let axis = pressAxis
        model.holding = false
        pressStarted = nil
        pressAxis = nil
        defer { withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { dragOffset = .zero } }
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
            if value.location.x < width / 3 { model.previous() } else { model.next() }
        }
    }

    /// Down closes, up opens Seen by (yours) or the reply (theirs), left and right change ring.
    private func swipe(_ translation: CGSize, axis: Axis?) {
        let dx = translation.width
        let dy = translation.height
        let vertical = axis.map { $0 == .vertical } ?? (abs(dy) > abs(dx))
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
