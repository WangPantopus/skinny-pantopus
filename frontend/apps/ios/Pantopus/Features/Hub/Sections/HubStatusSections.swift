//
//  HubStatusSections.swift
//  Pantopus
//
//  Two server-driven hub blocks that used to be dropped on native:
//
//  * `HubStatusStrip` — the "NEEDS ATTENTION" rail built from
//    `GET /api/hub`'s `statusItems[]`, with per-pill dismiss and the
//    "All caught up" empty pill. RN
//    `src/components/hub/HubActionStrip.tsx`.
//  * `HubNeighborDensitySection` — the verified-neighbor density pill
//    plus the milestone celebration banner and its dismiss. RN
//    `src/components/hub/NeighborDensity.tsx`.
//

import SwiftUI

// MARK: - Needs attention

/// Horizontal rail of server-driven status pills. Dismissal is
/// client-side only (RN keeps a `Set<string>` of dismissed ids for the
/// session), so nothing is sent to the backend.
struct HubStatusStrip: View {
    let items: [StatusStripItem]
    let onTap: (StatusStripItem) -> Void
    let onDismiss: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("NEEDS ATTENTION")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s4)

            if items.isEmpty {
                allCaughtUpPill
                    .padding(.horizontal, Spacing.s4)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        ForEach(items) { item in
                            pill(item)
                        }
                    }
                    .padding(.horizontal, Spacing.s4)
                }
            }
        }
        .accessibilityIdentifier("hubStatusStrip")
    }

    private var allCaughtUpPill: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.checkCircle, size: 18, color: Theme.Color.success)
            Text("All caught up")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .accessibilityIdentifier("hubStatusStripEmpty")
    }

    private func pill(_ item: StatusStripItem) -> some View {
        Button { onTap(item) } label: {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(item.icon, size: 18, color: tint(item.severity))
                    .padding(.top, 1)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if let subtitle = item.subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.system(size: 11))
                            .foregroundStyle(tint(item.severity))
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: Spacing.s3)
            }
            .padding(.leading, Spacing.s3)
            .padding(.trailing, Spacing.s5)
            .padding(.vertical, Spacing.s2)
            .frame(minWidth: 130, alignment: .leading)
            .background(background(item.severity))
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(tint(item.severity).opacity(0.2), lineWidth: 1)
            )
            .overlay(alignment: .topTrailing) {
                Button { onDismiss(item.id) } label: {
                    Icon(.x, size: 12, color: Theme.Color.appTextMuted)
                        .padding(Spacing.s1)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss \(item.title)")
                .accessibilityIdentifier("hubStatusItemDismiss_\(item.id)")
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("hubStatusItem_\(item.id)")
    }

    private func tint(_ severity: StatusStripItem.Severity) -> Color {
        switch severity {
        case .critical: Theme.Color.error
        case .warning: Theme.Color.warning
        case .info: Theme.Color.info
        }
    }

    private func background(_ severity: StatusStripItem.Severity) -> Color {
        switch severity {
        case .critical: Theme.Color.errorBg
        case .warning: Theme.Color.warningBg
        case .info: Theme.Color.infoBg
        }
    }
}

// MARK: - Neighbor density

/// Density pill + milestone celebration banner. The banner auto-hides
/// after 10s exactly like RN, and both the tap and the timeout raise
/// `onDismissMilestone` so the backend records the milestone as seen.
struct HubNeighborDensitySection: View {
    let content: NeighborDensityContent
    let onDismissMilestone: () -> Void

    @State private var showsMilestone: Bool

    init(content: NeighborDensityContent, onDismissMilestone: @escaping () -> Void) {
        self.content = content
        self.onDismissMilestone = onDismissMilestone
        _showsMilestone = State(initialValue: content.milestone != nil)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if showsMilestone, let milestone = content.milestone {
                Button { dismiss() } label: {
                    HStack(spacing: Spacing.s2) {
                        Icon(.partyPopper, size: 16, color: Theme.Color.primary600)
                        Text(milestone)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.primary600)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Icon(.x, size: 16, color: Theme.Color.appTextMuted)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 10)
                    .background(Theme.Color.primary50)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("hubDensityMilestoneBanner")
                .task {
                    // RN auto-dismisses the banner after 10s.
                    try? await Task.sleep(nanoseconds: 10_000_000_000)
                    if showsMilestone { dismiss() }
                }
            }

            if content.count >= 1 {
                HStack(spacing: 6) {
                    Icon(.users, size: 12, color: Theme.Color.appTextSecondary)
                    Text(content.pillText)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Capsule())
                .accessibilityIdentifier("hubNeighborDensityPill")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("hubNeighborDensity")
    }

    private func dismiss() {
        guard showsMilestone else { return }
        withAnimation(.easeOut(duration: 0.25)) { showsMilestone = false }
        onDismissMilestone()
    }
}
