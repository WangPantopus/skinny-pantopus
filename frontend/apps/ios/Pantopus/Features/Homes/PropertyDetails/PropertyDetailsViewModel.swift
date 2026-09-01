//
//  PropertyDetailsViewModel.swift
//  Pantopus
//
//  Backs `PropertyDetailsView` (A.4 / A13.5). Reads the home's property
//  fields from `GET /api/homes/:id/property-details` (route
//  `backend/routes/home.js:2991`) and projects them into a `.clean`
//  state. Only the property facts + address are backed; the Records
//  (ATTOM) and Verification (provenance) sections + the mismatch banner
//  have no clean backend source, so they stay empty / nil. An injectable
//  `loader` seam (non-nil) bypasses the network for previews + tests.
//

import Foundation
import Observation

@Observable
@MainActor
final class PropertyDetailsViewModel {
    /// Currently displayed state.
    private(set) var state: PropertyDetailsState = .loading

    private let homeId: String
    private let api: APIClient
    /// Preview/test seam. When non-nil, `load()` projects this loader's
    /// output instead of calling the backend.
    private let loader: (@Sendable (String) throws -> PropertyDetailsContent)?

    init(
        homeId: String,
        api: APIClient = .shared,
        loader: (@Sendable (String) throws -> PropertyDetailsContent)? = nil
    ) {
        self.homeId = homeId
        self.api = api
        self.loader = loader
    }

    /// Initial load; no-op once content is resolved.
    func load() async {
        guard case .loading = state else { return }
        await apply()
    }

    /// Retry after an error.
    func refresh() async {
        await apply()
    }

    private func apply() async {
        if let loader {
            do {
                let content = try loader(homeId)
                state = content.banner == nil ? .clean(content) : .mismatch(content)
            } catch {
                state = .error(message: "Couldn't load property details. Pull to retry.")
            }
            return
        }
        do {
            let response = try await api.request(
                HomesEndpoints.propertyDetails(homeId: homeId),
                as: PropertyDetailsResponse.self
            )
            let content = Self.content(from: response.home)
            state = content.banner == nil ? .clean(content) : .mismatch(content)
        } catch {
            state = .error(message: "Couldn't load property details. Pull to retry.")
        }
    }

    /// Map the backend `home` onto the screen's projection. Records +
    /// Verification stay empty (no clean source) and the banner is never
    /// raised from the backend, so this always yields the clean state.
    static func content(from home: PropertyHomeDTO) -> PropertyDetailsContent {
        let line1 = [home.address?.nonBlank, home.unitNumber?.nonBlank]
            .compactMap { $0 }
            .joined(separator: " · ")
        let stateZip = [home.state?.nonBlank, (home.zipcode ?? home.zipCode)?.nonBlank]
            .compactMap { $0 }
            .joined(separator: " ")
        let line2 = [home.city?.nonBlank, stateZip.nonBlank]
            .compactMap { $0 }
            .joined(separator: ", ")

        var facts: [PropertyFactRow] = []
        if let type = home.homeType?.nonBlank {
            facts.append(PropertyFactRow(id: "type", label: "Type", value: Self.humanize(type)))
        }
        if let year = home.yearBuilt {
            facts.append(PropertyFactRow(id: "year", label: "Year built", value: "\(year)", mono: true))
        }
        if let beds = home.bedrooms {
            facts.append(PropertyFactRow(id: "beds", label: "Bedrooms", value: "\(beds)", mono: true))
        }
        if let baths = home.bathrooms {
            facts.append(PropertyFactRow(id: "baths", label: "Bathrooms", value: Self.formatBaths(baths), mono: true))
        }
        if let sqft = home.sqFt {
            facts.append(PropertyFactRow(id: "interior", label: "Interior", value: "\(sqft) sq ft", mono: true))
        }
        if let lot = home.lotSqFt {
            facts.append(PropertyFactRow(id: "lot", label: "Lot", value: "\(lot) sq ft", mono: true))
        }

        return PropertyDetailsContent(
            address: PropertyAddress(
                line1: line1.isEmpty ? "Address unavailable" : line1,
                line2: line2,
                latitude: home.location?.latitude ?? 0,
                longitude: home.location?.longitude ?? 0
            ),
            propertyFacts: facts,
            records: [],
            verification: [],
            banner: nil
        )
    }

    private static func humanize(_ raw: String) -> String {
        let spaced = raw.replacingOccurrences(of: "_", with: " ")
        return spaced.prefix(1).uppercased() + spaced.dropFirst()
    }

    private static func formatBaths(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }
}

private extension String {
    var nonBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
