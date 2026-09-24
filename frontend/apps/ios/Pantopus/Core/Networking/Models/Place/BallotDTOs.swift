//
//  BallotDTOs.swift
//  Pantopus
//
//  Ballot P0 (docs/ballot-implementation-plan-2026-09-24.md §5.2): the
//  optional card fields the backend adds to the `civic_election` section
//  when the `ballot_p0` flag is on for the viewer. Every sentence is
//  composed on the server; the app lays it out. All fields are optional
//  and decoded tolerantly, so a malformed ballot field never blanks the
//  election section the dashboard already shows.
//

import Foundation

public enum BallotCoverage: String, Sendable, Hashable {
    case supported
    case linksOnly = "links_only"
    case unknown
}

public enum BallotPhase: String, Sendable, Hashable {
    case far
    case inSeason = "in_season"
    case electionDay = "election_day"
    case after
    case unknown
}

extension BallotCoverage: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = BallotCoverage(rawValue: raw) ?? .unknown
    }
}

extension BallotPhase: Decodable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = BallotPhase(rawValue: raw) ?? .unknown
    }
}

public struct BallotDeadline: Decodable, Sendable, Hashable {
    public let key: String
    public let label: String
    /// Calendar date in the state's timezone, `YYYY-MM-DD`.
    public let date: String
    /// "Oct 16".
    public let monthDay: String
    public let daysUntil: Int
    public let needsAction: Bool
    /// Drawn as a marker on the deadline timeline.
    public let timeline: Bool
    public let detail: String?

    private enum CodingKeys: String, CodingKey {
        case key, label, date, timeline, detail
        case monthDay = "month_day"
        case daysUntil = "days_until"
        case needsAction = "needs_action"
    }
}

public struct BallotOfficialLink: Decodable, Sendable, Hashable {
    public let key: String
    public let label: String
    public let owner: String
    public let url: String
}

public struct BallotGovernment: Decodable, Sendable, Hashable {
    public let level: String
    public let name: String
}

public struct BallotGovernments: Decodable, Sendable, Hashable {
    public let count: Int
    /// Always true in P0: special districts are not counted yet.
    public let countIsMinimum: Bool
    public let items: [BallotGovernment]
    public let summary: String
    public let caveat: String
    public let sourceLine: String

    private enum CodingKeys: String, CodingKey {
        case count, items, summary, caveat
        case countIsMinimum = "count_is_minimum"
        case sourceLine = "source_line"
    }
}

public struct BallotPrimaryAction: Decodable, Sendable, Hashable {
    /// `governments` opens the still governments view.
    public let kind: String
    public let label: String
}

public struct BallotWeek: Decodable, Sendable, Hashable {
    public let show: Bool
    public let overline: String?
    public let title: String?
    public let body: String?
}

public struct BallotMoverPrompt: Decodable, Sendable, Hashable {
    public let text: String
    public let daysLeft: Int
    public let url: String?

    private enum CodingKeys: String, CodingKey {
        case text, url
        case daysLeft = "days_left"
    }
}

public struct BallotNotice: Decodable, Sendable, Hashable {
    public let lead: String
    public let detail: String
}

/// The Ballot P0 card, present only when the server sent it.
public struct BallotSummary: Sendable, Hashable {
    public let coverage: BallotCoverage
    public let phase: BallotPhase
    /// The state's local date the summary was composed for.
    public let today: String?
    public let title: String
    public let subtitle: String?
    public let chip: String?
    public let line: String?
    public let note: String?
    public let howItWorks: String?
    public let deadlines: [BallotDeadline]
    public let electionDayNotice: BallotNotice?
    public let primaryAction: BallotPrimaryAction?
    public let officialLinks: [BallotOfficialLink]
    public let governments: BallotGovernments?
    public let ballotWeek: BallotWeek?
    public let moverPrompt: BallotMoverPrompt?
    public let sourceLine: String?
}

extension BallotSummary {
    enum CodingKeys: String, CodingKey {
        case coverage, phase, today, title, subtitle, chip, line, note, deadlines, governments
        case howItWorks = "how_it_works"
        case electionDayNotice = "election_day_notice"
        case primaryAction = "primary_action"
        case officialLinks = "official_links"
        case ballotWeek = "ballot_week"
        case moverPrompt = "mover_prompt"
        case sourceLine = "source_line"
    }

    /// Decodes the card from the civic_election `data` object. Returns nil
    /// when the server did not send one (flag off) — never throws.
    static func decodeIfPresent(from decoder: Decoder, fallbackTitle: String) -> BallotSummary? {
        guard let c = try? decoder.container(keyedBy: CodingKeys.self),
              let coverage = try? c.decode(BallotCoverage.self, forKey: .coverage),
              let phase = try? c.decode(BallotPhase.self, forKey: .phase),
              coverage != .unknown, phase != .unknown else { return nil }
        /// `try?` flattens the optional: a missing or malformed field is nil.
        func opt<T: Decodable>(_ type: T.Type, _ key: CodingKeys) -> T? {
            try? c.decodeIfPresent(type, forKey: key)
        }
        return BallotSummary(
            coverage: coverage,
            phase: phase,
            today: opt(String.self, .today),
            title: opt(String.self, .title) ?? fallbackTitle,
            subtitle: opt(String.self, .subtitle),
            chip: opt(String.self, .chip),
            line: opt(String.self, .line),
            note: opt(String.self, .note),
            howItWorks: opt(String.self, .howItWorks),
            deadlines: opt([BallotDeadline].self, .deadlines) ?? [],
            electionDayNotice: opt(BallotNotice.self, .electionDayNotice),
            primaryAction: opt(BallotPrimaryAction.self, .primaryAction),
            officialLinks: opt([BallotOfficialLink].self, .officialLinks) ?? [],
            governments: opt(BallotGovernments.self, .governments),
            ballotWeek: opt(BallotWeek.self, .ballotWeek),
            moverPrompt: opt(BallotMoverPrompt.self, .moverPrompt),
            sourceLine: opt(String.self, .sourceLine)
        )
    }
}
