//
//  HidesTabBar.swift
//  Pantopus
//
//  A screen that has the whole window hides the tabs' bottom bar while it
//  shows: a chat, and a few forms and threads. It comes back on any screen
//  pushed over it and as soon as the person leaves it.
//

import SwiftUI

extension View {
    /// Hides the bottom bar while this screen shows: the system tab bar, and
    /// the drawn bar while the Mailbox is on (`RootTabBar`). A screen pushed over
    /// this one has the bar again. With `hides` false the bar stays, for a
    /// screen that hides it only where it is the whole screen: a chat keeps it
    /// beside the list on a wide screen.
    func hidesTabBar(_ hides: Bool = true) -> some View {
        modifier(HidesTabBar(hides: hides))
    }
}

private struct HidesTabBar: ViewModifier {
    let hides: Bool
    @Environment(RootTabModel.self) private var rootTabs: RootTabModel?
    @State private var token = UUID()
    /// Another screen is pushed over this one, or another tab is picked. The
    /// system bar would otherwise stay hidden for every screen above this one.
    @State private var isCovered = false

    func body(content: Content) -> some View {
        content
            .toolbar(hides && !isCovered ? .hidden : .automatic, for: .tabBar)
            .onAppear {
                isCovered = false
                setHidden(hides)
            }
            .onDisappear {
                isCovered = true
                setHidden(false)
            }
            // A fold or a turn can change it while the screen stays up.
            .onChange(of: hides) { _, hides in
                if !isCovered { setHidden(hides) }
            }
    }

    private func setHidden(_ hidden: Bool) {
        if hidden {
            rootTabs?.barHiders.insert(token)
        } else {
            rootTabs?.barHiders.remove(token)
        }
    }
}
