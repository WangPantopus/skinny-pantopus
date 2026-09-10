import XCTest
@testable import Pantopus

@MainActor
final class ClaimOwnershipAddressMatchTests: XCTestCase {
    func testFilenameNeverCreatesAddressVerification() async {
        let fixture = PrivateEvidenceFixture()
        for name in ["deed_412_elm.pdf", "unrelated_name.pdf"] {
            SequencedURLProtocol.reset()
            fixture.routes()
            let vm = ClaimOwnershipWizardViewModel(homeId: fixture.home, api: fixture.api(), evidenceClient: fixture.client())
            await vm.load()
            vm.primaryTapped()
            vm.picked(.ownership, file: .init(filename: name, mimeType: "application/pdf", data: Data("%PDF-".utf8)))
            XCTAssertTrue(vm.bothSlotsHaveFiles)
            XCTAssertTrue(vm.addressMatches.isEmpty)
        }
    }

    func testManualTypesAndSizeMatchThePrivateEvidenceContract() {
        XCTAssertEqual(CLAIM_FILE_MAX_BYTES, 25 * 1024 * 1024)
        XCTAssertEqual(ClaimEvidenceSlot.ownership.documentOptions.map(\.id), ["deed", "closing_disclosure", "tax_bill"])
        XCTAssertEqual(ClaimEvidenceSlot.residency.documentOptions.map(\.id), ["lease", "utility_bill", "tax_bill"])
    }
}
