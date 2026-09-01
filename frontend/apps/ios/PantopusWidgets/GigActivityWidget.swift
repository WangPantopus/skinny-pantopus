//
//  GigActivityWidget.swift
//  PantopusWidgets
//
//  Phase 6b — lock-screen / Dynamic Island UI for the active-task Live
//  Activity. The extension cannot import the app target, so the category
//  accents live in a local hex map (`GigActivityPalette`) that mirrors
//  `GigsCategory.color`; the app's Theme / Icon / token guards do not
//  apply here (extension-only code, outside `Pantopus/Features/**`).
//

import ActivityKit
import SwiftUI
import WidgetKit

struct GigActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GigActivityAttributes.self) { context in
            GigActivityLockScreenView(context: context)
                .activityBackgroundTint(nil)
                .activitySystemActionForegroundColor(
                    GigActivityPalette.color(for: context.attributes.categoryKey)
                )
        } dynamicIsland: { context in
            let accent = GigActivityPalette.color(for: context.attributes.categoryKey)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    GigActivityTile(categoryKey: context.attributes.categoryKey, size: 36)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.attributes.title)
                            .font(.system(size: 14, weight: .bold))
                            .lineLimit(1)
                        Text(context.state.phase.label)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(accent)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if let detail = GigActivityCopy.detailLine(for: context.state) {
                        Text(detail)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                }
            } compactLeading: {
                Image(systemName: GigActivityPalette.symbol(for: context.attributes.categoryKey))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(accent)
            } compactTrailing: {
                Text(context.state.phase.label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(accent)
                    .lineLimit(1)
            } minimal: {
                Image(systemName: GigActivityPalette.symbol(for: context.attributes.categoryKey))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(accent)
            }
        }
    }
}

// MARK: - Lock-screen banner

/// Category-colored leading tile + title + phase label + ETA line.
private struct GigActivityLockScreenView: View {
    let context: ActivityViewContext<GigActivityAttributes>

    var body: some View {
        let accent = GigActivityPalette.color(for: context.attributes.categoryKey)
        HStack(spacing: 12) {
            GigActivityTile(categoryKey: context.attributes.categoryKey, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(context.attributes.title)
                    .font(.system(size: 14, weight: .bold))
                    .lineLimit(1)
                Text(context.state.phase.label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(accent)
                if let detail = GigActivityCopy.detailLine(for: context.state) {
                    Text(detail)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
    }
}

/// Rounded category tile with the category's SF Symbol, white on accent.
private struct GigActivityTile: View {
    let categoryKey: String
    let size: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            .fill(GigActivityPalette.color(for: categoryKey))
            .frame(width: size, height: size)
            .overlay(
                Image(systemName: GigActivityPalette.symbol(for: categoryKey))
                    .font(.system(size: size * 0.42, weight: .semibold))
                    .foregroundStyle(.white)
            )
    }
}

// MARK: - Copy + palette (extension-local)

enum GigActivityCopy {
    /// Secondary line under the phase: late ETA wins, then the worker
    /// name; `nil` collapses the row.
    static func detailLine(for state: GigActivityAttributes.ContentState) -> String? {
        if state.phase == .runningLate, let eta = state.etaMinutes, eta > 0 {
            return "ETA ~\(eta) min"
        }
        if let worker = state.workerName, !worker.isEmpty {
            return "with \(worker)"
        }
        return nil
    }
}

/// Mirrors `GigsCategory.color` / the app's `primary600` fallback. Keep
/// this hex map in the extension ONLY — feature code must keep using
/// design tokens.
enum GigActivityPalette {
    static func color(for categoryKey: String) -> Color {
        switch normalize(categoryKey) {
        case "handyman": Color(rgb: 0xEA580C)
        case "cleaning": Color(rgb: 0x0EA5E9)
        case "moving": Color(rgb: 0x7C3AED)
        case "petcare": Color(rgb: 0x16A34A)
        case "childcare": Color(rgb: 0xDB2777)
        case "tutoring": Color(rgb: 0xCA8A04)
        case "tech": Color(rgb: 0x475569)
        case "delivery": Color(rgb: 0x0891B2)
        default: Color(rgb: 0x0284C7) // app primary600
        }
    }

    static func symbol(for categoryKey: String) -> String {
        switch normalize(categoryKey) {
        case "handyman": "hammer.fill"
        case "cleaning": "sparkles"
        case "moving": "shippingbox.fill"
        case "petcare": "pawprint.fill"
        case "childcare": "figure.and.child.holdinghands"
        case "tutoring": "book.fill"
        case "tech": "desktopcomputer"
        case "delivery": "bicycle"
        default: "checkmark.circle.fill"
        }
    }

    /// Collapse the backend's key aliases the same way
    /// `GigsCategory.from(backendKey:)` does.
    private static func normalize(_ raw: String) -> String {
        switch raw.lowercased() {
        case "handyman", "handy", "repair", "repairs": "handyman"
        case "cleaning", "clean": "cleaning"
        case "moving", "move", "movers": "moving"
        case "petcare", "pet", "pets", "dogwalking", "petsitting": "petcare"
        case "childcare", "child", "babysitting", "nanny": "childcare"
        case "tutoring", "tutor", "lessons", "teaching": "tutoring"
        case "tech", "technology", "it", "computer": "tech"
        case "delivery", "deliveries", "courier": "delivery"
        default: "other"
        }
    }
}

private extension Color {
    init(rgb: UInt32) {
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
