import XCTest
@testable import Pantopus

@MainActor
final class MyHomesListViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    func testLoadEmptyTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"homes\":[]}")]
        let vm = MyHomesListViewModel(api: makeAPI(), identity: { "list-tests" }, onOpenHome: { _ in })
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No saved Homes yet")
        XCTAssertEqual(content.ctaTitle, "Add a home")
        XCTAssertNil(vm.banner, "Banner is suppressed when there are no homes")
    }

    func testLoadPopulatedRendersRichRows() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"homes":[
              {"id":"00000000-0000-4000-8000-000000000001","name":"Birch Lane","address":"412 Birch Ln","city":"Elm Park","state":"NY",
               "ownership_status":"verified","is_primary_owner":true,
               "access_kind":"shared","has_home_access":true,"role_base":"owner","can_delete_home":true,
               "occupancy":{"id":"o1","role":"owner","role_base":"owner","is_active":true,
                            "verification_status":"verified"}},
              {"id":"00000000-0000-4000-8000-000000000002","name":null,"address":"88 Greenwood Ave","city":"Sellwood","state":"OR",
               "ownership_status":null,
               "access_kind":"shared","has_home_access":true,"role_base":"lease_resident","can_delete_home":false,
               "occupancy":{"id":"o2","role":"lease_resident","role_base":"lease_resident",
                            "is_active":true,"verification_status":"verified"}}
            ]}
            """)
        ]
        let vm = MyHomesListViewModel(api: makeAPI(), identity: { "list-tests" }, onOpenHome: { _ in })
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let rows = sections.first?.rows else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.count, 2)
        // Role, ownership and residency are independent facts.
        XCTAssertEqual(rows[0].id, "00000000-0000-4000-8000-000000000001")
        XCTAssertEqual(rows[0].title, "Birch Lane")
        XCTAssertEqual(rows[0].subtitle, "Owner role · Elm Park, NY")
        XCTAssertEqual(rows[0].chips?.map(\.text), ["Ownership verified", "Residency verified"])
        if case .typeIcon = rows[0].leading {} else { XCTFail("Expected Home icon without fabricated progress") }
        // A tenant has residency; ownership stays absent.
        XCTAssertEqual(rows[1].title, "88 Greenwood Ave")
        XCTAssertEqual(rows[1].subtitle, "Tenant · Sellwood, OR")
        XCTAssertEqual(rows[1].chips?.map(\.text), ["Residency verified"])
        if case .typeIcon = rows[1].leading {} else { XCTFail("Expected Home icon") }
        // Banner shows count + tap hint when populated.
        XCTAssertNotNil(vm.banner)
        XCTAssertEqual(vm.banner?.title, "2 saved Homes")
        let renderedSource: any ListOfRowsDataSource = vm
        XCTAssertEqual(renderedSource.banner?.title, "2 saved Homes")
        XCTAssertEqual(vm.banner?.tint, .home)
    }

    func testLoadFailureTransitionsToErrorWhenCold() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = MyHomesListViewModel(api: makeAPI(), identity: { "list-tests" }, onOpenHome: { _ in })
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testFabUsesHomeIdentityTintAndSecondaryCreate() {
        let vm = MyHomesListViewModel()
        guard let fab = vm.fab else {
            XCTFail("Expected FAB")
            return
        }
        XCTAssertEqual(fab.tint, .home)
        XCTAssertEqual(fab.accessibilityLabel, "Add a home")
        if case .secondaryCreate = fab.variant {} else {
            XCTFail("Expected .secondaryCreate variant, got \(fab.variant)")
        }
    }
}
