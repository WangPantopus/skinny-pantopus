//
//  PulsePostTargetPickerViewModel.swift
//  Pantopus
//
//  Loads homes for step 1 of the Pulse compose flow and resolves
//  current-location coordinates via Core Location + reverse geocode.
//  (Businesses don't post to Pulse, Pulse S1, so none are offered.)
//

import Foundation
import Observation

public struct PulseHomeTargetOption: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let latitude: Double
    public let longitude: Double
}

public enum PulsePostTargetPickerState: Sendable, Equatable {
    case loading
    case ready
    case error(String)
}

@Observable
@MainActor
public final class PulsePostTargetPickerViewModel {
    public private(set) var state: PulsePostTargetPickerState = .loading
    public private(set) var homes: [PulseHomeTargetOption] = []
    public private(set) var isLocating = false

    private let api: APIClient
    private let locationProvider: any LocationProviding

    init(
        api: APIClient = .shared,
        locationProvider: any LocationProviding = DeviceLocationProvider.shared
    ) {
        self.api = api
        self.locationProvider = locationProvider
    }

    public func load() async {
        state = .loading
        do {
            let homesResponse: MyHomesResponse = try await api.request(HomesEndpoints.myHomes())
            homes = homesResponse.sharedHomes.compactMap { row in
                guard let loc = row.location else { return nil }
                return PulseHomeTargetOption(
                    id: row.id,
                    label: row.areaLabel,
                    latitude: loc.latitude,
                    longitude: loc.longitude
                )
            }
            state = .ready
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    public func selectCurrentLocation() async -> PulsePostingTarget? {
        isLocating = true
        defer { isLocating = false }
        guard let coordinate = await locationProvider.requestCurrent(timeoutSeconds: 4) else {
            return nil
        }
        var label = String(format: "%.2f, %.2f", coordinate.latitude, coordinate.longitude)
        do {
            let response: GeoReverseResponse = try await api.request(
                GeoEndpoints.reverse(latitude: coordinate.latitude, longitude: coordinate.longitude)
            )
            let locality = response.normalized.localityLabel
            if !locality.isEmpty { label = locality }
        } catch {
            // keep coordinate fallback
        }
        return .currentLocation(
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            label: label
        )
    }
}
