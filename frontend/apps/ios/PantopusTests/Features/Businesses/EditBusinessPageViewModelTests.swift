//
//  EditBusinessPageViewModelTests.swift
//  PantopusTests
//
//  P4.2 — A13.10 Edit Business Page. View-model behaviour for the
//  preview-seeded local-persistence path (snapshots + previews).
//

import XCTest
@testable import Pantopus

@MainActor
final class EditBusinessPageViewModelTests: XCTestCase {
    func test_preview_initSeedsLoadedState() {
        let viewModel = EditBusinessPageViewModel(
            businessId: "biz-1",
            preview: EditBusinessPageSampleData.publishedRoostCafe
        )
        guard case let .loaded(content) = viewModel.state else {
            return XCTFail("Expected .loaded — got \(viewModel.state)")
        }
        XCTAssertEqual(content.businessId, "biz-roost")
    }

    func test_save_clearsDirtyFieldsAndZeroesUnsavedCount() async {
        var seed = EditBusinessPageSampleData.publishedRoostCafe
        seed = withModifiedName(seed, current: "Roost Café & Bakery")
        let viewModel = EditBusinessPageViewModel(businessId: "biz-1", preview: seed)
        XCTAssertTrue(currentName(viewModel) == "Roost Café & Bakery")
        XCTAssertTrue(currentNameIsDirty(viewModel))

        await viewModel.save()

        XCTAssertFalse(currentNameIsDirty(viewModel))
        if case let .loaded(content) = viewModel.state,
           case let .published(count, _) = content.mode {
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected published mode with cleared unsavedCount")
        }
        XCTAssertEqual(viewModel.toastMessage, "Saved")
    }

    func test_updateMarksFieldDirty() {
        let viewModel = EditBusinessPageViewModel(
            businessId: "biz-1",
            preview: EditBusinessPageSampleData.publishedRoostCafe
        )
        viewModel.update(.name, to: "Roost Café & Bakery")
        XCTAssertTrue(currentNameIsDirty(viewModel))
        XCTAssertEqual(currentName(viewModel), "Roost Café & Bakery")
    }

    func test_discardConfirmed_revertsCurrentToOriginal() async {
        var seed = EditBusinessPageSampleData.publishedRoostCafe
        seed = withModifiedName(seed, current: "Roost Café & Bakery")
        let viewModel = EditBusinessPageViewModel(businessId: "biz-1", preview: seed)
        XCTAssertTrue(currentNameIsDirty(viewModel))

        await viewModel.discardConfirmed()

        XCTAssertFalse(currentNameIsDirty(viewModel))
        XCTAssertEqual(currentName(viewModel), "Roost Café")
        XCTAssertEqual(viewModel.toastMessage, "Edits discarded")
    }

    func test_setupMode_publishUpdatesToast() async {
        let viewModel = EditBusinessPageViewModel(
            businessId: "biz-1",
            preview: EditBusinessPageSampleData.setupPatchAndPaw
        )
        await viewModel.publish()
        XCTAssertEqual(viewModel.toastMessage, "Published")
    }

    func test_setupMode_saveDraftUpdatesToast() async {
        let viewModel = EditBusinessPageViewModel(
            businessId: "biz-1",
            preview: EditBusinessPageSampleData.setupPatchAndPaw
        )
        await viewModel.saveDraft()
        XCTAssertEqual(viewModel.toastMessage, "Draft saved")
    }

    func test_discardRequested_flipsConfirmFlag() {
        let viewModel = EditBusinessPageViewModel(
            businessId: "biz-1",
            preview: EditBusinessPageSampleData.publishedRoostCafe
        )
        XCTAssertFalse(viewModel.showsDiscardConfirm)
        viewModel.discardRequested()
        XCTAssertTrue(viewModel.showsDiscardConfirm)
    }

    // MARK: - Helpers

    private func withModifiedName(
        _ content: EditBusinessPageContent,
        current: String
    ) -> EditBusinessPageContent {
        EditBusinessPageContent(
            businessId: content.businessId,
            mode: content.mode,
            banner: content.banner,
            logo: content.logo,
            name: EditBusinessPageField(
                original: content.name.original,
                current: current,
                placeholder: content.name.placeholder
            ),
            tagline: content.tagline,
            category: content.category,
            categoryRequired: content.categoryRequired,
            price: content.price,
            description: content.description,
            hours: content.hours,
            services: content.services,
            gallery: content.gallery,
            phone: content.phone,
            email: content.email,
            website: content.website,
            bookingLink: content.bookingLink,
            location: content.location
        )
    }

    private func currentName(_ viewModel: EditBusinessPageViewModel) -> String {
        guard case let .loaded(content) = viewModel.state else { return "" }
        return content.name.current
    }

    private func currentNameIsDirty(_ viewModel: EditBusinessPageViewModel) -> Bool {
        guard case let .loaded(content) = viewModel.state else { return false }
        return content.name.isDirty
    }
}
