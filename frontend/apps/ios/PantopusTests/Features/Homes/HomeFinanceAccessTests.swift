import XCTest
@testable import Pantopus

@MainActor
private final class FinanceState {
    var permissions = ["finance.view", "finance.manage"]
    var hasAccess = true
    var session: String? = "original-session"
    var failAccess = false
    var accessReads = 0
    var callbacks = 0
}

@MainActor
final class HomeFinanceAccessTests: XCTestCase {
    private let bill = #"{"id":"bill-1","home_id":"home-1","bill_type":"other","provider_name":"Utilities","amount":12,"status":"pending"}"#

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    private func access(_ state: FinanceState, api: APIClient) -> HomeFinanceAccess {
        HomeFinanceAccess(
            homeId: "home-1",
            api: api,
            loadAccess: {
                state.accessReads += 1
                if state.failAccess { throw APIError.invalidResponse }
                return HomeAccessDTO(
                    hasAccess: state.hasAccess,
                    isOwner: true,
                    roleBase: "admin",
                    permissions: state.permissions,
                    canManageFinance: true
                )
            },
            identity: { state.session }
        )
    }

    private func stubDetail() {
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/bills": [.status(200, body: "{\"bills\":[\(bill)]}")],
            "/api/homes/home-1/bills/bill-1/splits": [.status(200, body: #"{"splits":[]}"#)]
        ]
    }

    private func writes() -> Int {
        SequencedURLProtocol.capturedRequests.filter { ["POST", "PUT"].contains($0.httpMethod ?? "") }.count
    }

    func testReadOnlyOwnerHasNoListMutationControls() async {
        let state = FinanceState()
        state.permissions = ["finance.view"]
        let api = makeAPI()
        let vm = BillsListViewModel(homeId: "home-1", api: api, financeAccess: access(state, api: api))
        SequencedURLProtocol.sequence = [.status(200, body: #"{"bills":[]}"#)]
        await vm.load()
        guard case let .empty(content) = vm.state else { return XCTFail("Expected readable empty bills") }
        XCTAssertNil(vm.fab)
        XCTAssertNil(content.ctaTitle)
        XCTAssertNil(content.onCTA)
    }

    func testMissingViewOrAccessNeverReadsBills() async {
        for hasAccess in [true, false] {
            let state = FinanceState()
            state.hasAccess = hasAccess
            state.permissions = hasAccess ? ["finance.manage"] : ["finance.view", "finance.manage"]
            let api = makeAPI()
            let vm = BillsListViewModel(homeId: "home-1", api: api, financeAccess: access(state, api: api))
            await vm.load()
            guard case .error = vm.state else { return XCTFail("Expected denied bills") }
            XCTAssertNil(vm.fab)
        }
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testRefreshFailureClearsPreviouslyLoadedBillCountsAndActions() async {
        let state = FinanceState()
        let api = makeAPI()
        let vm = BillsListViewModel(homeId: "home-1", api: api, financeAccess: access(state, api: api))
        SequencedURLProtocol.sequence = [.status(200, body: "{\"bills\":[\(bill)]}")]
        await vm.load()
        XCTAssertNotNil(vm.fab)
        state.failAccess = true
        await vm.refresh()
        guard case .error = vm.state else { return XCTFail("Expected failed permission refresh") }
        XCTAssertNil(vm.fab)
        XCTAssertNil(vm.banner)
        XCTAssertTrue(vm.tabs.allSatisfy { $0.count == nil })
    }

    func testRetainedAddCallbackCannotOpenAfterSessionChange() async {
        let state = FinanceState()
        let api = makeAPI()
        let onAdd: @Sendable () -> Void = { Task { @MainActor in state.callbacks += 1 } }
        let vm = BillsListViewModel(
            homeId: "home-1",
            api: api,
            financeAccess: access(state, api: api),
            onAddBill: onAdd
        )
        SequencedURLProtocol.sequence = [.status(200, body: #"{"bills":[]}"#)]
        await vm.load()
        let callback = vm.fab?.handler
        XCTAssertNotNil(callback)
        state.session = "replacement-session"
        callback?()
        await Task.yield()
        await Task.yield()
        XCTAssertEqual(state.callbacks, 0)
        guard case .error = vm.state else { return XCTFail("Old session content must disappear") }
        XCTAssertNil(vm.fab)
    }

    func testReadOnlyDetailRejectsDirectMutationCalls() async {
        let state = FinanceState()
        state.permissions = ["finance.view"]
        let api = makeAPI()
        let vm = BillDetailViewModel(homeId: "home-1", billId: "bill-1", api: api, financeAccess: access(state, api: api))
        stubDetail()
        await vm.load()
        XCTAssertFalse(vm.canManageFinance)
        await vm.markPaid()
        await vm.remove()
        XCTAssertEqual(writes(), 0)
        XCTAssertNotNil(vm.saveError)
    }

    func testRevocationBeforeSavingRechecksCurrentAuthority() async {
        let state = FinanceState()
        let api = makeAPI()
        let vm = BillDetailViewModel(homeId: "home-1", billId: "bill-1", api: api, financeAccess: access(state, api: api))
        stubDetail()
        await vm.load()
        XCTAssertTrue(vm.canManageFinance)
        state.permissions = ["finance.view"]
        await vm.markPaid()
        XCTAssertEqual(writes(), 0)
        XCTAssertFalse(vm.canManageFinance)
        XCTAssertEqual(state.accessReads, 2)
    }

    func testFailedRemovalDoesNotCloseOrClaimSuccess() async {
        let state = FinanceState()
        let api = makeAPI()
        let vm = BillDetailViewModel(
            homeId: "home-1",
            billId: "bill-1",
            api: api,
            financeAccess: access(state, api: api),
            onChanged: { Task { @MainActor in state.callbacks += 1 } },
            onClose: { Task { @MainActor in state.callbacks += 1 } }
        )
        stubDetail()
        SequencedURLProtocol.routeResponses["/api/homes/home-1/bills/bill-1"] = [.status(503, body: #"{"error":"Try again"}"#)]
        await vm.load()
        await vm.remove()
        await Task.yield()
        XCTAssertEqual(writes(), 1)
        XCTAssertEqual(state.callbacks, 0)
        XCTAssertNotNil(vm.saveError)
    }

    func testFailedSplitsReadRequiresRetryInsteadOfShowingNoAllocations() async {
        let state = FinanceState()
        let api = makeAPI()
        let vm = BillDetailViewModel(homeId: "home-1", billId: "bill-1", api: api, financeAccess: access(state, api: api))
        stubDetail()
        SequencedURLProtocol.routeResponses["/api/homes/home-1/bills/bill-1/splits"] = [.status(503, body: #"{"error":"Try again"}"#)]
        await vm.load()
        guard case .error = vm.state else { return XCTFail("A failed allocation read is not an empty allocation list") }
        stubDetail()
        await vm.load()
        guard case .loaded = vm.state else { return XCTFail("Retry should recover the bill and its verified allocations") }
    }

    func testUnchangedRemovalReceiptDoesNotCloseTheBill() async {
        let state = FinanceState()
        let api = makeAPI()
        let vm = BillDetailViewModel(
            homeId: "home-1",
            billId: "bill-1",
            api: api,
            financeAccess: access(state, api: api)
        ) { Task { @MainActor in state.callbacks += 1 } }
        stubDetail()
        SequencedURLProtocol.routeResponses["/api/homes/home-1/bills/bill-1"] = [.status(200, body: "{\"bill\":\(bill)}")]
        await vm.load()
        await vm.remove()
        await Task.yield()
        XCTAssertEqual(state.callbacks, 0)
        XCTAssertNotNil(vm.saveError)
    }

    func testForeignMutationReceiptCannotCloseTheCurrentBill() async {
        let state = FinanceState()
        let api = makeAPI()
        let vm = BillDetailViewModel(
            homeId: "home-1",
            billId: "bill-1",
            api: api,
            financeAccess: access(state, api: api)
        ) { Task { @MainActor in state.callbacks += 1 } }
        stubDetail()
        let foreign = bill.replacingOccurrences(of: "home-1", with: "another-home")
        SequencedURLProtocol.routeResponses["/api/homes/home-1/bills/bill-1"] = [.status(200, body: "{\"bill\":\(foreign)}")]
        await vm.load()
        await vm.remove()
        await Task.yield()
        XCTAssertEqual(state.callbacks, 0)
        XCTAssertNotNil(vm.saveError)
    }

    func testDirectCreateFormRequiresViewAndManageBeforeAnyPost() async {
        let state = FinanceState()
        state.permissions = ["finance.view"]
        let api = makeAPI()
        let vm = AddBillWizardViewModel(homeId: "home-1", api: api, financeAccess: access(state, api: api))
        await vm.load()
        vm.payee = "Utilities"
        vm.amount = "12"
        XCTAssertFalse(vm.canManageFinance)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        await vm.submit()
        XCTAssertEqual(writes(), 0)
        XCTAssertNotNil(vm.loadError)
    }

    func testCreateDraftCannotSaveAfterAuthorityIsRevoked() async {
        let state = FinanceState()
        let api = makeAPI()
        let vm = AddBillWizardViewModel(homeId: "home-1", api: api, financeAccess: access(state, api: api))
        await vm.load()
        vm.payee = "Utilities"
        vm.amount = "12"
        state.permissions = ["finance.view"]
        await vm.submit()
        XCTAssertEqual(writes(), 0)
        XCTAssertNotEqual(vm.currentStep, .success)
        XCTAssertFalse(vm.canManageFinance)
    }

    func testPermissionReplyFromOldSessionCannotEnableTheForm() async {
        let state = FinanceState()
        let api = makeAPI()
        let guardAccess = HomeFinanceAccess(
            homeId: "home-1",
            api: api,
            loadAccess: {
                state.session = "new-session"
                return HomeAccessDTO(hasAccess: true, permissions: ["finance.view", "finance.manage"])
            },
            identity: { state.session }
        )
        let vm = AddBillWizardViewModel(homeId: "home-1", api: api, financeAccess: guardAccess)
        await vm.load()
        XCTAssertFalse(vm.canManageFinance)
        XCTAssertNotNil(vm.loadError)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testProductionAccessLoaderReadsExactHomeMeBeforeBills() async {
        let api = makeAPI()
        let guardAccess = HomeFinanceAccess(homeId: "home-1", api: api) { "test-session" }
        let vm = BillsListViewModel(homeId: "home-1", api: api, financeAccess: guardAccess)
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"hasAccess":true,"permissions":["finance.view"]}"#),
            .status(200, body: #"{"bills":[]}"#)
        ]
        await vm.load()
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.map { $0.url?.path }, ["/api/homes/home-1/me", "/api/homes/home-1/bills"])
        XCTAssertNil(vm.fab)
    }
}
