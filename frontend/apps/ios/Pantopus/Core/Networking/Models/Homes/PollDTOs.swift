//
//  PollDTOs.swift
//  Pantopus
//
//  DTOs for the Home Polls endpoints under `backend/routes/home.js`:
//   - GET    /api/homes/:id/polls                       (line 6984)
//   - POST   /api/homes/:id/polls                       (line 7058)
//   - POST   /api/homes/:id/polls/:pollId/vote          (line 7100)
//   - PUT    /api/homes/:id/polls/:pollId               (line 7159)
//
//  `HomePoll.options` is stored as JSONB and the backend accepts both
//  bare strings (`["Sat", "Sun"]`) and objects (`[{ id, label }, …]`).
//  `PollOptionDTO` decodes both shapes uniformly; `key` is what we send
//  on `selected_options` when casting a vote.
//

import Foundation

/// One row from `GET /api/homes/:id/polls`.
public struct PollDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let title: String
    public let description: String?
    public let pollType: String
    public let options: [PollOptionDTO]
    public let status: String
    public let closesAt: String?
    public let visibility: String?
    public let createdAt: String?
    public let createdBy: String?
    /// Total vote rows for this poll across all members. Set by the
    /// server enrichment in `home.js`.
    public let voteCount: Int
    /// Per-option vote breakdown keyed by `PollOptionDTO.key`. Empty when
    /// nobody has voted yet.
    public let optionCounts: [String: Int]
    /// The current viewer's selected option keys, if they've voted. `nil`
    /// when the viewer hasn't voted.
    public let myVote: [String]?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case title
        case description
        case pollType = "poll_type"
        case options
        case status
        case closesAt = "closes_at"
        case visibility
        case createdAt = "created_at"
        case createdBy = "created_by"
        case voteCount = "vote_count"
        case optionCounts = "option_counts"
        case myVote = "my_vote"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        homeId = try c.decode(String.self, forKey: .homeId)
        title = try c.decode(String.self, forKey: .title)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        pollType = try c.decodeIfPresent(String.self, forKey: .pollType) ?? "single_choice"
        options = (try? c.decode([PollOptionDTO].self, forKey: .options)) ?? []
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "open"
        closesAt = try c.decodeIfPresent(String.self, forKey: .closesAt)
        visibility = try c.decodeIfPresent(String.self, forKey: .visibility)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        createdBy = try c.decodeIfPresent(String.self, forKey: .createdBy)
        voteCount = try c.decodeIfPresent(Int.self, forKey: .voteCount) ?? 0
        optionCounts = try c.decodeIfPresent([String: Int].self, forKey: .optionCounts) ?? [:]
        myVote = PollDTO.decodeMyVote(in: c, key: .myVote)
    }

    public init(
        id: String,
        homeId: String,
        title: String,
        description: String? = nil,
        pollType: String = "single_choice",
        options: [PollOptionDTO] = [],
        status: String = "open",
        closesAt: String? = nil,
        visibility: String? = nil,
        createdAt: String? = nil,
        createdBy: String? = nil,
        voteCount: Int = 0,
        optionCounts: [String: Int] = [:],
        myVote: [String]? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.title = title
        self.description = description
        self.pollType = pollType
        self.options = options
        self.status = status
        self.closesAt = closesAt
        self.visibility = visibility
        self.createdAt = createdAt
        self.createdBy = createdBy
        self.voteCount = voteCount
        self.optionCounts = optionCounts
        self.myVote = myVote
    }

    /// `my_vote` arrives as either a JSON array of strings/objects or a
    /// single scalar (the backend's vote schema accepts both shapes).
    /// Normalise to `[String]?` of option keys for the renderer.
    private static func decodeMyVote<K: CodingKey>(
        in container: KeyedDecodingContainer<K>,
        key: K
    ) -> [String]? {
        if let array = try? container.decodeIfPresent([PollVoteValue].self, forKey: key) {
            return array.map(\.key)
        }
        if let single = try? container.decodeIfPresent(PollVoteValue.self, forKey: key) {
            return [single.key]
        }
        return nil
    }
}

/// One option on a `PollDTO`. The backend serialises options as either a
/// bare string (`"Sat"`) or an object (`{ id: "opt-1", label: "Sat" }`).
/// We accept both: `key` is what gets sent back on a vote, `label` is
/// what the user sees.
public struct PollOptionDTO: Decodable, Sendable, Hashable, Identifiable {
    /// Stable identifier sent back as `selected_options[]` on a vote.
    /// Falls back to the label when no `id` / `key` is present.
    public let id: String
    /// User-facing label.
    public let label: String

    public init(id: String, label: String) {
        self.id = id
        self.label = label
    }

    public init(from decoder: any Decoder) throws {
        if let single = try? decoder.singleValueContainer().decode(String.self) {
            id = single
            label = single
            return
        }
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let rawLabel = try c.decodeIfPresent(String.self, forKey: .label)
        let rawText = try c.decodeIfPresent(String.self, forKey: .text)
        let rawId = try c.decodeIfPresent(String.self, forKey: .id)
        let rawKey = try c.decodeIfPresent(String.self, forKey: .key)
        let labelResolved = rawLabel ?? rawText ?? rawId ?? rawKey ?? ""
        let idResolved = rawId ?? rawKey ?? labelResolved
        label = labelResolved
        id = idResolved
    }

    private enum CodingKeys: String, CodingKey {
        case id, label, text, key
    }
}

/// Wire form for a single value inside `my_vote` — either a string
/// (`"Sage"`) or an object with `id` / `label`. Decoded to a single
/// `key` we can compare against `PollOptionDTO.id`.
struct PollVoteValue: Decodable {
    let key: String

    init(from decoder: any Decoder) throws {
        if let str = try? decoder.singleValueContainer().decode(String.self) {
            key = str
            return
        }
        if let num = try? decoder.singleValueContainer().decode(Int.self) {
            key = String(num)
            return
        }
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let raw = try c.decodeIfPresent(String.self, forKey: .id) {
            key = raw
        } else if let raw = try c.decodeIfPresent(String.self, forKey: .key) {
            key = raw
        } else if let raw = try c.decodeIfPresent(String.self, forKey: .label) {
            key = raw
        } else {
            key = ""
        }
    }

    private enum CodingKeys: String, CodingKey {
        case id, key, label
    }
}

/// Envelope for `GET /api/homes/:id/polls`.
public struct GetHomePollsResponse: Decodable, Sendable {
    public let polls: [PollDTO]
}

/// Envelope for `POST /api/homes/:id/polls` and `PUT …/:pollId`.
public struct HomePollResponse: Decodable, Sendable {
    public let poll: PollDTO
}

/// Body for `POST /api/homes/:id/polls`. The backend's options array
/// accepts strings; we send `{ label }` objects so future fields (id,
/// metadata) can ride alongside without a wire break.
public struct CreatePollRequest: Encodable, Sendable {
    public let title: String
    public let description: String?
    public let pollType: String
    public let options: [Option]
    public let closesAt: String?
    public let visibility: String?

    public struct Option: Encodable, Sendable, Hashable {
        public let label: String
        public init(label: String) {
            self.label = label
        }
    }

    private enum CodingKeys: String, CodingKey {
        case title
        case description
        case pollType = "poll_type"
        case options
        case closesAt = "closes_at"
        case visibility
    }

    public init(
        title: String,
        description: String? = nil,
        pollType: String = "single_choice",
        options: [Option],
        closesAt: String? = nil,
        visibility: String? = nil
    ) {
        self.title = title
        self.description = description
        self.pollType = pollType
        self.options = options
        self.closesAt = closesAt
        self.visibility = visibility
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(title, forKey: .title)
        if let description, !description.isEmpty {
            try c.encode(description, forKey: .description)
        }
        try c.encode(pollType, forKey: .pollType)
        try c.encode(options, forKey: .options)
        if let closesAt { try c.encode(closesAt, forKey: .closesAt) }
        if let visibility { try c.encode(visibility, forKey: .visibility) }
    }
}

/// Body for `PUT /api/homes/:id/polls/:pollId`. All fields optional.
public struct UpdatePollRequest: Encodable, Sendable {
    public let title: String?
    public let description: String?
    public let status: String?
    public let closesAt: String?
    public let visibility: String?

    private enum CodingKeys: String, CodingKey {
        case title, description, status
        case closesAt = "closes_at"
        case visibility
    }

    public init(
        title: String? = nil,
        description: String? = nil,
        status: String? = nil,
        closesAt: String? = nil,
        visibility: String? = nil
    ) {
        self.title = title
        self.description = description
        self.status = status
        self.closesAt = closesAt
        self.visibility = visibility
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        if let title { try c.encode(title, forKey: .title) }
        if let description { try c.encode(description, forKey: .description) }
        if let status { try c.encode(status, forKey: .status) }
        if let closesAt { try c.encode(closesAt, forKey: .closesAt) }
        if let visibility { try c.encode(visibility, forKey: .visibility) }
    }
}

/// Body for `POST /api/homes/:id/polls/:pollId/vote`. Always sends an
/// array — the backend normalises scalar values internally but mobile
/// always sends array form for shape stability.
public struct CastVoteRequest: Encodable, Sendable {
    public let selectedOptions: [String]

    private enum CodingKeys: String, CodingKey {
        case selectedOptions = "selected_options"
    }

    public init(selectedOptions: [String]) {
        self.selectedOptions = selectedOptions
    }
}

/// Envelope for `POST /api/homes/:id/polls/:pollId/vote`.
public struct CastVoteResponse: Decodable, Sendable {
    public let vote: PollVoteDTO?
}

/// A single vote row — minimal shape since the client only needs to
/// confirm the round-trip succeeded.
public struct PollVoteDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String?
    public let pollId: String?
    public let userId: String?
    public let selectedOptions: [String]?

    private enum CodingKeys: String, CodingKey {
        case id
        case pollId = "poll_id"
        case userId = "user_id"
        case selectedOptions = "selected_options"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id)
        pollId = try c.decodeIfPresent(String.self, forKey: .pollId)
        userId = try c.decodeIfPresent(String.self, forKey: .userId)
        if let array = try? c.decodeIfPresent([PollVoteValue].self, forKey: .selectedOptions) {
            selectedOptions = array.map(\.key)
        } else if let single = try? c.decodeIfPresent(PollVoteValue.self, forKey: .selectedOptions) {
            selectedOptions = [single.key]
        } else {
            selectedOptions = nil
        }
    }
}
