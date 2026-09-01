//
//  YourAudienceSampleData.swift
//  Pantopus
//
//  Deterministic sample data for A22.2 "Your audience" previews. Mirrors
//  the four design frames (populated · pending · full-empty · no-pending).
//

import Foundation

enum YourAudienceSampleData {
    private static func member(
        _ name: String,
        rank: Int,
        local: Bool,
        status: String = "active",
        month: String = "2025-01"
    ) -> AudienceMember {
        let key = name.lowercased().filter { !$0.isWhitespace }
        return AudienceMember(
            membershipId: "m_\(key)",
            displayName: name,
            handle: "@\(key)",
            avatarURL: nil,
            tierRank: rank,
            tierName: tierName(rank: rank),
            verifiedLocal: local,
            status: status,
            joinedMonth: month,
            tenureMonths: 4
        )
    }

    private static func tierName(rank: Int) -> String {
        switch rank {
        case 4: "VIP"
        case 3: "Insiders"
        default: "Members"
        }
    }

    static let pending: [AudienceMember] = [
        member("Dana Reyes", rank: 3, local: true, status: "pending", month: "2025-05"),
        member("Marcus Lee", rank: 4, local: false, status: "pending", month: "2025-05")
    ]

    static let vipMembers: [AudienceMember] = [
        member("Priya Nair", rank: 4, local: true, month: "2025-01"),
        member("Tom Becker", rank: 4, local: false, status: "muted", month: "2024-11")
    ]

    static let insiderMembers: [AudienceMember] = [
        member("Sana Ortiz", rank: 3, local: true, month: "2025-03"),
        member("Otis Park", rank: 3, local: false, month: "2025-04"),
        member("Lena Cho", rank: 3, local: true, month: "2025-05")
    ]

    static let counts = AudienceCounts(totalActive: 5, pending: 2, byTier: [4: 2, 3: 3])

    static let tierNames: [Int: String] = [4: "VIP", 3: "Insiders"]

    static let populatedLoaded = AudienceLoaded(
        counts: counts,
        pending: pending,
        tierGroups: [
            AudienceTierGroup(rank: 4, name: "VIP", members: vipMembers),
            AudienceTierGroup(rank: 3, name: "Insiders", members: insiderMembers)
        ]
    )

    #if DEBUG
    @MainActor
    static func populatedViewModel() -> YourAudienceViewModel {
        YourAudienceViewModel.preview(.loaded(populatedLoaded), counts: counts, tierNames: tierNames)
    }

    @MainActor
    static func emptyViewModel() -> YourAudienceViewModel {
        YourAudienceViewModel.preview(.empty, counts: .zero)
    }
    #endif
}
