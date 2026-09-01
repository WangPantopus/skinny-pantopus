//
//  AddBillWizardViewModelTests.swift
//  PantopusTests
//
//  Covers `AddBillWizardViewModel` in both Add (P3.1) and Edit (P3.2)
//  modes:
//   - initial pose (no billId ⇒ create chrome; billId ⇒ load + hydrate)
//   - chrome contract (titles, CTA labels, dirty + loading gates)
//   - schedule round-trip via `details.schedule` / `details.frequency`
//   - submit happy path (POST in Add, PUT in Edit) with payload assertions
//   - submit error surfacing
//   - 404-on-load surfacing (`loadError`)
//   - isDirty gating (Edit gates on snapshot diff; Add gates on any value)
//   - amount round-trip from `Decimal` → text field → wire body
//

import XCTest
@testable import Pantopus

private enum AddBillFixtures {
    static func billsJSON(
        id: String = "bill-1",
        provider: String = "ConEd Electric",
        amount: String = "142.80",
        dueDate: String = "2026-06-01",
        scheduleKey: String? = "monthly"
    ) -> String {
        let scheduleField =
            if let scheduleKey { "\"schedule\":\"\(scheduleKey)\",\"frequency\":\"\(scheduleKey)\"" } else { "" }
        return """
        {
          "bills": [
            {
              "id": "\(id)",
              "home_id": "home-1",
              "bill_type": "other",
              "provider_name": "\(provider)",
              "amount": "\(amount)",
              "due_date": "\(dueDate)",
              "status": "pending",
              "details": { \(scheduleField) }
            }
          ]
        }
        """
    }

    static let createdBillJSON = """
    {
      "bill": {
        "id": "bill-new",
        "home_id": "home-1",
        "bill_type": "other",
        "provider_name": "Spectrum",
        "amount": "60.00",
        "due_date": "2026-06-15",
        "status": "pending"
      }
    }
    """

    static let updatedBillJSON = """
    {
      "bill": {
        "id": "bill-1",
        "home_id": "home-1",
        "bill_type": "other",
        "provider_name": "ConEd Electric",
        "amount": "150.00",
        "due_date": "2026-06-01",
        "status": "pending"
      }
    }
    """
}

private struct CreateBillBody: Decodable {
    let bill_type: String
    let provider_name: String?
    let amount: Double
    let due_date: String?
    let details: [String: String]?
}

private struct UpdateBillBody: Decodable {
    let provider_name: String?
    let amount: Double?
    let due_date: String?
    let details: [String: String]?
    let status: String?
    let paid_at: String?
}

@MainActor
final class AddBillWizardViewModelTests: XCTestCase {
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

    // MARK: - Initial pose

    func testAddMode_initialPoseHasOneTimeAndEmptyFields() {
        let vm = AddBillWizardViewModel(homeId: "home-1", api: makeAPI())
        XCTAssertFalse(vm.isEditing)
        XCTAssertEqual(vm.schedule, .oneTime)
        XCTAssertEqual(vm.payee, "")
        XCTAssertEqual(vm.amount, "")
        XCTAssertNil(vm.dueDate)
        XCTAssertFalse(vm.detailsValid)
        XCTAssertFalse(vm.isDirty)
        XCTAssertFalse(vm.isLoadingExisting)
    }

    func testEditMode_initialPoseStartsHydrating() {
        let vm = AddBillWizardViewModel(homeId: "home-1", billId: "bill-1", api: makeAPI())
        XCTAssertTrue(vm.isEditing)
        XCTAssertTrue(vm.isLoadingExisting, "Edit mode flips the loading flag on init.")
    }

    // MARK: - Chrome contract

    func testChrome_addModeUsesAddTitlesAndCTAs() {
        let vm = AddBillWizardViewModel(homeId: "home-1", api: makeAPI())
        XCTAssertEqual(vm.chrome.title, "Add a bill")
        // Walk through every step's CTA label.
        vm.payee = "ConEd"
        vm.amount = "100"
        vm.primaryTapped() // → schedule
        vm.primaryTapped() // → review
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Add bill")
    }

    func testChrome_editModeUsesEditTitlesAndSaveChangesCTA() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddBillFixtures.billsJSON())
        ]
        let vm = AddBillWizardViewModel(homeId: "home-1", billId: "bill-1", api: makeAPI())
        await vm.load()
        XCTAssertEqual(vm.chrome.title, "Edit bill")
        vm.primaryTapped() // → schedule
        vm.primaryTapped() // → review
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Save changes")
    }

    func testChrome_detailsCTADisabledWhileHydrating() {
        let vm = AddBillWizardViewModel(homeId: "home-1", billId: "bill-1", api: makeAPI())
        // Even with the form filled, the loading flag keeps the CTA off
        // until `load()` returns.
        vm.payee = "ConEd"
        vm.amount = "100"
        XCTAssertFalse(
            vm.chrome.primaryCTAEnabled,
            "Hydration in flight must keep the Next CTA disabled."
        )
    }

    // MARK: - Hydration

    func testEditMode_hydratesEveryFieldFromBackend() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddBillFixtures.billsJSON(scheduleKey: "monthly"))
        ]
        let vm = AddBillWizardViewModel(homeId: "home-1", billId: "bill-1", api: makeAPI())
        await vm.load()
        XCTAssertEqual(vm.payee, "ConEd Electric")
        XCTAssertEqual(vm.amount, "142.8")
        XCTAssertEqual(vm.schedule, .monthly)
        XCTAssertNotNil(vm.dueDate)
        XCTAssertFalse(vm.isLoadingExisting)
        XCTAssertNil(vm.loadError)
        XCTAssertFalse(vm.isDirty)
        XCTAssertTrue(vm.detailsValid)
    }

    func testEditMode_hydratesScheduleFromLegacyFrequencyKey() async {
        // Older rows wrote only `frequency`; the wizard should fall
        // back to it so the schedule still hydrates correctly.
        let legacy = """
        {
          "bills": [{
            "id": "bill-1",
            "home_id": "home-1",
            "bill_type": "other",
            "provider_name": "ConEd",
            "amount": "50.00",
            "due_date": "2026-06-01",
            "status": "pending",
            "details": { "frequency": "quarterly" }
          }]
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: legacy)]
        let vm = AddBillWizardViewModel(homeId: "home-1", billId: "bill-1", api: makeAPI())
        await vm.load()
        XCTAssertEqual(vm.schedule, .quarterly)
    }

    func testEditMode_missingBillSurfacesLoadError() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"bills\":[]}")
        ]
        let vm = AddBillWizardViewModel(homeId: "home-1", billId: "bill-1", api: makeAPI())
        await vm.load()
        XCTAssertEqual(vm.loadError, "This bill is no longer available.")
        XCTAssertFalse(vm.isLoadingExisting)
    }

    // MARK: - Submit

    func testAddMode_savePostsExpectedBody() async throws {
        SequencedURLProtocol.sequence = [
            .status(201, body: AddBillFixtures.createdBillJSON)
        ]
        let vm = AddBillWizardViewModel(homeId: "home-1", api: makeAPI())
        vm.payee = "Spectrum"
        vm.amount = "60.00"
        vm.schedule = .monthly
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .success)
        XCTAssertEqual(vm.createdBillId, "bill-new")

        let captured = SequencedURLProtocol.capturedRequests
        XCTAssertEqual(captured.count, 1)
        let post = captured[0]
        XCTAssertEqual(post.httpMethod, "POST")
        XCTAssertEqual(post.url?.path, "/api/homes/home-1/bills")
        let body = try decodedBody(CreateBillBody.self, from: post)
        XCTAssertEqual(body.bill_type, "other")
        XCTAssertEqual(body.provider_name, "Spectrum")
        XCTAssertEqual(body.amount, 60.0, accuracy: 0.001)
        XCTAssertEqual(body.details?["schedule"], "monthly")
        XCTAssertEqual(body.details?["frequency"], "monthly")
    }

    func testEditMode_savePutsExpectedBody() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddBillFixtures.billsJSON()),
            .status(200, body: AddBillFixtures.updatedBillJSON)
        ]
        let vm = AddBillWizardViewModel(homeId: "home-1", billId: "bill-1", api: makeAPI())
        await vm.load()
        vm.amount = "150.00"
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .success)

        let captured = SequencedURLProtocol.capturedRequests
        XCTAssertEqual(captured.count, 2)
        let put = captured[1]
        XCTAssertEqual(put.httpMethod, "PUT")
        XCTAssertEqual(put.url?.path, "/api/homes/home-1/bills/bill-1")
        let body = try decodedBody(UpdateBillBody.self, from: put)
        XCTAssertEqual(body.amount ?? 0, 150.0, accuracy: 0.001)
        XCTAssertEqual(body.provider_name, "ConEd Electric")
        XCTAssertEqual(body.details?["schedule"], "monthly")
        // Status / paid_at must NOT be touched by the edit flow — those
        // are owned by the BillDetail mark-paid action.
        XCTAssertNil(body.status)
        XCTAssertNil(body.paid_at)
    }

    func testEditMode_successEmitsUpdatedEvent() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddBillFixtures.billsJSON()),
            .status(200, body: AddBillFixtures.updatedBillJSON)
        ]
        let vm = AddBillWizardViewModel(homeId: "home-1", billId: "bill-1", api: makeAPI())
        await vm.load()
        await vm.submit()
        vm.primaryTapped() // Done on success step
        XCTAssertEqual(vm.pendingEvent, .updated(billId: "bill-1"))
    }

    func testSubmit_errorSurfacesErrorMessageAndKeepsReviewStep() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"down\"}")
        ]
        let vm = AddBillWizardViewModel(homeId: "home-1", api: makeAPI())
        vm.payee = "ConEd"
        vm.amount = "100"
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .details)
        XCTAssertNotNil(vm.submitError)
    }

    // MARK: - Dirty gating

    func testEditMode_isDirtyFalseUntilFieldChanges() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: AddBillFixtures.billsJSON())
        ]
        let vm = AddBillWizardViewModel(homeId: "home-1", billId: "bill-1", api: makeAPI())
        await vm.load()
        XCTAssertFalse(vm.isDirty)
        vm.amount = "200.00"
        XCTAssertTrue(vm.isDirty)
    }

    func testAddMode_isDirtyTrueOnceAnyFieldFilled() {
        let vm = AddBillWizardViewModel(homeId: "home-1", api: makeAPI())
        XCTAssertFalse(vm.isDirty)
        vm.payee = "ConEd"
        XCTAssertTrue(vm.isDirty)
    }
}

// MARK: - Helpers

private func decodedBody<T: Decodable>(
    _ type: T.Type,
    from request: URLRequest
) throws -> T {
    let data: Data = if let body = request.httpBody {
        body
    } else if let stream = request.httpBodyStream {
        Data(reading: stream)
    } else {
        Data()
    }
    return try JSONDecoder().decode(type, from: data)
}

private extension Data {
    init(reading stream: InputStream) {
        var data = Data()
        stream.open()
        defer { stream.close() }
        let bufferSize = 4096
        var buffer = [UInt8](repeating: 0, count: bufferSize)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        self = data
    }
}
