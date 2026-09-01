//
//  MyTasksView.swift
//  Pantopus
//
//  T5.3.2 — My tasks V2. Thin wrapper around `ListOfRowsView`. The
//  shell renders the back chevron, centered "My tasks" title, trailing
//  filter icon, four tabs, the open-tab banner, the row cards (with
//  the bidder stack + status chip + footer actions), and the 56pt
//  canonical-create FAB ("Post a task"). All bespoke logic lives in
//  the ViewModel.
//

import SwiftUI

public struct MyTasksView: View {
    @State private var viewModel: MyTasksViewModel

    public init(viewModel: MyTasksViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        @Bindable var bindable = viewModel
        return ListOfRowsView(dataSource: viewModel) {
            // "Rebook a favorite helper". Renders above the list and collapses
            // to nothing when the server has no rebookable tasks, so it never
            // costs a task-less poster any vertical space.
            RebookRailView { gig in
                viewModel.rebook(gig)
            }
        }
        .accessibilityIdentifier("my-tasks")
        .sheet(isPresented: $bindable.isFilterPresented) {
            ActivityFilterSheet(
                statusTitle: viewModel.statusFilterTitle,
                statusOptions: viewModel.statusFilterOptions,
                sortOptions: viewModel.sortFilterOptions,
                filter: viewModel.activityFilter,
                onApply: { viewModel.applyFilter($0) },
                onClose: { viewModel.isFilterPresented = false }
            )
        }
    }
}

#Preview {
    NavigationStack {
        MyTasksView(viewModel: MyTasksViewModel())
    }
}
