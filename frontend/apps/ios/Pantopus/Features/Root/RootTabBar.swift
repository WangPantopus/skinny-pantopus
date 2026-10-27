//
//  RootTabBar.swift
//  Pantopus
//
//  The bar over `RootTabContainer` while the Mailbox is on: Place · Today ·
//  Nearby · Plans · Mail · Messages (drawing "Six-tab bar", Mail tab design
//  2026-10-27). The same icons, labels and `tab.<id>` ids as the system bar;
//  Mail's red badge counts unopened mail and Messages' counts chats. The
//  labels keep their size at every text size, as the system bar's do, and at
//  the accessibility sizes a long press shows the large content viewer.
//

import SwiftUI

/// The selected tab was tapped again: its stack goes back to its root.
struct RootTabReselection: Equatable {
    let tab: RootTab
    let id = UUID()
}

struct RootTabBar: View {
    /// The bar's height above the bottom safe area.
    static let height: CGFloat = 50

    let tabs: [RootTab]
    let selected: RootTab
    let badges: [RootTab: Int]
    let onSelect: @MainActor (RootTab) -> Void

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s0) {
            ForEach(tabs, id: \.self) { tab in
                RootTabBarItem(tab: tab, isSelected: tab == selected, badge: badges[tab] ?? 0) {
                    onSelect(tab)
                }
            }
        }
        .padding(.horizontal, 2)
        .padding(.top, 6)
        .frame(maxWidth: .infinity)
        .frame(height: Self.height, alignment: .top)
        .background(Theme.Color.appSurface.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
        // VoiceOver reads each tab as "tab, 5 of 6", as on the system bar.
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isTabBar)
        .accessibilityIdentifier("rootTabBar")
    }
}

private struct RootTabBarItem: View {
    let tab: RootTab
    let isSelected: Bool
    let badge: Int
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Icon(tab.icon, size: 24, strokeWidth: isSelected ? 2.25 : 1.75, color: tint)
                    .overlay(alignment: .topLeading) {
                        if badge > 0 {
                            RootTabBadge(count: badge)
                                .offset(x: 16, y: -5)
                        }
                    }
                Text(tab.label)
                    .font(.system(size: 11, weight: isSelected ? .semibold : .medium))
                    .foregroundStyle(tint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .top)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityIdentifier("tab.\(tab.id)")
        .accessibilityShowsLargeContentViewer {
            Icon(tab.icon, size: 24)
            Text(tab.label)
        }
    }

    private var tint: Color {
        isSelected ? Theme.Color.primaryInk : Theme.Color.appTextSecondary
    }

    /// "Mail, 3 unopened", "Messages, 2 unread", or the tab's name.
    private var accessibilityLabel: String {
        guard badge > 0 else { return tab.label }
        return tab == .mail ? "\(tab.label), \(badge) unopened" : "\(tab.label), \(badge) unread"
    }
}

private struct RootTabBadge: View {
    let count: Int

    var body: some View {
        Text(count > 99 ? "99+" : "\(count)")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .lineLimit(1)
            .padding(.horizontal, 5)
            .frame(minWidth: 18, minHeight: 18)
            .background(Capsule().fill(Theme.Color.errorSolid))
            .overlay(Capsule().strokeBorder(Theme.Color.appSurface, lineWidth: 2))
            .fixedSize()
            .accessibilityHidden(true)
    }
}

extension View {
    /// Hides the bottom bar while this screen shows: the system tab bar, and
    /// the drawn bar while the Mailbox is on (`RootTabBar`).
    func hidesTabBar() -> some View {
        modifier(HidesTabBar())
    }
}

private struct HidesTabBar: ViewModifier {
    @Environment(RootTabModel.self) private var rootTabs: RootTabModel?
    @State private var token = UUID()

    func body(content: Content) -> some View {
        content
            .toolbar(.hidden, for: .tabBar)
            .onAppear { rootTabs?.barHiders.insert(token) }
            .onDisappear { rootTabs?.barHiders.remove(token) }
    }
}
