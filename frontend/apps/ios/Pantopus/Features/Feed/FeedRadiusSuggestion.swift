//
//  FeedRadiusSuggestion.swift
//  Pantopus
//
//  Port of RN's `useRadiusSuggestion` + `RadiusSuggestionBanner`. When
//  the Nearby feed comes back nearly empty (or overwhelmingly full) the
//  banner proposes the next radius and applies it on tap.
//

import SwiftUI

/// A proposed radius change. `nil` from `compute(...)` means "no advice".
public struct FeedRadiusSuggestion: Sendable, Hashable {
    public enum Direction: Sendable, Hashable { case expand, narrow }

    public let suggestedRadius: Double
    public let reason: String
    public let direction: Direction

    /// Radius ladder — RN `useRadiusSuggestion.ts:34`.
    public static let radiusOptions: [Double] = [1, 3, 10, 25, 100, 1000, 25000]

    /// `25000` reads "Global"; everything else is "<n> mi".
    public static func formatRadius(_ miles: Double) -> String {
        if miles >= 25000 { return "Global" }
        if miles == miles.rounded() { return "\(Int(miles)) mi" }
        return String(format: "%.1f mi", miles)
    }

    /// Thresholds ported verbatim from RN
    /// (`useRadiusSuggestion.ts:66-101`):
    /// 0 items → expand; ≤2 items → expand; ≥50 items → narrow.
    public static func compute(
        currentRadius: Double,
        itemCount: Int,
        singularLabel: String = "post",
        pluralLabel: String = "posts"
    ) -> FeedRadiusSuggestion? {
        guard let index = radiusOptions.firstIndex(of: currentRadius) else { return nil }
        let noun = itemCount == 1 ? singularLabel : pluralLabel

        if itemCount == 0, index < radiusOptions.count - 1 {
            let next = radiusOptions[index + 1]
            return FeedRadiusSuggestion(
                suggestedRadius: next,
                reason: "No \(pluralLabel) within \(formatRadius(currentRadius)). "
                    + "Expand to \(formatRadius(next))?",
                direction: .expand
            )
        }
        if itemCount <= 2, currentRadius < 25000, index < radiusOptions.count - 1 {
            let next = radiusOptions[index + 1]
            return FeedRadiusSuggestion(
                suggestedRadius: next,
                reason: "\(itemCount) \(noun) within \(formatRadius(currentRadius)). "
                    + "Expand to \(formatRadius(next))?",
                direction: .expand
            )
        }
        if itemCount >= 50, currentRadius > 1, index > 0 {
            let next = radiusOptions[index - 1]
            return FeedRadiusSuggestion(
                suggestedRadius: next,
                reason: "Lots of \(pluralLabel) here. Focus to \(formatRadius(next))?",
                direction: .narrow
            )
        }
        return nil
    }
}

/// Inline apply / dismiss banner — RN `RadiusSuggestionBanner.tsx`.
struct FeedRadiusSuggestionBanner: View {
    let suggestion: FeedRadiusSuggestion
    let onApply: () -> Void
    let onDismiss: () -> Void

    private var isExpand: Bool {
        suggestion.direction == .expand
    }

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(
                isExpand ? .maximize : .filter,
                size: 18,
                strokeWidth: 2,
                color: isExpand ? Theme.Color.info : Theme.Color.magic
            )
            Text(suggestion.reason)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onApply) {
                Text(FeedRadiusSuggestion.formatRadius(suggestion.suggestedRadius))
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(isExpand ? Theme.Color.primary600 : Theme.Color.magic)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("pulseRadiusSuggestionApply")
            Button(action: onDismiss) {
                Icon(.x, size: 16, color: Theme.Color.appTextMuted)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss radius suggestion")
            .accessibilityIdentifier("pulseRadiusSuggestionDismiss")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .background(isExpand ? Theme.Color.infoBg : Theme.Color.magicBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .padding(.horizontal, Spacing.s3)
        .padding(.bottom, Spacing.s2)
        .accessibilityIdentifier("pulseRadiusSuggestionBanner")
    }
}
