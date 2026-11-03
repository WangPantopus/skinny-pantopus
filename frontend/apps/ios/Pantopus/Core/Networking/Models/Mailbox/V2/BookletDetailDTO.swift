//
//  BookletDetailDTO.swift
//  Pantopus
//
//  Booklet sub-payload decoded from the V2 item's `mail.object_payload`
//  for `kind == "booklet"` (stored `mail_type == "book"`). The DTO is
//  defensive and `decode(from:)` returns nil if the payload doesn't
//  carry a single page URL.
//

import Foundation

/// Booklet detail payload — drives the FrameBooklet swiper + facts.
public struct BookletDetailDTO: Sendable, Hashable {
    public let pages: [URL]
    public let summary: String?
    public let pageCount: Int
    /// Per-page OCR transcripts, index-aligned with `pages`. Optional —
    /// the A17.2 OCR card only renders for pages that carry text.
    public let ocrTexts: [String]

    public init(pages: [URL], summary: String?, pageCount: Int, ocrTexts: [String] = []) {
        self.pages = pages
        self.summary = summary
        self.pageCount = pageCount
        self.ocrTexts = ocrTexts
    }

    public static func decode(from value: JSONValue?) -> BookletDetailDTO? {
        guard let dict = value?.dictValue else { return nil }
        let pageURLs: [URL] = (dict["pages"]?.arrayValue ?? [])
            .compactMap(\.stringValue)
            .compactMap(URL.init(string:))
        guard !pageURLs.isEmpty else { return nil }
        return BookletDetailDTO(
            pages: pageURLs,
            summary: dict["summary"]?.stringValue,
            pageCount: dict["page_count"]?.numberValue.map { Int($0) } ?? pageURLs.count,
            ocrTexts: (dict["ocr_texts"]?.arrayValue ?? []).compactMap(\.stringValue)
        )
    }
}
