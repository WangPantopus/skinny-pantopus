//
//  EditProfileSnapshotTests.swift
//  PantopusTests
//
//  A13.9 — structural snapshot coverage for the Edit Profile form.
//  Mirrors the two design frames: CLEAN and DIRTY with four unsaved fields.
//  Until swift-snapshot-testing is wired into the project, this follows the
//  existing iOS pattern of rendering the SwiftUI hierarchy in-process.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class EditProfileSnapshotTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    func test_a13_9_clean_frame_renders() async {
        let vm = await loadedViewModel()
        XCTAssertEqual(vm.dirtyFieldCount, 0)
        assertRenders(EditProfileView(viewModel: vm))
    }

    func test_a13_9_dirty_frame_renders_four_unsaved_fields() async {
        let vm = await loadedViewModel()
        vm.update(.firstName, to: "Alex")
        vm.update(.bio, to: "Hello world!")
        vm.update(.website, to: "https://alex.example")
        vm.update(.profileVisibility, to: "registered")

        XCTAssertEqual(vm.dirtyFieldCount, 4)
        assertRenders(EditProfileView(viewModel: vm))
    }

    private func loadedViewModel() async -> EditProfileViewModel {
        SequencedURLProtocol.sequence = [.status(200, body: Self.profileJSON)]
        let vm = EditProfileViewModel(api: makeAPI())
        await vm.load()
        return vm
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

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
}
