//
//  ModelsCodingTests.swift
//  PantopusTests
//
//  Locks down the JSON shape contract for the Auth + Feed DTOs. More
//  granular coverage of every P3 DTO lives in `DTODecodingTests`.
//

import XCTest
@testable import Pantopus

final class ModelsCodingTests: XCTestCase {
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    func testDecodesLoginResponse() throws {
        let data = Data(Fixtures.loginJSON().utf8)
        let resp = try decoder.decode(LoginResponse.self, from: data)
        XCTAssertEqual(resp.accessToken, "at_test")
        XCTAssertEqual(resp.refreshToken, "rt_test")
        XCTAssertEqual(resp.user.email, "alice@example.com")
        XCTAssertEqual(resp.user.firstName, "Alice")
    }

    func testDecodesFeedResponse() throws {
        let data = Data(Fixtures.feedJSON.utf8)
        let feed = try decoder.decode(FeedResponse.self, from: data)
        XCTAssertEqual(feed.posts.count, 1)
        XCTAssertEqual(feed.posts.first?.creator?.displayName, "Alice Doe")
        XCTAssertEqual(feed.posts.first?.postType, "ask_local")
        XCTAssertEqual(feed.posts.first?.likeCount, 3)
        XCTAssertEqual(feed.pagination?.hasMore, false)
    }

    func testLoginResponseWithoutRefreshToken() throws {
        let data = Data(Fixtures.loginJSON(refreshToken: nil).utf8)
        let resp = try decoder.decode(LoginResponse.self, from: data)
        XCTAssertNil(resp.refreshToken)
        XCTAssertEqual(resp.accessToken, "at_test")
    }
}
