//
//  DeepLinkRouterPlaceTests.swift
//  PantopusTests
//
//  `pantopus://place` routing. Neither client had a Place destination, so
//  every Place-derived push routed to /hub and Place was unreachable after
//  a back-swipe.
//
//  Split out of DeepLinkRouterTests to stay inside SwiftLint's
//  type_body_length limit, which CI runs with --strict.
//

import XCTest
@testable import Pantopus

@MainActor
final class DeepLinkRouterPlaceTests: XCTestCase {
    /// WS1.4 gates `.content` destinations behind the session check: a
    /// signed-out link is stashed for post-login replay instead of being
    /// published to `pending`. These cases describe a signed-in user's
    /// routing, so bind the seam rather than depending on whatever session
    /// the test host happens to hold. Mirrors `DeepLinkRouterTests.setUp`.
    override func setUp() {
        super.setUp()
        DeepLinkRouter.bindSignedInProvider { true }
        DeepLinkRouter.shared.clearPending()
        PendingDeepLinkStore.clear()
    }

    override func tearDown() {
        DeepLinkRouter.bindSignedInProvider(nil)
        DeepLinkRouter.shared.clearPending()
        PendingDeepLinkStore.clear()
        super.tearDown()
    }

    // Neither client had a Place destination, so every Place-derived push
    // routed to /hub and Place was unreachable after a back-swipe.

    func testPlaceBareLinkDefersHomeResolutionToTheClient() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://place"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .place(homeId: nil, slug: nil))
    }

    func testPlaceTakesHomeIdFromThePath() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://place/home-1"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .place(homeId: "home-1", slug: nil))
    }

    func testPlaceTakesHomeIdFromTheIdQuery() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://place?id=home-1"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .place(homeId: "home-1", slug: nil))
    }

    func testPlaceOpensAGroupDetailPageFromThePath() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://place/home-1/risk"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .place(homeId: "home-1", slug: "risk"))
    }

    func testPlaceOpensAGroupDetailPageFromTheSectionQuery() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://place?id=home-1&section=today"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .place(homeId: "home-1", slug: "today"))
    }

    func testPlaceDegradesAnUnknownSlugToTheDashboard() throws {
        // A server that learns a new section must not produce a dead link
        // on a client that predates it.
        let url = try XCTUnwrap(URL(string: "pantopus://place/home-1/not-a-real-group"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .place(homeId: "home-1", slug: nil))
    }

    func testPlaceAcceptsEveryShippedGroupSlug() throws {
        for slug in ["today", "your-home", "risk", "block", "money", "civic", "identity"] {
            let url = try XCTUnwrap(URL(string: "pantopus://place/h/\(slug)"))
            DeepLinkRouter.shared.handle(url: url)
            XCTAssertEqual(
                DeepLinkRouter.shared.pending,
                .place(homeId: "h", slug: slug),
                "slug \(slug) should map to a group-detail page"
            )
        }
    }

    func testPlaceHTTPSHost() throws {
        let url = try XCTUnwrap(URL(string: "https://pantopus.app/place/home-1/money"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .place(homeId: "home-1", slug: "money"))
    }

    /// Every slug the router accepts must map onto a real detail page.
    func testPlaceRouterSlugsMatchPlaceDetailGroup() {
        for slug in ["today", "your-home", "risk", "block", "money", "civic", "identity"] {
            XCTAssertNotNil(PlaceDetailGroup(rawValue: slug), "no PlaceDetailGroup for \(slug)")
        }
    }

}
