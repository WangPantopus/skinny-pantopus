//
//  ProfessionalProfileViewModelTests.swift
//  PantopusTests
//
//  A.5 (A13.11) — covers the verified ⇄ pending state machine: hydration,
//  per-field edits, the verified→pending transition, Discard rollback, and
//  Save & submit commit semantics (claims stay "in review" after submit).
//

import XCTest
@testable import Pantopus

@MainActor
final class ProfessionalProfileViewModelTests: XCTestCase {
    private func makeVM(
        seed: ProfessionalProfileContent = ProfessionalProfileSampleData.published,
        baseline: ProfessionalProfileContent? = nil
    ) async -> ProfessionalProfileViewModel {
        let vm = ProfessionalProfileViewModel(seed: seed, baseline: baseline)
        await vm.load()
        return vm
    }

    private func content(_ state: ProfessionalProfileState) -> ProfessionalProfileContent? {
        switch state {
        case let .verified(content): content
        case let .pending(content, _, _): content
        default: nil
        }
    }

    // MARK: - Hydration

    func test_load_publishedSeed_isVerifiedAndClean() async {
        let vm = await makeVM()
        guard case let .verified(content) = vm.state else {
            return XCTFail("Expected .verified, got \(vm.state)")
        }
        XCTAssertEqual(content.dirtyCount, 0)
        XCTAssertEqual(content.strength, 92)
    }

    func test_load_failure_isError() async {
        let vm = ProfessionalProfileViewModel(simulateFailure: true)
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected .error, got \(vm.state)")
        }
    }

    // MARK: - Edits flip verified → pending

    func test_addSkill_transitionsToPending_withFreshChip() async {
        let vm = await makeVM()
        vm.addSkill()
        guard case let .pending(content, dirtyCount, pendingCount) = vm.state else {
            return XCTFail("Expected .pending after adding a skill, got \(vm.state)")
        }
        XCTAssertEqual(dirtyCount, 1)
        XCTAssertEqual(pendingCount, 0, "Skills carry no verification")
        XCTAssertTrue(content.skills.last?.isFresh ?? false)
    }

    func test_addCertification_transitionsToPending_withPendingClaim() async {
        let vm = await makeVM()
        vm.addCertification()
        guard case let .pending(_, dirtyCount, pendingCount) = vm.state else {
            return XCTFail("Expected .pending after adding a cert, got \(vm.state)")
        }
        XCTAssertEqual(dirtyCount, 1)
        XCTAssertEqual(pendingCount, 1, "A new cert needs verification")
    }

    func test_setVisibility_off_marksDirty() async {
        let vm = await makeVM()
        vm.setVisibility("hourlyRate", isOn: false)
        guard case let .pending(content, dirtyCount, _) = vm.state else {
            return XCTFail("Expected .pending after a toggle, got \(vm.state)")
        }
        XCTAssertEqual(dirtyCount, 1)
        XCTAssertEqual(content.visibility.first { $0.id == "hourlyRate" }?.isOn, false)
    }

    func test_updateTitle_marksDirty() async {
        let vm = await makeVM()
        vm.updateTitle("Master Carpenter")
        guard case let .pending(content, dirtyCount, _) = vm.state else {
            return XCTFail("Expected .pending after editing the title, got \(vm.state)")
        }
        XCTAssertEqual(dirtyCount, 1)
        XCTAssertTrue(content.title.isDirty)
    }

    // MARK: - Discard

    func test_discard_revertsToVerifiedBaseline() async {
        let vm = await makeVM()
        vm.addSkill()
        vm.updateTitle("Changed")
        vm.discard()
        guard case let .verified(content) = vm.state else {
            return XCTFail("Expected .verified after discard, got \(vm.state)")
        }
        XCTAssertEqual(content.dirtyCount, 0)
        XCTAssertEqual(content.title.value, "Licensed General Handyman")
    }

    func test_pendingSeed_discard_rollsBackToPublished() async {
        let vm = await makeVM(
            seed: ProfessionalProfileSampleData.pendingEdits,
            baseline: ProfessionalProfileSampleData.published
        )
        vm.discard()
        guard case let .verified(content) = vm.state else {
            return XCTFail("Expected .verified after discard, got \(vm.state)")
        }
        XCTAssertEqual(content.company.status, .verified)
        XCTAssertFalse(content.skills.contains { $0.label == "Tile work" })
    }

    // MARK: - Save & submit

    func test_saveAndSubmit_commitsAndClearsDirty() async {
        let vm = await makeVM()
        vm.addSkill()
        vm.saveAndSubmit()
        guard case let .verified(content) = vm.state else {
            return XCTFail("Expected .verified after submit, got \(vm.state)")
        }
        XCTAssertEqual(content.dirtyCount, 0)
        XCTAssertFalse(content.skills.contains(where: \.isFresh), "Fresh flags cleared on submit")
        XCTAssertEqual(vm.toast?.kind, .success)
    }

    func test_saveAndSubmit_whenClean_isNoop() async {
        let vm = await makeVM()
        vm.saveAndSubmit()
        guard case .verified = vm.state else {
            return XCTFail("Expected .verified, got \(vm.state)")
        }
        XCTAssertNil(vm.toast, "Nothing to submit → no toast")
    }

    func test_pendingSeed_saveAndSubmit_keepsClaimsInReview() async {
        let vm = await makeVM(
            seed: ProfessionalProfileSampleData.pendingEdits,
            baseline: ProfessionalProfileSampleData.published
        )
        vm.saveAndSubmit()
        guard case let .verified(content) = vm.state else {
            return XCTFail("Expected .verified after submit, got \(vm.state)")
        }
        // Edits are committed (clean) but the company + new cert are still
        // awaiting server verification.
        XCTAssertEqual(content.dirtyCount, 0)
        XCTAssertEqual(content.pendingCount, 2)
        XCTAssertEqual(vm.toast?.kind, .success)
        XCTAssertTrue(vm.toast?.text.contains("2") ?? false)
    }

    // MARK: - Removal

    func test_removeSkill_dropsChip() async {
        let vm = await makeVM()
        vm.removeSkill("carpentry")
        let skills = content(vm.state)?.skills ?? []
        XCTAssertFalse(skills.contains { $0.id == "carpentry" })
    }
}
