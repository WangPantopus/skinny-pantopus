//
//  ReinventedPulseSheet.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 6 (PHASE-6 §2 A3, A4, D): on a phone the list is a sheet over the map with three rests:
//  peek (a grabber and one line, 64 pt high), half (about 45% of the height) and full (up to under the top). It moves
//  only when its header is dragged or tapped (peek to half, half to full, full back to half); scrolling the list never
//  moves it, and it never closes by itself. A fling goes to the rest its speed points at, on the system's own spring,
//  carrying the finger's speed. The "+" rides 12 pt above the sheet's top edge and steps into the header at full.
//  While the sheet moves, nothing under it is laid out again: the list keeps its rows and only its offset changes.
//  Only drawn while `pulse_reinvented` is on.
//

import SwiftUI

struct ReinventedPulseSheet<Content: View, Add: View, Accessory: View>: View {
    @Binding var rest: ReinventedPulseView.Height
    /// The height the sheet moves in (the tab's, above the tab bar) and where its top stops at full.
    let height: CGFloat
    let fullTop: CGFloat
    /// The header's one line: "23 here · Live".
    let line: String
    /// Dimmed while the list's new read is out (PHASE-6 H: never an old number shown as new).
    var lineDimmed = false
    /// Small, right-aligned in the header: "No place" (PHASE-6 A3).
    let accessory: Accessory
    /// The list, or My Atlas.
    let content: Content
    /// The "+" (the Studio), floating over the sheet's top edge, or in the header at full.
    let add: (_ small: Bool) -> Add

    /// The finger's travel since the drag began; zero at rest.
    @State private var dragged: CGFloat = 0
    @State private var dragging = false

    static var peekHeight: CGFloat {
        64
    }

    /// The floating "+"'s height.
    static var addSize: CGFloat {
        58
    }

    var body: some View {
        let top = shownTop
        VStack(spacing: Spacing.s0) {
            header(atFull: top <= fullTop + 40)
            content
                // The part of the sheet below the screen at this rest stays reachable by scrolling. It changes only at
                // a rest, never while the sheet moves.
                .safeAreaPadding(.bottom, restTop(rest) - fullTop)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(maxWidth: .infinity)
        .frame(height: max(height - fullTop, Self.peekHeight))
        .background(
            UnevenRoundedRectangle(topLeadingRadius: Radii.xl2, topTrailingRadius: Radii.xl2, style: .continuous)
                .fill(Theme.Color.appBg)
                .shadow(color: .black.opacity(0.14), radius: 10, y: -2)
                .ignoresSafeArea(edges: .bottom)
        )
        .overlay(alignment: .topTrailing) {
            if top > fullTop + 40 {
                // Its bottom 12 pt above the sheet's top edge (PHASE-6 A4); an alignment guide is not followed in an
                // overlay's conditional content, so it is moved up by its own height.
                add(false)
                    .padding(.trailing, Spacing.s4)
                    .offset(y: -(Self.addSize + Spacing.s3))
                    .transition(.opacity)
            }
        }
        .offset(y: top - fullTop)
        .frame(maxHeight: .infinity, alignment: .bottom)
        .accessibilityIdentifier("reinventedPulse.sheet")
    }

    // MARK: - The header, the only handle

    private func header(atFull: Bool) -> some View {
        HStack(spacing: Spacing.s2) {
            VStack(spacing: 6) {
                Capsule()
                    .fill(Theme.Color.appBorder)
                    .frame(width: 36, height: 5)
                Text(line)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .opacity(lineDimmed ? 0.45 : 1)
                    .animation(.easeOut(duration: 0.15), value: lineDimmed)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Spacing.s4)
            }
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s2)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(line)
            .accessibilityValue(spokenRest)
            .accessibilityHint("Swipe up or down to show more or less of the list")
            .accessibilityAddTraits(.isButton)
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: settle(on: higher(than: rest), speed: 0)
                case .decrement: settle(on: lower(than: rest), speed: 0)
                @unknown default: break
                }
            }
            .accessibilityAction { tap() }
            .accessibilityIdentifier("reinventedPulse.handle")
            // Its own control, beside the line: not part of the handle.
            .overlay(alignment: .bottomTrailing) {
                accessory.padding(.trailing, atFull ? 0 : Spacing.s3)
            }
            if atFull {
                add(true)
                    .padding(.trailing, Spacing.s3)
                    .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 52)
        .contentShape(Rectangle())
        // One owner for a touch on the header: it moves the sheet, or, barely moved, it is a tap. The "+" inside is a
        // button of its own and keeps its touches.
        .gesture(handle)
    }

    private var handle: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .onChanged { value in
                if !dragging, abs(value.translation.height) < 4 { return }
                dragging = true
                dragged = value.translation.height
            }
            .onEnded { value in
                guard dragging else {
                    tap()
                    return
                }
                dragging = false
                let from = restTop(rest) + value.translation.height
                let projected = restTop(rest) + value.predictedEndTranslation.height
                let next = ReinventedPulseView.Height.phone.min {
                    abs(restTop($0) - projected) < abs(restTop($1) - projected)
                } ?? rest
                settle(on: next, speed: value.velocity.height, from: from)
            }
    }

    /// A tap on the header: peek to half, half to full, full back to half.
    private func tap() {
        settle(on: rest == .peek ? .half : rest == .half ? .full : .half, speed: 0)
    }

    /// To a rest on the system's spring (response 0.35, damping 0.86), carrying the finger's speed.
    private func settle(on next: ReinventedPulseView.Height, speed: CGFloat, from: CGFloat? = nil) {
        let start = from ?? shownTop
        let distance = restTop(next) - start
        let velocity = abs(distance) > 1 ? max(min(Double(speed / distance), 12), -12) : 0
        withAnimation(.interpolatingSpring(duration: 0.35, bounce: 0.14, initialVelocity: velocity)) {
            rest = next
            dragged = 0
        }
    }

    // MARK: - Rests

    /// Where the sheet's top is now: its rest plus the finger, held between full and peek with a little give.
    private var shownTop: CGFloat {
        let raw = restTop(rest) + dragged
        let low = fullTop, high = height - Self.peekHeight
        if raw < low { return low - (low - raw) * 0.25 }
        if raw > high { return high + (raw - high) * 0.25 }
        return raw
    }

    private func restTop(_ height: ReinventedPulseView.Height) -> CGFloat {
        Self.top(of: height, in: self.height, fullTop: fullTop)
    }

    /// Where the sheet's top rests, in a height: what the map shows ends there (PHASE-6 B).
    static func top(of rest: ReinventedPulseView.Height, in height: CGFloat, fullTop: CGFloat) -> CGFloat {
        switch rest {
        case .full: fullTop
        case .half: max(fullTop, height * 0.55)
        case .peek: max(fullTop, height - peekHeight)
        }
    }

    private func higher(than height: ReinventedPulseView.Height) -> ReinventedPulseView.Height {
        height == .peek ? .half : .full
    }

    private func lower(than height: ReinventedPulseView.Height) -> ReinventedPulseView.Height {
        height == .full ? .half : .peek
    }

    private var spokenRest: String {
        switch rest {
        case .peek: "The map, with the list lowered"
        case .half: "Half the screen"
        case .full: "The whole screen"
        }
    }
}
