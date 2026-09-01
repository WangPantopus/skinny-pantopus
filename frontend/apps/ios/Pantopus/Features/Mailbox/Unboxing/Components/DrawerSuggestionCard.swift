//
//  DrawerSuggestionCard.swift
//  Pantopus
//
//  A17.14 `DrawerSuggestion` slot — the AI-classified filing destination.
//  A "File into" header with a "Suggested by Pantopus" chip, the selected
//  suggested drawer (accent ring + confidence "96% match"), a hairline
//  "Or re-route to" list of alternatives with selection radios, and a
//  "Choose another drawer" footer button.
//

import SwiftUI

@MainActor
struct DrawerSuggestionCard: View {
    let accent: Color
    let accentDark: Color
    let accentBg: Color
    let suggestion: UnboxingDrawer
    let alternates: [UnboxingDrawer]
    let onSelectAlternate: (UnboxingDrawer) -> Void
    let onChooseAnother: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            header
            suggestedRow
            reRouteHeader
            ForEach(Array(alternates.enumerated()), id: \.element.id) { index, alt in
                if index > 0 { hairline }
                alternateRow(alt)
            }
            chooseAnotherButton
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("unboxing_drawerSuggestion")
    }

    // MARK: Header

    private var header: some View {
        HStack {
            Text("File into")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            HStack(spacing: 3) {
                Icon(.sparkles, size: 11, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                Text("Suggested by Pantopus")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s1)
    }

    // MARK: Suggested

    private var suggestedRow: some View {
        HStack(spacing: Spacing.s3) {
            swatchTile(suggestion.tint, size: 40, iconSize: 19, background: suggestion.tint.swatchBg)
            VStack(alignment: .leading, spacing: 2) {
                drawerPath(suggestion, valueSize: 14)
                if let confidence = suggestion.confidence {
                    HStack(spacing: Spacing.s1) {
                        Icon(.badgeCheck, size: 12, strokeWidth: 2, color: accentDark)
                        Text("\(confidence)% match")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(accentDark)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Circle()
                .fill(accent)
                .frame(width: 24, height: 24)
                .overlay(Icon(.check, size: 14, strokeWidth: 2.4, color: .white))
        }
        .padding(Spacing.s3)
        .background(accentBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(accent, lineWidth: 1.5)
        )
        .padding(.horizontal, Spacing.s3)
        .padding(.bottom, Spacing.s3)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Suggested: \(suggestion.drawer), \(suggestion.folder)"
                + (suggestion.confidence.map { ", \($0) percent match" } ?? "")
        )
        .accessibilityIdentifier("unboxing_drawerSuggested")
    }

    // MARK: Re-route

    private var reRouteHeader: some View {
        Text("Or re-route to")
            .font(.system(size: 10, weight: .bold))
            .tracking(0.6)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.appTextMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s1)
            .overlay(alignment: .top) {
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            }
    }

    private func alternateRow(_ alt: UnboxingDrawer) -> some View {
        Button {
            onSelectAlternate(alt)
        } label: {
            HStack(spacing: Spacing.s3) {
                swatchTile(alt.tint, size: 32, iconSize: 15, background: Theme.Color.appSurfaceSunken)
                drawerPath(alt, valueSize: 13)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Circle()
                    .strokeBorder(Theme.Color.appBorderStrong, lineWidth: 1.5)
                    .frame(width: 20, height: 20)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Re-route to \(alt.drawer), \(alt.folder)")
        .accessibilityIdentifier("unboxing_drawerAlternate_\(alt.id)")
    }

    private var chooseAnotherButton: some View {
        Button(action: onChooseAnother) {
            HStack(spacing: Spacing.s1) {
                Icon(.folderPlus, size: 14, strokeWidth: 2, color: Theme.Color.primary600)
                Text("Choose another drawer")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityIdentifier("unboxing_chooseAnotherDrawer")
    }

    // MARK: Pieces

    private func swatchTile(_ tint: UnboxingDrawerTint, size: CGFloat, iconSize: CGFloat, background: Color) -> some View {
        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
            .fill(background)
            .frame(width: size, height: size)
            .overlay(Icon(tint.icon, size: iconSize, strokeWidth: 2, color: tint.swatch))
    }

    /// "Home › Warranties & Receipts" — drawer + folder bold, separator muted.
    private func drawerPath(_ drawer: UnboxingDrawer, valueSize: CGFloat) -> some View {
        (
            Text(drawer.drawer).font(.system(size: valueSize, weight: .bold))
                .foregroundColor(Theme.Color.appText)
                + Text("  ›  ").font(.system(size: valueSize, weight: .semibold))
                .foregroundColor(Theme.Color.appTextMuted)
                + Text(drawer.folder).font(.system(size: valueSize, weight: drawer.confidence == nil ? .semibold : .bold))
                .foregroundColor(Theme.Color.appText)
        )
        .fixedSize(horizontal: false, vertical: true)
    }

    private var hairline: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
    }
}
