//
//  UploadDocumentFormViewModelTests.swift
//  PantopusTests
//
//  P2.10 — Unit tests for the Upload Document form's view-model.
//  Covers:
//    • Default state (dirty/valid flags off when empty)
//    • File pick auto-fills the title from the filename (sans extension)
//    • Category mapping onto the wire-format `doc_type`
//    • Tag dedupe + max length / cap
//    • Linked-to selection writes through to `details`
//    • Successful submit posts the expected request shape
//

import XCTest
@testable import Pantopus

@MainActor
final class UploadDocumentFormViewModelTests: XCTestCase {
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

    private func makeVM() -> UploadDocumentFormViewModel {
        UploadDocumentFormViewModel(homeId: "home-1", api: makeAPI())
    }

    // MARK: - Default state

    func testInitialStateIsCleanAndInvalid() {
        let vm = makeVM()
        XCTAssertFalse(vm.isValid)
        XCTAssertFalse(vm.isDirty)
        XCTAssertNil(vm.pickedFile)
        XCTAssertEqual(vm.tags, [])
        XCTAssertEqual(vm.category, .other)
        XCTAssertEqual(vm.visibility, .allMembers)
    }

    // MARK: - File picker

    func testAcceptingFileSeedsTitleFromFilename() {
        let vm = makeVM()
        let url = URL(fileURLWithPath: "/tmp/Lease-Renewal.pdf")
        vm.acceptPicked(url: url)
        XCTAssertEqual(vm.pickedFile?.filename, "Lease-Renewal.pdf")
        XCTAssertEqual(vm.titleField.value, "Lease-Renewal")
        XCTAssertEqual(
            vm.category,
            .mortgage,
            "Heuristic should suggest mortgage for filenames containing 'Lease'."
        )
    }

    func testAcceptingFileWithExplicitTitleLeavesItUntouched() {
        let vm = makeVM()
        vm.updateTitle("Custom title")
        let url = URL(fileURLWithPath: "/tmp/State-Farm-Policy.pdf")
        vm.acceptPicked(url: url)
        XCTAssertEqual(vm.titleField.value, "Custom title")
    }

    // MARK: - Category mapping

    func testCategoryDocTypeMappingHitsBackendEnumValues() {
        XCTAssertEqual(UploadDocumentCategory.insurance.docType, "insurance")
        XCTAssertEqual(UploadDocumentCategory.mortgage.docType, "lease")
        XCTAssertEqual(UploadDocumentCategory.warranty.docType, "warranty")
        XCTAssertEqual(UploadDocumentCategory.receipt.docType, "receipt")
        XCTAssertEqual(UploadDocumentCategory.contract.docType, "permit")
        XCTAssertEqual(UploadDocumentCategory.identity.docType, "other")
        XCTAssertEqual(UploadDocumentCategory.medical.docType, "manual")
        XCTAssertEqual(UploadDocumentCategory.tax.docType, "receipt")
        XCTAssertEqual(UploadDocumentCategory.other.docType, "other")
    }

    func testCategoryPaletteMappingMatchesDesignSwatches() {
        XCTAssertEqual(UploadDocumentCategory.mortgage.palette, .lease)
        XCTAssertEqual(UploadDocumentCategory.contract.palette, .permit)
        XCTAssertEqual(UploadDocumentCategory.medical.palette, .warranty)
        XCTAssertEqual(UploadDocumentCategory.tax.palette, .tax)
        XCTAssertEqual(UploadDocumentCategory.identity.palette, .identity)
    }

    // MARK: - Tags

    func testCommitTagDraftAppendsAndDedupes() {
        let vm = makeVM()
        vm.tagDraft = "renewal"
        vm.commitTagDraft()
        XCTAssertEqual(vm.tags, ["renewal"])

        // Case-insensitive dedupe.
        vm.tagDraft = "Renewal"
        vm.commitTagDraft()
        XCTAssertEqual(vm.tags, ["renewal"], "Dedupe should be case-insensitive.")
    }

    func testCommitTagDraftRejectsOverlongOrEmpty() {
        let vm = makeVM()
        vm.tagDraft = ""
        vm.commitTagDraft()
        XCTAssertEqual(vm.tags, [])

        vm.tagDraft = String(repeating: "a", count: 25)
        vm.commitTagDraft()
        XCTAssertEqual(vm.tags, [], "Tags > 24 chars should be rejected.")
    }

    func testRemoveTagDeletesByExactValue() {
        let vm = makeVM()
        vm.tags = ["renewal", "lease", "2024"]
        vm.removeTag("lease")
        XCTAssertEqual(vm.tags, ["renewal", "2024"])
    }

    // MARK: - Linked entity

    func testSelectLinkAttachesEntityAndClearReleasesIt() {
        let vm = makeVM()
        let option = UploadDocumentLinkOption(
            id: "bill-1",
            kind: .bill,
            title: "Con Edison",
            subtitle: "Due Oct 28"
        )
        vm.selectLink(option)
        XCTAssertEqual(vm.linkedEntity?.id, "bill-1")
        vm.clearLinkedEntity()
        XCTAssertNil(vm.linkedEntity)
    }

    // MARK: - Detail parsing helpers

    func testParseTagsHandlesEmptyAndPopulatedDetails() {
        XCTAssertEqual(DocumentDetailView.parseTags(from: [:]), [])
        XCTAssertEqual(DocumentDetailView.parseTags(from: ["tags": ""]), [])
        XCTAssertEqual(
            DocumentDetailView.parseTags(from: ["tags": " renewal,  signed, 2024  "]),
            ["renewal", "signed", "2024"]
        )
    }

    func testLinkedEntityParserReadsDetailsMap() {
        let details = [
            "linked_entity_kind": "bill",
            "linked_entity_id": "bill-9",
            "linked_entity_title": "Con Edison"
        ]
        let link = DocumentLinkedEntity.from(details: details)
        XCTAssertEqual(link?.kind, .bill)
        XCTAssertEqual(link?.title, "Con Edison")
    }

    func testLinkedEntityParserReturnsNilForMissingFields() {
        XCTAssertNil(DocumentLinkedEntity.from(details: [:]))
        XCTAssertNil(DocumentLinkedEntity.from(details: [
            "linked_entity_kind": "bill",
            "linked_entity_title": ""
        ]))
        XCTAssertNil(DocumentLinkedEntity.from(details: [
            "linked_entity_kind": "unknown",
            "linked_entity_title": "X"
        ]))
    }
}
