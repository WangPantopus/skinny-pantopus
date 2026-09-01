//
//  ErrorState.swift
//  Pantopus
//
//  Shared error-state scaffold: the canonical "couldn't load" surface with
//  an inline Retry. Built on `EmptyState` so the geometry, hero circle, and
//  CTA match the empty state exactly — the only differences are the
//  `.alertCircle` glyph and the retry-wired CTA. Use this on every fetchable
//  screen's `.error` case instead of hand-rolling an `EmptyState(icon:
//  .alertCircle, …)` so the copy, icon, and retry affordance stay consistent
//  app-wide (Block 2F state rule).
//

import SwiftUI

/// Shared error-state scaffold with an inline Retry.
///
/// Renders identically to `EmptyState(icon: .alertCircle, headline:,
/// subcopy:, cta: .init(title: retryTitle, action: onRetry))` — it exists so
/// the error surface is declared once and stays uniform across screens.
///
/// - Parameters:
///   - headline: Bold H3 message, e.g. "Couldn't load Earn". Defaults to a
///     generic "Something went wrong".
///   - message: Supporting sentence — usually the failure reason surfaced by
///     the view-model. Defaults to a connectivity-oriented hint.
///   - retryTitle: Primary CTA label. Defaults to "Try again".
///   - onRetry: Invoked on tap — wire to `viewModel.refresh()` / `retry()`.
@MainActor
public struct ErrorState: View {
    private let headline: String
    private let message: String
    private let retryTitle: String
    private let onRetry: () async -> Void

    public init(
        headline: String = "Something went wrong",
        message: String = "We couldn't load this. Check your connection and try again.",
        retryTitle: String = "Try again",
        onRetry: @escaping () async -> Void
    ) {
        self.headline = headline
        self.message = message
        self.retryTitle = retryTitle
        self.onRetry = onRetry
    }

    public var body: some View {
        EmptyState(
            icon: .alertCircle,
            headline: headline,
            subcopy: message,
            cta: EmptyState.CTA(title: retryTitle, action: onRetry)
        )
    }
}

#Preview("Default copy") {
    ErrorState {}
}

#Preview("Screen copy") {
    ErrorState(
        headline: "Couldn't load Earn",
        message: "We hit a snag reaching your earnings. Pull to refresh or try again."
    ) {}
}
