//
//  VacationHoldSnapshotTests.swift
//  PantopusTests
//
//  A14.8 — build-validity snapshots for the Vacation Hold screen in
//  both `scheduling` and `active` variants, plus the two feature-local
//  primitives (`HoldStatusHero` and `HeldList`). The asserts mirror the
//  same shape every other feature snapshot test in the repo uses: host
//  the view in a `UIHostingController` and assert it lays out without
//  crashing. Visual baselines live alongside the design previews.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class VacationHoldSnapshotTests: XCTestCase {
    private func assertRenders(
        _ view: some View,
        size: CGSize = CGSize(width: 390, height: 1200),
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view.frame(width: size.width, height: size.height))
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(origin: .zero, size: size)
        host.loadViewIfNeeded()
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }

    // MARK: - Full screen

    func test_vacationHold_schedulingFrame_renders() {
        let vm = VacationHoldViewModel(seed: .scheduling)
        assertRenders(VacationHoldView(viewModel: vm))
    }

    func test_vacationHold_activeFrame_renders() {
        let vm = VacationHoldViewModel(seed: .active)
        assertRenders(VacationHoldView(viewModel: vm))
    }

    // MARK: - Primitives

    func test_holdStatusHero_renders() {
        assertRenders(
            HoldStatusHero(
                daysLeft: 5,
                untilLabel: "Jun 9",
                stats: VacationHoldSampleData.activeHold.stats,
                reduceMotionOverride: true
            ),
            size: CGSize(width: 390, height: 220)
        )
    }

    func test_heldList_renders() {
        assertRenders(
            HeldList(items: VacationHoldSampleData.activeHold.heldItems),
            size: CGSize(width: 390, height: 320)
        )
    }
}
