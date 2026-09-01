//
//  EditProfileViewModelTests.swift
//  PantopusTests
//
//  Covers load, validation across every field in `updateProfileSchema`
//  (`backend/routes/users.js:324-351`), dirty tracking, save happy path,
//  save error, and the exact PATCH payload sent on commit.
//

import XCTest
@testable import Pantopus

@MainActor
final class EditProfileViewModelTests: XCTestCase {
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

    private static let userJSON = """
    {
      "id":"u1","email":"alice@example.com","username":"alice",
      "firstName":"Alice","middleName":"Q","lastName":"Doe","name":"Alice Q Doe",
      "phoneNumber":"+15555550123","dateOfBirth":"1990-04-12",
      "address":"123 Main St","city":"Portland","state":"OR","zipcode":"97201",
      "accountType":"personal","role":"user","verified":true,
      "residency":null,"avatar_url":null,"profile_picture_url":null,"profilePicture":null,
      "bio":"Hello world","tagline":"Builder of homes","socialLinks":{
        "website":"https://alice.dev","linkedin":null,"twitter":null,
        "instagram":null,"facebook":null
      },"skills":[],
      "followers_count":0,"average_rating":0,"gigs_posted":0,"gigs_completed":0,
      "profileVisibility":"public","createdAt":"2025-01-01T00:00:00Z","updatedAt":"2025-01-01T00:00:00Z"
    }
    """

    private static var profileJSON: String {
        "{\"user\":\(userJSON),\"invite_progress\":null}"
    }

    private static var patchEnvelope: String {
        "{\"message\":\"ok\",\"user\":\(userJSON)}"
    }

    private func loaded() async -> EditProfileViewModel {
        SequencedURLProtocol.sequence = [.status(200, body: Self.profileJSON)]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        return vm
    }

    // MARK: - Hydration

    func testLoadHydratesEveryField() async {
        let vm = await loaded()
        XCTAssertEqual(vm.fields[.firstName]?.value, "Alice")
        XCTAssertEqual(vm.fields[.middleName]?.value, "Q")
        XCTAssertEqual(vm.fields[.lastName]?.value, "Doe")
        XCTAssertEqual(vm.fields[.bio]?.value, "Hello world")
        XCTAssertEqual(vm.fields[.tagline]?.value, "Builder of homes")
        XCTAssertEqual(vm.fields[.phoneNumber]?.value, "+15555550123")
        XCTAssertEqual(vm.fields[.dateOfBirth]?.value, "1990-04-12")
        XCTAssertEqual(vm.fields[.address]?.value, "123 Main St")
        XCTAssertEqual(vm.fields[.city]?.value, "Portland")
        XCTAssertEqual(vm.fields[.state]?.value, "OR")
        XCTAssertEqual(vm.fields[.zipcode]?.value, "97201")
        XCTAssertEqual(vm.fields[.website]?.value, "https://alice.dev")
        XCTAssertEqual(vm.fields[.profileVisibility]?.value, "public")
        XCTAssertEqual(vm.email, "alice@example.com")
        XCTAssertTrue(vm.emailVerified)
        XCTAssertFalse(vm.isDirty)
        XCTAssertTrue(vm.isValid)
    }

    // MARK: - Validators

    func testRequiredFieldsRejectEmpty() async {
        let vm = await loaded()
        vm.update(.firstName, to: "")
        XCTAssertNotNil(vm.fields[.firstName]?.error)
        XCTAssertFalse(vm.isValid)
        vm.update(.firstName, to: "Alex")
        XCTAssertNil(vm.fields[.firstName]?.error)
        XCTAssertTrue(vm.isValid)
    }

    func testPhoneValidatorAcceptsE164AndEmpty() async {
        let vm = await loaded()
        vm.update(.phoneNumber, to: "555-0123")
        XCTAssertNotNil(vm.fields[.phoneNumber]?.error)
        vm.update(.phoneNumber, to: "+447700900123")
        XCTAssertNil(vm.fields[.phoneNumber]?.error)
        vm.update(.phoneNumber, to: "")
        XCTAssertNil(vm.fields[.phoneNumber]?.error, "Empty phone is allowed (optional).")
    }

    func testBioMaxLengthIs2000() async {
        let vm = await loaded()
        vm.update(.bio, to: String(repeating: "a", count: 2001))
        XCTAssertNotNil(vm.fields[.bio]?.error)
        vm.update(.bio, to: String(repeating: "a", count: 2000))
        XCTAssertNil(vm.fields[.bio]?.error)
    }

    func testTaglineMaxLengthIs255() async {
        let vm = await loaded()
        vm.update(.tagline, to: String(repeating: "a", count: 256))
        XCTAssertNotNil(vm.fields[.tagline]?.error)
        vm.update(.tagline, to: String(repeating: "a", count: 255))
        XCTAssertNil(vm.fields[.tagline]?.error)
    }

    func testAddressOptionalLengthBounds() async {
        let vm = await loaded()
        // Min 5 — "1234" is too short.
        vm.update(.address, to: "1234")
        XCTAssertNotNil(vm.fields[.address]?.error)
        // Empty is allowed (optional).
        vm.update(.address, to: "")
        XCTAssertNil(vm.fields[.address]?.error)
        // 256 chars is one over the max.
        vm.update(.address, to: String(repeating: "a", count: 256))
        XCTAssertNotNil(vm.fields[.address]?.error)
        vm.update(.address, to: "456 Oak Ave")
        XCTAssertNil(vm.fields[.address]?.error)
    }

    func testCityStateZipBounds() async {
        let vm = await loaded()
        vm.update(.city, to: "A")
        XCTAssertNotNil(vm.fields[.city]?.error)
        vm.update(.state, to: "O")
        XCTAssertNotNil(vm.fields[.state]?.error)
        vm.update(.zipcode, to: "ab")
        XCTAssertNotNil(vm.fields[.zipcode]?.error)
        vm.update(.city, to: "Seattle")
        vm.update(.state, to: "WA")
        vm.update(.zipcode, to: "98101")
        XCTAssertNil(vm.fields[.city]?.error)
        XCTAssertNil(vm.fields[.state]?.error)
        XCTAssertNil(vm.fields[.zipcode]?.error)
    }

    func testSocialURLValidator() async {
        let vm = await loaded()
        vm.update(.linkedin, to: "not-a-url")
        XCTAssertNotNil(vm.fields[.linkedin]?.error)
        vm.update(.linkedin, to: "ftp://bad.scheme")
        XCTAssertNotNil(vm.fields[.linkedin]?.error)
        vm.update(.linkedin, to: "https://linkedin.com/in/alice")
        XCTAssertNil(vm.fields[.linkedin]?.error)
        vm.update(.linkedin, to: "")
        XCTAssertNil(vm.fields[.linkedin]?.error, "Empty URL is allowed.")
    }

    func testDateOfBirthValidator() async {
        let vm = await loaded()
        vm.update(.dateOfBirth, to: "not-a-date")
        XCTAssertNotNil(vm.fields[.dateOfBirth]?.error)
        vm.update(.dateOfBirth, to: "1990-04-12")
        XCTAssertNil(vm.fields[.dateOfBirth]?.error)
        vm.update(.dateOfBirth, to: "")
        XCTAssertNil(vm.fields[.dateOfBirth]?.error)
    }

    func testProfileVisibilityRejectsUnknownValue() async {
        let vm = await loaded()
        vm.update(.profileVisibility, to: "stealth")
        XCTAssertNotNil(vm.fields[.profileVisibility]?.error)
        vm.update(.profileVisibility, to: "registered")
        XCTAssertNil(vm.fields[.profileVisibility]?.error)
    }

    // MARK: - Save flow

    func testSaveHappyPathPatchesAndSignalsDismiss() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.profileJSON),
            .status(200, body: Self.patchEnvelope)
        ]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        vm.update(.firstName, to: "Alex")
        _ = await vm.save()
        XCTAssertTrue(vm.shouldDismiss)
        XCTAssertEqual(vm.toast?.kind, .success)
    }

    func testSaveServerErrorSurfacesToast() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.profileJSON),
            .status(500, body: "{\"error\":\"down\"}")
        ]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        vm.update(.firstName, to: "Alex")
        _ = await vm.save()
        XCTAssertFalse(vm.shouldDismiss)
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    func testSaveWithInvalidFieldShakesAndDoesNotPatch() async {
        let vm = await loaded()
        vm.update(.firstName, to: "")
        let before = vm.shakeTrigger
        let captured = SequencedURLProtocol.capturedRequests.count
        _ = await vm.save()
        XCTAssertNotEqual(before, vm.shakeTrigger)
        XCTAssertFalse(vm.shouldDismiss)
        XCTAssertEqual(
            SequencedURLProtocol.capturedRequests.count,
            captured,
            "Invalid form must not issue a network call."
        )
    }

    // MARK: - Payload correctness

    /// Decodes the captured PATCH body so we can assert exact keys + values.
    private struct PatchBody: Decodable, Equatable {
        let firstName: String?
        let lastName: String?
        let middleName: String?
        let bio: String?
        let tagline: String?
        let phoneNumber: String?
        let dateOfBirth: String?
        let address: String?
        let city: String?
        let state: String?
        let zipcode: String?
        let website: String?
        let linkedin: String?
        let twitter: String?
        let instagram: String?
        let facebook: String?
        let profileVisibility: String?
    }

    private func decodedPatchBody(from request: URLRequest) throws -> PatchBody {
        // URLProtocol-stubbed sessions strip the body and expose it as
        // `httpBodyStream`. Read the stream end-to-end so the assertion
        // stays robust across iOS versions.
        let data: Data = if let body = request.httpBody {
            body
        } else if let stream = request.httpBodyStream {
            Data(reading: stream)
        } else {
            Data()
        }
        return try JSONDecoder().decode(PatchBody.self, from: data)
    }

    func testPatchBodyIncludesOnlyDirtyFields() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.profileJSON),
            .status(200, body: Self.patchEnvelope)
        ]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        vm.update(.firstName, to: "Alex")
        vm.update(.bio, to: "Hello world!")
        _ = await vm.save()

        // [0] is GET, [1] is PATCH.
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
        let patch = SequencedURLProtocol.capturedRequests[1]
        XCTAssertEqual(patch.httpMethod, "PATCH")
        XCTAssertEqual(patch.url?.path, "/api/users/profile")

        let body = try decodedPatchBody(from: patch)
        XCTAssertEqual(body.firstName, "Alex")
        XCTAssertEqual(body.bio, "Hello world!")
        // Untouched keys must NOT be present in the body.
        XCTAssertNil(body.lastName)
        XCTAssertNil(body.phoneNumber)
        XCTAssertNil(body.dateOfBirth)
        XCTAssertNil(body.address)
        XCTAssertNil(body.profileVisibility)
    }

    func testClearingNullableFieldSubmitsEmptyString() async throws {
        // Bio allows '', so clearing it should send `bio: ""`.
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.profileJSON),
            .status(200, body: Self.patchEnvelope)
        ]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        vm.update(.bio, to: "")
        _ = await vm.save()
        let body = try decodedPatchBody(from: SequencedURLProtocol.capturedRequests[1])
        XCTAssertEqual(body.bio, "")
    }

    func testClearingNonNullableFieldIsOmittedFromPatch() async throws {
        // Address does NOT allow empty in the schema, so clearing must
        // be skipped from the PATCH (the user can't blank it out via this
        // form — see EditProfileViewModel.fieldAllowsEmpty).
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.profileJSON),
            .status(200, body: Self.patchEnvelope)
        ]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        vm.update(.address, to: "")
        // Need at least one effective change to enable save; pair with a
        // bio edit so the PATCH actually fires.
        vm.update(.bio, to: "still here")
        _ = await vm.save()
        let body = try decodedPatchBody(from: SequencedURLProtocol.capturedRequests[1])
        XCTAssertNil(body.address, "Empty address must be omitted from PATCH per schema.")
        XCTAssertEqual(body.bio, "still here")
    }

    // MARK: - Dirty tracking

    func testBuildRequestOnlyIncludesDirtyFields() async {
        let vm = await loaded()
        vm.update(.bio, to: "New bio")
        XCTAssertEqual(vm.dirtyFieldCount, 1)
        XCTAssertTrue(vm.fields[.bio]?.isDirty ?? false)
        XCTAssertFalse(vm.fields[.firstName]?.isDirty ?? true)
        XCTAssertFalse(vm.fields[.lastName]?.isDirty ?? true)
    }

    func testDirtyFieldCountTracksChangedFields() async {
        let vm = await loaded()
        XCTAssertEqual(vm.dirtyFieldCount, 0)
        vm.update(.firstName, to: "Alex")
        vm.update(.bio, to: "Hello world!")
        vm.update(.website, to: "https://alex.example")
        vm.update(.profileVisibility, to: "registered")
        XCTAssertEqual(vm.dirtyFieldCount, 4)
        vm.update(.firstName, to: "Alice")
        XCTAssertEqual(vm.dirtyFieldCount, 3)
    }

    func testDiscardChangesRestoresOriginalValuesAndClearsDirtyCount() async {
        let vm = await loaded()
        vm.update(.firstName, to: "Alex")
        vm.update(.bio, to: "Hello world!")
        XCTAssertEqual(vm.dirtyFieldCount, 2)
        vm.discardChanges()
        XCTAssertEqual(vm.fields[.firstName]?.value, "Alice")
        XCTAssertEqual(vm.fields[.bio]?.value, "Hello world")
        XCTAssertEqual(vm.dirtyFieldCount, 0)
        XCTAssertFalse(vm.isDirty)
    }
}

// MARK: - Helpers

private extension Data {
    /// Read an `InputStream` to EOF — used to surface request bodies that
    /// `URLProtocol` exposes via `httpBodyStream` rather than `httpBody`.
    init(reading stream: InputStream) {
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
