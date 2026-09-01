//
//  BusinessLocationsView.swift
//  Pantopus
//
//  Locations & Hours list MVP — thin ListOfRows wrapper. Add/edit forms
//  are a follow-up; this screen lists active locations from
//  `GET /api/businesses/:id/locations`.
//

import SwiftUI

public struct BusinessLocationsView: View {
    @State private var viewModel: BusinessLocationsViewModel

    public init(businessId: String) {
        _viewModel = State(initialValue: BusinessLocationsViewModel(businessId: businessId))
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("businessLocations")
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
    }
}
