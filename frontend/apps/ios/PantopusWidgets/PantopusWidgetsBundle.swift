//
//  PantopusWidgetsBundle.swift
//  PantopusWidgets
//
//  Widget-extension entry point: the active-task Live Activity (Phase
//  6b) plus the "Tasks near me" home-screen timeline widget (Phase 6c).
//

import SwiftUI
import WidgetKit

@main
struct PantopusWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TasksNearMeWidget()
        GigActivityWidget()
    }
}
