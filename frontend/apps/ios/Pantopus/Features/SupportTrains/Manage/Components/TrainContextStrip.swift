//
//  TrainContextStrip.swift
//  Pantopus
//
//  A13.13 — Manage train. Header strip identifying which train is being
//  managed: warm-amber gradient icon tile (utensils glyph) + title +
//  date-range meta + Active/Closed status chip on the right. Switches
//  to a neutral palette when `isActive` is false.
//

import SwiftUI

/// Warm-amber identity strip that anchors the Manage Train screen.
@MainActor
public struct TrainContextStrip: View {
    private let title: String
    private let dateRangeLabel: String
    private let isActive: Bool

    public init(title: String, dateRangeLabel: String, isActive: Bool) {
        self.title = title
        self.dateRangeLabel = dateRangeLabel
        self.isActive = isActive
    }

    public var body: some View {
        HStack(spacing: Spacing.s3) {
            iconTile
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .accessibilityAddTraits(.isHeader)
                HStack(spacing: Spacing.s1) {
                    Icon(.calendar, size: 10, color: dateRangeColor)
                    Text(dateRangeLabel)
                        .font(.system(size: 11))
                        .foregroundStyle(dateRangeColor)
                }
                .accessibilityElement(children: .combine)
            }
            Spacer(minLength: Spacing.s1)
            statusChip
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(stripBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(stripBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("manageTrainContextStrip")
    }

    // MARK: - Sub-views

    private var iconTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(iconBackground)
            Icon(.utensils, size: 16, color: Theme.Color.appTextInverse)
        }
        .frame(width: 34, height: 34)
    }

    private var statusChip: some View {
        HStack(spacing: Spacing.s1) {
            if isActive {
                Circle()
                    .fill(Theme.Color.success)
                    .frame(width: 5, height: 5)
            }
            Text(isActive ? "ACTIVE" : "CLOSED")
                .font(.system(size: 10, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(isActive ? Theme.Color.success : Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(
            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                .fill(isActive ? Theme.Color.successBg : Theme.Color.appSurfaceSunken)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                .stroke(isActive ? Theme.Color.successLight : Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityLabel(isActive ? "Active" : "Closed")
    }

    // MARK: - Tones

    private var stripBackground: Color {
        isActive ? Theme.Color.warmAmberBg.opacity(0.55) : Theme.Color.appSurfaceSunken
    }

    private var stripBorder: Color {
        isActive ? Theme.Color.warmAmber.opacity(0.35) : Theme.Color.appBorder
    }

    private var iconBackground: LinearGradient {
        if isActive {
            return LinearGradient(
                colors: [Theme.Color.warmAmber.opacity(0.85), Theme.Color.warmAmber],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        return LinearGradient(
            colors: [Theme.Color.appTextMuted, Theme.Color.appTextSecondary],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var dateRangeColor: Color {
        isActive ? Theme.Color.warmAmber : Theme.Color.appTextSecondary
    }
}

#Preview("Active") {
    TrainContextStrip(
        title: "Meals for the Murphy family",
        dateRangeLabel: "May 18 → Jun 7 · 21 days",
        isActive: true
    )
    .padding()
    .background(Theme.Color.appBg)
}

#Preview("Closed") {
    TrainContextStrip(
        title: "Meals for the Murphy family",
        dateRangeLabel: "Closed Jun 1",
        isActive: false
    )
    .padding()
    .background(Theme.Color.appBg)
}
