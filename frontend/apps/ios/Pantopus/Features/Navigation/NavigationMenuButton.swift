//
//  NavigationMenuButton.swift
//  Pantopus
//
//  The side menu on every tab (founder decision 2026-10-20): the top screen
//  of each tab carries this menu button, and `RootTabView` hosts the one
//  navigation drawer it opens, above the whole tab view. The drawer's rows
//  open their screens in the Place tab's stack (`NavigationMenuAction`), as
//  the account links (`/connections`, `/wallet` …) already did.
//

import SwiftUI

/// What the side menu asks the Place tab's stack to open.
enum NavigationMenuAction: Equatable {
    /// A drawer row's screen, pushed on the Place stack.
    case open(NavigationDrawerDestination)
    /// "Back to Place": the Place stack's root.
    case backToPlace
    /// The context pill's Switch chip (launch cut #2, Personas).
    case identityCenter
}

/// The menu button that opens the side menu. Outside the tab view (a
/// preview, a cover without the tab model) it draws nothing.
struct NavigationMenuButton: View {
    @Environment(RootTabModel.self) private var rootTabs: RootTabModel?
    let accessibilityIdentifier: String
    /// A round material button for chrome floating over a map (Plans).
    var floating = false

    var body: some View {
        if let rootTabs {
            Button {
                rootTabs.showsNavigationMenu = true
            } label: {
                if floating {
                    Icon(.menu, size: 20, color: Theme.Color.appText)
                        .frame(width: Spacing.s12, height: Spacing.s12)
                        .background(Circle().fill(.regularMaterial))
                        .shadow(color: .black.opacity(0.12), radius: 5, x: 0, y: 2)
                        .contentShape(Circle())
                } else {
                    Icon(.menu, size: 20, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Menu")
            .accessibilityIdentifier(accessibilityIdentifier)
        }
    }
}
