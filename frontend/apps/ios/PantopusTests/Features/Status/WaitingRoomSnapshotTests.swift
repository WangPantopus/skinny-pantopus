//
//  WaitingRoomSnapshotTests.swift
//  PantopusTests
//
//  Build-validity smoke for `WaitingRoomView` across both A18.4 frames
//  (active wait / more-info-requested). Hosts each frame in a
//  UIHostingController and asserts the SwiftUI tree builds — mirrors
//  `StatusWaitingSnapshotTests`, the established pattern for the ceremonial
//  status surfaces (whose pixel baselines live alongside).
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class WaitingRoomSnapshotTests: XCTestCase {
    private func assertRenders(
        _ label: String,
        state: WaitingRoomState,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let view = WaitingRoomView(viewModel: WaitingRoomViewModel(homeId: "home-1", state: state))
        let host = UIHostingController(rootView: view)
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.loadViewIfNeeded()
        XCTAssertNotNil(host.view, "\(label) failed to build", file: file, line: line)
    }

    func testActiveWait() {
        assertRenders("A18.4 active", state: .active)
    }

    func testMoreInfoRequested() {
        assertRenders("A18.4 more-info", state: .moreInfoRequested)
    }
}
