//
//  MailboxTranslationDTOs.swift
//  Pantopus
//
//  DTOs for the A17.13 mail-translation endpoint
//  (POST /api/mailbox/v2/p3/translate — backend/routes/mailboxV2Phase3.js:1643).
//
//  The screen itself is sample-data driven (real MT is out of scope, B2.3),
//  but the confirm action posts to the real endpoint so the wiring exists.
//  Every field is optional so a backend that omits or extends the payload
//  never fails the decode (and rolls the optimistic confirm back).
//

import Foundation

/// Response of the translate endpoint.
public struct TranslationResultDTO: Decodable, Sendable {
    /// The translated body text.
    public let translatedText: String?
    /// Detected / declared source language (e.g. "es" or "auto").
    public let fromLanguage: String?
    /// Target language (e.g. "en").
    public let toLanguage: String?
    /// Whether the translation was served from cache.
    public let cached: Bool?

    enum CodingKeys: String, CodingKey {
        case translatedText = "translated_text"
        case fromLanguage = "from_language"
        case toLanguage = "to_language"
        case cached
    }
}
