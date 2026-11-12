//
//  MomentRingPreviewDTO.swift
//  Pantopus
//
//  A small look at a ring's newest Moment, drawn inside its pin on the map
//  (founder, 2026-11-11; contract v3.6, `GET /api/moments/map`, Route
//  backend/routes/moments.js:310, built in
//  backend/services/moments/momentStore.js `previewOf`). A photo or a video
//  carries a signed link to its small thumbnail (it lasts 15 minutes; the map
//  is read again every minute or so); a text card carries its background.
//  Rings with no location have none, and neither does an older server.
//
//  Looking at a preview is not watching the Moment: nothing is recorded, so
//  the viewer never shows in Seen by. The founder accepted that knowingly.
//

import Foundation

public struct MomentRingPreviewDTO: Codable, Sendable, Hashable {
    public let momentId: String
    public let kind: MomentKind
    public let thumbURL: URL?
    /// A text card's background name ("teal", "sky", "green", "amber", "rose", "slate").
    public let background: String?

    private enum CodingKeys: String, CodingKey {
        case kind, background
        case momentId = "moment_id"
        case thumbURL = "thumb_url"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        momentId = try c.decode(String.self, forKey: .momentId)
        kind = try c.decodeIfPresent(MomentKind.self, forKey: .kind) ?? .photo
        thumbURL = try (c.decodeIfPresent(String.self, forKey: .thumbURL)).flatMap { URL(string: $0) }
        background = try c.decodeIfPresent(String.self, forKey: .background)
    }

    /// Whether there is something to draw: a text card always has its colours, a picture needs its link.
    public var canShow: Bool {
        kind == .text || thumbURL != nil
    }
}

public extension MomentRingDTO {
    /// Moments not watched yet (the server's `unseen_count`, kept current as you watch).
    var unseenCount: Int {
        moments.filter { !$0.seen }.count
    }

    /// How the ring is drawn, per Moment: your own ring is never gray (the
    /// server sends your own Moments as seen, since your views aren't counted).
    var ringSeen: [Bool] {
        mine ? moments.map { _ in false } : moments.map(\.seen)
    }

    var isNew: Bool {
        unseenCount > 0
    }
}
