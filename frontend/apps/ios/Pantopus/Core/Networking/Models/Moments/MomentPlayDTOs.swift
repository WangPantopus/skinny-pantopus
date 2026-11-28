//
//  MomentPlayDTOs.swift
//  Pantopus
//
//  Playable items on a Moment or a Studio post ("Pulse, reinvented" phase 2; CONTRACT 7b and 7g): a poll, a slider or
//  the spectrum dial, the board, the question box, guess and reveal, a countdown, a lifted quote, fog, a swatch and
//  before and after. Each sits on the picture as a stamp does (`x`, `y`, `scale`, `rotation`). The author sends them in
//  `POST /api/moments` as `play`; every Moment answer to a reader whose switch is on carries them back with what that
//  reader may see (`mine`, `results`, `open`). With the switch off the server sends no `play` key, and today's screens
//  show the plain picture and words.
//

import Foundation

/// One playable item, as the author placed it and as a reader reads it.
public struct MomentPlayItem: Codable, Sendable, Hashable, Identifiable {
    public enum Kind: String, Codable, Sendable {
        case poll, slider, board, question, guess, countdown, quote, fog, swatch
        case beforeAfter = "before_after"
        /// Moving words (CONTRACT 7k): drawn over the photo, never answered.
        case movingWords = "moving_words"
        /// A kind this app doesn't know yet (a newer server): never drawn.
        case unknown
    }

    public struct Axis: Codable, Sendable, Hashable {
        public var left: String?
        public var right: String?
        public var bottom: String?
        public var top: String?
    }

    public struct Range: Codable, Sendable, Hashable {
        public var min: Double
        public var max: Double
        public var unit: String?
    }

    public struct Box: Codable, Sendable, Hashable {
        public var x: Double
        public var y: Double
        public var w: Double
        public var h: Double
    }

    /// The reader's own answer, in the shape the kind's `PUT` takes; a guess adds whether it was right or how far off.
    public struct Mine: Codable, Sendable, Hashable {
        public var choice: Int?
        public var value: Double?
        public var x: Double?
        public var y: Double?
        public var note: String?
        public var text: String?
        public var right: Bool?
        public var offBy: Double?

        enum CodingKeys: String, CodingKey {
            case choice, value, x, y, note, text, right
            case offBy = "off_by"
        }
    }

    /// Someone on a board or along the dial: `person` only for the reader and their connections.
    public struct Face: Decodable, Sendable, Hashable {
        public let x: Double
        public let y: Double?
        public let note: String?
        public let mine: Bool
        public let person: MomentPlayPerson?
    }

    /// What this reader may see of everyone's answers (CONTRACT 7b, by kind).
    public struct Results: Decodable, Sendable, Hashable {
        public let counts: [Int]?
        public let total: Int?
        public let average: Double?
        public let count: Int?
        public let faces: [Face]?
    }

    public var id: String
    public var kind: Kind
    public var x: Double
    public var y: Double
    public var scale: Double
    public var rotation: Double
    public var question: String?
    public var options: [String]?
    public var left: String?
    public var right: String?
    /// A slider's look: `slider` or `dial`.
    public var look: String?
    public var emoji: String?
    public var xAxis: Axis?
    public var yAxis: Axis?
    public var prompt: String?
    public var range: Range?
    /// A guess's right answer: there only for its author and after the reader's try.
    public var answer: Double?
    public var title: String?
    public var endsAt: String?
    public var text: String?
    public var source: String?
    public var colors: [String]?
    public var box: Box?
    public var before: String?
    public var after: String?
    /// Moving words (CONTRACT 7k): the lettering's shared id, the motion, and `#RRGGBB`.
    public var lettering: String?
    public var motion: String?
    public var color: String?
    /// Read only: whether answers are taken now (never for the author), the reader's answer, and the results.
    public var open = false
    public var mine: Mine?
    public var results: Results?

    public init(id: String, kind: Kind, x: Double = 0.5, y: Double = 0.5, scale: Double = 1, rotation: Double = 0) {
        self.id = id
        self.kind = kind
        self.x = x
        self.y = y
        self.scale = scale
        self.rotation = rotation
    }

    enum CodingKeys: String, CodingKey {
        case id, kind, x, y, scale, rotation, question, options, left, right, look, emoji, prompt, range, answer, title
        case text, source, colors, box, before, after, open, mine, results, lettering, motion, color
        case xAxis = "x_axis"
        case yAxis = "y_axis"
        case endsAt = "ends_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kind = (try? c.decode(String.self, forKey: .kind)).flatMap(Kind.init(rawValue:)) ?? .unknown
        x = (try? c.decodeIfPresent(Double.self, forKey: .x)) ?? 0.5
        y = (try? c.decodeIfPresent(Double.self, forKey: .y)) ?? 0.5
        scale = (try? c.decodeIfPresent(Double.self, forKey: .scale)) ?? 1
        rotation = (try? c.decodeIfPresent(Double.self, forKey: .rotation)) ?? 0
        question = try? c.decodeIfPresent(String.self, forKey: .question)
        options = try? c.decodeIfPresent([String].self, forKey: .options)
        left = try? c.decodeIfPresent(String.self, forKey: .left)
        right = try? c.decodeIfPresent(String.self, forKey: .right)
        look = try? c.decodeIfPresent(String.self, forKey: .look)
        emoji = try? c.decodeIfPresent(String.self, forKey: .emoji)
        xAxis = try? c.decodeIfPresent(Axis.self, forKey: .xAxis)
        yAxis = try? c.decodeIfPresent(Axis.self, forKey: .yAxis)
        prompt = try? c.decodeIfPresent(String.self, forKey: .prompt)
        range = try? c.decodeIfPresent(Range.self, forKey: .range)
        answer = try? c.decodeIfPresent(Double.self, forKey: .answer)
        title = try? c.decodeIfPresent(String.self, forKey: .title)
        endsAt = try? c.decodeIfPresent(String.self, forKey: .endsAt)
        text = try? c.decodeIfPresent(String.self, forKey: .text)
        source = try? c.decodeIfPresent(String.self, forKey: .source)
        colors = try? c.decodeIfPresent([String].self, forKey: .colors)
        box = try? c.decodeIfPresent(Box.self, forKey: .box)
        before = try? c.decodeIfPresent(String.self, forKey: .before)
        after = try? c.decodeIfPresent(String.self, forKey: .after)
        lettering = try? c.decodeIfPresent(String.self, forKey: .lettering)
        motion = try? c.decodeIfPresent(String.self, forKey: .motion)
        color = try? c.decodeIfPresent(String.self, forKey: .color)
        open = (try? c.decodeIfPresent(Bool.self, forKey: .open)) ?? false
        mine = try? c.decodeIfPresent(Mine.self, forKey: .mine)
        results = try? c.decodeIfPresent(Results.self, forKey: .results)
    }

    /// What the author sends: the placement and the kind's own words; never what a reader reads back.
    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(kind.rawValue, forKey: .kind)
        try c.encode(x, forKey: .x)
        try c.encode(y, forKey: .y)
        try c.encode(scale, forKey: .scale)
        try c.encode(rotation, forKey: .rotation)
        try c.encodeIfPresent(question, forKey: .question)
        try c.encodeIfPresent(options, forKey: .options)
        try c.encodeIfPresent(left, forKey: .left)
        try c.encodeIfPresent(right, forKey: .right)
        try c.encodeIfPresent(look, forKey: .look)
        try c.encodeIfPresent(emoji, forKey: .emoji)
        try c.encodeIfPresent(xAxis, forKey: .xAxis)
        try c.encodeIfPresent(yAxis, forKey: .yAxis)
        try c.encodeIfPresent(prompt, forKey: .prompt)
        try c.encodeIfPresent(range, forKey: .range)
        try c.encodeIfPresent(answer, forKey: .answer)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(endsAt, forKey: .endsAt)
        try c.encodeIfPresent(text, forKey: .text)
        try c.encodeIfPresent(source, forKey: .source)
        try c.encodeIfPresent(colors, forKey: .colors)
        try c.encodeIfPresent(box, forKey: .box)
        try c.encodeIfPresent(before, forKey: .before)
        try c.encodeIfPresent(after, forKey: .after)
        try c.encodeIfPresent(lettering, forKey: .lettering)
        try c.encodeIfPresent(motion, forKey: .motion)
        try c.encodeIfPresent(color, forKey: .color)
    }
}

/// A dot on a thing in the photo (CONTRACT 7c, living objects): a note, a rating, a link, a thing to name (its field
/// card, 7d) or a voice whisper (7e). `x` and `y` are its place on the picture, 0 to 1 from the top left, as a stamp's.
public struct MomentDotDTO: Codable, Sendable, Hashable, Identifiable {
    public enum Kind: String, Codable, Sendable {
        case note, rating, link, thing, whisper
        /// A kind this app doesn't know yet: never drawn.
        case unknown
    }

    public var id: String
    public var kind: Kind
    public var x: Double
    public var y: Double
    /// A note's words (up to 140).
    public var text: String?
    /// A rating's subject, or a thing's own guess (up to 40).
    public var label: String?
    /// A rating's stars, 1 to 5.
    public var stars: Int?
    /// A link's https address and optional title.
    public var url: String?
    public var title: String?
    /// A thing's outline on the picture.
    public var box: MomentPlayItem.Box?
    /// Read only: a thing's kept field card, and a whisper's sound.
    public var card: MomentFieldCardDTO?
    public var audioURL: String?
    public var durationMs: Double?

    public init(id: String, kind: Kind, x: Double, y: Double) {
        self.id = id
        self.kind = kind
        self.x = x
        self.y = y
    }

    enum CodingKeys: String, CodingKey {
        case id, kind, x, y, text, label, stars, url, title, box, card
        case audioURL = "audio_url"
        case durationMs = "duration_ms"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kind = (try? c.decode(String.self, forKey: .kind)).flatMap(Kind.init(rawValue:)) ?? .unknown
        x = (try? c.decodeIfPresent(Double.self, forKey: .x)) ?? 0.5
        y = (try? c.decodeIfPresent(Double.self, forKey: .y)) ?? 0.5
        text = try? c.decodeIfPresent(String.self, forKey: .text)
        label = try? c.decodeIfPresent(String.self, forKey: .label)
        stars = try? c.decodeIfPresent(Int.self, forKey: .stars)
        url = try? c.decodeIfPresent(String.self, forKey: .url)
        title = try? c.decodeIfPresent(String.self, forKey: .title)
        box = try? c.decodeIfPresent(MomentPlayItem.Box.self, forKey: .box)
        card = try? c.decodeIfPresent(MomentFieldCardDTO.self, forKey: .card)
        audioURL = try? c.decodeIfPresent(String.self, forKey: .audioURL)
        durationMs = try? c.decodeIfPresent(Double.self, forKey: .durationMs)
    }

    /// What the author sends: its place and its kind's own fields.
    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(kind.rawValue, forKey: .kind)
        try c.encode(x, forKey: .x)
        try c.encode(y, forKey: .y)
        try c.encodeIfPresent(text, forKey: .text)
        try c.encodeIfPresent(label, forKey: .label)
        try c.encodeIfPresent(stars, forKey: .stars)
        try c.encodeIfPresent(url, forKey: .url)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(box, forKey: .box)
    }
}

/// A thing's field card (CONTRACT 7d): always "likely", one line of why, a source a reader can open, and a caution
/// for anything one might eat. Kept with the post once made, so the next reader's tap costs nothing.
public struct MomentFieldCardDTO: Decodable, Sendable, Hashable {
    public struct Source: Decodable, Sendable, Hashable {
        public let title: String
        public let url: String
    }

    public struct Correction: Decodable, Sendable, Hashable {
        public let name: String
        public let note: String?
    }

    public let name: String?
    public let likely: Bool
    public let scientific: String?
    public let why: String
    public let source: Source?
    public let caution: String?
    public let namedBy: String
    public let corrections: Int
    public let myCorrection: Correction?
    public let collected: Bool?

    enum CodingKeys: String, CodingKey {
        case name, likely, scientific, why, source, caution, corrections, collected
        case namedBy = "named_by"
        case myCorrection = "my_correction"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try? c.decodeIfPresent(String.self, forKey: .name)
        likely = (try? c.decodeIfPresent(Bool.self, forKey: .likely)) ?? true
        scientific = try? c.decodeIfPresent(String.self, forKey: .scientific)
        why = (try? c.decodeIfPresent(String.self, forKey: .why)) ?? ""
        source = try? c.decodeIfPresent(Source.self, forKey: .source)
        caution = try? c.decodeIfPresent(String.self, forKey: .caution)
        namedBy = (try? c.decodeIfPresent(String.self, forKey: .namedBy)) ?? "Pantopus AI"
        corrections = (try? c.decodeIfPresent(Int.self, forKey: .corrections)) ?? 0
        myCorrection = try? c.decodeIfPresent(Correction.self, forKey: .myCorrection)
        collected = try? c.decodeIfPresent(Bool.self, forKey: .collected)
    }
}

/// A Moment's sound (CONTRACT 7e): the person's own voice with their exact words and when each was said (Voice Spark),
/// or three seconds of the place. `url` is a short signed link, given exactly when the picture's link is.
public struct MomentSoundDTO: Decodable, Sendable, Hashable {
    public enum Kind: String, Decodable, Sendable {
        case voice, place
    }

    public let kind: Kind
    public let url: String?
    public let durationMs: Double
    public let words: [MomentSoundWord]?
    /// Wind was cleaned from it on the phone (shown as such).
    public let cleaned: Bool

    enum CodingKeys: String, CodingKey {
        case kind, url, words, cleaned
        case durationMs = "duration_ms"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = try c.decode(Kind.self, forKey: .kind)
        url = try? c.decodeIfPresent(String.self, forKey: .url)
        durationMs = (try? c.decodeIfPresent(Double.self, forKey: .durationMs)) ?? 0
        words = try? c.decodeIfPresent([MomentSoundWord].self, forKey: .words)
        cleaned = (try? c.decodeIfPresent(Bool.self, forKey: .cleaned)) ?? false
    }
}

/// One spoken word and when it was said, in milliseconds from the start.
public struct MomentSoundWord: Codable, Sendable, Hashable {
    public let w: String
    public let startMs: Int
    public let endMs: Int

    public init(w: String, startMs: Int, endMs: Int) {
        self.w = w
        self.startMs = startMs
        self.endMs = endMs
    }

    enum CodingKeys: String, CodingKey {
        case w
        case startMs = "start_ms"
        case endMs = "end_ms"
    }
}

/// A person on a board, along the dial, or in the author's list of answers.
public struct MomentPlayPerson: Decodable, Sendable, Hashable {
    public let id: String
    public let name: String?
    public let firstName: String?
    public let avatarURL: String?
    public let initials: String?

    enum CodingKeys: String, CodingKey {
        case id, name, initials
        case firstName = "first_name"
        case avatarURL = "avatar_url"
    }
}

/// A list read leniently: an item this app can't read is left out, never the whole Moment.
struct MomentLenientList<Item: Decodable>: Decodable {
    let items: [Item]

    init(from decoder: any Decoder) throws {
        var c = try decoder.unkeyedContainer()
        var read: [Item] = []
        while !c.isAtEnd {
            if let item = try? c.decode(Item.self) {
                read.append(item)
            } else if (try? c.decode(MomentStampSkip.self)) == nil {
                // Not even an object to step past: what was read so far stands.
                break
            }
        }
        items = read
    }
}

/// What "Pulse, reinvented" phase 2 lays over a Moment's picture, read from the Moment's own answer (only a reader whose
/// switch is on gets these keys; everyone else gets none of them).
public struct MomentLayersDTO: Sendable, Hashable {
    /// The playable items (CONTRACT 7b, 7g), `[]` when none.
    public let play: [MomentPlayItem]
    /// The people mentioned in the caption (CONTRACT 7h), in the order sent, as this reader may see them; `[]` when none.
    public let mentions: [MomentAuthorDTO]
    /// The dots on things in the photo (CONTRACT 7c), `[]` when none.
    public let dots: [MomentDotDTO]
    /// Voice Spark or place sound (CONTRACT 7e), nil when none.
    public let sound: MomentSoundDTO?
    /// The step deck this Moment is a step of (CONTRACT 7g, `MomentDeckDTOs.swift`), nil for any other Moment.
    public let deck: MomentDeckDTO?
    /// A loop on a video (CONTRACT 7j, `MomentLoopDTOs.swift`): the span the new viewers repeat, nil for any other.
    public let loop: MomentLoopDTO?
    /// The picture is its author's composed whole (CONTRACT 10c): the new viewers fit it, never cut, on its backdrop.
    public let whole: Bool
    /// A whole video's place on the 9:16 canvas (CONTRACT 10c), nil for a photo or a video posted as taken.
    public let placement: MomentWholePlacementDTO?
    /// The two colours around a whole picture (CONTRACT 10c), nil when the viewer makes them from the picture.
    public let backdrop: MomentBackdropDTO?

    private enum CodingKeys: String, CodingKey {
        case play, mentions, dots, sound, deck, loop, whole, placement, backdrop
    }

    init(from decoder: any Decoder) {
        let c = try? decoder.container(keyedBy: CodingKeys.self)
        play = (try? c?.decodeIfPresent(MomentLenientList<MomentPlayItem>.self, forKey: .play))?.items.filter { $0.kind != .unknown } ?? []
        mentions = (try? c?.decodeIfPresent(MomentLenientList<MomentAuthorDTO>.self, forKey: .mentions))?.items ?? []
        dots = (try? c?.decodeIfPresent(MomentLenientList<MomentDotDTO>.self, forKey: .dots))?.items.filter { $0.kind != .unknown } ?? []
        sound = try? c?.decodeIfPresent(MomentSoundDTO.self, forKey: .sound)
        deck = try? c?.decodeIfPresent(MomentDeckDTO.self, forKey: .deck)
        loop = try? c?.decodeIfPresent(MomentLoopDTO.self, forKey: .loop)
        whole = (try? c?.decodeIfPresent(Bool.self, forKey: .whole)).flatMap { $0 } ?? false
        placement = try? c?.decodeIfPresent(MomentWholePlacementDTO.self, forKey: .placement)
        backdrop = try? c?.decodeIfPresent(MomentBackdropDTO.self, forKey: .backdrop)
    }

    /// The before and after on a photo, if it has one (one at most).
    public var beforeAfter: MomentPlayItem? {
        play.first { $0.kind == .beforeAfter }
    }
}

/// CONTRACT 7k: the four colours moving words are sent in (`#RRGGBB`, upper-case, as the server stores them): white,
/// warm yellow, black and sky. Values on the wire, kept here beside the item rather than in feature code.
public enum MomentMovingWordsColor {
    public static let white = "#FFFFFF"
    public static let all = [white, "#FDE68A", "#111827", "#38BDF8"]
}

/// CONTRACT 10c: where a whole video sits on the 9:16 canvas (Resize's own model): its width as a share of the canvas's
/// width before turning, its middle on the canvas (0 to 1), and degrees clockwise.
public struct MomentWholePlacementDTO: Codable, Sendable, Hashable {
    public let width: Double
    public let x: Double
    public let y: Double
    public let turn: Double
}

/// CONTRACT 10c: the two colours of the backdrop a whole picture sits on, `#RRGGBB` upper-case.
public struct MomentBackdropDTO: Codable, Sendable, Hashable {
    public let top: String
    public let bottom: String
}
