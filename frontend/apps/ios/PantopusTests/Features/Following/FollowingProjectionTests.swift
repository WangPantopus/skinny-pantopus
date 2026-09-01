//
//  FollowingProjectionTests.swift
//  PantopusTests
//
//  §1A① — locks the client-side grouping contract for the Following
//  screen: New updates / Active / Quiet bucketing, the muted-row unread
//  suppression, the "25+" cap, and the quiet placeholder copy.
//

import XCTest
@testable import Pantopus

final class FollowingProjectionTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_750_000_000)

    private func iso(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }

    private func row(
        id: String,
        unread: Int,
        hoursAgo: Double?,
        muted: Bool = false,
        tier: String? = nil
    ) -> FollowingRowDTO {
        let post = hoursAgo.map {
            FollowingPostDTO(
                id: "post-\(id)",
                snippet: "Snippet \(id)",
                createdAt: iso(now.addingTimeInterval(-$0 * 3600))
            )
        }
        return FollowingRowDTO(
            membershipId: id,
            persona: FollowingPersonaDTO(
                id: "p-\(id)",
                handle: id,
                displayName: id,
                avatarUrl: nil,
                status: "active",
                verified: true,
                followerCount: nil
            ),
            fanHandle: nil,
            notificationLevel: "all",
            mutedUntil: muted ? iso(now.addingTimeInterval(86400 * 3)) : nil,
            paidTier: tier.map {
                FollowingTierDTO(
                    rank: 2,
                    name: $0,
                    priceCents: 500
                )
            },
            latestPost: post,
            unreadCount: unread,
            followedAt: nil,
            lastSeenAt: nil
        )
    }

    func testGroupsByActivity() {
        let dtos = [
            row(id: "a", unread: 3, hoursAgo: 2), // unread → New updates
            row(id: "b", unread: 0, hoursAgo: 48), // recent post, no unread → Active
            row(id: "c", unread: 0, hoursAgo: nil), // no post → Quiet
            row(id: "d", unread: 5, hoursAgo: 1, muted: true) // muted suppresses unread → Active
        ]
        let sections = FollowingProjection.sections(from: dtos, now: now)
        XCTAssertEqual(sections.map(\.kind), [.newUpdates, .active, .quiet])
        XCTAssertEqual(sections[0].rows.map(\.id), ["a"])
        XCTAssertEqual(Set(sections[1].rows.map(\.id)), ["b", "d"])
        XCTAssertEqual(sections[2].rows.map(\.id), ["c"])
    }

    func testUnreadBadgeCapsAtTwentyFive() {
        XCTAssertEqual(FollowingProjection.unreadBadge(3), "3")
        XCTAssertEqual(FollowingProjection.unreadBadge(25), "25+")
        XCTAssertEqual(FollowingProjection.unreadBadge(40), "25+")
    }

    func testMutedRowShowsBellOffNotBadge() {
        let (kind, projected) = FollowingProjection.project(
            row(id: "m", unread: 9, hoursAgo: 1, muted: true), now: now
        )
        XCTAssertEqual(kind, .active)
        XCTAssertTrue(projected.isMuted)
        XCTAssertEqual(projected.trailing, .muted)
    }

    func testQuietPlaceholderCopy() {
        let normal = FollowingProjection.project(row(id: "q", unread: 0, hoursAgo: nil), now: now).1
        XCTAssertEqual(normal.bodyText, "No recent updates")
        XCTAssertTrue(normal.bodyIsQuiet)

        let mutedQuiet = FollowingProjection.project(
            row(id: "qm", unread: 0, hoursAgo: nil, muted: true), now: now
        ).1
        XCTAssertEqual(mutedQuiet.bodyText, "No updates while muted")
    }

    func testNewUpdateRowCarriesTierAndBadge() {
        let (kind, projected) = FollowingProjection.project(
            row(id: "t", unread: 1, hoursAgo: 1, tier: "Insiders"), now: now
        )
        XCTAssertEqual(kind, .newUpdates)
        XCTAssertEqual(projected.tierName, "Insiders")
        XCTAssertEqual(projected.trailing, .unread("1"))
    }
}
