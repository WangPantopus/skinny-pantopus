//
//  AddHomeSampleData.swift
//  Pantopus
//
//  Deterministic address fixtures for the Add Home wizard's search-first
//  entry step. These mirror the API shape the rest of the wizard consumes
//  while keeping previews and snapshots network-free.
//

import Foundation

struct AddHomeAddressCandidate: Identifiable, Equatable {
    let id: String
    let street: String
    let unit: String
    let city: String
    let state: String
    let zipCode: String
    let distance: String?
    let status: AddHomeAddressStatus

    var line1: String {
        unit.isEmpty ? street : "\(street), \(unit)"
    }

    var line2: String {
        "\(city), \(state)"
    }

    var secondaryLine: String {
        "\(city), \(state) \(zipCode)"
    }

    var isClaimed: Bool {
        status == .claimed
    }

    var addressFields: AddHomeAddressFields {
        AddHomeAddressFields(
            street: street,
            unit: unit,
            city: city,
            state: state,
            zipCode: zipCode
        )
    }
}

enum AddHomeAddressStatus: String, Equatable {
    case available
    case claimed

    var label: String {
        switch self {
        case .available: "Available"
        case .claimed: "Claimed"
        }
    }
}

enum AddHomeSampleData {
    static let nearbyHomes: [AddHomeAddressCandidate] = [
        AddHomeAddressCandidate(
            id: "elm-412-3b",
            street: "412 Elm St",
            unit: "Apt 3B",
            city: "Brooklyn",
            state: "NY",
            zipCode: "11211",
            distance: "12 ft",
            status: .available
        ),
        AddHomeAddressCandidate(
            id: "elm-412-3a",
            street: "412 Elm St",
            unit: "Apt 3A",
            city: "Brooklyn",
            state: "NY",
            zipCode: "11211",
            distance: "14 ft",
            status: .available
        ),
        AddHomeAddressCandidate(
            id: "elm-412-4b",
            street: "412 Elm St",
            unit: "Apt 4B",
            city: "Brooklyn",
            state: "NY",
            zipCode: "11211",
            distance: "18 ft",
            status: .claimed
        ),
        AddHomeAddressCandidate(
            id: "elm-414",
            street: "414 Elm St",
            unit: "",
            city: "Brooklyn",
            state: "NY",
            zipCode: "11211",
            distance: "42 ft",
            status: .available
        ),
        AddHomeAddressCandidate(
            id: "elm-410",
            street: "410 Elm St",
            unit: "",
            city: "Brooklyn",
            state: "NY",
            zipCode: "11211",
            distance: "48 ft",
            status: .available
        )
    ]

    static let autocompleteHomes: [AddHomeAddressCandidate] = [
        nearbyHomes[0],
        nearbyHomes[1],
        AddHomeAddressCandidate(
            id: "cambridge-412-elm",
            street: "412 Elm Street",
            unit: "",
            city: "Cambridge",
            state: "MA",
            zipCode: "02139",
            distance: nil,
            status: .available
        ),
        AddHomeAddressCandidate(
            id: "buffalo-412-elmwood",
            street: "412 Elmwood Ave",
            unit: "",
            city: "Buffalo",
            state: "NY",
            zipCode: "14222",
            distance: nil,
            status: .available
        ),
        AddHomeAddressCandidate(
            id: "sacramento-4120-elm-ridge",
            street: "4120 Elm Ridge Rd",
            unit: "",
            city: "Sacramento",
            state: "CA",
            zipCode: "95821",
            distance: nil,
            status: .available
        )
    ]

    static func autocompleteResults(matching query: String) -> [AddHomeAddressCandidate] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        let needle = trimmed.lowercased()
        let terms = needle.split(separator: " ").map(String.init)
        return autocompleteHomes.filter { candidate in
            let haystack = "\(candidate.line1) \(candidate.secondaryLine)".lowercased()
            return haystack.contains(needle) || terms.allSatisfy { haystack.contains($0) }
        }
    }

    static func candidate(for address: AddHomeAddressFields) -> AddHomeAddressCandidate? {
        nearbyHomes.first { $0.addressFields == address }
            ?? autocompleteHomes.first { $0.addressFields == address }
    }

    static let geocodedAddress = AddHomeGeocodedAddress(
        street: "412 Elm Street",
        unit: "3B",
        city: "Brooklyn",
        state: "NY",
        zipCode: "11211",
        latitude: 40.7138,
        longitude: -73.9527,
        isMultiUnit: true
    )

    static let geocodedReadyForm = AddHomeFormState(
        step: AddHomeStep.confirm.rawValue,
        address: AddHomeAddressFields(
            street: "412 Elm Street",
            unit: "3B",
            city: "Brooklyn",
            state: "NY",
            zipCode: "11211"
        )
    )

    static let zipMismatchForm = AddHomeFormState(
        step: AddHomeStep.confirm.rawValue,
        address: AddHomeAddressFields(
            street: "412 Elm Street",
            unit: "3B",
            city: "Brooklyn",
            state: "NY",
            zipCode: "11201"
        )
    )
}
