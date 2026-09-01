//
//  NotificationsZoneStrip.swift
//  Pantopus
//
//  S5 — Personal / Audience (Beacon) firewall zone selector.
//
//  The `ListOfRows` shell renders exactly one filter strip (tabs OR
//  chips), and Notifications already spends that slot on the
//  All / Unread / Read filter. The zone selector therefore rides in the
//  shell's `customHeader` slot as a segmented control, mirroring
//  Android's `NotificationsZoneStrip` composable.
//

import SwiftUI

/// Segmented Personal / Audience selector. Only rendered when the
/// account actually has a Beacon stream (or the route asked for a
/// specific zone) — see `NotificationsViewModel.showsZoneStrip`.
public struct NotificationsZoneStrip: View {
    private let zones: [NotificationsZone]
    private let selected: NotificationsZone
    private let onSelect: @MainActor (NotificationsZone) -> Void

    public init(
        zones: [NotificationsZone],
        selected: NotificationsZone,
        onSelect: @escaping @MainActor (NotificationsZone) -> Void
    ) {
        self.zones = zones
        self.selected = selected
        self.onSelect = onSelect
    }

    public var body: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(zones, id: \.self) { zone in
                Button { onSelect(zone) } label: {
                    Text(zone.label)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(
                            zone == selected
                                ? Theme.Color.appTextInverse
                                : Theme.Color.appTextSecondary
                        )
                        .frame(maxWidth: .infinity)
                        .frame(height: 32)
                        .background(
                            zone == selected
                                ? Theme.Color.primary600
                                : Theme.Color.appSurface
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(zone.label) notifications")
                .accessibilityAddTraits(zone == selected ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("notifications.zone.\(zone.rawValue)")
            }
        }
        .padding(Spacing.s1)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("notifications.zoneStrip")
    }
}

#Preview {
    NotificationsZoneStrip(
        zones: NotificationsZone.allCases,
        selected: .personal
    ) { _ in }
}
