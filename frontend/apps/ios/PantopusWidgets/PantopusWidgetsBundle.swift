//
//  PantopusWidgetsBundle.swift
//  PantopusWidgets
//
//  Widget-extension entry point: the active-task Live Activity (Phase
//  6b), the "Tasks near me" home-screen timeline widget (Phase 6c) and
//  "Today at your address" (the Today tab's living sky).
//

import SwiftUI
import WidgetKit

@main
struct PantopusWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TodayWidget()
        TasksNearMeWidget()
        GigActivityWidget()
    }
}
