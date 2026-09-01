//
//  DayHeader.swift
//  Pantopus
//
//  A13.16 — Mail Day header card. Left: 56pt `ProgressRing` (done/total
//  with a slim sweep). Right: date + streak chip stacked over a single
//  meta line ("2 still need a call · 6 routed" → "All 8 routed. Ready
//  to close out." when complete).
//

import SwiftUI

struct DayHeader: View {
    let dateLabel: String
    let streakDays: Int
    let done: Int
    let total: Int
    /// A13.16 — gear that opens the Mail Day settings sub-view. `nil` (the
    /// default) hides it, so the VM-free snapshot frames stay unchanged.
    var onOpenSettings: (@MainActor () -> Void)?

    private var remaining: Int {
        total - done
    }

    var body: some View {
        HStack(spacing: Spacing.s3) {
            HStack(spacing: Spacing.s3) {
                MailDayProgressRing(done: done, total: total)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(dateLabel)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        StreakChip(days: streakDays)
                    }
                    metaLine
                }
                Spacer(minLength: Spacing.s0)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(accessibilityLabel)
            if let onOpenSettings {
                Button(action: onOpenSettings) {
                    Icon(.slidersHorizontal, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                        .frame(width: 34, height: 34)
                        .background(Circle().fill(Theme.Color.appSurfaceSunken))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Mail Day settings")
                .accessibilityIdentifier("mailDaySettingsButton")
            }
        }
        .padding(14)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 3, x: 0, y: 1)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mailDayHeader")
    }

    @ViewBuilder
    private var metaLine: some View {
        if remaining > 0 {
            HStack(spacing: Spacing.s1) {
                Text("\(remaining)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("still need a call · ")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text("\(done)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.success)
                Text("routed")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        } else {
            HStack(spacing: Spacing.s1) {
                Text("All")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text("\(done)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
                Text("routed. Ready to close out.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private var accessibilityLabel: String {
        let summary = remaining > 0
            ? "\(remaining) pending, \(done) routed of \(total)"
            : "All \(done) routed, ready to close"
        return "\(dateLabel). Day \(streakDays) streak. \(summary)."
    }
}

// MARK: - Progress ring

/// 56pt circular progress meter (done/total). Sweeps in the design's
/// primary tint while in flight and flips to success when the day is
/// complete. Numerator + denominator render centred inside the ring.
private struct MailDayProgressRing: View {
    let done: Int
    let total: Int

    private var fraction: Double {
        guard total > 0 else { return 0 }
        return Double(done) / Double(total)
    }

    private var isComplete: Bool {
        total > 0 && done >= total
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Theme.Color.appSurfaceSunken, lineWidth: 4)
                .frame(width: 56, height: 56)
            Circle()
                .trim(from: 0, to: CGFloat(fraction))
                .stroke(
                    isComplete ? Theme.Color.success : Theme.Color.primary600,
                    style: StrokeStyle(lineWidth: 4, lineCap: .round)
                )
                .frame(width: 56, height: 56)
                .rotationEffect(.degrees(-90))
            HStack(spacing: Spacing.s0) {
                Text("\(done)")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("/\(total)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Streak chip

/// Warm-amber "Day N" pill — leading flame glyph + tracked text. The
/// design tracks letter-spacing at +0.2; emulated via `.tracking(0.2)`.
private struct StreakChip: View {
    let days: Int

    var body: some View {
        HStack(spacing: 3) {
            Icon(.flame, size: 9, strokeWidth: 2.4, color: Theme.Color.warmAmber)
            Text("Day \(days)")
                .font(.system(size: 10, weight: .bold))
                .tracking(0.2)
                .foregroundStyle(Theme.Color.warmAmber)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 1.5)
        .background(Theme.Color.warmAmberBg)
        .clipShape(Capsule())
    }
}
