//
//  SchedulingPollDTOs.swift
//  Pantopus
//
//  DTOs for time polls — host routes `/api/scheduling/polls*` and the public
//  `/api/public/poll/:id[/vote]`. See `reference/calendarly-backend-api.md`.
//

import Foundation

/// A scheduling time-poll.
public struct SchedulingPollDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let ownerType: String?
    public let ownerId: String?
    public let title: String
    public let description: String?
    public let durationMin: Int?
    /// `open` | `closed`.
    public let status: String?
    public let finalizedStartAt: String?
    public let createdBy: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case ownerType = "owner_type"
        case ownerId = "owner_id"
        case title
        case description
        case durationMin = "duration_min"
        case status
        case finalizedStartAt = "finalized_start_at"
        case createdBy = "created_by"
        case createdAt = "created_at"
    }
}

/// A poll option (a candidate slot).
public struct SchedulingPollOptionDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let pollId: String?
    public let startAt: String?
    public let endAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case pollId = "poll_id"
        case startAt = "start_at"
        case endAt = "end_at"
    }
}

/// A poll vote. `value` is `yes` | `maybe` | `no` on the public surface (the
/// host `GET /polls/:id` sometimes returns a numeric tally) — kept flexible.
public struct SchedulingPollVoteDTO: Decodable, Sendable, Hashable {
    public let optionId: String?
    public let voterName: String?
    public let value: JSONValue?

    enum CodingKeys: String, CodingKey {
        case optionId = "option_id"
        case voterName = "voter_name"
        case value
    }
}

/// `POST /polls` → 201 `{ poll, options }`.
public struct CreatePollResponse: Decodable, Sendable, Hashable {
    public let poll: SchedulingPollDTO
    public let options: [SchedulingPollOptionDTO]
}

/// `GET /polls` → `{ polls }`.
public struct PollsResponse: Decodable, Sendable, Hashable {
    public let polls: [SchedulingPollDTO]
}

/// `GET /polls/:id` (host) → poll + options + votes.
public struct PollDetailResponse: Decodable, Sendable, Hashable {
    public let poll: SchedulingPollDTO
    public let options: [SchedulingPollOptionDTO]
    public let votes: [SchedulingPollVoteDTO]?
}

/// `POST /polls/:id/finalize` → `{ poll, finalized_start_at }`.
public struct FinalizePollResponse: Decodable, Sendable, Hashable {
    public let poll: SchedulingPollDTO
    public let finalizedStartAt: String?

    enum CodingKeys: String, CodingKey {
        case poll
        case finalizedStartAt = "finalized_start_at"
    }
}

/// `GET /api/public/poll/:id` → public poll view.
public struct PublicPollResponse: Decodable, Sendable, Hashable {
    public let poll: SchedulingPollDTO
    public let options: [SchedulingPollOptionDTO]
    public let votes: [SchedulingPollVoteDTO]?
}

// MARK: - Request bodies

/// Body for `POST /polls`. Owner fields spliced in by the builder.
public struct SchedulingCreatePollRequest: Encodable, Sendable {
    public let title: String
    public var description: String?
    public var durationMin: Int?
    public let options: [Option]

    public struct Option: Encodable, Sendable, Hashable {
        public let start: String
        public let end: String

        public init(start: String, end: String) {
            self.start = start
            self.end = end
        }
    }

    enum CodingKeys: String, CodingKey {
        case title
        case description
        case durationMin = "duration_min"
        case options
    }

    public init(
        title: String,
        options: [Option],
        description: String? = nil,
        durationMin: Int? = nil
    ) {
        self.title = title
        self.options = options
        self.description = description
        self.durationMin = durationMin
    }
}

/// Body for `POST /polls/:id/finalize`.
public struct FinalizePollRequest: Encodable, Sendable {
    public let optionId: String

    enum CodingKeys: String, CodingKey {
        case optionId = "option_id"
    }

    public init(optionId: String) {
        self.optionId = optionId
    }
}

/// Body for `POST /api/public/poll/:id/vote`.
public struct PublicPollVoteRequest: Encodable, Sendable {
    public var name: String?
    public var email: String?
    public let votes: [Vote]

    public struct Vote: Encodable, Sendable, Hashable {
        public let optionId: String
        /// `yes` | `maybe` | `no` (default `yes`).
        public var value: String?

        enum CodingKeys: String, CodingKey {
            case optionId = "option_id"
            case value
        }

        public init(optionId: String, value: String? = nil) {
            self.optionId = optionId
            self.value = value
        }
    }

    public init(votes: [Vote], name: String? = nil, email: String? = nil) {
        self.votes = votes
        self.name = name
        self.email = email
    }
}
