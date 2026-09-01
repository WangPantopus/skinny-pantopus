//
//  MailboxCheckDTOs.swift
//  Pantopus
//
//  The Mailbox Reality Check (Wave 1, #3): "can USPS, lenders, and
//  delivery apps actually find your address?" — answered from the
//  claim-time postal validation already on file (DPV match, RDI type,
//  vacancy, missing-unit flags) plus the caller's postcard as the
//  physical leg. Severities and statuses fall back to safe constants
//  so a server-side vocabulary addition cannot break an older build.
//

import Foundation

public enum MailboxCheckVerdict: String, Decodable, Sendable, Hashable {
    case looksGood = "looks_good"
    case needsAttention = "needs_attention"
    case problem
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = MailboxCheckVerdict(rawValue: raw) ?? .unknown
    }
}

public enum MailboxFindingSeverity: String, Decodable, Sendable, Hashable {
    case ok
    case info
    case attention
    case problem

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = MailboxFindingSeverity(rawValue: raw) ?? .info
    }
}

public enum MailboxPhysicalStatus: String, Decodable, Sendable, Hashable {
    case proven
    case inProgress = "in_progress"
    case notRun = "not_run"

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = MailboxPhysicalStatus(rawValue: raw) ?? .notRun
    }
}

public struct MailboxFinding: Decodable, Sendable, Hashable {
    public let severity: MailboxFindingSeverity
    public let title: String
    public let detail: String
}

public struct MailboxPhysicalLeg: Decodable, Sendable, Hashable {
    public let status: MailboxPhysicalStatus
    public let title: String
    public let detail: String
}

public struct MailboxCheck: Decodable, Sendable, Hashable {
    public let verdict: MailboxCheckVerdict
    public let findings: [MailboxFinding]
    public let physical: MailboxPhysicalLeg
    public let checkedAt: String?

    private enum CodingKeys: String, CodingKey {
        case verdict
        case findings
        case physical
        case checkedAt = "checked_at"
    }
}

public struct MailboxCheckResponse: Decodable, Sendable {
    public let check: MailboxCheck
}
