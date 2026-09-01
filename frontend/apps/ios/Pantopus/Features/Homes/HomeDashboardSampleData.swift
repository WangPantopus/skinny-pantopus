//
//  HomeDashboardSampleData.swift
//  Pantopus
//
//  Deterministic Home dashboard fixtures used by previews, snapshot
//  tests, and local sample IDs.
//

import Foundation

public enum HomeDashboardSampleData {
    public static let populatedHomeId = "sample-home-populated"
    public static let emptyHomeId = "sample-home-empty"
    public static let needsAttentionHomeId = "sample-home-needs-attention"

    /// Static chrome, not a fixture — owned by `HomeDashboardProjection`.
    public static let tabs: [GridTabsTab] = HomeDashboardProjection.tabs

    public static let populatedQuickActions: [QuickActionTile] = [
        QuickActionTile(id: "view_tasks", label: "Tasks", icon: .listChecks, tone: .warning, badge: "7"),
        QuickActionTile(id: "view_bills", label: "Bills", icon: .receipt, tone: .error),
        QuickActionTile(id: "view_packages", label: "Packages", icon: .package, tone: .business, badge: "4"),
        QuickActionTile(id: "add_member", label: "Members", icon: .users, tone: .home)
    ]

    public static let emptyQuickActions: [QuickActionTile] = [
        QuickActionTile(id: "view_tasks", label: "Tasks", icon: .listChecks, tone: .home, isMuted: true),
        QuickActionTile(id: "view_bills", label: "Bills", icon: .receipt, tone: .home, isMuted: true),
        QuickActionTile(id: "view_packages", label: "Packages", icon: .package, tone: .home, isMuted: true),
        QuickActionTile(id: "add_member", label: "Members", icon: .users, tone: .home, isMuted: true)
    ]

    public static let needsAttentionQuickActions: [QuickActionTile] = [
        QuickActionTile(id: "view_tasks", label: "Tasks", icon: .listChecks, tone: .warning, badge: "9"),
        QuickActionTile(id: "view_bills", label: "Bills", icon: .receipt, tone: .error, badge: "1"),
        QuickActionTile(id: "view_packages", label: "Packages", icon: .package, tone: .business, badge: "4"),
        QuickActionTile(id: "add_member", label: "Members", icon: .users, tone: .home)
    ]

    public static let populatedOverview = HomeDashboardOverviewContent(
        upcoming: [
            HomeDashboardTimelineItem(
                id: "plumber",
                icon: .droplet,
                tone: .personal,
                title: "Plumber - kitchen sink",
                subtitle: "Jorge - Elm St Plumbing",
                trailing: "Today - 4pm"
            ),
            HomeDashboardTimelineItem(
                id: "coned",
                icon: .receipt,
                tone: .error,
                title: "ConEd bill due",
                subtitle: "$142.80 - split 3 ways",
                trailing: "Fri"
            ),
            HomeDashboardTimelineItem(
                id: "packages",
                icon: .package,
                tone: .business,
                title: "Amazon - waiting pickup",
                subtitle: "4 packages - building lobby",
                trailing: nil
            )
        ],
        activity: [
            HomeDashboardActivityItem(
                id: "maria-task",
                initials: "MK",
                tone: .personal,
                title: "Maria marked Take out trash done",
                detail: "Household task completed",
                time: "18m ago"
            ),
            HomeDashboardActivityItem(
                id: "alex-package",
                initials: "AK",
                tone: .home,
                title: "Alex logged a new package from Uniqlo",
                detail: "Package tracker updated",
                time: "2h ago"
            )
        ],
        emergency: HomeDashboardEmergencyInfo(
            title: "Emergency info",
            body: "Tap to access shut-off valves, landlord contacts, insurance.",
            isConfigured: true
        )
    )

    public static let emptyOverview = HomeDashboardOverviewContent(
        upcoming: [],
        activity: [],
        emergency: HomeDashboardEmergencyInfo(
            title: "Emergency info",
            body: "Add shut-off valves, landlord contacts, insurance - for when it matters.",
            isConfigured: false
        )
    )

    public static let needsAttentionOverview = HomeDashboardOverviewContent(
        upcoming: [
            HomeDashboardTimelineItem(
                id: "plumber",
                icon: .droplet,
                tone: .personal,
                title: "Plumber - kitchen sink",
                subtitle: "Jorge - Elm St Plumbing",
                trailing: "Today - 4pm"
            ),
            HomeDashboardTimelineItem(
                id: "packages",
                icon: .package,
                tone: .business,
                title: "Amazon - waiting pickup",
                subtitle: "4 packages - building lobby",
                trailing: nil
            )
        ],
        activity: [
            HomeDashboardActivityItem(
                id: "coned-overdue",
                initials: "MK",
                tone: .error,
                title: "Maria flagged the ConEd bill as overdue",
                detail: "Bill needs payment",
                time: "6m ago"
            ),
            HomeDashboardActivityItem(
                id: "maintenance-past-due",
                initials: "PA",
                tone: .warning,
                title: "Pantopus marked maintenance past due",
                detail: "2 open maintenance items",
                time: "22m ago"
            )
        ],
        emergency: HomeDashboardEmergencyInfo(
            title: "Emergency info",
            body: "Tap to access shut-off valves, landlord contacts, insurance.",
            isConfigured: true
        )
    )

    public static let populatedContent = HomeDashboardContent(
        address: "412 Elm St, Apt 3B",
        verified: true,
        isVerifiedOwner: true,
        stats: stats(packages: 4, accessCodes: 2, tasks: 7),
        quickActions: populatedQuickActions,
        tabs: tabs,
        overview: populatedOverview,
        attentionSummary: nil
    )

    public static let brandNew = HomeDashboardBrandNewContent(
        content: HomeDashboardContent(
            address: "412 Elm St, Apt 3B",
            verified: true,
            isVerifiedOwner: true,
            stats: stats(packages: 0, accessCodes: 0, tasks: 0),
            quickActions: emptyQuickActions,
            tabs: tabs,
            overview: emptyOverview,
            attentionSummary: nil
        ),
        onboardingSteps: [
            HomeDashboardOnboardingStep(
                id: "add-members",
                title: "Add members",
                body: "Invite household members so updates land with the right people.",
                cta: "Add",
                icon: .users,
                tone: .home,
                actionId: "add_member"
            ),
            HomeDashboardOnboardingStep(
                id: "set-access-codes",
                title: "Set access codes",
                body: "Store Wi-Fi, alarm, lockbox, and gate codes in one secure place.",
                cta: "Set",
                icon: .keyRound,
                tone: .personal,
                actionId: "access_codes"
            ),
            HomeDashboardOnboardingStep(
                id: "log-emergency-info",
                title: "Log emergency info",
                body: "Add shut-off valves, contacts, insurance, and evacuation notes.",
                cta: "Log",
                icon: .siren,
                tone: .error,
                actionId: "view_emergency"
            )
        ]
    )

    public static let needsAttentionContent = HomeDashboardContent(
        address: "412 Elm St, Apt 3B",
        verified: true,
        isVerifiedOwner: true,
        stats: stats(packages: 4, accessCodes: 2, tasks: 9),
        quickActions: needsAttentionQuickActions,
        tabs: tabs,
        overview: needsAttentionOverview,
        attentionSummary: HomeDashboardAttentionSummary(
            message: "3 items need attention: 1 overdue bill, 2 maintenance items past due, 1 pending claim",
            chips: [
                HomeDashboardQuickJump(
                    id: "overdue-bill",
                    label: "Overdue bill",
                    icon: .receipt,
                    actionId: "view_bills"
                ),
                HomeDashboardQuickJump(
                    id: "maintenance-past-due",
                    label: "Maintenance",
                    icon: .hammer,
                    actionId: "view_maintenance"
                ),
                HomeDashboardQuickJump(
                    id: "pending-claim",
                    label: "Pending claim",
                    icon: .shieldAlert,
                    actionId: "view_claims"
                )
            ]
        )
    )

    public static func state(for homeId: String) -> HomeDashboardState? {
        switch homeId {
        case populatedHomeId:
            .loaded(populatedContent)
        case emptyHomeId:
            .empty(brandNew)
        case needsAttentionHomeId:
            .needsAttention(needsAttentionContent)
        default:
            nil
        }
    }

    public static func stats(packages: Int, accessCodes: Int, tasks: Int) -> [HomeHeroStat] {
        [
            HomeHeroStat(id: "packages", value: "\(packages)", label: "Packages"),
            HomeHeroStat(id: "access_codes", value: "\(accessCodes)", label: "Access codes"),
            HomeHeroStat(id: "tasks", value: "\(tasks)", label: "Tasks")
        ]
    }
}
