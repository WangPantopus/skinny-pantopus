//
//  StartSupportTrainSampleData.swift
//  Pantopus
//
//  Deterministic A12.11 data for previews, structural snapshots, and
//  step-1 invite/verified-recipient fixtures.
//

import Foundation

public enum StartSupportTrainSampleData {
    public static let verifiedNeighbor = MailRecipientDTO(
        userId: "u_maya_patel",
        name: "Maya Patel",
        username: "maya",
        homeId: "home_elm_418",
        homeAddress: "418 Elm St, Apt 2",
        isVerified: true,
        homeMediaUrl: nil,
        isOnPantopus: true
    )

    public static let verifiedContextNote =
        "Maya is home after knee surgery on the 12th. Meals, dog walks for Pixel, and rides to PT would help."

    /// Mutual connections shared with the verified neighbor — drives the
    /// recipient card's micro-avatar strip ("2 mutuals: Marisa, Devon").
    public static let mutuals: [StartSupportTrainMutual] = [
        StartSupportTrainMutual(id: "u_marisa_lee", name: "Marisa"),
        StartSupportTrainMutual(id: "u_devon_park", name: "Devon")
    ]

    public static let inviteQuery = "David Chen"

    /// The Frame-2 invite candidate built from the typed query plus
    /// stubbed contact handles (real contact-picker is out of scope).
    public static let inviteCandidate = StartSupportTrainInviteCandidate(
        typedName: inviteQuery,
        phone: "+1 (415) 555-0142",
        email: "d.chen@example.com"
    )
}
