//
//  EditProfileSkillsViewModelTests.swift
//  PantopusTests
//
//  Covers the two Edit Profile legs that don't ride the profile PATCH:
//  the skills editor (`PUT /api/users/skills`,
//  `backend/routes/users.js:2246`) and the "Generate with AI" bio draft
//  (`POST /api/ai/draft/post`, `backend/routes/ai.js:218`).
//

import XCTest
@testable import Pantopus

@MainActor
final class EditProfileSkillsViewModelTests: XCTestCase {
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

    private static func userJSON(
        firstName: String = "Alice",
        lastName: String = "Doe",
        tagline: String = "Builder of homes",
        city: String = "Portland",
        skills: String = "[\"Plumbing\"]"
    ) -> String {
        """
        {
          "id":"u1","email":"alice@example.com","username":"alice",
          "firstName":"\(firstName)","middleName":"Q","lastName":"\(lastName)",
          "name":"Alice Q Doe",
          "phoneNumber":"+15555550123","dateOfBirth":"1990-04-12",
          "address":"123 Main St","city":"\(city)","state":"OR","zipcode":"97201",
          "accountType":"personal","role":"user","verified":true,
          "residency":null,"avatar_url":null,"profile_picture_url":null,"profilePicture":null,
          "bio":"Hello world","tagline":"\(tagline)","socialLinks":{
            "website":"https://alice.dev","linkedin":null,"twitter":null,
            "instagram":null,"facebook":null
          },"skills":\(skills),
          "followers_count":0,"average_rating":0,"gigs_posted":0,"gigs_completed":0,
          "profileVisibility":"public","createdAt":"2025-01-01T00:00:00Z",
          "updatedAt":"2025-01-01T00:00:00Z"
        }
        """
    }

    private static func profileJSON(_ user: String = userJSON()) -> String {
        "{\"user\":\(user),\"invite_progress\":null}"
    }

    /// `PATCH /api/users/profile` echoes no `skills` key
    /// (`backend/routes/users.js:2194`) — the fixture must not add one,
    /// or the "PATCH doesn't blank the list" guarantee goes untested.
    private static var patchEnvelope: String {
        "{\"message\":\"ok\",\"user\":\(userJSON(skills: "null"))}"
    }

    private static let profilePath = "/api/users/profile"
    private static let skillsPath = "/api/users/skills"
    private static let draftPostPath = "/api/ai/draft/post"

    private func loaded(user: String = userJSON()) async -> EditProfileViewModel {
        SequencedURLProtocol.routeResponses[Self.profilePath] = [.status(200, body: Self.profileJSON(user))]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        return vm
    }

    private func requests(to path: String) -> [URLRequest] {
        SequencedURLProtocol.capturedRequests.filter { $0.url?.path == path }
    }

    private func body(of request: URLRequest) -> Data {
        if let body = request.httpBody { return body }
        if let stream = request.httpBodyStream { return Data(readingStream: stream) }
        return Data()
    }

    private struct SkillsBody: Decodable { let skills: [String] }
    private struct DraftPostBody: Decodable { let text: String }

    // MARK: - Hydration

    func testLoadSeedsSkillsFromProfileAndStartsClean() async {
        let vm = await loaded()
        XCTAssertEqual(vm.skills, ["Plumbing"])
        XCTAssertEqual(vm.savedSkills, ["Plumbing"])
        XCTAssertFalse(vm.isSkillsDirty)
        XCTAssertFalse(vm.isDirty)
        XCTAssertEqual(vm.dirtyFieldCount, 0)
    }

    // MARK: - Skills editor

    func testAddSkillTrimsAndClearsTheDraftInput() async {
        let vm = await loaded()
        vm.skillDraft = "  Tutoring  "
        vm.addSkill()
        XCTAssertEqual(vm.skills, ["Plumbing", "Tutoring"])
        XCTAssertEqual(vm.skillDraft, "")
        XCTAssertTrue(vm.isSkillsDirty)
        XCTAssertEqual(vm.dirtyFieldCount, 1, "The skill list counts as one dirty field.")
    }

    func testAddSkillIgnoresBlankAndCaseInsensitiveDuplicates() async {
        let vm = await loaded()
        vm.skillDraft = "   "
        vm.addSkill()
        XCTAssertEqual(vm.skills, ["Plumbing"])
        XCTAssertEqual(vm.skillDraft, "   ", "A blank draft is a no-op, not a clear.")
        vm.skillDraft = "plumbing"
        vm.addSkill()
        XCTAssertEqual(vm.skills, ["Plumbing"], "The route dedupes; the chip row must not show both cases.")
        XCTAssertEqual(vm.skillDraft, "")
    }

    func testAddSkillRejectsEntryOverTheServerLengthCap() async {
        let vm = await loaded()
        vm.skillDraft = String(repeating: "a", count: EditProfileViewModel.maxSkillLength + 1)
        vm.addSkill()
        XCTAssertEqual(vm.skills, ["Plumbing"])
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    func testCanAddSkillGatesTheCTA() async {
        let vm = await loaded()
        XCTAssertFalse(vm.canAddSkill, "Empty input must leave the Add CTA disabled.")
        vm.skillDraft = "Tutoring"
        XCTAssertTrue(vm.canAddSkill)
    }

    func testRemoveSkillMarksTheFormDirty() async {
        let vm = await loaded()
        vm.removeSkill("Plumbing")
        XCTAssertEqual(vm.skills, [])
        XCTAssertTrue(vm.isDirty)
    }

    func testDiscardChangesRestoresTheSavedSkillList() async {
        let vm = await loaded()
        vm.skillDraft = "Tutoring"
        vm.addSkill()
        vm.removeSkill("Plumbing")
        XCTAssertTrue(vm.isSkillsDirty)
        vm.discardChanges()
        XCTAssertEqual(vm.skills, ["Plumbing"])
        XCTAssertEqual(vm.skillDraft, "")
        XCTAssertFalse(vm.isDirty)
    }

    // MARK: - Save

    func testSaveSendsSkillsPutAlongsideTheProfilePatch() async throws {
        SequencedURLProtocol.routeResponses[Self.profilePath] = [
            .status(200, body: Self.profileJSON()),
            .status(200, body: Self.patchEnvelope)
        ]
        SequencedURLProtocol.routeResponses[Self.skillsPath] = [
            .status(200, body: "{\"skills\":[\"Plumbing\",\"Tutoring\"]}")
        ]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        vm.update(.firstName, to: "Alex")
        vm.skillDraft = "Tutoring"
        vm.addSkill()
        let saved = await vm.save()

        XCTAssertTrue(saved)
        XCTAssertTrue(vm.shouldDismiss)
        XCTAssertEqual(vm.toast?.kind, .success)
        let puts = requests(to: Self.skillsPath)
        XCTAssertEqual(puts.count, 1)
        XCTAssertEqual(puts[0].httpMethod, "PUT")
        let sent = try JSONDecoder().decode(SkillsBody.self, from: body(of: puts[0]))
        XCTAssertEqual(sent.skills, ["Plumbing", "Tutoring"])
        // Two profile calls: the GET on load and the PATCH on save.
        XCTAssertEqual(requests(to: Self.profilePath).count, 2)
    }

    func testSaveWithOnlySkillsDirtySkipsTheProfilePatch() async {
        SequencedURLProtocol.routeResponses[Self.profilePath] = [.status(200, body: Self.profileJSON())]
        SequencedURLProtocol.routeResponses[Self.skillsPath] = [.status(200, body: "{\"skills\":[]}")]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        vm.removeSkill("Plumbing")
        let saved = await vm.save()

        XCTAssertTrue(saved)
        XCTAssertEqual(requests(to: Self.skillsPath).count, 1)
        XCTAssertEqual(
            requests(to: Self.profilePath).count,
            1,
            "Only the load GET — a clean field set must not issue a PATCH."
        )
    }

    func testSkillsBaselineAdoptsTheServerEcho() async {
        SequencedURLProtocol.routeResponses[Self.profilePath] = [.status(200, body: Self.profileJSON())]
        // The route trims + dedupes before echoing; the baseline must
        // follow the server, not the locally typed list.
        SequencedURLProtocol.routeResponses[Self.skillsPath] = [.status(200, body: "{\"skills\":[\"Plumbing\"]}")]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        vm.skillDraft = "Tutoring"
        vm.addSkill()
        _ = await vm.save()
        XCTAssertEqual(vm.skills, ["Plumbing"])
        XCTAssertEqual(vm.savedSkills, ["Plumbing"])
        XCTAssertFalse(vm.isSkillsDirty)
    }

    func testFailedProfilePatchStillCommitsSkillsAndLeavesOnlyTheFieldDirty() async {
        SequencedURLProtocol.routeResponses[Self.profilePath] = [
            .status(200, body: Self.profileJSON()),
            .status(500, body: "{\"error\":\"down\"}")
        ]
        SequencedURLProtocol.routeResponses[Self.skillsPath] = [
            .status(200, body: "{\"skills\":[\"Plumbing\",\"Tutoring\"]}")
        ]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        vm.update(.firstName, to: "Alex")
        vm.skillDraft = "Tutoring"
        vm.addSkill()
        let saved = await vm.save()

        XCTAssertFalse(saved)
        XCTAssertFalse(vm.shouldDismiss)
        XCTAssertEqual(vm.toast?.kind, .error)
        XCTAssertEqual(requests(to: Self.skillsPath).count, 1, "A failed PATCH must not skip the skills PUT.")
        XCTAssertFalse(vm.isSkillsDirty, "A landed skills PUT re-baselines so a retry doesn't re-send it.")
        XCTAssertTrue(vm.fields[.firstName]?.isDirty ?? false, "The failed field edit stays dirty for the retry.")
    }

    func testFailedSkillsPutKeepsTheProfilePatchResult() async {
        SequencedURLProtocol.routeResponses[Self.profilePath] = [
            .status(200, body: Self.profileJSON()),
            .status(200, body: Self.patchEnvelope)
        ]
        SequencedURLProtocol.routeResponses[Self.skillsPath] = [.status(500, body: "{\"error\":\"down\"}")]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        vm.update(.firstName, to: "Alex")
        vm.skillDraft = "Tutoring"
        vm.addSkill()
        let saved = await vm.save()

        XCTAssertFalse(saved)
        XCTAssertEqual(vm.toast?.kind, .error)
        XCTAssertFalse(vm.fields[.firstName]?.isDirty ?? true, "The landed PATCH re-baselined the field.")
        XCTAssertTrue(vm.isSkillsDirty, "The failed skills edit survives for the retry.")
        XCTAssertEqual(vm.skills, ["Plumbing", "Tutoring"])
    }

    func testProfilePatchEchoDoesNotBlankTheSkillList() async {
        SequencedURLProtocol.routeResponses[Self.profilePath] = [
            .status(200, body: Self.profileJSON()),
            .status(200, body: Self.patchEnvelope)
        ]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        vm.update(.firstName, to: "Alex")
        _ = await vm.save()
        XCTAssertEqual(vm.skills, ["Plumbing"])
        XCTAssertEqual(vm.savedSkills, ["Plumbing"])
    }

    // MARK: - Generate bio with AI

    func testGenerateBioWritesTheDraftIntoTheBioField() async throws {
        let vm = await loaded()
        SequencedURLProtocol.routeResponses[Self.draftPostPath] = [
            .status(200, body: "{\"draft\":{\"content\":\"Neighborly plumber in Portland.\"},\"clarifying_questions\":[]}")
        ]
        await vm.generateBio()

        XCTAssertEqual(vm.fields[.bio]?.value, "Neighborly plumber in Portland.")
        XCTAssertTrue(vm.fields[.bio]?.isDirty ?? false, "The draft must stay dirty-tracked so it rides the PATCH.")
        XCTAssertEqual(vm.bioDraftState, .idle)

        let posts = requests(to: Self.draftPostPath)
        XCTAssertEqual(posts.count, 1)
        XCTAssertEqual(posts[0].httpMethod, "POST")
        let prompt = try JSONDecoder().decode(DraftPostBody.self, from: body(of: posts[0])).text
        XCTAssertTrue(prompt.contains("Alice Doe"))
        XCTAssertTrue(prompt.contains("Builder of homes"))
        XCTAssertTrue(prompt.contains("Portland"))
        XCTAssertTrue(prompt.contains("Plumbing"))
    }

    func testGenerateBioFailureSurfacesInlineErrorAndKeepsTheTypedBio() async {
        let vm = await loaded()
        SequencedURLProtocol.routeResponses[Self.draftPostPath] = [.status(503, body: "{\"error\":\"AI_UNAVAILABLE\"}")]
        await vm.generateBio()

        XCTAssertEqual(vm.fields[.bio]?.value, "Hello world", "A failed draft must not blank the bio.")
        guard case .failed = vm.bioDraftState else {
            return XCTFail("Expected a failed draft state.")
        }
        vm.dismissBioDraftError()
        XCTAssertEqual(vm.bioDraftState, .idle)
    }

    func testGenerateBioIsDisabledWhenThereIsNothingToPromptWith() async {
        let vm = await loaded(
            user: Self.userJSON(firstName: "", lastName: "", tagline: "", city: "", skills: "[]")
        )
        XCTAssertFalse(vm.canGenerateBio)
        await vm.generateBio()
        XCTAssertEqual(requests(to: Self.draftPostPath).count, 0, "A CTA the route would 400 on must not fire.")
        guard case .failed = vm.bioDraftState else {
            return XCTFail("Expected an explanatory failed state, not a silent no-op.")
        }
    }

    func testGenerateBioPromptIsClampedToTheRouteLimit() async {
        let manySkills = (0..<50).map { "\"skill-\(String(repeating: "x", count: 90))-\($0)\"" }.joined(separator: ",")
        let vm = await loaded(user: Self.userJSON(skills: "[\(manySkills)]"))
        XCTAssertLessThanOrEqual(
            vm.bioPrompt().count,
            EditProfileViewModel.maxBioPromptLength,
            "Joi caps `text` at 2000 (`backend/routes/ai.js:82`)."
        )
    }
}

// MARK: - Helpers

private extension Data {
    /// Read an `InputStream` to EOF — `URLProtocol` exposes request
    /// bodies via `httpBodyStream` rather than `httpBody`.
    init(readingStream stream: InputStream) {
        var data = Data()
        stream.open()
        defer { stream.close() }
        let bufferSize = 4096
        var buffer = [UInt8](repeating: 0, count: bufferSize)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        self = data
    }
}
