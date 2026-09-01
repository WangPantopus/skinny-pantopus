//
//  ManageTrainProjection.swift
//  Pantopus
//
//  A13.13 — maps the shared `GET /api/support-trains/:id` payload
//  (`SupportTrainDetailDTO`) onto the organizer dashboard model. Split out
//  of ManageTrainViewModel.swift to keep both files under SwiftLint's
//  file_length budget.
//
//  PROJECTION GAPS: `/:id` exposes per-slot filled/capacity counts but no
//  helper roster, dropout count, or audience segmentation, so the helper
//  count is proxied from covered slots, dropout shows `0`, and the
//  audience picker is a single "All helpers" chip. The Organize rows are
//  static UI affordances (their destinations are separate screens).
//

import Foundation

extension ManageTrainViewModel {
    /// Derive the organizer dashboard from the detail payload. `nonisolated`
    /// so unit tests can assert it without an actor hop.
    nonisolated static func project(_ dto: SupportTrainDetailDTO) -> ManageTrainContent {
        let slots = dto.slots ?? []
        let total = slots.count
        let filled = slots.filter(\.isCovered).count
        let open = max(0, total - filled)
        let percent = total > 0 ? Int((Double(filled) / Double(total) * 100).rounded()) : 0
        let days = daysLeft(slots: slots)
        let isActive = ["published", "active", "paused"].contains(dto.status ?? "")
        // No helper roster in `/:id` — proxy the count from covered slots
        // (each covered slot is one neighbor's contribution).
        let helpers = "\(filled)"

        return ManageTrainContent(
            trainId: dto.id,
            title: dto.title ?? dto.recipientSummary ?? "Support train",
            dateRangeLabel: dateRangeLabel(slots: slots),
            isActive: isActive,
            slotFillValue: "\(filled)/\(total)",
            helpersValue: helpers,
            daysLeftValue: "\(days)d",
            dropoutValue: "0",
            slotsFilled: filled,
            slotsOpen: open,
            slotsDropout: 0,
            slotsTotal: total,
            slotFillCaption: "\(filled) / \(total) · \(percent)%",
            draftMessage: "",
            audienceChips: [AudienceChipContent(id: "all", label: "All helpers", count: helpers)],
            selectedAudienceId: "all",
            pushToPhones: true,
            organizeRows: defaultOrganizeRows(slotsTotal: total),
            closeRow: defaultCloseRow(),
            close: CloseTrainSheetContent(
                daysEarlyLabel: "Locks new signups · \(days) days early",
                mealsDelivered: "\(filled)",
                neighborsHelped: helpers,
                coverageDays: "\(days)d",
                recipientQuote: dto.story ?? ""
            ),
            status: dto.status ?? "",
            viewerRole: SupportTrainDetailViewModel.viewerRole(dto)
        )
    }

    private nonisolated static func defaultOrganizeRows(slotsTotal: Int) -> [OrganizeRowContent] {
        [
            OrganizeRowContent(
                id: "edit-dates",
                icon: .calendarCog,
                tone: .amber,
                label: "Edit dates & slots",
                meta: "\(slotsTotal)",
                sub: "Add, swap, or remove cooking days. Helpers see live changes.",
                isDestructive: false
            ),
            OrganizeRowContent(
                id: "invite",
                icon: .userPlus,
                tone: .sky,
                label: "Invite more helpers",
                meta: nil,
                sub: "Share a link or pick from neighbors who follow this train.",
                isDestructive: false
            ),
            OrganizeRowContent(
                id: "analytics",
                icon: .barChart3,
                tone: .green,
                label: "Analytics",
                meta: nil,
                sub: "Fill rate, response time, top contributors.",
                isDestructive: false
            )
        ]
    }

    private nonisolated static func defaultCloseRow() -> OrganizeRowContent {
        OrganizeRowContent(
            id: "close",
            icon: .archive,
            tone: .red,
            label: "Close train",
            meta: nil,
            sub: "Lock new signups and send a thank-you to everyone.",
            isDestructive: true
        )
    }

    private nonisolated static func dateRangeLabel(slots: [SupportTrainSlotDTO]) -> String {
        let dates = slots.compactMap { parseDate($0.slotDate) }
        guard let earliest = dates.min(), let latest = dates.max() else { return "" }
        return "\(format(earliest, "MMM d")) → \(format(latest, "MMM d")) · \(slots.count) days"
    }

    private nonisolated static func daysLeft(slots: [SupportTrainSlotDTO]) -> Int {
        let calendar = utcCalendar()
        let dates = slots.compactMap { parseDate($0.slotDate) }
        guard let latest = dates.max() else { return 0 }
        let today = calendar.startOfDay(for: Date())
        let days = calendar.dateComponents([.day], from: today, to: calendar.startOfDay(for: latest)).day ?? 0
        return max(0, days)
    }

    private nonisolated static func parseDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: String(value.prefix(10)))
    }

    private nonisolated static func format(_ date: Date, _ pattern: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = pattern
        return formatter.string(from: date)
    }

    private nonisolated static func utcCalendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        return calendar
    }
}
