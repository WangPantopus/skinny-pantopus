//
//  PlaceFold.swift
//  Pantopus
//
//  The quieter structure Today and Place share (the November 2026
//  redesign): a section heading with an optional text action, one surface
//  per group with hairlines between its rows instead of a card per row, and
//  a row that folds open in place. Parity twin of Android `PlaceFold.kt`.
//

import SwiftUI

// MARK: - Section heading

/// "Coming up at home", a quiet detail ("Next 7 days") and an optional text
/// action at the end ("Calendar").
struct PlaceSectionHeading<Trailing: View>: View {
    let title: String
    var detail: String?
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .kerning(-0.3)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            if let detail {
                Text(detail)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: Spacing.s2)
            trailing
        }
        .padding(.horizontal, 2)
        .padding(.top, 24)
        .padding(.bottom, 10)
    }
}

extension PlaceSectionHeading where Trailing == EmptyView {
    init(title: String, detail: String? = nil) {
        self.init(title: title, detail: detail) { EmptyView() }
    }
}

/// A text action beside a heading or under a block: brand-colored, 44 pt tall.
struct PlaceInlineAction: View {
    let title: String
    let identifier: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(Theme.Color.primaryInk)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}

// MARK: - Group surface

/// One surface for a group of rows: a hairline edge and no shadow, so a group
/// reads as one thing rather than a stack of cards.
struct PlaceGroupSurface<Content: View>: View {
    var horizontalPadding: CGFloat = 15
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .padding(.horizontal, horizontalPadding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            )
    }
}

/// The hairline between two rows of a group surface.
struct PlaceRowDivider: View {
    var body: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
    }
}

// MARK: - Folded row

/// A row that opens in place: a title, a one-line summary made from real
/// values, and its content beneath while open. VoiceOver hears one button that
/// says whether it is open.
struct PlaceFoldRow<Leading: View, Content: View>: View {
    let title: String
    var summary: String?
    @Binding var isOpen: Bool
    let identifier: String
    @ViewBuilder var leading: Leading
    @ViewBuilder var content: Content
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) { isOpen.toggle() }
            } label: {
                HStack(alignment: .center, spacing: 11) {
                    leading
                    VStack(alignment: .leading, spacing: 3) {
                        Text(title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .fixedSize(horizontal: false, vertical: true)
                        if let summary, !summary.isEmpty {
                            Text(summary)
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Icon(isOpen ? .minus : .plus, size: 16, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
                        .accessibilityHidden(true)
                }
                .padding(.vertical, 13)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityValue(isOpen ? "Expanded" : "Collapsed")
            .accessibilityHint(isOpen ? "Folds it away." : "Shows it here.")
            .accessibilityIdentifier(identifier)
            // A header whose content shows below its surface (EmptyView here) adds no space.
            if isOpen, Content.self != EmptyView.self {
                content
                    .padding(.bottom, 14)
                    .transition(.opacity)
            }
        }
    }
}

extension PlaceFoldRow where Leading == EmptyView {
    init(
        title: String,
        summary: String? = nil,
        isOpen: Binding<Bool>,
        identifier: String,
        @ViewBuilder content: () -> Content
    ) {
        self.init(title: title, summary: summary, isOpen: isOpen, identifier: identifier, leading: { EmptyView() }, content: content)
    }
}
