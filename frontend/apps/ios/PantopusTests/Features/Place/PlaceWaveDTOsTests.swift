//
//  PlaceWaveDTOsTests.swift
//  PantopusTests
//
//  Decoding contract for the Wave endpoint DTOs that ride beside the
//  Place sections: the Mailbox Reality Check, the Record Watch, the
//  Real Rent benchmark, and Block Founders. They all carry vocabulary
//  enums that must fall back to safe constants rather than failing, so
//  a server-side addition cannot break an older build.
//

import XCTest
@testable import Pantopus

@MainActor
final class PlaceWaveDTOsTests: XCTestCase {
    private let decoder = JSONDecoder()

    func testDecodesMailboxCheck() throws {
        let json = """
        {"check":{"verdict":"needs_attention",
          "findings":[
            {"severity":"attention","title":"A unit number is missing","detail":"USPS confirms the building but expects a unit."},
            {"severity":"attention","title":"USPS lists this address as vacant","detail":"Ask your carrier to clear it."}],
          "physical":{"status":"proven","title":"Mail physically reaches this mailbox","detail":"A postcard was delivered here."},
          "checked_at":"2026-08-01T00:00:00.000Z"}}
        """
        let response = try decoder.decode(MailboxCheckResponse.self, from: Data(json.utf8))
        XCTAssertEqual(response.check.verdict, .needsAttention)
        XCTAssertEqual(response.check.findings.count, 2)
        XCTAssertEqual(response.check.findings[0].severity, .attention)
        XCTAssertEqual(response.check.physical.status, .proven)
    }

    func testMailboxVocabularyAdditionsFallBack() throws {
        // New verdicts/severities/physical statuses must degrade, not throw.
        let json = """
        {"check":{"verdict":"catastrophic",
          "findings":[{"severity":"apocalyptic","title":"t","detail":"d"}],
          "physical":{"status":"teleported","title":"t","detail":"d"},
          "checked_at":null}}
        """
        let response = try decoder.decode(MailboxCheckResponse.self, from: Data(json.utf8))
        XCTAssertEqual(response.check.verdict, .unknown)
        XCTAssertEqual(response.check.findings[0].severity, .info)
        XCTAssertEqual(response.check.physical.status, .notRun)
        XCTAssertNil(response.check.checkedAt)
    }

    func testDecodesResidencyClaimAndFallsBackOnNewVocabulary() throws {
        let json = """
        {"claims":[
          {"id":"c1","home_id":"h1","scope":"school_district",
           "statement":"Dana is a verified resident of Portland SD 1J.",
           "holder_name":"Dana","status":"active","claim_code":"ABCD-EFGH-JKMN-PQRS",
           "verify_url":"https://pantopus.com/verify-claim/ABCD-EFGH-JKMN-PQRS",
           "issued_at":"2026-08-25T00:00:00.000Z","expires_at":"2026-09-24T00:00:00.000Z",
           "revoked_at":null,"residency_verified_at":null,"view_count":3,"last_viewed_at":null},
          {"id":"c2","home_id":"h1","scope":"galactic_sector",
           "statement":"s","holder_name":"Dana","status":"superseded","claim_code":"AAAA-BBBB-CCCC-DDDD",
           "verify_url":"u","issued_at":"2026-08-25T00:00:00.000Z","expires_at":"2026-09-24T00:00:00.000Z",
           "revoked_at":null,"residency_verified_at":null,"view_count":0,"last_viewed_at":null}]}
        """
        let response = try decoder.decode(ResidencyClaimsResponse.self, from: Data(json.utf8))
        XCTAssertEqual(response.claims.count, 2)
        XCTAssertEqual(response.claims[0].scope, .known(.schoolDistrict))
        XCTAssertEqual(response.claims[0].status, .active)
        XCTAssertEqual(response.claims[0].viewCount, 3)
        // A scope or status this build has never heard of renders inert,
        // never as active, and never fails the list.
        XCTAssertEqual(response.claims[1].scope, .unknown("galactic_sector"))
        XCTAssertEqual(response.claims[1].status, .expired)
    }

    func testDecodesFridgeCardAndKeepsUnknownSections() throws {
        let json = """
        {"cards":[{"id":"f1","home_id":"h1","label":"Sitter card","status":"active",
          "card_code":"ABCD-EFGH-JKMN-PQRS","card_url":"https://pantopus.com/fridge-card/ABCD-EFGH-JKMN-PQRS",
          "content":{"address":{"line1":"1421 SE Oak St Unit B","city_state_zip":"Portland, OR 97214"},
            "sections":[
              {"key":"household","items":[{"label":"Mia (6)","note":"Peanut allergy"}]},
              {"key":"evacuation_routes","items":[{"label":"Meet","note":"At the oak tree"}]}]},
          "issued_at":"2026-08-25T00:00:00.000Z","revoked_at":null,"view_count":2,"last_viewed_at":null}]}
        """
        let response = try decoder.decode(FridgeCardsResponse.self, from: Data(json.utf8))
        let card = try XCTUnwrap(response.cards.first)
        XCTAssertEqual(card.status, .active)
        // The address block is server-derived and always present.
        XCTAssertEqual(card.content.address.line1, "1421 SE Oak St Unit B")
        XCTAssertEqual(card.content.sections.count, 2)
        XCTAssertEqual(card.content.sections[0].key, .known(.household))
        // A section key this build has never heard of still decodes and
        // still carries its items — household safety data never hides.
        XCTAssertEqual(card.content.sections[1].key, .unknown("evacuation_routes"))
        XCTAssertEqual(card.content.sections[1].items.first?.note, "At the oak tree")
    }

    func testDecodesRecordWatchWithEvaluation() throws {
        let json = """
        {"watch":{"id":"w1","home_id":"home-1","loan_recorded_month":"2023-03",
          "baseline_rate":6.6,"created_at":"2026-08-01T00:00:00.000Z",
          "evaluation":{"baseline_rate":6.6,"current_rate":5.7,"current_as_of":"2026-08-20",
            "delta_pp":-0.9,"refi_window":true}}}
        """
        let response = try decoder.decode(RecordWatchResponse.self, from: Data(json.utf8))
        let watch = try XCTUnwrap(response.watch)
        XCTAssertEqual(watch.loanRecordedMonth, "2023-03")
        let ev = try XCTUnwrap(watch.evaluation)
        XCTAssertEqual(ev.deltaPp, -0.9, accuracy: 0.0001)
        XCTAssertTrue(ev.refiWindow)
    }

    func testRecordWatchDecodesNullWatchAndNullEvaluation() throws {
        // GET with no watch is {"watch": null}; a watch whose rate
        // history is momentarily unreachable ships evaluation: null.
        let none = try decoder.decode(RecordWatchResponse.self, from: Data(#"{"watch":null}"#.utf8))
        XCTAssertNil(none.watch)

        let noEval = """
        {"watch":{"id":"w1","home_id":"home-1","loan_recorded_month":"2023-03",
          "baseline_rate":6.6,"created_at":"2026-08-01T00:00:00.000Z","evaluation":null}}
        """
        let response = try decoder.decode(RecordWatchResponse.self, from: Data(noEval.utf8))
        XCTAssertNil(try XCTUnwrap(response.watch).evaluation)
    }

    // MARK: - Real Rent (Wave 3, band D)

    /// The section arrives inside the intelligence envelope, so decode
    /// it the way production does — id routing included.
    private func realRentEnvelope(
        access: String = "available",
        status: String,
        reason: String = "null",
        data: String
    ) throws -> PlaceSectionEnvelope {
        let json = """
        {"id":"real_rent","group":"money_signals","band":"D","access":"\(access)",
         "status":"\(status)","as_of":null,"source":"Pantopus · verified neighbors on your block",
         "coverage":"partial","unavailable_reason":\(reason),"data":\(data)}
        """
        return try decoder.decode(PlaceSectionEnvelope.self, from: Data(json.utf8))
    }

    func testDecodesRealRentBuildingPayload() throws {
        // `building` is a first-class product state: progress toward the
        // block's own benchmark, with no amounts anywhere in the payload.
        let env = try realRentEnvelope(status: "partial", data: """
        {"state":"building","reports":4,"needed":10,"scope":null,"bedrooms":null,
         "sample_size":null,"rent_p25":null,"rent_median":null,"rent_p75":null,
         "your_rent":2400,"standing":null,
         "summary":"4 of 10 verified homes on your block have shared their rent."}
        """)
        XCTAssertEqual(env.id, .realRent)
        XCTAssertEqual(env.band, .d)
        let data = try XCTUnwrap(env.realRent)
        XCTAssertEqual(data.state, .building)
        XCTAssertEqual(data.reports, 4)
        XCTAssertEqual(data.needed, 10)
        XCTAssertEqual(data.yourRent, 2400)
        XCTAssertNil(data.scope)
        XCTAssertNil(data.standing)
        XCTAssertNil(data.rentMedian)
        XCTAssertNil(data.sampleSize)
        XCTAssertTrue(data.summary.contains("4 of 10"))
    }

    func testDecodesRealRentReadyPayload() throws {
        let env = try realRentEnvelope(status: "ready", data: """
        {"state":"ready","reports":12,"needed":10,"scope":"bedrooms","bedrooms":2,
         "sample_size":12,"rent_p25":1950,"rent_median":2100,"rent_p75":2300,
         "your_rent":2400,"standing":"above_band",
         "summary":"12 verified 2-bedroom homes on your block pay a median of $2,100/mo."}
        """)
        let data = try XCTUnwrap(env.realRent)
        XCTAssertEqual(data.state, .ready)
        XCTAssertEqual(data.scope, .bedrooms)
        XCTAssertEqual(data.bedrooms, 2)
        XCTAssertEqual(data.sampleSize, 12)
        XCTAssertEqual(data.rentP25, 1950)
        XCTAssertEqual(data.rentMedian, 2100)
        XCTAssertEqual(data.rentP75, 2300)
        XCTAssertEqual(data.standing, .aboveBand)
    }

    func testRealRentUnknownVocabularyDegradesWithoutLosingTheSection() throws {
        // A state/scope/standing this build has never heard of must not
        // throw away the whole section — and an unknown STATE must never
        // land on `.ready`, which is the only state that shows amounts.
        let env = try realRentEnvelope(status: "ready", data: """
        {"state":"teleported","reports":3,"needed":10,"scope":"per_acre","bedrooms":null,
         "sample_size":null,"rent_p25":null,"rent_median":null,"rent_p75":null,
         "your_rent":null,"standing":"astral","summary":"s"}
        """)
        let data = try XCTUnwrap(env.realRent)
        XCTAssertEqual(data.state, .unknown)
        XCTAssertNotEqual(data.state, .ready)
        XCTAssertEqual(data.scope, .unknown)
        XCTAssertEqual(data.standing, .unknown)
        XCTAssertEqual(data.reports, 3)
    }

    func testRealRentLockedEnvelopeCarriesTheReasonAndNoData() throws {
        let env = try realRentEnvelope(
            access: "locked",
            status: "unavailable",
            reason: "\"Verify your address to see what your block actually pays.\"",
            data: "null"
        )
        XCTAssertEqual(env.access, .locked)
        XCTAssertNil(env.realRent)
        XCTAssertEqual(env.unavailableReason, "Verify your address to see what your block actually pays.")
    }

    func testDecodesRentReportAndNullReport() throws {
        let json = """
        {"report":{"monthly_rent":2400,"bedrooms":2,
          "reported_at":"2026-08-20T00:00:00.000Z","updated_at":"2026-08-25T00:00:00.000Z"}}
        """
        let report = try XCTUnwrap(try decoder.decode(RentReportResponse.self, from: Data(json.utf8)).report)
        XCTAssertEqual(report.monthlyRent, 2400)
        XCTAssertEqual(report.bedrooms, 2)

        let none = try decoder.decode(RentReportResponse.self, from: Data(#"{"report":null}"#.utf8))
        XCTAssertNil(none.report)
    }

    // MARK: - Block Founders (Wave 3)

    func testDecodesBlockStatusWithThreeMeters() throws {
        let json = """
        {"block":{"available":true,"rank":2,"established_at":"2026-08-25T00:00:00.000Z",
          "verified_count":7,"rent_reports":4,
          "meters":[
            {"id":"real_rent","label":"Real rents on your block","current":4,"needed":10,"unlocked":false},
            {"id":"bill_benchmark","label":"Bill benchmark","current":7,"needed":10,"unlocked":false},
            {"id":"block_growing","label":"Growing block status","current":7,"needed":25,"unlocked":false}],
          "invites_remaining":2,"invites_weekly_cap":3}}
        """
        let block = try decoder.decode(BlockStatusResponse.self, from: Data(json.utf8)).block
        XCTAssertTrue(block.available)
        XCTAssertEqual(block.rank, 2)
        XCTAssertEqual(block.verifiedCount, 7)
        // The real_rent meter reads RENT REPORTS, not verified homes —
        // the two readings are deliberately different numbers.
        XCTAssertEqual(block.rentReports, 4)
        let meters = try XCTUnwrap(block.meters)
        XCTAssertEqual(meters.map(\.id), ["real_rent", "bill_benchmark", "block_growing"])
        XCTAssertEqual(meters[0].current, 4)
        XCTAssertEqual(meters[1].current, 7)
        XCTAssertEqual(meters[2].needed, 25)
        XCTAssertEqual(block.invitesRemaining, 2)
        XCTAssertEqual(block.invitesWeeklyCap, 3)
    }

    func testBlockStatusUnavailableShapeDecodes() throws {
        // A home with no usable coordinates ships only these two keys.
        let json = #"{"block":{"available":false,"reason":"NO_COORDINATES"}}"#
        let block = try decoder.decode(BlockStatusResponse.self, from: Data(json.utf8)).block
        XCTAssertFalse(block.available)
        XCTAssertEqual(block.reason, "NO_COORDINATES")
        XCTAssertNil(block.rank)
        XCTAssertNil(block.meters)
        XCTAssertNil(block.invitesRemaining)
    }

    func testBlockInviteResultDecodesAndBudgetPatchIsLocal() throws {
        let result = try decoder.decode(
            BlockInviteResult.self,
            from: Data(#"{"sent":true,"invites_remaining":1}"#.utf8)
        )
        XCTAssertTrue(result.sent)
        XCTAssertEqual(result.invitesRemaining, 1)

        // The send's own budget replaces the panel's without a refetch,
        // so a momentary read failure can't collapse the form.
        let before = BlockStatus(available: true, rank: 2, invitesRemaining: 2, invitesWeeklyCap: 3)
        let after = before.withInvitesRemaining(result.invitesRemaining)
        XCTAssertEqual(after.invitesRemaining, 1)
        XCTAssertEqual(after.rank, 2)
        XCTAssertEqual(after.invitesWeeklyCap, 3)
    }

    // MARK: - The routes' own error codes, in the resident's terms

    /// `APIClient` maps 403 to `.forbidden` and DROPS the body, so the
    /// route's `VERIFICATION_REQUIRED` never survives as a parsable code.
    /// The gate is the whole product, so the copy has to name it rather
    /// than fall through to the generic "You don't have permission".
    func testRentWriteNamesTheVerificationGateOnA403() {
        let message = PlaceRealRentViewModel.writeFailureMessage(.forbidden, fallback: "Couldn't save your rent.")
        XCTAssertEqual(message, PlaceRealRentViewModel.verificationRequiredMessage)
        XCTAssertTrue(message.lowercased().contains("verify your address"))
        XCTAssertNotEqual(message, APIError.forbidden.errorDescription)

        // A 4xx that DOES keep its body is matched on the code too.
        let viaCode = PlaceRealRentViewModel.writeFailureMessage(
            .clientError(status: 400, message: #"{"error":"nope","code":"VERIFICATION_REQUIRED"}"#),
            fallback: "Couldn't save your rent."
        )
        XCTAssertEqual(viaCode, PlaceRealRentViewModel.verificationRequiredMessage)
    }

    /// 400 `BAD_AMOUNT` must surface the server's own sentence — it names
    /// the $50–$50,000/mo fence, which the client does not know.
    func testRentWriteSurfacesTheServersBadAmountSentence() {
        let message = PlaceRealRentViewModel.writeFailureMessage(
            .clientError(
                status: 400,
                message: #"{"error":"That monthly rent looks off — enter the amount you pay each month.","code":"BAD_AMOUNT"}"#
            ),
            fallback: "Couldn't save your rent."
        )
        XCTAssertEqual(message, "That monthly rent looks off — enter the amount you pay each month.")
    }

    func testInviteFailureMessagesMatchTheRoutesCodes() {
        let cap = PlaceBlockFoundersViewModel.inviteFailureMessage(
            .clientError(status: 429, message: #"{"code":"WEEKLY_CAP"}"#)
        )
        XCTAssertTrue(cap.contains("Three a week is the cap"))

        // Matched on the CODE even when the status is not the documented one.
        let capByCode = PlaceBlockFoundersViewModel.inviteFailureMessage(
            .clientError(status: 400, message: #"{"code":"WEEKLY_CAP"}"#)
        )
        XCTAssertEqual(capByCode, cap)

        // 502 is the mail vendor — a "try again", never the sender's fault,
        // and it must say nothing was mailed.
        let vendor = PlaceBlockFoundersViewModel.inviteFailureMessage(
            .server(status: 502, body: #"{"code":"SEND_FAILED"}"#)
        )
        XCTAssertTrue(vendor.contains("nothing was mailed"))

        XCTAssertTrue(
            PlaceBlockFoundersViewModel.inviteFailureMessage(.forbidden).lowercased().contains("verify your address")
        )
    }

    /// The ZIP fence the send button is gated on: 5 digits, or ZIP+4.
    func testInviteZipValidationAcceptsOnlyRealZips() {
        XCTAssertTrue(PlaceBlockFoundersViewModel.isZip("97214"))
        XCTAssertTrue(PlaceBlockFoundersViewModel.isZip("97214-1234"))
        XCTAssertFalse(PlaceBlockFoundersViewModel.isZip("9721"))
        XCTAssertFalse(PlaceBlockFoundersViewModel.isZip("97214-12"))
        XCTAssertFalse(PlaceBlockFoundersViewModel.isZip("ABCDE"))
        XCTAssertFalse(PlaceBlockFoundersViewModel.isZip(""))
    }

    /// Blank bedrooms mean "use the home's own count" — the server's
    /// fallback — so the field must be OMITTED, never sent as a zero that
    /// would file the report against studios.
    func testBlankBedroomsAreOmittedRatherThanSentAsZero() {
        XCTAssertNil(PlaceRealRentViewModel.parseBedrooms(""))
        XCTAssertNil(PlaceRealRentViewModel.parseBedrooms("   "))
        XCTAssertEqual(PlaceRealRentViewModel.parseBedrooms("0"), 0)
        XCTAssertEqual(PlaceRealRentViewModel.parseBedrooms("2"), 2)

        XCTAssertEqual(PlaceRealRentViewModel.parseRent("$2,400"), 2400)
        XCTAssertEqual(PlaceRealRentViewModel.parseRent("2400"), 2400)
        XCTAssertNil(PlaceRealRentViewModel.parseRent(""))
        XCTAssertNil(PlaceRealRentViewModel.parseRent("abc"))
    }
}
