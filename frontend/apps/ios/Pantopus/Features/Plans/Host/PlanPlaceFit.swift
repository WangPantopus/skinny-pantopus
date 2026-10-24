//
//  PlanPlaceFit.swift
//  Pantopus
//
//  H6's order of places for a kind, "You're here now" (board H4)
//  choosing the public place the host is at, and the server gathering the
//  host's places when the host flow opens.
//

import CoreLocation
import Foundation

/// Suitable categories first, preserving distance order within each; never a bar for a playdate.
/// Places open for only part of the plan come after the ones open for all of it, and closed ones
/// last, as the server orders them (`fitOrder` in backend/services/plans/planPlaces.js).
enum PlanPlaceFit {
    static func ordered(_ places: [PlanPlaceOptionDTO], for kind: PlanKind) -> [PlanPlaceOptionDTO] {
        let preferred = preferredCategories(kind)
        let allowed = places.filter { kind != .playdate || ($0.category ?? "").lowercased() != "bar" }
        return allowed.enumerated()
            .sorted { first, second in
                let one = rank(first.element, preferred)
                let two = rank(second.element, preferred)
                return one == two ? first.offset < second.offset : one < two
            }
            .map(\.element)
    }

    private static func rank(_ place: PlanPlaceOptionDTO, _ preferred: [String]) -> Int {
        let category = preferred.firstIndex(of: (place.category ?? "").lowercased()) ?? preferred.count
        let hours = place.hours?.isClosed == true ? 2 : place.hours?.isPartial == true ? 1 : 0
        return hours * 100 + category
    }

    private static func preferredCategories(_ kind: PlanKind) -> [String] {
        switch kind {
        case .watchParty: ["bar", "restaurant", "cafe", "community_center"]
        case .playdate: ["playground", "park", "library", "community_center"]
        case .pickupGame: ["court", "park", "playground", "community_center"]
        case .walkCoffee: ["trail", "park", "cafe"]
        case .studyGroup: ["library", "cafe", "community_center"]
        }
    }
}

/// The nearest named public place within a block, excluding the host's homes.
/// Matches `HOME_GUARD_METERS` in backend/services/plans/planRules.js.
enum PlanHereNow {
    static let reachMeters: CLLocationDistance = 150
    static let homeGuardMeters: CLLocationDistance = 50

    static func spot(
        in places: [PlanPlaceOptionDTO],
        around fix: UserCoordinate,
        homes: [(latitude: Double, longitude: Double)]
    ) -> PlanPlaceOptionDTO? {
        let here = CLLocation(latitude: fix.latitude, longitude: fix.longitude)
        let homeSpots = homes.map { CLLocation(latitude: $0.latitude, longitude: $0.longitude) }
        func meters(_ place: PlanPlaceOptionDTO) -> CLLocationDistance {
            place.distanceMeters ?? here.distance(from: CLLocation(latitude: place.latitude, longitude: place.longitude))
        }
        func atHome(_ place: PlanPlaceOptionDTO) -> Bool {
            let spot = CLLocation(latitude: place.latitude, longitude: place.longitude)
            return homeSpots.contains { $0.distance(from: spot) <= homeGuardMeters }
        }
        return places.filter { meters($0) <= reachMeters && !atHome($0) }.min { meters($0) < meters($1) }
    }
}

/// Starts the server gathering the public places around the host when the host flow opens, so H6
/// usually opens on a full list: a new area can take the map servers up to a minute. The server
/// answers at once (`wait: false`); nothing is shown from it.
enum PlanPlacesWarmup {
    @MainActor
    static func start(home: PlanHomeChoice?) async {
        let point = DeviceLocationProvider.shared.cachedCoordinate()
            ?? home.map { UserCoordinate(latitude: $0.latitude, longitude: $0.longitude, accuracyMeters: 50) }
            ?? PlansStoreReads.lastCenter
        guard let point else { return }
        _ = try? await APIClient.shared.requestData(
            PlansEndpoints.nearbyPlaces(latitude: point.latitude, longitude: point.longitude, wait: false)
        )
    }
}
