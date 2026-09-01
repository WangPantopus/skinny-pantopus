//
//  ViewAsMappingTests.swift
//  PantopusTests
//
//  P1-F — covers the live wiring of the "View as" privacy preview:
//    - audience → backend (surface, viewer) param mapping,
//    - pure ViewAsResponse → ViewAsRender projection (disclosure ladder),
//    - the live load() path (incl. error → sample fallback).
//

import XCTest
@testable import Pantopus

@MainActor
final class ViewAsMappingTests: XCTestCase {
    private func response(
        viewerLabel: String,
        displayName: String? = "Dana Okafor",
        badges: [String] = ["verified_resident"],
        neighborhood: String? = "Maple Heights",
        reviews: Int? = 38,
        canMessage: Bool = true,
        hidden: [String] = [],
        isConnection: Bool = true
    ) -> ViewAsResponse {
        ViewAsResponse(
            viewer: nil,
            viewerLabel: viewerLabel,
            visible: .init(
                handle: "dana.o",
                displayName: displayName,
                bio: nil,
                badges: badges,
                locality: .init(city: "Maple Heights", state: "NY", neighborhood: neighborhood, precision: "neighborhood"),
                stats: .init(reviews: reviews, gigsCompleted: 12),
                viewer: .init(relationshipStatus: "accepted", isFollowingLocal: true, canMessage: canMessage)
            ),
            hidden: hidden,
            context: .init(isNeighbor: true, isConnection: isConnection, isHouseholdMember: false, isGigParticipant: false)
        )
    }

    private func disclosure(_ render: ViewAsRender, _ id: String) -> ViewAsFieldDisclosure? {
        render.fields.first { $0.id == id }?.disclosure
    }

    // MARK: - Param mapping

    func testBackendParams() {
        XCTAssertEqual(ViewAsViewModel.backendParams(for: .public).viewer, "public")
        XCTAssertEqual(ViewAsViewModel.backendParams(for: .connection).viewer, "connection")
        XCTAssertEqual(ViewAsViewModel.backendParams(for: .household).viewer, "household_member")
        XCTAssertEqual(ViewAsViewModel.backendParams(for: .personaAudience).surface, "persona")
        XCTAssertEqual(ViewAsViewModel.backendParams(for: .neighbor).surface, "local")
    }

    // MARK: - Render projection

    func testConnectionRenderShowsRichDisclosure() {
        let render = ViewAsViewModel.makeRender(
            from: response(viewerLabel: "a connection"),
            audience: .connection
        )
        XCTAssertEqual(render.viewer, .connection)
        XCTAssertEqual(render.fields.count, 5)
        XCTAssertEqual(render.head.name, "Dana Okafor")
        XCTAssertEqual(render.head.handle, "@dana.o")
        XCTAssertTrue(render.head.verified)
        XCTAssertEqual(disclosure(render, "location")?.shownValue, "Maple Heights")
        XCTAssertEqual(disclosure(render, "contact")?.shownValue, "Available on request")
        XCTAssertEqual(disclosure(render, "rating")?.shownValue, "38 reviews")
        XCTAssertEqual(disclosure(render, "memberSince")?.isHidden, true, "Backend doesn't expose join date here")
        XCTAssertEqual(render.banner.tone, .info)
        XCTAssertEqual(render.badges.first { $0.id == "resident" }?.isOn, true)
    }

    func testPublicRenderRedactsHeavily() {
        let render = ViewAsViewModel.makeRender(
            from: response(
                viewerLabel: "the public",
                badges: [],
                reviews: 0,
                canMessage: false,
                hidden: ["locality", "contact", "mutuals"],
                isConnection: false
            ),
            audience: .public
        )
        XCTAssertEqual(render.banner.tone, .restricted)
        XCTAssertEqual(render.head.avatarTone, .masked)
        XCTAssertTrue(render.fields.allSatisfy(\.disclosure.isHidden))
        XCTAssertTrue(render.badges.allSatisfy { !$0.isOn })
    }

    func testInitialsDerivedFromName() {
        let render = ViewAsViewModel.makeRender(from: response(viewerLabel: "x"), audience: .connection)
        XCTAssertEqual(render.head.initials, "DO")
    }

    // MARK: - Live load() path

    func testLiveLoadResolvesRender() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/identity-center/view-as": [
                .status(200, body: """
                {"viewer":"connection","viewerLabel":"a connection","visible":{"handle":"dana.o",\
                "displayName":"Dana Okafor","badges":["verified_resident"],\
                "locality":{"city":"Maple Heights","state":"NY","neighborhood":"Maple Heights"},\
                "stats":{"reviews":38},"viewer":{"canMessage":true,"isFollowingLocal":true,\
                "relationshipStatus":"accepted"}},"hidden":[],\
                "context":{"isNeighbor":true,"isConnection":true}}
                """)
            ]
        ])
        let vm = ViewAsViewModel(api: APIClient(session: session, retryPolicy: .none), selected: .connection)
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(loaded.render.head.name, "Dana Okafor")
        XCTAssertEqual(disclosure(loaded.render, "contact")?.isHidden, false)
    }

    func testLiveLoadErrorFallsBackToSample() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/identity-center/view-as": [.status(500, body: "{\"error\":\"boom\"}")]
        ])
        let vm = ViewAsViewModel(api: APIClient(session: session, retryPolicy: .none), selected: .connection)
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            return XCTFail("Expected sample-fallback loaded, got \(vm.state)")
        }
        XCTAssertEqual(loaded.render.viewer, .connection)
    }
}
