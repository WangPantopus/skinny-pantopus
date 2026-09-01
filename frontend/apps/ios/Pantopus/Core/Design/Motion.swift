//
//  Motion.swift
//  Pantopus
//
//  Canonical animation tokens. Two breathing-room durations:
//   - `Motion.componentState` (150ms easeOut) — chip toggle, button
//     press, focus state, checkbox flip, accordion expand/collapse,
//     toast/banner overlay slide-in/out.
//   - `Motion.screenTransition` (180ms easeOut) — push/pop a navigation
//     destination, present/dismiss a sheet, modal slide.
//
//  Other motion categories (shimmer sweep, map gestures, upload
//  progress, gesture-driven drags, decorative success animations) are
//  NOT covered by these tokens — they use bespoke curves matched to
//  their domain. See `docs/motion-audit.md` for the full taxonomy.
//
//  Both tokens honour `accessibilityReduceMotion` when applied through
//  the `pantopusAnimation(_:value:)` view-modifier helper or the
//  `withPantopusAnimation(_:reduceMotion:body:)` mutation helper. The
//  raw `Animation` constants are exported for cases where reduceMotion
//  is being handled by the call site.
//

import SwiftUI

/// Canonical motion tokens. Pair with `pantopusAnimation(_:value:)` or
/// `withPantopusAnimation(_:reduceMotion:body:)` for built-in
/// reduce-motion handling.
public enum Motion {
    /// 150ms ease-out. Use for component-state changes: chip toggle,
    /// button press, focus state, accordion expand/collapse,
    /// toast/banner slide-in/out.
    public static let componentState: Animation = .easeOut(duration: 0.15)

    /// 180ms ease-out. Use for screen transitions: push/pop, sheet
    /// present/dismiss, modal slide.
    public static let screenTransition: Animation = .easeOut(duration: 0.18)

    /// 100ms ease-out used as the reduce-motion fallback for both
    /// tokens. Slightly faster than instant so SwiftUI's `.transition`
    /// modifiers still register a state change.
    public static let reducedMotion: Animation = .easeOut(duration: 0.1)
}

/// The canonical motion kinds tokenised by `Motion`. Use with
/// `View.pantopusAnimation(_:value:)`.
public enum PantopusMotion: Sendable {
    case componentState
    case screenTransition

    fileprivate var animation: Animation {
        switch self {
        case .componentState: Motion.componentState
        case .screenTransition: Motion.screenTransition
        }
    }
}

public extension View {
    /// Apply a canonical Pantopus animation that automatically honours
    /// `accessibilityReduceMotion` — when reduce-motion is on, the
    /// transition runs through `Motion.reducedMotion` (100ms fade)
    /// instead of the full curve.
    ///
    /// Use for component-state and screen-transition animations:
    /// ```swift
    /// .pantopusAnimation(.componentState, value: viewModel.toast)
    /// .pantopusAnimation(.screenTransition, value: isPresented)
    /// ```
    func pantopusAnimation(_ kind: PantopusMotion, value: some Equatable) -> some View {
        modifier(_PantopusAnimation(kind: kind, value: value))
    }
}

private struct _PantopusAnimation<V: Equatable>: ViewModifier {
    let kind: PantopusMotion
    let value: V
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content.animation(reduceMotion ? Motion.reducedMotion : kind.animation, value: value)
    }
}

/// Run a state mutation inside a canonical Pantopus animation that
/// honours reduce-motion. Pass the parent View's
/// `@Environment(\.accessibilityReduceMotion)` value so the helper can
/// pick the right curve.
///
/// ```swift
/// @Environment(\.accessibilityReduceMotion) private var reduceMotion
/// // ...
/// Button { withPantopusAnimation(.componentState, reduceMotion: reduceMotion) { expanded.toggle() } }
/// ```
public func withPantopusAnimation<Result>(
    _ kind: PantopusMotion,
    reduceMotion: Bool,
    _ body: () -> Result
) -> Result {
    withAnimation(reduceMotion ? Motion.reducedMotion : kind.animation, body)
}
