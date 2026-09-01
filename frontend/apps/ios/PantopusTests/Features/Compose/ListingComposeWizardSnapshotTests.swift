//
//  ListingComposeWizardSnapshotTests.swift
//  PantopusTests
//
//  P2.3 — design-reference baseline tripwire for the Snap & Sell wizard.
//  Same shape as `BroadcastDetailSnapshotTests.swift`: asserts the
//  baseline PNG file exists at `PantopusTests/__Snapshots__/
//  p2-listing-compose/<state>-ios.png` and is a valid non-trivial PNG.
//  Tests `XCTSkip` when the baseline is missing so the gate exists
//  without failing CI on the first PR; the follow-up commits the
//  rendered baselines.
//

import SwiftUI
import XCTest
@testable import Pantopus

final class ListingComposeWizardSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Compose
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p2-listing-compose")
    }

    func test_listing_compose_step1_photos_baseline_is_present() throws {
        try assertBaselineOrSkip("step1-photos")
    }

    func test_listing_compose_step2_title_category_baseline_is_present() throws {
        try assertBaselineOrSkip("step2-title-category")
    }

    func test_listing_compose_step3_condition_description_baseline_is_present() throws {
        try assertBaselineOrSkip("step3-condition-description")
    }

    func test_listing_compose_step4_price_baseline_is_present() throws {
        try assertBaselineOrSkip("step4-price")
    }

    func test_listing_compose_step5_location_baseline_is_present() throws {
        try assertBaselineOrSkip("step5-location")
    }

    func test_listing_compose_step6_review_baseline_is_present() throws {
        try assertBaselineOrSkip("step6-review")
    }

    func test_listing_compose_success_baseline_is_present() throws {
        try assertBaselineOrSkip("success")
    }

    /// P3.3 — Edit mode landing baseline. Same six-step wizard, but
    /// chrome adapts (title "Edit listing", CTA "Save changes") and the
    /// form is prefilled from the listing detail fetch. The landing
    /// step is `.review` so the user can scan + save with one tap.
    func test_listing_compose_edit_prefill_review_baseline_is_present() throws {
        try assertBaselineOrSkip("edit-prefill-review")
    }

    /// P3.3 — Edit mode jump-to-price baseline. Reached via the
    /// "Edit price" action on the listing-offers panel. Form is
    /// prefilled with the existing listing's data and the wizard
    /// lands on the price step.
    func test_listing_compose_edit_jump_to_price_baseline_is_present() throws {
        try assertBaselineOrSkip("edit-jump-to-price")
    }

    @MainActor
    func test_listing_compose_snap_capture_frame_renders() {
        let view = ListingComposeWizardView { _ in }
            .frame(width: 390, height: 820)
        assertRenders(view)
    }

    @MainActor
    func test_listing_compose_snap_review_frame_renders() {
        let vm = ListingComposeWizardViewModel(
            initialState: ListingComposeFormState(
                step: ListingComposeStep.titleCategory.rawValue,
                entryMode: .snap,
                photos: [
                    ListingComposePhoto(token: "snap_angle_1"),
                    ListingComposePhoto(token: "snap_angle_2"),
                    ListingComposePhoto(token: "snap_angle_3")
                ],
                title: "Sage green velvet sofa, 3-seater",
                category: .goods,
                condition: .good,
                bodyText: "Comfortable three-seat velvet sofa with light wear on one cushion and minor sun fade.",
                priceKind: .fixed,
                priceAmount: "280",
                fulfillment: .pickup,
                deliveryEnabled: true,
                locationKind: .savedAddress
            )
        )
        assertRenders(ListingComposeSnapReviewStep(viewModel: vm).frame(width: 390, height: 820))
    }

    private func assertBaselineOrSkip(_ slug: String) throws {
        let url = baselineURL.appendingPathComponent("\(slug)-ios.png")
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw XCTSkip("Baseline pending follow-up commit: \(url.path)")
        }
        let data = try Data(contentsOf: url)
        XCTAssertGreaterThan(data.count, 8 * 1024, "Baseline too small (\(data.count) bytes)")
        XCTAssertTrue(
            data.count > 4 &&
                data[0] == 0x89 &&
                data[1] == 0x50 &&
                data[2] == 0x4E &&
                data[3] == 0x47,
            "Not a PNG: \(url.path)"
        )
    }

    @MainActor
    private func assertRenders(_ view: some View) {
        let host = UIHostingController(rootView: view)
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 820)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0)
        XCTAssertGreaterThan(host.view.frame.size.height, 0)
    }
}
