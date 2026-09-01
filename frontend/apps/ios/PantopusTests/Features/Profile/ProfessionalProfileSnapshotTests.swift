//
//  ProfessionalProfileSnapshotTests.swift
//  PantopusTests
//
//  A.5 (A13.11) — structural render snapshots for the Professional Profile
//  editor across every state: loading (skeleton), verified (FRAME 1),
//  pending (FRAME 2), and error. Same pattern as the other screen
//  snapshot suites: until `swift-snapshot-testing` ships in `project.yml`,
//  each fixture asserts a valid hosting hierarchy with non-zero geometry,
//  backed by invariant checks on the two designed frames.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class ProfessionalProfileSnapshotTests: XCTestCase {
    // MARK: - Render states

    func test_professionalProfile_loading_renders() {
        assertRenders(ProfessionalProfileSkeleton())
    }

    func test_professionalProfile_verified_renders() async {
        let viewModel = ProfessionalProfileViewModel(seed: ProfessionalProfileSampleData.published)
        await viewModel.load()
        assertRenders(ProfessionalProfileView(viewModel: viewModel))
    }

    func test_professionalProfile_pending_renders() async {
        let viewModel = ProfessionalProfileViewModel(
            seed: ProfessionalProfileSampleData.pendingEdits,
            baseline: ProfessionalProfileSampleData.published
        )
        await viewModel.load()
        assertRenders(ProfessionalProfileView(viewModel: viewModel))
    }

    func test_professionalProfile_error_renders() async {
        let viewModel = ProfessionalProfileViewModel(simulateFailure: true)
        await viewModel.load()
        assertRenders(ProfessionalProfileView(viewModel: viewModel))
    }

    // MARK: - FRAME 1 · verified (published) invariants

    func test_publishedFixture_isCleanAndAllVerified() {
        let content = ProfessionalProfileSampleData.published
        XCTAssertEqual(content.strength, 92)
        XCTAssertEqual(content.dirtyCount, 0, "Published profile has no unsaved edits")
        XCTAssertEqual(content.pendingCount, 0, "Published profile has no claims in review")
        XCTAssertEqual(content.company.status, .verified)
        XCTAssertFalse(content.company.isDirty)
        XCTAssertFalse(content.certifications.contains { $0.status == .pending })
        XCTAssertFalse(content.skills.contains(where: \.isFresh))
        XCTAssertFalse(content.certifications.contains(where: \.isFresh))
        XCTAssertFalse(content.portfolio.contains(where: \.isFresh))
        // Strength caption reflects the all-verified state.
        XCTAssertTrue(content.strengthCaption.contains("All claims verified"))
    }

    func test_publishedFixture_hasOneExpiringCert() {
        // The EPA cert is the lone "expiring" (error-tinted) pill in FRAME 1.
        let expiring = ProfessionalProfileSampleData.published.certifications.filter { $0.status == .expiring }
        XCTAssertEqual(expiring.count, 1)
        XCTAssertEqual(expiring.first?.id, "epa-lead")
    }

    // MARK: - FRAME 2 · pending verification invariants

    func test_pendingFixture_hasFiveEditsTwoPendingClaims() {
        let content = ProfessionalProfileSampleData.pendingEdits
        XCTAssertEqual(content.strength, 68)
        XCTAssertEqual(content.dirtyCount, 5, "Company + skill + cert + link + visibility toggle")
        XCTAssertEqual(content.pendingCount, 2, "Co-op company + new CTI cert await verification")
    }

    func test_pendingFixture_freshClaimsAreMarked() {
        let content = ProfessionalProfileSampleData.pendingEdits
        // Company switched + dirty + pending.
        XCTAssertTrue(content.company.isDirty)
        XCTAssertEqual(content.company.status, .pending)
        XCTAssertNotNil(content.company.hint)
        // A fresh skill chip.
        XCTAssertTrue(content.skills.contains { $0.isFresh && $0.label == "Tile work" })
        // A fresh, pending certification.
        XCTAssertTrue(content.certifications.contains { $0.isFresh && $0.status == .pending })
        // A fresh portfolio link still resolving its preview.
        XCTAssertTrue(content.portfolio.contains { $0.isFresh && $0.state == .loading })
        // The hourly-rate visibility row was toggled off this session.
        let hourly = content.visibility.first { $0.id == "hourlyRate" }
        XCTAssertEqual(hourly?.isOn, false)
        XCTAssertTrue(hourly?.isDirty ?? false)
        XCTAssertTrue(content.strengthCaption.contains("pending verification"))
    }

    // MARK: - State derivation

    func test_viewModel_publishedSeed_derivesVerified() async {
        let viewModel = ProfessionalProfileViewModel(seed: ProfessionalProfileSampleData.published)
        await viewModel.load()
        guard case .verified = viewModel.state else {
            return XCTFail("Published seed should derive .verified, got \(viewModel.state)")
        }
    }

    func test_viewModel_pendingSeed_derivesPending() async {
        let viewModel = ProfessionalProfileViewModel(
            seed: ProfessionalProfileSampleData.pendingEdits,
            baseline: ProfessionalProfileSampleData.published
        )
        await viewModel.load()
        guard case let .pending(_, dirtyCount, pendingCount) = viewModel.state else {
            return XCTFail("Pending seed should derive .pending, got \(viewModel.state)")
        }
        XCTAssertEqual(dirtyCount, 5)
        XCTAssertEqual(pendingCount, 2)
    }

    // MARK: - Portfolio host glyph mapping

    func test_portfolioLink_hostGlyphs() {
        XCTAssertEqual(PortfolioLink(id: "a", host: "behance", title: "", url: "", state: .resolved).icon, .palette)
        XCTAssertEqual(PortfolioLink(id: "b", host: "youtube", title: "", url: "", state: .resolved).icon, .playCircle)
        XCTAssertEqual(PortfolioLink(id: "c", host: "instagram", title: "", url: "", state: .resolved).icon, .link)
    }

    // MARK: - Render helper

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view.frame(width: 390, height: 800))
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 800)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
