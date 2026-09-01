//
//  CapacityRoster.swift
//  Pantopus
//
//  Stream I9 — shared capacity header + attendee/waitlist rows for the group
//  roster (E8) and host waitlist (E13). Owner-polymorphic accent; the fill bar
//  clamps to grayscale when full. Reuses the Foundation SchedulingStatusPill.
//

import SwiftUI

/// "12 of 16 seats filled · 3 waiting" card with a fill bar and an optional
/// Confirmed / Pending / Waitlisted stat strip.
struct CapacityHeaderCard: View {
    let filled: Int
    let total: Int
    var waiting: Int = 0
    var showStats = false
    var confirmed = 0
    var pending = 0
    var accent: Color

    private var isFull: Bool {
        total > 0 && filled >= total
    }

    private var fraction: Double {
        guard total > 0 else { return 0 }
        return min(1, Double(filled) / Double(total))
    }

    private var headline: String {
        var text = "\(filled) of \(total) seats filled"
        if waiting > 0 { text += " · \(waiting) waiting" }
        return text
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2 + 1) {
            HStack(alignment: .firstTextBaseline) {
                Text(headline)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                if isFull {
                    Text("All seats filled")
                        .font(.system(size: 10.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.Color.appSurfaceSunken)
                    Capsule()
                        .fill(isFull ? Theme.Color.appTextMuted : accent)
                        .frame(width: max(0, geo.size.width * fraction))
                }
            }
            .frame(height: 9)

            if showStats {
                HStack(spacing: Spacing.s2) {
                    statCell("Confirmed", confirmed, Theme.Color.successDk)
                    statCell("Pending", pending, Theme.Color.warning)
                    statCell("Waitlisted", waiting, Theme.Color.appTextSecondary)
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .shadow(color: Theme.Color.appText.opacity(0.04), radius: 3, y: 1)
    }

    private func statCell(_ label: String, _ value: Int, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.system(size: 17, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(color)
            Text(label.uppercased())
                .font(.system(size: 9, weight: .semibold))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

/// One attendee / waitlist row: avatar (+ optional verified badge), name, meta,
/// optional status pill + kebab, and an optional full-width promote button.
struct RosterRow: View {
    struct Promote {
        let isEnabled: Bool
        let onPromote: () -> Void
    }

    let initials: String
    let name: String
    var meta: String?
    var verified = false
    var statusRaw: String?
    var accent: Color
    var accentBackground: Color
    var promote: Promote?
    var onKebab: (() -> Void)?

    var body: some View {
        VStack(spacing: Spacing.s3 - 2) {
            HStack(spacing: Spacing.s3) {
                avatar
                VStack(alignment: .leading, spacing: 1) {
                    Text(name)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    if let meta {
                        Text(meta)
                            .font(.system(size: 10.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let statusRaw {
                    SchedulingStatusPill(status: statusRaw)
                }
                if let onKebab {
                    Button(action: onKebab) {
                        Icon(.moreVertical, size: 16, color: Theme.Color.appTextMuted)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Row actions")
                }
            }
            if let promote { promoteSection(promote) }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3 - 2)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .shadow(color: Theme.Color.appText.opacity(0.04), radius: 3, y: 1)
    }

    private var avatar: some View {
        ZStack(alignment: .bottomTrailing) {
            Circle()
                .fill(accent)
                .frame(width: 38, height: 38)
                .overlay(
                    Text(initials)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                )
            if verified {
                Circle()
                    .fill(Theme.Color.appSurface)
                    .frame(width: 15, height: 15)
                    .overlay(Icon(.badgeCheck, size: 14, color: accent))
            }
        }
    }

    private func promoteSection(_ promote: Promote) -> some View {
        VStack(spacing: Spacing.s2 - 2) {
            Divider().overlay(Theme.Color.appBorder)
            Button(action: promote.onPromote) {
                HStack(spacing: Spacing.s2 - 2) {
                    Icon(.arrowUp, size: 14, color: promote.isEnabled ? accent : Theme.Color.appTextMuted)
                    Text("Promote to seat")
                }
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(promote.isEnabled ? accent : Theme.Color.appTextMuted)
                .frame(maxWidth: .infinity)
                .frame(height: 34)
                .background(promote.isEnabled ? accentBackground : Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!promote.isEnabled)
            if !promote.isEnabled {
                Text("Open a seat to promote")
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
    }
}
