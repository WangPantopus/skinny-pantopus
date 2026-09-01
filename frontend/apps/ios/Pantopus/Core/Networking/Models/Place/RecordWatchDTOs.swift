//
//  RecordWatchDTOs.swift
//  Pantopus
//
//  Home Record Watch's rate-watch half (Wave 2b): the loan-month PMMS
//  baseline vs the current weekly average. Averages and deltas only —
//  copy never says "refinance". The deed/lien half is deliberately
//  not built (ATTOM recorder contract pending).
//

import Foundation

public struct RecordWatchEvaluation: Decodable, Sendable, Hashable {
    public let baselineRate: Double
    public let currentRate: Double
    public let currentAsOf: String
    /// current − baseline, in percentage points (negative = below).
    public let deltaPp: Double
    public let refiWindow: Bool

    private enum CodingKeys: String, CodingKey {
        case baselineRate = "baseline_rate"
        case currentRate = "current_rate"
        case currentAsOf = "current_as_of"
        case deltaPp = "delta_pp"
        case refiWindow = "refi_window"
    }
}

public struct RecordWatch: Decodable, Sendable, Hashable {
    public let id: String
    public let homeId: String
    /// "YYYY-MM" as entered.
    public let loanRecordedMonth: String
    public let baselineRate: Double
    public let createdAt: String
    /// Nil when the rate history is temporarily unreachable.
    public let evaluation: RecordWatchEvaluation?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case loanRecordedMonth = "loan_recorded_month"
        case baselineRate = "baseline_rate"
        case createdAt = "created_at"
        case evaluation
    }
}

public struct SetRecordWatchRequest: Encodable, Sendable {
    public let loanRecordedMonth: String

    public init(loanRecordedMonth: String) {
        self.loanRecordedMonth = loanRecordedMonth
    }

    private enum CodingKeys: String, CodingKey {
        case loanRecordedMonth = "loan_recorded_month"
    }
}

public struct RecordWatchResponse: Decodable, Sendable {
    /// Null on GET when no watch exists.
    public let watch: RecordWatch?
}
