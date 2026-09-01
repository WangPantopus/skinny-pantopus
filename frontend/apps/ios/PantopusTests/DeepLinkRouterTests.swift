//
//  DeepLinkRouterTests.swift
//  PantopusTests
//

// One file per router, split into classes by concern (routing table /
// batch-2 seam / aliases / signed-out gate) so no single type body grows
// past the limit. Mirrors Android `DeepLinkRouterTest`.
// swiftlint:disable file_length

import XCTest
@testable import Pantopus

@MainActor
final class DeepLinkRouterTests: XCTestCase {
    /// WS1.4 gated `.content` destinations behind the session check: signed-out
    /// links are stashed for post-login replay instead of published to
    /// `pending`. These cases describe a signed-in user's routing, so bind the
    /// seam rather than depending on whatever session the test host happens to
    /// hold. Mirrors Android `DeepLinkRouterTest.setUp`.
    override func setUp() {
        super.setUp()
        DeepLinkRouter.bindSignedInProvider { true }
        DeepLinkRouter.shared.clearPending() // pending + prefersLoginPresentation
        PendingDeepLinkStore.clear()
    }

    override func tearDown() {
        DeepLinkRouter.bindSignedInProvider(nil)
        DeepLinkRouter.shared.clearPending()
        PendingDeepLinkStore.clear()
        super.tearDown()
    }

    func testCustomSchemeFeed() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://feed"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .feed)
    }

    func testHTTPSHost() throws {
        let url = try XCTUnwrap(URL(string: "https://pantopus.app/home"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .home)
    }

    func testPostIDExtracted() throws {
        let url = try XCTUnwrap(URL(string: "https://pantopus.app/posts/abc-123"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .post(id: "abc-123"))
    }

    func testConversationIDExtracted() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://messages/conv_42"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .conversation(id: "conv_42"))
    }

    func testUnknownPathFallsBack() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://wat"))
        if case let .unknown(captured) = DeepLinkRouter.shared.resolve(url: url) {
            XCTAssertEqual(captured, url)
        } else {
            XCTFail("Expected .unknown")
        }
    }

    func testConsumeClearsPending() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://feed"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertNotNil(DeepLinkRouter.shared.consume())
        XCTAssertNil(DeepLinkRouter.shared.pending)
        XCTAssertNil(DeepLinkRouter.shared.consume())
    }

    func testInviteTokenCustomScheme() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://invite/abc-123"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .invite(token: "abc-123"))
    }

    func testInviteTokenHTTPSHost() throws {
        let url = try XCTUnwrap(URL(string: "https://pantopus.app/invite/xyz789"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .invite(token: "xyz789"))
    }

    func testInviteWithoutTokenFallsBack() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://invite"))
        // WS1.4 classifies `.unknown` as `.discard`, so it is deliberately
        // never published to `pending`. Assert the classification itself —
        // this mirrors Android, whose equivalent cases assert `resolveString`.
        if case .unknown = DeepLinkRouter.shared.resolve(url: url) {
            // ok
        } else {
            XCTFail("Expected .unknown when /invite is missing the token")
        }
    }

    // MARK: - T4.1 routing table (docs/07-frontend-mobile-app.md §9)

    func testSupportTrainRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/support-trains/st_1")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .supportTrain(id: "st_1"))
    }

    /// A13.13 — `pantopus://support-trains/:id/manage` lands on the
    /// organizer-only Manage Train surface. Bare `support-trains/:id`
    /// keeps landing on the A10.9 participant detail.
    func testSupportTrainManageRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://support-trains/st_1/manage")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .supportTrainManage(id: "st_1"))
    }

    func testSupportTrainManageRouteHttpsForm() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/support-trains/st_1/manage")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .supportTrainManage(id: "st_1"))
    }

    func testGigRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://gig/g_42")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .gig(id: "g_42"))
    }

    func testListingRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/listing/l_99")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .listing(id: "l_99"))
    }

    func testHomeDetailRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/homes/h_1")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .homeDetail(id: "h_1"))
    }

    func testHomeDashboardRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/homes/h_1/dashboard")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .homeDashboard(id: "h_1"))
    }

    func testHomeMemberRequestsRoute() throws {
        try DeepLinkRouter.shared.handle(
            url: XCTUnwrap(URL(string: "https://pantopus.app/homes/h_1/members?tab=requests"))
        )
        XCTAssertEqual(DeepLinkRouter.shared.pending, .homeMemberRequests(id: "h_1"))
    }

    func testHomeMembersWithoutRequestsTabFallsBackToDetail() throws {
        try DeepLinkRouter.shared.handle(
            url: XCTUnwrap(URL(string: "https://pantopus.app/homes/h_1/members"))
        )
        XCTAssertEqual(DeepLinkRouter.shared.pending, .homeDetail(id: "h_1"))
    }

    func testHomeOwnersTransferRoute() throws {
        try DeepLinkRouter.shared.handle(
            url: XCTUnwrap(URL(string: "pantopus://homes/h_1/owners/transfer"))
        )
        XCTAssertEqual(DeepLinkRouter.shared.pending, .homeOwnersTransfer(id: "h_1"))
    }

    func testHomeOwnersTransferRouteHTTPSHost() throws {
        try DeepLinkRouter.shared.handle(
            url: XCTUnwrap(URL(string: "https://pantopus.app/homes/h_2/owners/transfer"))
        )
        XCTAssertEqual(DeepLinkRouter.shared.pending, .homeOwnersTransfer(id: "h_2"))
    }

    /// A10.6 — the **public** profile lives at the singular `business/:username`.
    /// (Plural `businesses/:id` is the A10.7 owner view — see
    /// `testBusinessOwnerRoute` in the B1.6 section.)
    func testBusinessProfileRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/business/biz_42")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .businessProfile(businessId: "biz_42"))
    }

    func testEditBusinessPageRoute() throws {
        try DeepLinkRouter.shared.handle(
            url: XCTUnwrap(URL(string: "pantopus://businesses/biz_42/page-editor"))
        )
        XCTAssertEqual(DeepLinkRouter.shared.pending, .editBusinessPage(businessId: "biz_42"))
    }

    func testChatRouteUsesConversationCase() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://chat/room_1")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .conversation(id: "room_1"))
    }

    func testUserRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/user/u_demo")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .user(id: "u_demo"))
    }

    func testConnectionsRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://connections")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .connections)
    }

    func testNotificationsRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://notifications")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .notifications)
    }

    // MARK: - A10.10 P3.2 — wallet deep link

    func testWalletRouteCustomScheme() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://wallet")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .wallet)
    }

    func testWalletRouteHTTPSHost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/wallet")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .wallet)
    }

    func testCreateBusinessRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://businesses/new")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .createBusiness)
    }

    func testCreateBusinessHTTPSHost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/businesses/new")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .createBusiness)
    }

    // MARK: - P5.2 / A14.6 — Settings → Payments deep link

    func testPaymentsSettingsCustomScheme() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://settings/payments")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .paymentsSettings)
    }

    func testPaymentsSettingsHTTPSHost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/settings/payments")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .paymentsSettings)
    }

    func testSettingsWithoutSubrouteFallsBack() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://settings"))
        if case let .unknown(captured) = DeepLinkRouter.shared.resolve(url: url) {
            XCTAssertEqual(captured, url)
        } else {
            XCTFail("Bare /settings should fall back to .unknown")
        }
    }

    // MARK: - A14.8 Vacation hold

    func testVacationHoldRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://mailbox/vacation")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .vacationHold)
    }

    func testVacationHoldHTTPSHost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/mailbox/vacation")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .vacationHold)
    }

    func testMailboxRootWithoutVacationFallsBack() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://mailbox"))
        // WS1.4 classifies `.unknown` as `.discard`, so it is deliberately
        // never published to `pending`. Assert the classification itself —
        // this mirrors Android, whose equivalent cases assert `resolveString`.
        if case .unknown = DeepLinkRouter.shared.resolve(url: url) {
            // ok — only the `/vacation` sub-path is wired today.
        } else {
            XCTFail("Expected .unknown for bare /mailbox path")
        }
    }

    // MARK: - T6.1c P5 — auth deep links

    func testResetPasswordCustomScheme() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://auth/reset-password?token=hashed-recovery"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .resetPassword(token: "hashed-recovery"))
    }

    func testResetPasswordHTTPSHost() throws {
        let url = try XCTUnwrap(URL(string: "https://pantopus.app/auth/reset-password?token=abc-123"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .resetPassword(token: "abc-123"))
    }

    func testResetPasswordWithoutTokenFallsBack() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://auth/reset-password"))
        // WS1.4 classifies `.unknown` as `.discard`, so it is deliberately
        // never published to `pending`. Assert the classification itself —
        // this mirrors Android, whose equivalent cases assert `resolveString`.
        if case .unknown = DeepLinkRouter.shared.resolve(url: url) {
            // ok
        } else {
            XCTFail("Expected .unknown when /auth/reset-password is missing the token")
        }
    }

    func testResetPasswordAcceptsBareShape() throws {
        // The backend's older recovery template emits `/reset-password?token=…`
        // without the `/auth/` prefix — must still route.
        let url = try XCTUnwrap(URL(string: "pantopus://reset-password?token=bare-shape-tok"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .resetPassword(token: "bare-shape-tok"))
    }

    func testResetPasswordAcceptsTokenHashParam() throws {
        // Supabase's older email template uses `token_hash` as the param
        // name; we accept both shapes.
        let url = try XCTUnwrap(URL(string: "pantopus://auth/reset-password?token_hash=hash-shape"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .resetPassword(token: "hash-shape"))
    }

    func testVerifyEmailCustomScheme() throws {
        let url = try XCTUnwrap(
            URL(string: "pantopus://auth/verify-email?token=hashed-otp&email=alice%40example.com")
        )
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(
            DeepLinkRouter.shared.pending,
            .verifyEmail(token: "hashed-otp", email: "alice@example.com")
        )
    }

    func testVerifyEmailHTTPSHost() throws {
        let url = try XCTUnwrap(URL(string: "https://pantopus.app/auth/verify-email?token=tok"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .verifyEmail(token: "tok", email: nil))
    }

    func testVerifyEmailWithoutTokenFallsBack() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://auth/verify-email"))
        // WS1.4 classifies `.unknown` as `.discard`, so it is deliberately
        // never published to `pending`. Assert the classification itself —
        // this mirrors Android, whose equivalent cases assert `resolveString`.
        if case .unknown = DeepLinkRouter.shared.resolve(url: url) {
            // ok
        } else {
            XCTFail("Expected .unknown when /auth/verify-email is missing the token")
        }
    }

    // MARK: - A13.16 My Mail Day

    func testMailDayCustomScheme() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://mailbox/mailday"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .mailDay)
    }

    func testMailDayHTTPSHost() throws {
        let url = try XCTUnwrap(URL(string: "https://pantopus.app/mailbox/mailday"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .mailDay)
    }

    func testMailboxRootWithoutSubrouteFallsBack() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://mailbox"))
        // WS1.4 classifies `.unknown` as `.discard`, so it is deliberately
        // never published to `pending`. Assert the classification itself —
        // this mirrors Android, whose equivalent cases assert `resolveString`.
        if case .unknown = DeepLinkRouter.shared.resolve(url: url) {
            // ok — bare `pantopus://mailbox` is not a typed destination today.
        } else {
            XCTFail("Expected .unknown for bare /mailbox")
        }
    }

    // MARK: - Path entry point (notification payload `link` field)

    func testHandlePathBoxesAbsolutePathIntoRouter() {
        DeepLinkRouter.shared.handle(path: "/post/abc-123")
        XCTAssertEqual(DeepLinkRouter.shared.pending, .post(id: "abc-123"))
    }

    func testHandlePathBoxesRelativeIntoRouter() {
        DeepLinkRouter.shared.handle(path: "gig/g_5")
        XCTAssertEqual(DeepLinkRouter.shared.pending, .gig(id: "g_5"))
    }

    func testHandlePathPassesThroughFullURLs() {
        DeepLinkRouter.shared.handle(path: "https://pantopus.app/user/u_1")
        XCTAssertEqual(DeepLinkRouter.shared.pending, .user(id: "u_1"))
    }

    // MARK: - Verify-landlord routes (P2.1 / A12.5–A12.7)

    func testVerifyLandlordCustomScheme() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://homes/h_42/verify-landlord"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .verifyLandlord(id: "h_42"))
    }

    func testVerifyLandlordUnderscoreShape() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://homes/h_42/verify_landlord"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .verifyLandlord(id: "h_42"))
    }

    func testPostcardVerificationDeepLink() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://homes/h_42/verify-postcard"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .postcardVerification(id: "h_42"))
    }

    func testVerifyLandlordHttpsHost() throws {
        let url = try XCTUnwrap(URL(string: "https://pantopus.app/homes/h_42/verify-landlord"))
        DeepLinkRouter.shared.handle(url: url)
        XCTAssertEqual(DeepLinkRouter.shared.pending, .verifyLandlord(id: "h_42"))
    }
}

/// B1.6 batch-2 routing seam — split into its own class so the original
/// `DeepLinkRouterTests` body stays under SwiftLint's `type_body_length`.
@MainActor
final class DeepLinkRouterBatch2Tests: XCTestCase {
    override func setUp() {
        super.setUp()
        DeepLinkRouter.bindSignedInProvider { true }
        DeepLinkRouter.shared.clearPending() // pending + prefersLoginPresentation
        PendingDeepLinkStore.clear()
    }

    override func tearDown() {
        DeepLinkRouter.bindSignedInProvider(nil)
        DeepLinkRouter.shared.clearPending()
        PendingDeepLinkStore.clear()
        super.tearDown()
    }

    func testStampsRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://mailbox/stamps")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .stamps)
    }

    func testStampsRouteHTTPSHost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/mailbox/stamps")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .stamps)
    }

    func testMailTaskRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://mailbox/tasks/t_7")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .mailTask(taskId: "t_7"))
    }

    func testMailTaskWithoutIdFallsBack() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://mailbox/tasks"))
        // WS1.4 classifies `.unknown` as `.discard`, so it is deliberately
        // never published to `pending`. Assert the classification itself —
        // this mirrors Android, whose equivalent cases assert `resolveString`.
        if case .unknown = DeepLinkRouter.shared.resolve(url: url) {
            // ok — `mailbox/tasks` with no id has no typed destination.
        } else {
            XCTFail("Expected .unknown when /mailbox/tasks is missing the id")
        }
    }

    func testMailTranslationRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://mailbox/translation?id=m_3")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .mailTranslation(mailId: "m_3"))
    }

    func testUnboxingRouteWithoutId() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://mailbox/unboxing")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .unboxing(mailId: nil))
    }

    func testUnboxingRouteWithId() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://mailbox/unboxing?id=m_9")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .unboxing(mailId: "m_9"))
    }

    func testEarnRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://mailbox/earn")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .earn)
    }

    func testEarnRouteHTTPSHost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/mailbox/earn")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .earn)
    }

    /// A10.7 — plural `businesses/:id` resolves to the owner view; `new` and
    /// `:id/page-editor` keep their existing meanings.
    func testBusinessOwnerRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://businesses/biz_42")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .businessOwner(businessId: "biz_42"))
    }

    func testBusinessOwnerRouteHTTPSHost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/businesses/biz_42")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .businessOwner(businessId: "biz_42"))
    }

    func testViewAsRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://identity/preview")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .viewAs)
    }

    func testViewAsRouteHTTPSHost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/identity/preview")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .viewAs)
    }

    func testWaitingRoomRoute() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://homes/h_5/waiting-room")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .waitingRoom(id: "h_5"))
    }

    func testWaitingRoomRouteHTTPSHost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/homes/h_5/waiting-room")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .waitingRoom(id: "h_5"))
    }
}

/// Short-link aliases (`/@handle`, `/persona/:handle`, `/u/:username`,
/// `/b/:username`, `/broadcast/:id`, `/join/:code`). Mirrors the Android
/// alias cases in `DeepLinkRouterTest`.
@MainActor
final class DeepLinkRouterAliasTests: XCTestCase {
    override func setUp() {
        super.setUp()
        DeepLinkRouter.bindSignedInProvider { true }
        DeepLinkRouter.shared.clearPending()
        PendingDeepLinkStore.clear()
    }

    override func tearDown() {
        DeepLinkRouter.bindSignedInProvider(nil)
        DeepLinkRouter.shared.clearPending()
        PendingDeepLinkStore.clear()
        super.tearDown()
    }

    /// `/persona/:handle` is the public Beacon profile on both platforms —
    /// it must not fall through to the generic `.user` surface.
    func testPersonaRouteResolvesToBeaconProfile() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://persona/mariak")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .beaconProfile(handle: "mariak"))
    }

    func testPersonaRouteHTTPSHost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/persona/mariak")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .beaconProfile(handle: "mariak"))
    }

    /// `URL(string:)` reads `@` as the userinfo delimiter, so the custom-scheme
    /// alias only survives because the router parses the raw authority.
    func testHandleAliasCustomScheme() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://@mariak")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .beaconProfile(handle: "mariak"))
    }

    func testHandleAliasHTTPSHost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/@mariak")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .beaconProfile(handle: "mariak"))
    }

    func testJoinRouteResolvesToJoinInvite() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://join/CODE-7")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .joinInvite(code: "CODE-7"))
    }

    /// The invite the backend hands out is an `https://pantopus.com/join/<code>`
    /// link. Until that domain was claimed and `/join/*` was added to the AASA,
    /// tapping one only ever opened a browser.
    func testHTTPSJoinLinkResolvesToJoinInvite() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.com/join/CODE-7")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .joinInvite(code: "CODE-7"))
    }

    /// Share links are built on the claimed domain — see `GigDetailViewModel.shareURL`.
    func testHTTPSGigShareLinkResolvesToGig() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.com/gigs/g_3")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .gig(id: "g_3"))
    }

    func testShortUserAlias() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://u/u_demo")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .user(id: "u_demo"))
    }

    func testShortBusinessAlias() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://b/biz_42")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .businessProfile(businessId: "biz_42"))
    }

    func testBroadcastAliasResolvesToPost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://broadcast/p_1")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .post(id: "p_1"))
    }

    func testBroadcastsAliasResolvesToPost() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://broadcasts/p_1")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .post(id: "p_1"))
    }

    /// There is no `/local/:handle` route on either platform.
    func testLocalRouteFallsBackToUnknown() throws {
        let url = try XCTUnwrap(URL(string: "pantopus://local/mariak"))
        if case .unknown = DeepLinkRouter.shared.resolve(url: url) {
            // ok
        } else {
            XCTFail("`/local` is not a route on either platform")
        }
    }
}

/// WS1.4 — the signed-out gate on `.content` destinations. Mirrors the
/// Android cases in `DeepLinkRouterTest`.
@MainActor
final class DeepLinkRouterSignedOutTests: XCTestCase {
    override func setUp() {
        super.setUp()
        DeepLinkRouter.bindSignedInProvider { false }
        DeepLinkRouter.shared.clearPending()
        PendingDeepLinkStore.clear()
    }

    override func tearDown() {
        DeepLinkRouter.bindSignedInProvider(nil)
        DeepLinkRouter.shared.clearPending()
        PendingDeepLinkStore.clear()
        super.tearDown()
    }

    func testSignedOutContentIsStashedAndNotPending() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://post/abc-123")))
        XCTAssertNil(DeepLinkRouter.shared.pending, "content must not publish while signed out")
        XCTAssertEqual(PendingDeepLinkStore.peek(), "pantopus://post/abc-123")
        XCTAssertTrue(DeepLinkRouter.shared.prefersLoginPresentation)
    }

    func testSignedOutHTTPSContentIsStashedInNormalizedForm() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/post/abc-123")))
        XCTAssertNil(DeepLinkRouter.shared.pending)
        XCTAssertEqual(PendingDeepLinkStore.peek(), "pantopus://post/abc-123")
    }

    /// The stashed form must stay percent-encoded — rebuilding it from the
    /// decoded path components would turn an encoded `/` inside an id into a
    /// real separator and replay a different link.
    func testSignedOutHTTPSContentKeepsPercentEncoding() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "https://pantopus.app/post/a%2Fb")))
        XCTAssertEqual(PendingDeepLinkStore.peek(), "pantopus://post/a%2Fb")
    }

    func testSignedOutAuthOwnedPublishesAndIsNotPersisted() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://reset-password?token=t_1")))
        XCTAssertEqual(DeepLinkRouter.shared.pending, .resetPassword(token: "t_1"))
        XCTAssertTrue(DeepLinkRouter.shared.prefersLoginPresentation)
        XCTAssertNil(PendingDeepLinkStore.peek(), "auth-owned links must not survive process death")
    }

    func testSignedOutUnknownIsDiscardedEntirely() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://not-a-real-route")))
        XCTAssertNil(DeepLinkRouter.shared.pending)
        XCTAssertNil(PendingDeepLinkStore.peek())
        XCTAssertFalse(DeepLinkRouter.shared.prefersLoginPresentation)
    }

    /// The `!signedIn -> signedIn` replay that `RootView` performs.
    func testStashedLinkReplaysOnceSignedIn() throws {
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: "pantopus://post/abc-123")))
        XCTAssertNil(DeepLinkRouter.shared.pending)

        DeepLinkRouter.bindSignedInProvider { true }
        DeepLinkRouter.shared.acknowledgeLoginPresentation()
        let replayed = try XCTUnwrap(PendingDeepLinkStore.take())
        try DeepLinkRouter.shared.handle(url: XCTUnwrap(URL(string: replayed)))

        XCTAssertEqual(DeepLinkRouter.shared.pending, .post(id: "abc-123"))
        XCTAssertNil(PendingDeepLinkStore.peek(), "the stash is one-shot")
    }
}
