//
//  EditPersonaViewModelTests.swift
//  PantopusTests
//
//  A13.12 — covers the Edit Beacon VM against the real persona write
//  contract: `GET /api/personas/me` decides create vs. edit, and `save()`
//  routes to `POST /api/personas` or `PATCH /api/personas/:id`.
//

import XCTest
@testable import Pantopus

@MainActor
final class EditPersonaViewModelTests: XCTestCase {
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

    // MARK: - Load

    func testLoadWithNoPersonaOpensCreateForm() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"persona":null,"channel":null}"#),
            .status(200, body: Self.categoriesJSON)
        ]
        let vm = EditPersonaViewModel(api: makeAPI())
        await vm.load()
        XCTAssertEqual(vm.state, .editing(.create))
        XCTAssertTrue(vm.isCreate)
        XCTAssertEqual(vm.form.handle, "")
        XCTAssertEqual(vm.form.category, "creator")
        XCTAssertEqual(vm.saveButtonLabel, "Publish Beacon")
        XCTAssertFalse(vm.isValid, "An empty create form has no handle / display name yet")
    }

    func testLoadProjectsExistingPersonaIntoTheForm() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.meJSON),
            .status(200, body: Self.categoriesJSON)
        ]
        let vm = EditPersonaViewModel(api: makeAPI())
        await vm.load()
        XCTAssertEqual(vm.state, .editing(.edit(personaId: "p_1")))
        XCTAssertEqual(vm.form.handle, "elmpark.watch")
        XCTAssertEqual(vm.form.displayName, "Elm Park Watch")
        XCTAssertEqual(vm.form.bio, "Neighborhood updates.")
        XCTAssertEqual(vm.form.category, "community_leader")
        XCTAssertEqual(vm.form.audienceLabel, .members)
        XCTAssertEqual(vm.form.audienceMode, .approvalRequired)
        XCTAssertEqual(vm.form.links.count, 1)
        XCTAssertEqual(vm.form.links.first?.url, "https://elmpark.org")
        XCTAssertEqual(vm.form.shareURL, "https://pantopus.com/@elmpark.watch")
        XCTAssertEqual(vm.saveButtonLabel, "Save Beacon")
        XCTAssertFalse(vm.isDirty)
        XCTAssertTrue(vm.isValid)
    }

    func testLoadFailureSurfacesRetryableError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = EditPersonaViewModel(api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected .error, got \(vm.state)")
        }
    }

    func testCategoryPoliciesOverrideTheFallbackLadder() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.meJSON),
            .status(200, body: Self.categoriesJSON)
        ]
        let vm = EditPersonaViewModel(api: makeAPI())
        await vm.load()
        XCTAssertEqual(vm.categories.map(\.value), ["creator", "community_leader", "doctor"])
        XCTAssertEqual(vm.categories.last?.isEnabled, false, "Sensitive categories stay gated")
        XCTAssertEqual(vm.categories.first?.label, "Creator")
    }

    // MARK: - Validation

    func testIncompleteLinkBlocksSave() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.meJSON),
            .status(200, body: Self.categoriesJSON)
        ]
        let vm = EditPersonaViewModel(api: makeAPI())
        await vm.load()
        vm.addLink()
        vm.updateLink(id: vm.form.links.last?.id ?? "", label: "Newsletter")
        XCTAssertTrue(vm.form.hasIncompleteLink)
        XCTAssertFalse(vm.isValid)

        SequencedURLProtocol.sequence = []
        let saved = await vm.save()
        XCTAssertNil(saved)
        XCTAssertEqual(vm.saveError, "Each public link needs both a label and a URL.")
    }

    func testBareHostGetsHttpsSchemeOnTheWire() {
        var form = EditPersonaForm(handle: "@sourdough", displayName: "Sourdough Sat")
        form.links = [PersonaLinkDraft(label: "Site", url: "sourdough.example")]
        let body = form.wireBody
        XCTAssertEqual(body.handle, "sourdough", "Leading @ is stripped before the wire")
        XCTAssertEqual(body.publicLinks.first?.url, "https://sourdough.example")
    }

    // MARK: - Save

    func testSaveCreatesWhenThereIsNoPersonaYet() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"persona":null,"channel":null}"#),
            .status(200, body: Self.categoriesJSON)
        ]
        let vm = EditPersonaViewModel(api: makeAPI())
        await vm.load()
        vm.form.handle = "sourdough.sat"
        vm.form.displayName = "Sourdough Saturdays"

        SequencedURLProtocol.sequence = [.status(201, body: Self.createdJSON)]
        let handle = await vm.save()
        XCTAssertEqual(handle, "sourdough.sat")
        XCTAssertEqual(vm.statusMessage, "Beacon created.")
        XCTAssertEqual(vm.state, .editing(.edit(personaId: "p_2")))
        XCTAssertFalse(vm.isCreate)
        XCTAssertFalse(vm.isDirty)
    }

    func testSaveUpdatesAnExistingPersona() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.meJSON),
            .status(200, body: Self.categoriesJSON)
        ]
        let vm = EditPersonaViewModel(api: makeAPI())
        await vm.load()
        vm.form.displayName = "Elm Park Neighborhood Watch"

        SequencedURLProtocol.sequence = [.status(200, body: Self.meJSON)]
        let handle = await vm.save()
        XCTAssertEqual(handle, "elmpark.watch")
        XCTAssertEqual(vm.statusMessage, "Beacon saved.")
        XCTAssertNil(vm.saveError)
    }

    func testHandleConflictSurfacesTheServerMessage() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"persona":null,"channel":null}"#),
            .status(200, body: Self.categoriesJSON)
        ]
        let vm = EditPersonaViewModel(api: makeAPI())
        await vm.load()
        vm.form.handle = "taken"
        vm.form.displayName = "Taken"

        SequencedURLProtocol.sequence = [
            .status(409, body: #"{"error":"That Beacon handle is already taken."}"#)
        ]
        let handle = await vm.save()
        XCTAssertNil(handle)
        XCTAssertEqual(vm.saveError, "That Beacon handle is already taken.")
        XCTAssertFalse(vm.isSaving)
    }

    // MARK: - Fixtures

    private static let meJSON = """
    {"persona":{"id":"p_1","handle":"elmpark.watch","displayName":"Elm Park Watch",
    "avatarUrl":null,"bannerUrl":null,"bio":"Neighborhood updates.",
    "category":"community_leader","audienceLabel":"members","audienceMode":"approval_required",
    "publicLinks":[{"label":"Site","url":"https://elmpark.org"}],
    "followerCount":128,"postCount":9},"channel":{"id":"c_1"}}
    """

    private static let createdJSON = """
    {"persona":{"id":"p_2","handle":"sourdough.sat","displayName":"Sourdough Saturdays",
    "avatarUrl":null,"bannerUrl":null,"bio":null,"category":"creator",
    "audienceLabel":"followers","audienceMode":"open","publicLinks":[],
    "followerCount":0,"postCount":0},"channel":{"id":"c_2"}}
    """

    private static let categoriesJSON = """
    {"categories":[
      {"category":"creator","label":"creator","sensitive":false,"enabled":true,"requirements":[]},
      {"category":"community_leader","label":"community leader","sensitive":false,"enabled":true,"requirements":[]},
      {"category":"doctor","label":"Doctor","sensitive":true,"enabled":false,
       "requirements":["credential_verification"]}
    ],"sensitiveCategoriesEnabled":false}
    """
}
