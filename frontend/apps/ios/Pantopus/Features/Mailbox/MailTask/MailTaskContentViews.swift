//
//  MailTaskContentViews.swift
//  Pantopus
//
//  A17.12 — feature-local cards composed into the Mail-task screen body
//  (the AI-elf strip, the "What got filed" completion summary, the
//  delegate hint, and the shimmer loading skeleton). Split out of
//  `MailTaskView.swift` to keep that file focused on the screen chrome.
//  The TaskCard / DueSnoozeCard / SubtaskChecklist / SourceMailCard /
//  NextUpCard live under `Components/`. Mirrors the Android
//  `MailTaskContentViews.kt` split.
//

import SwiftUI

// MARK: - Task elf strip

/// Sky-gradient AI-elf strip bespoke to the task screen — labeled bullets
/// with per-bullet icon discs + inline text (distinct from the shared
/// summary-only `AIElfStripView`).
struct TaskElfStrip: View {
    let elf: MailTaskElf

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2 + 2) {
            HStack(spacing: Spacing.s2) {
                Icon(.sparkles, size: 13, color: Theme.Color.appTextInverse)
                    .frame(width: 24, height: 24)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                Text(elf.headline)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.primary800)
                Spacer(minLength: Spacing.s0)
            }
            Text(elf.summary)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.primary900)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: Spacing.s1 + 2) {
                ForEach(elf.bullets) { bullet in
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        Icon(bullet.icon, size: 10, color: Theme.Color.primary700)
                            .frame(width: 16, height: 16)
                            .background(Theme.Color.appSurface)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                                    .stroke(Theme.Color.primary200, lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
                        (
                            Text(bullet.label).font(.system(size: 12, weight: .bold))
                                + Text(" — \(bullet.text)")
                                .pantopusTextStyle(.caption)
                                .foregroundColor(Theme.Color.appTextStrong)
                        )
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(.horizontal, Spacing.s3 + 2)
        .padding(.vertical, Spacing.s3 + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [Theme.Color.primary50, Theme.Color.primary100],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("mailTask_elf")
    }
}

// MARK: - Completion summary

/// "What got filed" card (done frame) — label/value rows, mono for the
/// confirmation number.
struct CompletionSummaryCard: View {
    let completion: MailTaskCompletion

    var body: some View {
        MailTaskAccentCard {
            VStack(alignment: .leading, spacing: Spacing.s3 - 2) {
                Text("WHAT GOT FILED")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.bottom, Spacing.s1)
                ForEach(completion.rows) { row in
                    HStack(spacing: Spacing.s2 + 2) {
                        Icon(row.icon, size: 14, color: Theme.Color.appTextStrong)
                            .frame(width: 28, height: 28)
                            .background(Theme.Color.appSurfaceSunken)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        Text(row.label)
                            .font(.system(size: 12.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Spacer(minLength: Spacing.s0)
                        Text(row.value)
                            .font(.system(size: 12.5, weight: .bold, design: row.isMono ? .monospaced : .default))
                            .foregroundStyle(Theme.Color.appText)
                    }
                }
            }
        }
        .accessibilityIdentifier("mailTask_completion")
    }
}

// MARK: - Delegate hint

/// "Hand this off" overlapping-avatars row (open frame).
struct DelegateHintCard: View {
    let onTap: () -> Void

    private let initials = ["JR", "MV", "DK"]
    private let tints: [Color] = [Theme.Color.categoryTask, Theme.Color.categoryStamps, Theme.Color.warmAmber]

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s2 + 2) {
                HStack(spacing: -8) {
                    ForEach(Array(initials.enumerated()), id: \.offset) { index, text in
                        Text(text)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                            .frame(width: 26, height: 26)
                            .background(tints[index])
                            .clipShape(Circle())
                            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    }
                }
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Hand this off")
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Delegate to someone in your Home drawer")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3 - 2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailTask_delegateHint")
        .accessibilityLabel("Hand this off. Delegate to someone in your Home drawer.")
    }
}

// MARK: - Loading

/// Shimmer skeleton mirroring the loaded geometry (header chips, hero,
/// elf, two cards).
struct MailTaskLoadingView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: Spacing.s2) {
                    Shimmer(width: 74, height: 20, cornerRadius: Radii.pill)
                    Shimmer(width: 54, height: 20, cornerRadius: Radii.pill)
                    Spacer()
                    Shimmer(width: 90, height: 14)
                }
                Shimmer(height: 168, cornerRadius: Radii.xl)
                Shimmer(height: 132, cornerRadius: Radii.xl)
                Shimmer(height: 150, cornerRadius: Radii.xl)
                Shimmer(height: 120, cornerRadius: Radii.xl)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
        }
        .accessibilityIdentifier("mailTask_loading")
    }
}
