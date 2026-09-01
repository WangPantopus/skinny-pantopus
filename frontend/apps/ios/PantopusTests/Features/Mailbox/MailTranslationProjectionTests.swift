//
//  MailTranslationProjectionTests.swift
//  PantopusTests
//
//  A17.13 — the Translation screen now renders a real machine
//  translation instead of a fixture. These lock the projection from the
//  two live payloads (`GET /api/mailbox/:id` +
//  `POST /api/mailbox/v2/p3/translate`) onto the screen content.
//

import XCTest
@testable import Pantopus

@MainActor
final class MailTranslationProjectionTests: XCTestCase {
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

    private static let detailBody = """
    {"mail":{
      "id":"m1","type":"letter","mail_type":"letter",
      "subject":"Invitación",
      "content":"Querida vecina,\\nLe escribo para invitarla a la posada.",
      "sender_business_name":null,
      "sender_address":"Elm Park",
      "sender_trust":"pantopus_user",
      "tags":[],"priority":"normal",
      "created_at":"2026-05-15T12:00:00Z",
      "sender":{"id":"u2","username":"lucia","name":"Lucía Herrera"},
      "links":[]
    }}
    """

    private static let translateBody = """
    {"translated_text":"Dear neighbor,\\nI'm writing to invite you to the posada.",
     "from_language":"es","to_language":"en","cached":false}
    """

    private func decodeDetail() throws -> MailDetailResponse.MailDetail {
        let data = Data(Self.detailBody.utf8)
        return try JSONDecoder().decode(MailDetailResponse.self, from: data).mail
    }

    private func decodeTranslation() throws -> TranslationResultDTO {
        try JSONDecoder().decode(TranslationResultDTO.self, from: Data(Self.translateBody.utf8))
    }

    // MARK: - Projection

    func testProjectionRendersTranslatedTextAndDetectedLanguage() throws {
        let content = try MailTranslationProjection.project(
            mailId: "m1",
            detail: decodeDetail(),
            translation: decodeTranslation(),
            now: Date(timeIntervalSince1970: 1_778_000_000)
        )
        XCTAssertEqual(content.languages.sourceCode, "ES")
        XCTAssertEqual(content.languages.targetCode, "EN")
        XCTAssertEqual(content.languages.targetName, "English")
        // The backend reports no confidence — the badge must not invent one.
        XCTAssertNil(content.languages.confidence)
        XCTAssertEqual(content.paragraphs.count, 2)
        XCTAssertEqual(content.paragraphs.first?.original, "Querida vecina,")
        XCTAssertEqual(content.paragraphs.first?.english, "Dear neighbor,")
        XCTAssertEqual(content.sender.name, "Lucía Herrera")
        XCTAssertEqual(content.sender.initials, "LH")
        XCTAssertEqual(content.sender.kind, "Verified neighbor")
        // No translator-notes glossary exists on the wire.
        XCTAssertTrue(content.glossary.isEmpty)
        XCTAssertFalse(content.confirmed)
    }

    func testAlignParagraphsPadsTheShorterSide() {
        let rows = MailTranslationProjection.alignParagraphs(
            original: "uno\ndos\ntres",
            translated: "one\ntwo"
        )
        XCTAssertEqual(rows.count, 3)
        XCTAssertEqual(rows[2].original, "tres")
        XCTAssertEqual(rows[2].english, "")
    }

    func testAutoSourceLanguageReadsAsAutoDetected() throws {
        let body = """
        {"translated_text":"hi","from_language":"auto","to_language":"en","cached":true}
        """
        let translation = try JSONDecoder().decode(
            TranslationResultDTO.self,
            from: Data(body.utf8)
        )
        let languages = MailTranslationProjection.makeLanguages(translation: translation)
        XCTAssertEqual(languages.sourceCode, "AUTO")
        XCTAssertEqual(languages.sourceName, "Auto-detected")
        XCTAssertNil(languages.confidence)
    }

    // MARK: - Load

    func testLoadFetchesDetailThenTranslation() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.detailBody),
            .status(200, body: Self.translateBody)
        ]
        let vm = MailTranslationViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.mailId, "m1")
        XCTAssertEqual(content.languages.sourceName, "Spanish")
    }

    func testLoadFailureRendersRetryableError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = MailTranslationViewModel(mailId: "m1", api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error, got \(vm.state)")
            return
        }
    }
}
