//
//  PlaceHomeToolsCard.swift
//  Pantopus
//
//  "Home tools" on Your Place: the row into the full Home tools and, under
//  it, the household shortcuts the person's access at this Home allows.
//  Parity twin of Android `PlaceHomeToolsCard`.
//

import SwiftUI

/// A household shortcut under Home tools. Each shows only when the person's
/// access at the Home carries the permission Home tools gates it on.
enum PlaceHomeShortcut: String, CaseIterable, Hashable {
    case tasks, members, documents, emergency

    var title: String {
        switch self {
        case .tasks: "Tasks"
        case .members: "Members"
        case .documents: "Documents"
        case .emergency: "Emergency"
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .tasks: .listChecks
        case .members: .users
        case .documents: .fileText
        case .emergency: .siren
        }
    }

    var permission: String {
        switch self {
        case .tasks: "tasks.view"
        case .members: "members.view"
        case .documents: "docs.view"
        case .emergency: "sensitive.view"
        }
    }

    /// The shortcuts `access` allows, in this order; none without access.
    static func allowed(by access: HomeAccessDTO?) -> [PlaceHomeShortcut] {
        guard let access else { return [] }
        return allCases.filter { access.can($0.permission) }
    }
}

/// The Home tools row with its shortcuts beneath. With none (a guest, a
/// private setup, or before the access is read) it is the single row.
struct PlaceHomeToolsCard: View {
    let shortcuts: [PlaceHomeShortcut]
    let onOpen: () -> Void
    let onShortcut: (PlaceHomeShortcut) -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button(action: onOpen) {
                PlaceActionRowLabel(icon: .house, title: "Home tools", subtitle: "Tasks and tools for your household.")
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("place.homeTools")
            if !shortcuts.isEmpty {
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                HStack(spacing: 0) {
                    ForEach(shortcuts, id: \.self) { shortcut in
                        Button { onShortcut(shortcut) } label: { shortcutLabel(shortcut) }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("place.homeTools.\(shortcut.rawValue)")
                    }
                }
                .padding(.horizontal, 6)
            }
        }
        .placeCard()
    }

    private func shortcutLabel(_ shortcut: PlaceHomeShortcut) -> some View {
        VStack(spacing: 6) {
            PlaceIconTile(icon: shortcut.icon, tone: .home, size: 30)
            Text(shortcut.title)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, minHeight: 44)
        .contentShape(Rectangle())
    }
}
