//
//  BackToTopFab.swift
//  Pantopus
//
//  A19 legal scaffold — a small circular "scroll to top" button that fades in
//  once the reader has scrolled past the table of contents. The host screen
//  owns the scroll threshold + the scroll-to-top action and toggles
//  `isVisible`; the fab owns the fade/slide transition (honouring
//  reduce-motion), the hit target, and dropping out of the a11y tree when
//  hidden.
//

import SwiftUI

/// A 40pt circular up-arrow button on a sunken surface. `isVisible` fades and
/// slides it in/out over 180 ms (a 100 ms cross-fade under reduce-motion);
/// while hidden it ignores hit-testing and is removed from accessibility. The
/// caller positions it (bottom-trailing in the legal scaffold) and wires
/// `onTap` to scroll its scroll view back to the top.
public struct BackToTopFab: View {
    private let isVisible: Bool
    private let onTap: () -> Void
    private let reduceMotionOverride: Bool?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(isVisible: Bool, onTap: @escaping () -> Void) {
        self.init(isVisible: isVisible, onTap: onTap, reduceMotionOverride: nil)
    }

    init(isVisible: Bool, onTap: @escaping () -> Void, reduceMotionOverride: Bool?) {
        self.isVisible = isVisible
        self.onTap = onTap
        self.reduceMotionOverride = reduceMotionOverride
    }

    public var body: some View {
        let motionReduced = reduceMotionOverride ?? reduceMotion
        Button(action: onTap) {
            Icon(.arrowUp, size: 18, strokeWidth: 2.2, color: Theme.Color.appText)
                .frame(width: 40, height: 40)
                .background(Circle().fill(Theme.Color.appSurfaceSunken))
                .overlay(Circle().strokeBorder(Theme.Color.appBorder, lineWidth: 1))
                .shadow(color: Theme.Color.appText.opacity(0.12), radius: 16, x: 0, y: 6)
        }
        .buttonStyle(.plain)
        .frame(width: 44, height: 44)
        .contentShape(Circle())
        .opacity(isVisible ? 1 : 0)
        .offset(y: isVisible ? 0 : 6)
        .allowsHitTesting(isVisible)
        .animation(motionReduced ? Motion.reducedMotion : Motion.screenTransition, value: isVisible)
        .accessibilityHidden(!isVisible)
        .accessibilityLabel("Back to top")
        .accessibilityIdentifier("backToTopFab")
    }
}

#Preview("Visible / hidden") {
    HStack(spacing: Spacing.s8) {
        BackToTopFab(isVisible: true) {}
        BackToTopFab(isVisible: false) {}
    }
    .padding(Spacing.s5)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Theme.Color.appSurface)
}
