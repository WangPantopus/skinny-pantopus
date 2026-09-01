//
//  BusinessLocationsViewModel.swift
//  Pantopus
//
//  Owner/staff Locations & Hours list MVP. Reads
//  `GET /api/businesses/:businessId/locations` and projects rows into the
//  shared ListOfRows shell. Add-location form is a follow-up.
//

import Foundation
import Observation

@Observable
@MainActor
public final class BusinessLocationsViewModel: ListOfRowsDataSource {
    public var title: String {
        "Locations & Hours"
    }

    public var topBarAction: TopBarAction? {
        nil
    }

    public var tabs: [ListOfRowsTab] {
        []
    }

    public var selectedTab: String = ""

    public var fab: FABAction? {
        nil
    }

    public private(set) var state: ListOfRowsState = .loading

    private let businessId: String
    private let api: APIClient

    init(businessId: String, api: APIClient = .shared) {
        self.businessId = businessId
        self.api = api
    }

    public func load() async {
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    public func loadMoreIfNeeded() async {}

    private func fetch() async {
        do {
            let response: BusinessLocationsResponse = try await api.request(
                BusinessesEndpoints.locations(businessId: businessId)
            )
            rebuild(locations: response.locations)
        } catch {
            state = .error(message: "Couldn't load locations. Pull to retry.")
        }
    }

    private func rebuild(locations: [BusinessLocationDTO]) {
        guard !locations.isEmpty else {
            state = .empty(.init(
                icon: .mapPin,
                headline: "No locations yet",
                subcopy: "Add a storefront or service area so neighbors know where to find you.",
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            ))
            return
        }
        let rows: [RowModel] = locations.map { location in
            let title = Self.displayTitle(for: location)
            let subtitle = Self.subtitle(for: location)
            let isPrimary = location.isPrimary == true
            return RowModel(
                id: location.id,
                title: title,
                subtitle: subtitle,
                template: isPrimary ? .statusChip : .fileChevron,
                leading: .typeIcon(
                    .mapPin,
                    background: Theme.Color.businessBg,
                    foreground: Theme.Color.business
                ),
                trailing: isPrimary
                    ? .statusChip(text: "Primary", variant: .business)
                    : .chevron
            ) {}
        }
        state = .loaded(
            sections: [RowSection(id: "locations", header: "Locations · \(locations.count)", rows: rows)],
            hasMore: false
        )
    }

    private static func displayTitle(for location: BusinessLocationDTO) -> String {
        if let label = location.label?.trimmedNonEmpty { return label }
        if let city = location.city?.trimmedNonEmpty { return city }
        if let address = location.address?.trimmedNonEmpty { return address }
        return "Location"
    }

    private static func subtitle(for location: BusinessLocationDTO) -> String? {
        var parts: [String] = []
        if let address = location.address?.trimmedNonEmpty { parts.append(address) }
        let locality = [location.city, location.state]
            .compactMap { $0?.trimmedNonEmpty }
            .joined(separator: ", ")
        if !locality.isEmpty { parts.append(locality) }
        if let zip = location.zipcode?.trimmedNonEmpty { parts.append(zip) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

private extension String {
    var trimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
