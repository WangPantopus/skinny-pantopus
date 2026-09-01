//
//  ProfessionalProfileMappingTests.swift
//  PantopusTests
//
//  P1-F — covers the live wiring of the Professional Profile editor:
//    - pure ProfessionalProfileDTO → content projection (overlapping fields),
//    - verification-status + category mapping,
//    - the null-profile (professional mode off) path,
//    - the live load() path via a stubbed APIClient.
//

import XCTest
@testable import Pantopus

@MainActor
final class ProfessionalProfileMappingTests: XCTestCase {
    private func dto(
        headline: String? = "Licensed General Handyman",
        bio: String? = "20 years of trade work.",
        categories: [String]? = ["handyman", "carpentry"],
        isPublic: Bool? = true,
        isActive: Bool? = false,
        status: String? = "verified"
    ) -> ProfessionalProfileDTO {
        ProfessionalProfileDTO(
            headline: headline,
            bio: bio,
            categories: categories,
            serviceArea: .init(city: "Elm Park", state: "NY"),
            pricingMeta: nil,
            isPublic: isPublic,
            isActive: isActive,
            verificationTier: 2,
            verificationStatus: status
        )
    }

    // MARK: - Projection

    func testMakeContentMapsOverlappingFields() {
        let content = ProfessionalProfileViewModel.makeContent(
            from: dto(),
            verification: nil,
            proName: "Maria K."
        )
        XCTAssertEqual(content.proName, "Maria K.")
        XCTAssertEqual(content.title.value, "Licensed General Handyman")
        XCTAssertEqual(content.skills.map(\.label), ["Handyman", "Carpentry"])
        XCTAssertEqual(content.company.locality, "Elm Park, NY")
        XCTAssertEqual(content.company.status, .verified)
        // Backend doesn't store these on profile/me.
        XCTAssertTrue(content.certifications.isEmpty)
        XCTAssertTrue(content.portfolio.isEmpty)
        // Visibility reflects the live flags.
        XCTAssertEqual(content.visibility.first { $0.id == "publicProfile" }?.isOn, true)
        XCTAssertEqual(content.visibility.first { $0.id == "activeForHire" }?.isOn, false)
        XCTAssertEqual(content.dirtyCount, 0, "Freshly loaded content is clean")
    }

    func testNullProfileProducesEmptyCleanContent() {
        let content = ProfessionalProfileViewModel.makeContent(
            from: nil,
            verification: nil,
            proName: ""
        )
        XCTAssertEqual(content.title.value, "")
        XCTAssertTrue(content.skills.isEmpty)
        XCTAssertEqual(content.company.status, .unverified)
        XCTAssertEqual(content.strength, 0)
        XCTAssertEqual(content.dirtyCount, 0)
    }

    func testVerificationStatusMapping() {
        XCTAssertEqual(ProfessionalProfileViewModel.verificationStatus("verified"), .verified)
        XCTAssertEqual(ProfessionalProfileViewModel.verificationStatus("pending"), .pending)
        XCTAssertEqual(ProfessionalProfileViewModel.verificationStatus(nil), .unverified)
        XCTAssertEqual(ProfessionalProfileViewModel.verificationStatus("rejected"), .unverified)
    }

    func testCategoryLabelHumanizes() {
        XCTAssertEqual(ProfessionalProfileViewModel.categoryLabel("pet_care"), "Pet Care")
        XCTAssertEqual(ProfessionalProfileViewModel.categoryLabel("handyman"), "Handyman")
    }

    func testStrengthHeuristicRewardsCompleteness() {
        let bare = ProfessionalProfileViewModel.strength(
            for: dto(headline: "", bio: "", categories: [], status: "unverified")
        )
        let full = ProfessionalProfileViewModel.strength(for: dto())
        XCTAssertEqual(bare, 40)
        XCTAssertGreaterThan(full, bare)
        XCTAssertLessThanOrEqual(full, 100)
    }

    // MARK: - Live load() path

    func testLiveLoadHydratesFromProfileMe() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/professional/profile/me": [
                .status(200, body: """
                {"profile":{"headline":"Licensed Handyman","bio":"Trades.",\
                "categories":["handyman","carpentry"],"is_public":true,"is_active":true,\
                "verification_status":"verified","service_area":{"city":"Elm Park","state":"NY"}}}
                """)
            ],
            "/api/professional/verification/status": [
                .status(200, body: """
                {"tier":2,"status":"verified","submitted_at":null,"completed_at":null}
                """)
            ]
        ])
        let vm = ProfessionalProfileViewModel(api: APIClient(session: session, retryPolicy: .none))
        await vm.load()
        guard case let .verified(content) = vm.state else {
            return XCTFail("Expected verified (clean) after load, got \(vm.state)")
        }
        XCTAssertEqual(content.title.value, "Licensed Handyman")
        XCTAssertEqual(content.skills.count, 2)
        XCTAssertEqual(content.company.status, .verified)
    }

    func testLiveLoadErrorSurfacesErrorState() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/professional/profile/me": [.status(500, body: "{\"error\":\"boom\"}")]
        ])
        let vm = ProfessionalProfileViewModel(api: APIClient(session: session, retryPolicy: .none))
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected error, got \(vm.state)")
        }
    }

    // MARK: - Create / enable / disable (T4)

    func testNullProfileEntersCreateMode() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/professional/profile/me": [.status(200, body: "{\"profile\":null}")]
        ])
        let vm = ProfessionalProfileViewModel(api: APIClient(session: session, retryPolicy: .none))
        await vm.load()
        guard case let .create(draft) = vm.state else {
            return XCTFail("Expected .create for a null profile, got \(vm.state)")
        }
        XCTAssertFalse(draft.isReEnable)
        XCTAssertEqual(draft.ctaLabel, "Enable professional mode")
        XCTAssertTrue(draft.isPublic)
    }

    func testNotFoundEntersCreateModeRatherThanError() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/professional/profile/me": [.status(404, body: "{\"error\":\"not found\"}")]
        ])
        let vm = ProfessionalProfileViewModel(api: APIClient(session: session, retryPolicy: .none))
        await vm.load()
        guard case .create = vm.state else {
            return XCTFail("Expected .create on 404, got \(vm.state)")
        }
    }

    func testInactiveProfileEntersReEnableModeSeededFromRecord() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/professional/profile/me": [
                .status(200, body: """
                {"profile":{"headline":"Licensed Handyman","bio":"Trades.",\
                "categories":["handyman"],"is_public":false,"is_active":false,\
                "service_area":{"city":"Elm Park","state":"NY","radius_km":25},\
                "pricing_meta":{"hourly_rate":85,"currency":"USD"}}}
                """)
            ]
        ])
        let vm = ProfessionalProfileViewModel(api: APIClient(session: session, retryPolicy: .none))
        await vm.load()
        guard case let .create(draft) = vm.state else {
            return XCTFail("Expected .create for a disabled profile, got \(vm.state)")
        }
        XCTAssertTrue(draft.isReEnable)
        XCTAssertEqual(draft.ctaLabel, "Re-enable professional mode")
        XCTAssertEqual(draft.headline, "Licensed Handyman")
        XCTAssertEqual(draft.categories, ["handyman"])
        XCTAssertEqual(draft.city, "Elm Park")
        XCTAssertEqual(draft.radiusKm, "25")
        XCTAssertEqual(draft.hourlyRate, "85")
    }

    func testEnablePostsProfileThenShowsEditor() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/professional/profile/me": [.status(200, body: "{\"profile\":null}")],
            "/api/professional/profile": [
                .status(201, body: """
                {"message":"Professional mode enabled",\
                "profile":{"headline":"Handy","is_public":true,"is_active":true,"categories":["handyman"]}}
                """)
            ],
            "/api/professional/verification/status": [
                .status(200, body: "{\"tier\":0,\"status\":\"none\"}")
            ]
        ])
        let vm = ProfessionalProfileViewModel(api: APIClient(session: session, retryPolicy: .none))
        await vm.load()
        vm.updateDraftHeadline("Handy")
        vm.toggleDraftCategory("handyman")
        await vm.enable()
        guard case let .verified(content) = vm.state else {
            return XCTFail("Expected the editor after enabling, got \(vm.state)")
        }
        XCTAssertEqual(content.title.value, "Handy")
        XCTAssertEqual(vm.toast?.text, "Professional mode enabled")
    }

    func testEnableFailureKeepsCreateModeAndSurfacesMessage() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/professional/profile/me": [.status(200, body: "{\"profile\":null}")],
            "/api/professional/profile": [
                .status(400, body: "{\"error\":\"Professional profile already exists\"}")
            ]
        ])
        let vm = ProfessionalProfileViewModel(api: APIClient(session: session, retryPolicy: .none))
        await vm.load()
        await vm.enable()
        guard case let .create(draft) = vm.state else {
            return XCTFail("Expected to stay in .create after a failure, got \(vm.state)")
        }
        XCTAssertFalse(draft.isSubmitting)
        XCTAssertEqual(draft.errorMessage, "Professional profile already exists")
    }

    func testDisableConfirmedDropsBackToReEnableMode() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/professional/profile/me": [
                .status(200, body: """
                {"profile":{"headline":"Licensed Handyman","is_public":true,"is_active":true,\
                "categories":["handyman"]}}
                """),
                // DELETE hits the same path.
                .status(200, body: """
                {"message":"Professional mode disabled",\
                "profile":{"headline":"Licensed Handyman","is_public":false,"is_active":false,\
                "categories":["handyman"]}}
                """)
            ],
            "/api/professional/verification/status": [
                .status(200, body: "{\"tier\":0,\"status\":\"none\"}")
            ]
        ])
        let vm = ProfessionalProfileViewModel(api: APIClient(session: session, retryPolicy: .none))
        await vm.load()
        vm.requestDisable()
        XCTAssertTrue(vm.showsDisableConfirm, "Disable must go through a confirm")
        await vm.disableConfirmed()
        guard case let .create(draft) = vm.state else {
            return XCTFail("Expected .create after disabling, got \(vm.state)")
        }
        XCTAssertTrue(draft.isReEnable)
        XCTAssertEqual(vm.toast?.text, "Professional mode disabled")
    }

    // MARK: - Request bodies

    func testEnableRequestOmitsBlankFieldsAndClampsRadius() throws {
        let draft = ProfessionalEnableDraft(
            headline: "  Handyman  ",
            bio: "",
            categories: ["handyman", "carpentry"],
            city: "Elm Park",
            state: "NY",
            radiusKm: "",
            hourlyRate: "85",
            isPublic: false
        )
        let json = try JSONSerialization.jsonObject(
            with: JSONEncoder().encode(ProfessionalProfileViewModel.enableRequest(from: draft))
        ) as? [String: Any]
        XCTAssertEqual(json?["headline"] as? String, "Handyman")
        XCTAssertNil(json?["bio"], "Blank optional fields are omitted, not sent as empty strings")
        XCTAssertEqual(json?["categories"] as? [String], ["handyman", "carpentry"])
        XCTAssertEqual(json?["is_public"] as? Bool, false)
        let area = json?["service_area"] as? [String: Any]
        XCTAssertEqual(area?["city"] as? String, "Elm Park")
        XCTAssertEqual(area?["radius_km"] as? Int, 50)
        let pricing = json?["pricing_meta"] as? [String: Any]
        XCTAssertEqual(pricing?["hourly_rate"] as? Double, 85)
        XCTAssertEqual(pricing?["currency"] as? String, "USD")
    }

    func testReEnableRequestSetsIsActiveTrue() throws {
        let draft = ProfessionalEnableDraft(headline: "Handyman", isReEnable: true)
        let json = try JSONSerialization.jsonObject(
            with: JSONEncoder().encode(ProfessionalProfileViewModel.updateRequest(from: draft))
        ) as? [String: Any]
        XCTAssertEqual(json?["is_active"] as? Bool, true)
        XCTAssertEqual(json?["headline"] as? String, "Handyman")
    }

    func testCategorySelectionIsCappedAtFive() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/professional/profile/me": [.status(200, body: "{\"profile\":null}")]
        ])
        let vm = ProfessionalProfileViewModel(api: APIClient(session: session, retryPolicy: .none))
        await vm.load()
        for category in ProfessionalCategory.all.prefix(6) {
            vm.toggleDraftCategory(category.key)
        }
        guard case let .create(draft) = vm.state else {
            return XCTFail("Expected .create, got \(vm.state)")
        }
        XCTAssertEqual(draft.categories.count, ProfessionalCategory.selectionLimit)
        vm.toggleDraftCategory(draft.categories[0])
        guard case let .create(after) = vm.state else {
            return XCTFail("Expected .create, got \(vm.state)")
        }
        XCTAssertEqual(after.categories.count, 4, "Toggling a selected chip removes it")
    }
}
