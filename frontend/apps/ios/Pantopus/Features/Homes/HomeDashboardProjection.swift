//
//  HomeDashboardProjection.swift
//  Pantopus
//
//  Pure mapping from `GET /api/homes/:id/dashboard`
//  (`backend/routes/home.js:6224`) onto the Home dashboard's hero stats,
//  quick-action tiles, and Overview sections. No fixtures — every value
//  here traces back to a field on the aggregate response.
//

import Foundation

public enum HomeDashboardProjection {
    /// Grid-tab strip — static chrome, identical on Android. This is the
    /// ungated superset; `gatedTabs(access:)` applies the per-home
    /// permission filter.
    public static let tabs: [GridTabsTab] = [
        GridTabsTab(id: "overview", label: "Overview"),
        GridTabsTab(id: "tasks", label: "Tasks"),
        GridTabsTab(id: "bills", label: "Bills"),
        GridTabsTab(id: "packages", label: "Packages"),
        GridTabsTab(id: "members", label: "Members"),
        GridTabsTab(id: "ownership", label: "Ownership")
    ]

    /// Permission-gated tab strip. Mirrors RN's
    /// `src/app/homes/[id]/dashboard.tsx:169-176`, which gates on the
    /// five navigation booleans from `GET /api/homes/:id/me`
    /// (`backend/routes/homeIam.js:51`) and never on role strings.
    /// A nil access record (403 / offline) leaves the strip ungated so a
    /// failed side-read can't blank the screen — the same fallback RN
    /// takes at `src/app/homes/[id]/index.tsx:124`.
    public static func gatedTabs(access: HomeAccessDTO?) -> [GridTabsTab] {
        guard let access else { return tabs }
        return tabs.filter { tab in
            switch tab.id {
            case "tasks": access.canManageTasks
            case "bills": access.canManageFinance
            case "members": access.canManageAccess
            case "ownership": access.isOwner || access.canManageHome
            default: true
            }
        }
    }

    // MARK: - Hero stats

    /// Three-slot hero row. The backend aggregate has no access-code
    /// count, so the middle slot carries `bills_due` (the design's
    /// "Access codes" number has no server-side source).
    static func stats(counts: HomeDashboardCountsDTO?) -> [HomeHeroStat] {
        let counts = counts ?? HomeDashboardCountsDTO()
        return [
            HomeHeroStat(id: "packages", value: "\(counts.packagesExpected)", label: "Packages"),
            HomeHeroStat(id: "bills", value: "\(counts.billsDue)", label: "Bills"),
            HomeHeroStat(id: "tasks", value: "\(counts.tasksOpen)", label: "Tasks")
        ]
    }

    // MARK: - Quick actions

    /// Quick-action tiles, permission-gated the same way RN gates its
    /// dashboard cards (`src/app/homes/[id]/index.tsx:324`, `:353`,
    /// `:374`) using the IAM permission strings from
    /// `GET /api/homes/:id/me`. A nil access record leaves every tile in
    /// place — RN's `can()` also falls through to "allow" when it has no
    /// permission list to test.
    static func quickActions(
        counts: HomeDashboardCountsDTO?,
        access: HomeAccessDTO? = nil
    ) -> [QuickActionTile] {
        let counts = counts ?? HomeDashboardCountsDTO()
        func allowed(_ permission: String) -> Bool {
            access?.can(permission) ?? true
        }
        var out: [QuickActionTile] = []
        if allowed("tasks.view") {
            out.append(
                tile(
                    id: "view_tasks",
                    label: "Tasks",
                    icon: .listChecks,
                    tone: .warning,
                    count: counts.tasksOpen
                )
            )
        }
        if allowed("finance.view") {
            out.append(
                tile(
                    id: "view_bills",
                    label: "Bills",
                    icon: .receipt,
                    tone: .error,
                    count: counts.billsDue
                )
            )
        }
        if allowed("mailbox.view") {
            out.append(
                tile(
                    id: "view_packages",
                    label: "Packages",
                    icon: .package,
                    tone: .business,
                    count: counts.packagesExpected
                )
            )
        }
        out.append(
            tile(
                id: "add_member",
                label: "Members",
                icon: .users,
                tone: .home,
                count: counts.membersActive,
                showsBadge: false
            )
        )
        return out
    }

    private static func tile(
        id: String,
        label: String,
        icon: PantopusIcon,
        tone: QuickActionTone,
        count: Int,
        showsBadge: Bool = true
    ) -> QuickActionTile {
        QuickActionTile(
            id: id,
            label: label,
            icon: icon,
            tone: count > 0 ? tone : .home,
            badge: showsBadge && count > 0 ? "\(count)" : nil,
            isMuted: count == 0
        )
    }

    // MARK: - Overview

    /// Maximum "Upcoming" rows — mirrors the design frame's three-row
    /// card with headroom for the bill + delivery summary rows.
    private static let upcomingLimit = 5

    static func overview(
        dashboard: HomeDashboardResponse?,
        health: HomeHealthScoreDTO?
    ) -> HomeDashboardOverviewContent {
        HomeDashboardOverviewContent(
            upcoming: upcoming(dashboard: dashboard),
            activity: activity(dashboard: dashboard),
            emergency: emergency(health: health)
        )
    }

    static func upcoming(dashboard: HomeDashboardResponse?) -> [HomeDashboardTimelineItem] {
        guard let today = dashboard?.today else { return [] }
        var items: [HomeDashboardTimelineItem] = []

        if let bill = today.nextBill {
            items.append(
                HomeDashboardTimelineItem(
                    id: "bill-\(bill.id)",
                    icon: .receipt,
                    tone: .error,
                    title: "\(billLabel(bill)) bill due",
                    subtitle: currency(bill.displayAmount, code: bill.currency),
                    trailing: whenLabel(bill.dueDate)
                )
            )
        }

        for event in today.nextEvents {
            items.append(
                HomeDashboardTimelineItem(
                    id: "event-\(event.id)",
                    icon: .calendar,
                    tone: .personal,
                    title: event.title,
                    subtitle: firstNonEmpty(
                        event.locationNotes,
                        event.description,
                        humanized(event.eventType)
                    ) ?? "Calendar event",
                    trailing: whenLabel(event.startAt)
                )
            )
        }

        for task in today.tasksDue {
            items.append(
                HomeDashboardTimelineItem(
                    id: "task-\(task.id)",
                    icon: .listChecks,
                    tone: .warning,
                    title: task.title,
                    subtitle: firstNonEmpty(task.description, humanized(task.taskType))
                        ?? "Household task",
                    trailing: whenLabel(task.dueAt)
                )
            )
        }

        if today.deliveriesArriving > 0 {
            let count = today.deliveriesArriving
            items.append(
                HomeDashboardTimelineItem(
                    id: "deliveries",
                    icon: .package,
                    tone: .business,
                    title: count == 1 ? "1 package on the way" : "\(count) packages on the way",
                    subtitle: "Ordered, shipped, or out for delivery",
                    trailing: nil
                )
            )
        }

        return Array(items.prefix(upcomingLimit))
    }

    static func activity(dashboard: HomeDashboardResponse?) -> [HomeDashboardActivityItem] {
        guard let dashboard else { return [] }
        let namesByUserId = Dictionary(
            dashboard.members.compactMap { member -> (String, String)? in
                guard let id = member.user?.id ?? member.userId else { return nil }
                guard let name = firstNonEmpty(member.user?.name, member.user?.username) else { return nil }
                return (id, name)
            }
        ) { first, _ in first }

        return dashboard.recentActivity.enumerated().map { index, entry in
            let actorName = entry.actorUserId.flatMap { namesByUserId[$0] }
            let phrase = humanized(entry.action) ?? entry.action
            return HomeDashboardActivityItem(
                id: entry.id,
                initials: initials(from: actorName),
                tone: index.isMultiple(of: 2) ? .personal : .home,
                title: actorName.map { "\($0): \(phrase)" } ?? phrase,
                detail: humanized(entry.targetType) ?? "Home activity",
                time: relativeTime(entry.createdAt) ?? ""
            )
        }
    }

    /// The aggregate has no emergency block, so the configured flag comes
    /// from the health score's `emergency` dimension
    /// (`backend/services/homeHealthService.js:83` — score 0 means "no
    /// emergency contacts set").
    static func emergency(health: HomeHealthScoreDTO?) -> HomeDashboardEmergencyInfo {
        let configured = (health?.breakdown["emergency"]?.score ?? 0) > 0
        return HomeDashboardEmergencyInfo(
            title: "Emergency info",
            body: configured
                ? "Tap to access shut-off valves, landlord contacts, insurance."
                : "Add shut-off valves, landlord contacts, insurance - for when it matters.",
            isConfigured: configured
        )
    }

    // MARK: - Formatting

    static func billLabel(_ bill: BillDTO) -> String {
        firstNonEmpty(bill.providerName, humanized(bill.billType)) ?? "Utility"
    }

    static func currency(_ amount: Decimal, code: String?) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code ?? "USD"
        formatter.maximumFractionDigits = 2
        return formatter.string(from: amount as NSDecimalNumber) ?? "\(amount)"
    }

    /// Compact money for the property-value card ("$1.2M" / "$940K").
    static func compactCurrency(_ value: Double) -> String {
        if value >= 1_000_000 {
            return String(format: "$%.1fM", value / 1_000_000)
        }
        if value >= 1000 {
            return "$\(Int((value / 1000).rounded()))K"
        }
        return fullCurrency(value)
    }

    static func fullCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
    }

    static func monthYear(_ iso: String?) -> String? {
        guard let date = parseDate(iso) else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: date)
    }

    /// "Overdue" / "Today 4 PM" / "Tomorrow" / "Fri" / "Mar 3".
    static func whenLabel(_ iso: String?) -> String? {
        guard let date = parseDate(iso) else { return nil }
        let calendar = Calendar.current
        let now = Date()
        if date < now, !calendar.isDateInToday(date) { return "Overdue" }
        if calendar.isDateInToday(date) {
            let formatter = DateFormatter()
            formatter.dateFormat = "h a"
            return "Today \(formatter.string(from: date))"
        }
        if calendar.isDateInTomorrow(date) { return "Tomorrow" }
        let days = calendar.dateComponents([.day], from: now, to: date).day ?? 0
        let formatter = DateFormatter()
        formatter.dateFormat = days < 7 ? "EEE" : "MMM d"
        return formatter.string(from: date)
    }

    static func relativeTime(_ iso: String?) -> String? {
        guard let date = parseDate(iso) else { return nil }
        let elapsed = Date().timeIntervalSince(date)
        switch elapsed {
        case ..<60: return "just now"
        case ..<3600: return "\(Int(elapsed / 60))m ago"
        case ..<86400: return "\(Int(elapsed / 3600))h ago"
        case ..<604_800: return "\(Int(elapsed / 86400))d ago"
        default: return "\(Int(elapsed / 604_800))w ago"
        }
    }

    static func parseDate(_ iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: iso) { return date }
        if let date = ISO8601DateFormatter().date(from: iso) { return date }
        let dayOnly = DateFormatter()
        dayOnly.dateFormat = "yyyy-MM-dd"
        dayOnly.timeZone = TimeZone(secondsFromGMT: 0)
        return dayOnly.date(from: iso)
    }

    /// `guest_pass_created` / `pet.create` → "Guest pass created".
    static func humanized(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        let spaced = raw
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: ".", with: " ")
            .trimmingCharacters(in: .whitespaces)
        guard let first = spaced.first else { return nil }
        return first.uppercased() + spaced.dropFirst()
    }

    static func initials(from name: String?) -> String {
        guard let name, !name.isEmpty else { return "PA" }
        let parts = name
            .split(separator: " ")
            .prefix(2)
            .compactMap(\.first)
            .map(String.init)
        let joined = parts.joined().uppercased()
        return joined.isEmpty ? "PA" : joined
    }

    static func firstNonEmpty(_ candidates: String?...) -> String? {
        for candidate in candidates {
            if let candidate, !candidate.trimmingCharacters(in: .whitespaces).isEmpty {
                return candidate
            }
        }
        return nil
    }
}
