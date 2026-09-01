//
//  InsightsResponses.swift
//  Pantopus
//
//  Stream I17 — Insights & reports. Stream-LOCAL response DTOs for the three
//  insights reads. These intentionally mirror the **deployed** backend
//  (`backend/services/scheduling/bookingMetricsService.js`) rather than the
//  Foundation `Core/Networking/Models/Scheduling/InsightsDTOs.swift`, whose
//  shapes (and the API doc that seeded them) describe an earlier design that
//  the shipped service never returns. Decoding the Foundation DTOs against the
//  live endpoints yields all-nil → blank screens.
//
//  This is a FOUNDATION GAP (flagged in the PR): `SchedulingSummaryDTO`,
//  `NoShowReportResponse`, and `TeamPerformanceResponse` should be corrected to
//  the shapes below. We do NOT edit the shared file from a feature stream;
//  instead we keep a lenient local projection here (the same pattern Stream I1
//  used for `HubSummary`). Every field is optional so the surface binds to
//  whatever the environment serves.
//

import Foundation

// MARK: - GET /bookings/summary

/// Lenient decode of `GET …/bookings/summary`.
/// Deployed shape: `{ bookingsThisMonth, bookingsLastMonth, deltaPct,
/// upcomingCount, noShowCount, sparkline:[{date,count}],
/// byEventType:[{event_type_id,count}] }` (top level is camelCase; only the
/// nested `byEventType` row is snake_case).
struct InsightsSummary: Decodable, Hashable {
    let bookingsThisMonth: Int?
    let bookingsLastMonth: Int?
    let deltaPct: Int?
    let upcomingCount: Int?
    let noShowCount: Int?
    let sparkline: [SparkPoint]?
    let byEventType: [EventTypeCount]?

    /// One day in the 30-day sparkline.
    struct SparkPoint: Decodable, Hashable {
        let date: String?
        let count: Int?
    }

    /// One per-event-type bucket (`event_type_id` + count), server-sorted desc.
    struct EventTypeCount: Decodable, Hashable, Identifiable {
        let eventTypeId: String?
        let count: Int?

        var id: String {
            eventTypeId ?? UUID().uuidString
        }

        enum CodingKeys: String, CodingKey {
            case eventTypeId = "event_type_id"
            case count
        }
    }
}

// MARK: - GET /insights/no-shows

/// Lenient decode of `GET …/insights/no-shows?days`.
/// Deployed shape: `{ window_days, completed, no_show, cancelled, no_show_rate,
/// recent_no_shows:[{id, start_at, status, invitee_name, event_type_id}] }`.
struct InsightsNoShowReport: Decodable, Hashable {
    let windowDays: Int?
    let completed: Int?
    let noShow: Int?
    let cancelled: Int?
    /// Already a whole-number percent (0–100), `no_show / (completed + no_show)`.
    let noShowRate: Double?
    let recentNoShows: [RecentNoShow]?

    enum CodingKeys: String, CodingKey {
        case windowDays = "window_days"
        case completed
        case noShow = "no_show"
        case cancelled
        case noShowRate = "no_show_rate"
        case recentNoShows = "recent_no_shows"
    }

    /// One recent no-show row.
    struct RecentNoShow: Decodable, Hashable, Identifiable {
        let bookingId: String?
        let startAt: String?
        let status: String?
        let inviteeName: String?
        let eventTypeId: String?

        var id: String {
            bookingId ?? "\(inviteeName ?? "?")-\(startAt ?? "?")"
        }

        enum CodingKeys: String, CodingKey {
            case bookingId = "id"
            case startAt = "start_at"
            case status
            case inviteeName = "invitee_name"
            case eventTypeId = "event_type_id"
        }
    }
}

// MARK: - GET /insights/team

/// Lenient decode of `GET …/insights/team?days` (business-only; `400
/// BUSINESS_ONLY` otherwise). Deployed shape: `{ window_days,
/// hosts:[{host_user_id, total, confirmed, completed, no_show, cancelled}] }`.
/// The deployed service does NOT return member names, revenue, ratings, or avg
/// duration — those are resolved/omitted client-side (member names via the core
/// `BusinessTeamEndpoints.members`).
struct InsightsTeamReport: Decodable, Hashable {
    let windowDays: Int?
    let hosts: [HostStat]?

    enum CodingKeys: String, CodingKey {
        case windowDays = "window_days"
        case hosts
    }

    /// Per-host booking tallies over the window.
    struct HostStat: Decodable, Hashable, Identifiable {
        let hostUserId: String?
        let total: Int?
        let confirmed: Int?
        let completed: Int?
        let noShow: Int?
        let cancelled: Int?

        var id: String {
            hostUserId ?? UUID().uuidString
        }

        enum CodingKeys: String, CodingKey {
            case hostUserId = "host_user_id"
            case total
            case confirmed
            case completed
            case noShow = "no_show"
            case cancelled
        }
    }
}
