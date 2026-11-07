//
//  PostReactionRequest.swift
//  Pantopus
//
//  How people react to a post, the one iOS source for it
//  (`backend/utils/postReaction.js`): Going on an event, one emoji from a
//  fixed set on every other kind. Both go through `POST /api/posts/:id/like`
//  (route `backend/routes/posts.js:3423`): an event sends `{"liked": Bool}`,
//  every other post `{"reaction": "❤️"}`, or `{"reaction": null}` to take
//  the viewer's emoji away.
//

import Foundation

/// Response payload for `POST /api/posts/:id/like`. An emoji request also
/// gets the viewer's `reaction` and each emoji's count after the change;
/// `reactions` is left out when the server couldn't read the counts.
public struct PostLikeResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let liked: Bool
    public let likeCount: Int
    /// The viewer's emoji after the change; nil once taken away (and for Going).
    public let reaction: PostReactionEmoji?
    /// Each emoji's count after the change; nil when the server didn't send them.
    public let reactions: [PostReactionCount]?

    private enum CodingKeys: String, CodingKey {
        case message, liked, likeCount, reaction, reactions
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        message = c.lenient(String.self, forKey: .message)
        liked = try c.decode(Bool.self, forKey: .liked)
        likeCount = try c.decode(Int.self, forKey: .likeCount)
        reaction = c.lenient(PostReactionEmoji.self, forKey: .reaction)
        reactions = c.lenient(LossyList<PostReactionCount>.self, forKey: .reactions)?.items
    }
}

/// Body for `POST /api/posts/:id/like` on a post that takes emoji: the
/// viewer's emoji, or null to take theirs away. Null is sent, never left
/// out: without `reaction` the server toggles a plain like instead.
public struct PostReactionRequest: Encodable, Sendable {
    public let reaction: PostReactionEmoji?

    public init(reaction: PostReactionEmoji?) {
        self.reaction = reaction
    }

    private enum CodingKeys: String, CodingKey {
        case reaction
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        if let reaction {
            try c.encode(reaction.rawValue, forKey: .reaction)
        } else {
            try c.encodeNil(forKey: .reaction)
        }
    }
}

/// How people react to a post, by its type (`postReaction` in
/// `backend/utils/postReaction.js`), the same on web, iPhone and Android and
/// in the author's notice: Going on an event, an emoji on every other kind.
public enum PostReactionKind: String, Sendable, CaseIterable, Identifiable {
    case going
    case emoji

    public init(postType: String?) {
        self = postType == "event" ? .going : .emoji
    }

    public var id: String {
        rawValue
    }

    /// The button: "Going", or "React" for the emoji picker.
    public var label: String {
        switch self {
        case .going: "Going"
        case .emoji: "React"
        }
    }

    /// The count in words: "2 going", "1 reaction", "3 reactions".
    public func countText(_ count: Int) -> String {
        switch self {
        case .going: "\(count) going"
        case .emoji: count == 1 ? "1 reaction" : "\(count) reactions"
        }
    }
}

/// The emoji a post can get, in the order the apps offer them: the same list
/// as the server (`POST_REACTION_EMOJIS`), web and Android. The raw value is
/// the exact string the server stores and returns.
public enum PostReactionEmoji: String, CaseIterable, Sendable, Hashable, Identifiable {
    case like = "👍"
    case love = "\u{2764}\u{FE0F}"
    case haha = "😂"
    case wow = "😮"
    case sad = "😢"
    case thanks = "🙏"
    case celebrate = "🎉"

    /// Its name in accessibility identifiers (`pulseReactionOption_love`).
    public var id: String {
        switch self {
        case .like: "like"
        case .love: "love"
        case .haha: "haha"
        case .wow: "wow"
        case .sad: "sad"
        case .thanks: "thanks"
        case .celebrate: "celebrate"
        }
    }

    /// What VoiceOver calls it.
    public var name: String {
        switch self {
        case .like: "Like"
        case .love: "Love"
        case .haha: "Haha"
        case .wow: "Wow"
        case .sad: "Sad"
        case .thanks: "Thanks"
        case .celebrate: "Celebrate"
        }
    }

    /// Its place in the order the apps offer them, which breaks a tie in counts.
    var order: Int {
        Self.allCases.firstIndex(of: self) ?? 0
    }

    /// The emoji as the server spells it: "❤" without its emoji-style mark
    /// (U+FE0F) is ❤️ too. Nil for one the apps don't offer.
    public init?(wire value: String) {
        let bare = Self.bare(value.trimmingCharacters(in: .whitespacesAndNewlines))
        guard let emoji = Self.allCases.first(where: { Self.bare($0.rawValue) == bare }) else { return nil }
        self = emoji
    }

    /// The text without U+FE0F, which only asks for the emoji style.
    private static func bare(_ text: String) -> String {
        var scalars = String.UnicodeScalarView()
        scalars.append(contentsOf: text.unicodeScalars.filter { $0.value != 0xFE0F })
        return String(scalars)
    }
}

extension PostReactionEmoji: Decodable {
    /// An emoji this build doesn't offer fails, so a list leaves its row out.
    public init(from decoder: any Decoder) throws {
        let value = try decoder.singleValueContainer().decode(String.self)
        guard let emoji = Self(wire: value) else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Not a post reaction"))
        }
        self = emoji
    }
}

/// One emoji's count under a post: `{ "reaction": "👍", "count": 3 }`.
public struct PostReactionCount: Decodable, Sendable, Hashable, Identifiable {
    public let emoji: PostReactionEmoji
    public let count: Int

    public var id: String {
        emoji.id
    }

    public init(emoji: PostReactionEmoji, count: Int) {
        self.emoji = emoji
        self.count = count
    }

    private enum CodingKeys: String, CodingKey {
        case emoji = "reaction"
        case count
    }
}

/// A post's emoji reactions as every app shows them: each emoji someone
/// picked with its count, most used first (ties in the order the apps offer
/// them), and the viewer's own. A mark from before emoji reactions, or from
/// an older app, counts as 👍.
public struct PostReactions: Sendable, Hashable {
    /// Each emoji with a count above 0, most used first.
    public let counts: [PostReactionCount]
    /// The viewer's emoji; nil until they react.
    public let mine: PostReactionEmoji?

    /// `counts` as a read of the post gave them (`reactions`). `likeCount`
    /// stands in when there are none (an older server, or counts it couldn't
    /// read): that many 👍, with the viewer's own emoji among them when known.
    public init(counts: [PostReactionCount] = [], mine: PostReactionEmoji? = nil, likeCount: Int = 0) {
        var byEmoji = Dictionary(counts.map { ($0.emoji, $0.count) }, uniquingKeysWith: +)
        let people = max(likeCount, mine == nil ? 0 : 1)
        if !byEmoji.values.contains(where: { $0 > 0 }), people > 0 {
            byEmoji = [.like: people]
            if let mine, mine != .like {
                byEmoji[.like] = people - 1
                byEmoji[mine] = 1
            }
        }
        self.init(byEmoji: byEmoji, mine: mine)
    }

    private init(byEmoji: [PostReactionEmoji: Int], mine: PostReactionEmoji?) {
        counts = byEmoji
            .filter { $0.value > 0 }
            .map { PostReactionCount(emoji: $0.key, count: $0.value) }
            .sorted { $0.count == $1.count ? $0.emoji.order < $1.emoji.order : $0.count > $1.count }
        self.mine = mine
    }

    /// How many people reacted.
    public var total: Int {
        counts.reduce(0) { $0 + $1.count }
    }

    /// Nobody has reacted yet.
    public var isEmpty: Bool {
        counts.isEmpty
    }

    /// The card's emoji: up to three, most used first, the viewer's own always
    /// among them (first when it isn't in the top three).
    public var cardEmoji: [PostReactionEmoji] {
        let top = counts.prefix(3).map(\.emoji)
        guard let mine, !top.contains(mine) else { return top }
        return [mine] + top.prefix(2)
    }

    /// The reaction a pick asks for: that emoji, or none when it's already the
    /// viewer's (picking it again takes it away).
    public func request(picking emoji: PostReactionEmoji) -> PostReactionEmoji? {
        mine == emoji ? nil : emoji
    }

    /// What shows at once when the viewer sets `emoji` (nil takes theirs
    /// away): one off their old emoji, one on the new one, re-sorted.
    public func setting(_ emoji: PostReactionEmoji?) -> PostReactions {
        var byEmoji = Dictionary(counts.map { ($0.emoji, $0.count) }, uniquingKeysWith: +)
        if let mine { byEmoji[mine, default: 0] -= 1 }
        if let emoji { byEmoji[emoji, default: 0] += 1 }
        return PostReactions(byEmoji: byEmoji, mine: emoji)
    }

    /// The server's answer to a pick: its counts, or these when it couldn't
    /// read them (with its `likeCount` standing in once none are left), and
    /// its emoji for the viewer.
    public func confirmed(by response: PostLikeResponse) -> PostReactions {
        let viewer = response.liked ? response.reaction ?? mine : nil
        return PostReactions(counts: response.reactions ?? counts, mine: viewer, likeCount: response.likeCount)
    }

    /// What VoiceOver reads for them: "React" before anyone reacted, else
    /// "Reactions, 6: 3 Like, 2 Love, 1 Haha".
    public var accessibilityLabel: String {
        guard !counts.isEmpty else { return PostReactionKind.emoji.label }
        let each = counts.map { "\($0.count) \($0.emoji.name)" }.joined(separator: ", ")
        return "Reactions, \(total): \(each)"
    }

    /// "Your reaction: Love"; empty before the viewer reacts.
    public var accessibilityValue: String {
        mine.map { "Your reaction: \($0.name)" } ?? ""
    }
}

/// A post as a list or its page reads it, for its reactions: `reactions`
/// and `userReaction` (missing from older servers), `like_count` and
/// `userHasLiked`.
protocol PostReactionFields {
    var likeCount: Int { get }
    var userHasLiked: Bool { get }
    var reactions: [PostReactionCount] { get }
    var userReaction: PostReactionEmoji? { get }
}

extension PostReactionFields {
    /// The post's emoji reactions. Without `userReaction`, the viewer's mark
    /// is 👍; without counts, `like_count` stands in.
    var emojiReactions: PostReactions {
        PostReactions(counts: reactions, mine: userReaction ?? (userHasLiked ? .like : nil), likeCount: likeCount)
    }
}

extension FeedPostDTO: PostReactionFields {}
extension PostDetailDTO: PostReactionFields {}
extension MyPostDTO: PostReactionFields {}
