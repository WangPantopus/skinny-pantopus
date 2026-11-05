//
//  CrewDayMembership.swift
//  Pantopus
//
//  The businesses the signed-in person is on the team of (owner or seat),
//  for Crew Day's crew screens: the side menu shows its Business section
//  only for them, and the crew's list opens on one of them. Read only while
//  `crew_day` is on.
//

import Foundation

@Observable
@MainActor
final class CrewDayMembership {
    static let shared = CrewDayMembership()

    private(set) var businesses: [BusinessMembership] = []
    private var account: String?

    /// Reads the person's businesses again (at sign-in and when the side
    /// menu opens). A failed read keeps what was known.
    func refresh(account: String?) async {
        guard LaunchFeatures.crewDay, let account else {
            businesses = []
            self.account = nil
            return
        }
        if self.account != account {
            businesses = []
            self.account = account
        }
        guard let response: MyBusinessesResponse = try? await APIClient.shared.request(
            BusinessesEndpoints.myBusinesses()
        ), self.account == account else { return }
        businesses = response.businesses
    }
}
