//
//  HubViewModelTests.swift
//  PantopusTests
//
//  State-transition coverage for `HubViewModel` using the Sequenced
//  URLProtocol infra.
//

import XCTest
@testable import Pantopus

@MainActor
final class HubViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        UserDefaults.standard.removeObject(forKey: "hub.setupBanner.dismissed")
    }

    private func makeVM() -> HubViewModel {
        let api = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        return HubViewModel(api: api)
    }

    // MARK: - Fixtures

    private func populatedHubJSON(
        allDone: Bool = true,
        score: Double = 0.9,
        homeCount: Int = 1
    ) -> String {
        let home = """
        {"id":"h1","name":"Main","addressShort":"1 Main","city":"X","state":"CA",
         "latitude":null,"longitude":null,"isPrimary":true,"roleBase":"owner"}
        """
        return """
        {
          "user":{"id":"u1","name":"Alice Doe","firstName":"Alice","username":"alice","avatarUrl":null,"email":"a@b.co"},
          "context":{"activeHomeId":"h1","activePersona":{"type":"personal"}},
          "availability":{"hasHome":\(homeCount > 0),"hasBusiness":false,"hasPayoutMethod":false},
          "homes":[\(homeCount > 0 ? home : "")],
          "businesses":[],
          "setup":{"steps":[{"key":"verify_home","done":\(allDone)}],"allDone":\(allDone),
                   "profileCompleteness":{"score":\(score),
                                          "checks":{"firstName":true,"lastName":true,"photo":true,"bio":true,"skills":true},
                                          "missingFields":[]}},
          "statusItems":[],
          "cards":{"personal":{"unreadChats":2,"earnings":0,"gigsNearby":3,"rating":0,"reviewCount":0},
                   "home":{"newMail":1,"billsDue":[],"tasksDue":[],"memberCount":1},
                   "business":null},
          "jumpBackIn":[],
          "activity":[],
          "neighborDensity":null
        }
        """
    }

    // MARK: - Tests

    func testSkeletonTransitionsToPopulated() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: populatedHubJSON()),
            .status(200, body: "{\"today\":null}"),
            .status(200, body: "{\"items\":[]}")
        ]
        let vm = makeVM()
        XCTAssertEqual(isSkeleton(vm.state), true)
        await vm.load()
        guard case let .populated(content) = vm.state else {
            XCTFail("Expected populated, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.topBar.name, "Alice")
        XCTAssertEqual(content.pillars.count, 4)
    }

    func testSkeletonTransitionsToFirstRun() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: populatedHubJSON(allDone: false, score: 0.2, homeCount: 0)),
            .status(200, body: "{\"today\":null}"),
            .status(200, body: "{\"items\":[]}")
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .firstRun(content) = vm.state else {
            XCTFail("Expected firstRun, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.profileCompleteness, 0.2, accuracy: 0.001)
    }

    func testErrorThenRetryRecovers() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{}"),
            .status(200, body: populatedHubJSON()),
            .status(200, body: "{\"today\":null}"),
            .status(200, body: "{\"items\":[]}")
        ]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error, got \(vm.state)")
            return
        }
        await vm.refresh()
        guard case .populated = vm.state else {
            XCTFail("Expected populated after retry, got \(vm.state)")
            return
        }
    }

    func testSetupBannerVisibilityAndDismiss() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: populatedHubJSON(allDone: false, score: 0.9, homeCount: 1)),
            .status(200, body: "{\"today\":null}"),
            .status(200, body: "{\"items\":[]}")
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .populated(content) = vm.state else {
            XCTFail("Expected populated, got \(vm.state)")
            return
        }
        XCTAssertNotNil(content.setupBanner, "Banner should show when setup not done")

        vm.dismissSetupBanner()
        guard case let .populated(updated) = vm.state else {
            XCTFail("Expected populated after dismiss, got \(vm.state)")
            return
        }
        XCTAssertNil(updated.setupBanner, "Banner should be hidden after dismiss")
    }

    // MARK: - Helpers

    private func isSkeleton(_ state: HubState) -> Bool {
        if case .skeleton = state { true } else { false }
    }
}
