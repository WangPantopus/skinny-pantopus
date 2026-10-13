//
//  PlansRefresh.swift
//  Pantopus
//
//  A Plans screen reads again when Plans data changes while it's shown: a
//  push in the foreground, an action on another screen, coming back to the
//  app (RootTabView signals all three through `PlansStoreReads.changed`).
//
//  Not `refreshesOnStoreChange`: its window probe can point at a copy of the
//  screen that isn't in the window (seen on iOS 27 for a plan opened from
//  "See your plan"), and then the screen on top never reads again. Plans
//  screens keep nothing that must be cleared in the background, so "shown"
//  is enough.
//

import SwiftUI

extension View {
    func refreshesOnPlansChange(perform action: @escaping @MainActor () async -> Void) -> some View {
        modifier(PlansRefresh(action: action))
    }
}

private struct PlansRefresh: ViewModifier {
    let action: @MainActor () async -> Void
    @State private var isShown = false

    func body(content: Content) -> some View {
        content
            .onAppear { isShown = true }
            .onDisappear { isShown = false }
            .onReceive(NotificationCenter.default.publisher(for: .screenStoreChanged)) { note in
                guard isShown, PlansStoreReads.affects(note) else { return }
                Task { await action() }
            }
    }
}
