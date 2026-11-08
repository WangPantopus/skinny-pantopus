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

/// The chat button at the top right of every tab's first screen but Mail's
/// (founder decision 2026-11-08, as Facebook shows Messenger): it carries the
/// unread count the Messages tab had and opens Messages over the tab you're
/// on. Outside the tab view it draws nothing.
struct MessagesButton: View {
    @Environment(RootTabModel.self) private var rootTabs: RootTabModel?
    let accessibilityIdentifier: String
    /// A round material button for chrome floating over a map (Plans).
    var floating = false

    var body: some View {
        if let rootTabs {
            Button {
                rootTabs.openMessages()
            } label: {
                Group {
                    if floating {
                        Icon(.messageCircle, size: 21, color: Theme.Color.appText)
                            .frame(width: Spacing.s12, height: Spacing.s12)
                            .background(Circle().fill(.regularMaterial))
                            .shadow(color: .black.opacity(0.12), radius: 5, x: 0, y: 2)
                            .contentShape(Circle())
                    } else {
                        Icon(.messageCircle, size: 21, color: Theme.Color.appText)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                }
                .overlay(alignment: .topLeading) {
                    if rootTabs.messagesBadge > 0 {
                        RootTabBadge(count: rootTabs.messagesBadge, ring: true)
                            .offset(x: floating ? 27 : 25, y: floating ? 3 : 4)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(rootTabs.messagesBadge > 0 ? "Messages, \(rootTabs.messagesBadge) unread" : "Messages")
            .accessibilityIdentifier(accessibilityIdentifier)
        }
    }
}
