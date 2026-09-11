import XCTest
@testable import Pantopus

@MainActor
final class DeepLinkDiagnosticsTests: XCTestCase {
    override func setUp() {
        super.setUp()
        DeepLinkRouter.bindSignedInUserIDProvider { "diagnostics-user" }
        PendingDeepLinkStore.clear()
    }

    override func tearDown() {
        DeepLinkRouter.bindSignedInUserIDProvider(nil)
        PendingDeepLinkStore.clear()
        super.tearDown()
    }

    func testAuthLinksPreserveTokensForRoutingButEmitOnlyTheirCategory() throws {
        let cases: [(String, DeepLinkRouter.Destination)] = [
            ("pantopus://auth/reset-password?token=recovery-secret", .resetPassword(token: "recovery-secret")),
            ("https://pantopus.app/auth/reset-password?token_hash=hashed-secret", .resetPassword(token: "hashed-secret")),
            (
                "pantopus://auth/verify-email?token=otp-secret&email=alice%40example.com",
                .verifyEmail(token: "otp-secret", email: "alice@example.com")
            ),
            ("pantopus://join/private-invite-code", .joinInvite(code: "private-invite-code"))
        ]
        for (link, expected) in cases {
            var diagnostics: [String] = []
            let router = DeepLinkRouter { diagnostics.append($0) }
            try router.handle(url: XCTUnwrap(URL(string: link)))
            XCTAssertEqual(router.pending, expected)
            XCTAssertEqual(diagnostics, ["authOwned"])
        }
    }

    func testNotificationAndInvitationPathsKeepTheirTargetsOutOfDiagnostics() {
        let cases: [(String, DeepLinkRouter.Destination)] = [
            ("/post/private-post-id", .post(id: "private-post-id")),
            ("/chat/private-room?name=Private%20Person", .conversation(id: "private-room")),
            ("/invite/private-token", .invite(token: "private-token")),
            ("/place/private-home?address=12%20Elm%20Street", .place(homeId: "private-home", slug: nil))
        ]
        for (link, expected) in cases {
            var diagnostics: [String] = []
            let router = DeepLinkRouter { diagnostics.append($0) }
            router.handle(path: link)
            XCTAssertEqual(router.pending, expected)
            XCTAssertEqual(diagnostics, ["content"])
        }
    }

    func testUnknownURLDoesNotEchoQueryPathFragmentOrCredentials() throws {
        var diagnostics: [String] = []
        let router = DeepLinkRouter { diagnostics.append($0) }
        try router.handle(url: XCTUnwrap(URL(string:
            "https://private-user:private-password@unrecognized.invalid/unknown/private-id?token=secret#private-fragment")))
        XCTAssertNil(router.pending)
        XCTAssertEqual(diagnostics, ["discard"])
    }

    func testOAuthCallbackBypassesContentDiagnostics() throws {
        var diagnostics: [String] = []
        let router = DeepLinkRouter { diagnostics.append($0) }
        try router.handle(url: XCTUnwrap(URL(string: "pantopus://auth/callback?code=private-code&state=private-state")))
        XCTAssertNil(router.pending)
        XCTAssertTrue(diagnostics.isEmpty)
    }

    func testSignedOutPostRetainsDeferredNavigationWithoutLoggingItsID() {
        DeepLinkRouter.bindSignedInUserIDProvider { nil }
        var diagnostics: [String] = []
        let router = DeepLinkRouter { diagnostics.append($0) }
        router.handle(path: "/post/deferred-private-post")
        XCTAssertNil(router.pending)
        XCTAssertTrue(router.prefersLoginPresentation)
        XCTAssertEqual(diagnostics, ["content"])
        XCTAssertEqual(PendingDeepLinkStore.take(), "pantopus://post/deferred-private-post")
    }
}
