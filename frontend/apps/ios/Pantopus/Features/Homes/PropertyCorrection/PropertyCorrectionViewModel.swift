//
//  PropertyCorrectionViewModel.swift
//  Pantopus
//
//  A13 — Request property correction form. Mirrors Android
//  `PropertyCorrectionViewModel`.
//

import Foundation
import Observation

@Observable
@MainActor
public final class PropertyCorrectionViewModel {
    /// No backend route accepts property corrections yet — `backend/routes/home.js`
    /// and `backend/routes/placeIntelligence.js` expose no correction/dispute
    /// endpoint. The form therefore cannot submit, and says so rather than
    /// flipping a local flag and popping as if it had sent something.
    public static let isSubmissionAvailable = false

    /// Shown above the fields while `isSubmissionAvailable` is false.
    /// Byte-identical to the Android twin.
    public static let unavailableNotice =
        "Corrections can't be submitted yet. We're still building the property-record " +
        "review queue — nothing you enter here is sent to Pantopus."

    public let homeId: String

    public init(homeId: String) {
        self.homeId = homeId
    }
}
