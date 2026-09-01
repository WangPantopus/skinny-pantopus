//
//  SchedulingOnboardingModelTests.swift
//  PantopusTests
//
//  Step-machine coverage for the Home / Business scheduling onboarding wizard.
//
//  The Home flow's rail has three steps but only TWO of them take input — the third
//  ("Share") IS the success frame, per `onboarding-home-frames.jsx` `HomeSuccess`. That
//  distinction was previously conflated with `totalSteps`, which left step 3 rendering an
//  empty body under a live Continue button, and made two other paths silently wrong.
//  These tests pin the corrected transitions.
//

import XCTest
@testable import Pantopus

@MainActor
final class SchedulingOnboardingModelTests: XCTestCase {
    private func homeModel() -> SchedulingOnboardingModel {
        SchedulingOnboardingModel(owner: .home(homeId: "h1")) { _ in }
    }

    private func businessModel() -> SchedulingOnboardingModel {
        SchedulingOnboardingModel(owner: .business(id: "b1")) { _ in }
    }

    // MARK: Step counts

    func testHomeHasThreeRailStepsButOnlyTwoTakeInput() {
        let model = homeModel()
        XCTAssertEqual(model.totalSteps, 3, "The rail still shows Members · Combine · Share")
        XCTAssertEqual(model.inputSteps, 2, "Share is the success frame, not an input step")
    }

    func testBusinessInputStepsMatchRailSteps() {
        let model = businessModel()
        XCTAssertEqual(model.totalSteps, 4)
        XCTAssertEqual(model.inputSteps, 4, "Every Business rail step collects input")
    }

    // MARK: Home advance

    func testHomeStartsOnStepOneAndIsNotSuccess() {
        let model = homeModel()
        XCTAssertEqual(model.stepIndex, 1)
        XCTAssertFalse(model.isSuccess)
    }

    func testHomeContinueFromStepOneLandsOnStepTwo() {
        let model = homeModel()
        model.primaryTapped()
        XCTAssertEqual(model.stepIndex, 2)
        XCTAssertFalse(model.isSuccess, "Step 2 still collects input")
    }

    // MARK: Regressions

    /// Regression: "skip" advanced on `totalSteps`, so on Home it stepped 2 -> 3, which now
    /// reads as success — showing "your link is live" without ever running finishSetup().
    func testHomeSkipOnTheLastInputStepDoesNotFakeSuccess() {
        let model = homeModel()
        model.primaryTapped() // -> step 2 (last input step)
        XCTAssertEqual(model.stepIndex, 2)

        model.secondaryTapped()

        XCTAssertFalse(
            model.isSuccess,
            "Skip must run finishSetup() rather than stepping into the success frame directly"
        )
    }

    func testHomeSkipFromStepOneJustAdvances() {
        let model = homeModel()
        model.secondaryTapped()
        XCTAssertEqual(model.stepIndex, 2)
        XCTAssertFalse(model.isSuccess)
    }

    // MARK: Back navigation

    func testBackFromFirstStepFinishes() {
        let model = homeModel()
        model.leadingTapped()
        XCTAssertTrue(model.isFinished)
    }

    func testBackFromStepTwoReturnsToStepOne() {
        let model = homeModel()
        model.primaryTapped()
        model.leadingTapped()
        XCTAssertEqual(model.stepIndex, 1)
        XCTAssertFalse(model.isFinished)
    }

    // MARK: displayStep stays inside the rail

    func testDisplayStepTracksTheStepIndexInsideTheRail() {
        let model = homeModel()
        XCTAssertEqual(model.displayStep, 1)
        model.primaryTapped()
        XCTAssertEqual(model.displayStep, 2)
        XCTAssertLessThanOrEqual(model.displayStep, model.totalSteps)
    }

    // NOTE: the success frame is not reachable from a unit test — `finishSetup()` uses
    // `SchedulingClient.shared`, so there is no seam to drive it without a network stub.
    // (It now advances to success ONLY after `createEventType` succeeds; failures set
    // `submitError` and keep the wizard on the last input step, and the is_live publish
    // runs after creation.) The `leadingTapped()`-out-of-success fix is therefore covered
    // by review, not by a test. Injecting the client into this model would close that gap.
}
