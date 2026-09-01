//
//  SupportTrainsView.swift
//  Pantopus
//
//  T6.6c (P26.5) — Support trains. Thin wrapper around the shared
//  `ListOfRowsView`. The shell renders the back chevron, title,
//  trailing search action, three tabs, and per-train rows with the
//  category-gradient leading tile + status chip trailing.
//

import SwiftUI

public struct SupportTrainsView: View {
    @State private var viewModel: SupportTrainsViewModel

    public init(viewModel: SupportTrainsViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("supportTrains")
    }
}

#Preview {
    NavigationStack {
        SupportTrainsView(viewModel: SupportTrainsViewModel())
    }
}
