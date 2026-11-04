//
//  PlansListColumn.swift
//  Pantopus
//
//  The Plans list in a column beside the map (`PlansMapBeside`), on a wide
//  screen (the iPhone Duo open, held sideways or half folded like a book):
//  the area and time pill, Ask and the side menu, the type chips, and what
//  the sheet holds pulled all the way up (the list by day, F4, F5),
//  scrolling, with no stops. Host floats at the column's bottom corner. A
//  row, or a pin on the map, opens its plan in this column, on the Plans
//  stack, with the map still beside it.
//

import SwiftUI

struct PlansListColumn: View {
    let viewModel: PlansMapViewModel
    let actions: PlansMapActions
    @State private var flags = PlansFlags.shared

    var body: some View {
        VStack(spacing: 0) {
            PlansMapTopBar(
                viewModel: viewModel,
                showsPlaydates: flags.playdates && viewModel.showsPlaydateFilter,
                onAsk: actions.ask,
                onAreaTap: actions.areaPicker,
                inColumn: true
            )
            .padding(.bottom, Spacing.s2)
            PlansSheetContent(viewModel: viewModel, actions: actions, onStop: { _ in }, inColumn: true)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                // Room under the list for Host, so the last plan scrolls clear of the button.
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if showsHost { Color.clear.frame(height: 66) }
                }
        }
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottomTrailing) {
            if showsHost {
                PlansHostButton { actions.host(nil) }
                    .padding(.trailing, Spacing.s4)
                    .padding(.bottom, Spacing.s4)
                    .transition(.opacity)
            }
        }
        // The map beside this list (`PlansMapBeside`) starts Plans and reads them again on a change: it stays on
        // screen while a plan covers the list.
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("plansListColumn")
    }

    /// Host, once there are plans listed ("Nothing planned yet" has its own ways to start one).
    private var showsHost: Bool {
        viewModel.phase == .ready && viewModel.listLoaded && !viewModel.isEmpty
    }
}
