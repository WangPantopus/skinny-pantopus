//
//  SchedulingA11yModifiers.swift
//  Pantopus
//
//  H14 Accessibility & Large-Text pass · Stream I18. Reusable accessibility
//  helpers for the Calendarly surface — minimum touch targets, a visible focus
//  ring, slot/timezone VoiceOver label builders, and a Dynamic-Type reflow gate
//  for slot grids. These are the building blocks the H14 contract requires
//  (see SchedulingA11yAudit). H14 is scoped to its OWN files: I18 ships these and
//  adopts them in its H15 screen; gaps found inside other streams' files are
//  filed as follow-up issues, never edited here. Tokens only.
//

import SwiftUI

/// VoiceOver label + value builders so availability, time, and timezone are
/// always conveyed by text — never by color alone.
public enum SchedulingA11y {
    /// "Tue Jun 16, 3:00 PM, available" / "…, taken" — the per-slot button name.
    public static func slotLabel(date: String, time: String, isAvailable: Bool) -> String {
        "\(date), \(time), \(isAvailable ? "available" : "taken")"
    }

    /// "Times shown in Pacific Time" — and, on a host/viewer mismatch,
    /// "…, host is in Eastern Time" so the timezone affordance is announced.
    public static func timezoneLabel(viewer: String, host: String? = nil) -> String {
        guard let host, host != viewer else {
            return "Times shown in \(viewer)"
        }
        return "Times shown in \(viewer), host is in \(host)"
    }
}

public extension View {
    /// Guarantee a ≥`size` (default 44pt) interactive target with a full hit area
    /// — the floor every scheduling control must meet, including at large text.
    func a11yMinimumTapTarget(_ size: CGFloat = 44) -> some View {
        frame(minWidth: size, minHeight: size)
            .contentShape(Rectangle())
    }

    /// A visible focus ring for keyboard / switch-control focus (color is never
    /// the sole signal — pair with a real `accessibilityLabel`).
    func a11yFocusRing(
        active: Bool,
        accent: Color = Theme.Color.primary600,
        cornerRadius: CGFloat = Radii.sm
    ) -> some View {
        overlay(
            RoundedRectangle(cornerRadius: cornerRadius + 2, style: .continuous)
                .stroke(accent.opacity(0.45), lineWidth: active ? 2 : 0)
                .padding(-3)
        )
    }
}

public extension DynamicTypeSize {
    /// Slot grids collapse to a single stacked column at accessibility sizes so
    /// day numbers never truncate and every tile keeps a 44pt target.
    var schedulingSlotColumns: Int {
        isAccessibilitySize ? 1 : 3
    }
}
