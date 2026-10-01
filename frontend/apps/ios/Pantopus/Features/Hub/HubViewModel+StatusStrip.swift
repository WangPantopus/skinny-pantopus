//
//  HubViewModel+StatusStrip.swift
//  Pantopus
//
//  The hub's server-driven "Needs attention" strip, the neighbor-density
//  milestone dismissal, and the rebookable-helper injection into
//  "Jump back in". Split out of `HubViewModel.swift` to keep that file
//  inside the 500-line lint budget.
//

import Foundation

extension HubViewModel {
    /// Dismiss one "Needs attention" pill. Session-scoped, exactly like
    /// RN's `handleDismissStatusItem` (`(tabs)/index.tsx:319`).
    func dismissStatusItem(id: String) {
        guard !dismissedStatusIds.contains(id) else { return }
        dismissedStatusIds.insert(id)
        guard case let .populated(content) = state else { return }
        applyState(.populated(HubState.PopulatedContent(
            topBar: content.topBar,
            actionChips: content.actionChips,
            statusItems: content.statusItems.filter { $0.id != id },
            neighborDensity: content.neighborDensity,
            setupBanner: content.setupBanner,
            today: content.today,
            pillars: content.pillars,
            discovery: content.discovery,
            jumpBackIn: content.jumpBackIn,
            activity: content.activity
        )))
    }

    /// Record the neighbor-density milestone as seen. Mirrors RN's
    /// `handleDismissMilestone` (`(tabs)/index.tsx:369-383`): resolve the
    /// largest crossed milestone, POST it, then drop the banner locally.
    /// Failure is silent — the banner is already hidden client-side.
    func dismissDensityMilestone() async {
        clearMilestoneLocally()
        guard let homeId = densityHomeId,
              let milestone = Self.crossedMilestone(for: densityCount) else { return }
        _ = try? await api.request(
            HubExtrasEndpoints.dismissDensityMilestone(homeId: homeId, milestone: milestone),
            as: DismissDensityMilestoneResponse.self
        )
    }

    /// RN's milestone ladder — the highest rung the count has passed.
    static func crossedMilestone(for count: Int) -> Int? {
        [500, 200, 100, 50, 25, 10].first { count >= $0 }
    }

    /// Drops `milestone` from the projected density block so the banner
    /// stays hidden across the next re-render.
    private func clearMilestoneLocally() {
        guard case let .populated(content) = state,
              let density = content.neighborDensity,
              density.milestone != nil else { return }
        applyState(.populated(HubState.PopulatedContent(
            topBar: content.topBar,
            actionChips: content.actionChips,
            statusItems: content.statusItems,
            neighborDensity: NeighborDensityContent(
                count: density.count,
                radiusMiles: density.radiusMiles,
                milestone: nil,
                homeId: density.homeId
            ),
            setupBanner: content.setupBanner,
            today: content.today,
            pillars: content.pillars,
            discovery: content.discovery,
            jumpBackIn: content.jumpBackIn,
            activity: content.activity
        )))
    }

    /// Launch cut #7 (Household extras): bill-due and package pills are
    /// hidden for the first launch (the bill and package screens are).
    static func isStatusItemAvailableAtLaunch(_ raw: HubResponse.HubStatusItem) -> Bool {
        LaunchFeatures.householdExtras || !["bill_due", "package_update"].contains(raw.type)
    }

    /// First-launch scope: an activity row whose type or route opens a
    /// feature hidden for the first launch is skipped.
    static func isActivityAvailableAtLaunch(_ item: HubResponse.HubActivityItem) -> Bool {
        DeepLinkRouter.shared.isLaunchAvailable(notificationType: item.notificationType, link: item.route)
    }

    /// Project one `GET /api/hub` `statusItems[]` row onto the strip
    /// model. The icon table mirrors RN's `ACTION_TYPE_ICONS`
    /// (`src/components/hub/hubTheme.ts:255-264`).
    static func projectStatusItem(_ raw: HubResponse.HubStatusItem) -> StatusStripItem {
        let icon: PantopusIcon = switch raw.type {
        case "chat_unread": .messageCircle
        case "mail_new": .mail
        case "bill_due": .creditCard
        case "task_due": .wrench
        case "gig_update": .briefcase
        case "package_update": .package
        case "business_order": .shoppingBag
        default: .alertCircle
        }
        return StatusStripItem(
            id: raw.id,
            title: raw.title,
            subtitle: raw.subtitle,
            severity: StatusStripItem.Severity(raw: raw.severity),
            icon: icon,
            route: raw.route
        )
    }

    /// "Jump back in" rail = up to two rebookable-helper cards injected
    /// ahead of the server's own jump items, capped at two total —
    /// mirrors RN `(tabs)/index.tsx:344-358`, which prepends
    /// `rebookableGigs.slice(0, 2)` and keeps the server list behind it.
    static func jumpBackItems(
        hub: HubResponse,
        rebookable: [RebookableGigDTO]
    ) -> [JumpBackItem] {
        // Launch cut #4 (Open gigs): "Rebook" opens the open-task composer
        // (`/gigs/new`), so these cards are hidden; so are server tiles into
        // the composer or the Gigs feed.
        let rebookable = LaunchFeatures.openGigs ? rebookable : []
        let rebookItems: [JumpBackItem] = rebookable.prefix(2).compactMap { gig in
            guard let worker = gig.worker else { return nil }
            let category = gig.category ?? "another task"
            return JumpBackItem(
                id: "rebook-\(gig.id)",
                title: "Rebook \(worker.displayName) for \(category)",
                icon: .arrowsRepeat,
                // Both hosts map `/gigs/new` onto the native gig composer.
                route: "/gigs/new",
                tint: .personal,
                kicker: "Rebook",
                progressLabel: nil,
                progressFraction: nil
            )
        }
        let serverItems = hub.jumpBackIn.filter { LaunchFeatures.openGigs || !$0.route.hasPrefix("/gigs") }.map { raw in
            JumpBackItem(
                id: raw.title,
                title: raw.title,
                icon: icon(from: raw.icon),
                route: raw.route,
                tint: tint(forRoute: raw.route),
                // The backend carries no status for these tiles, so they
                // get no kicker (a label by position was untrue).
                kicker: "",
                progressLabel: nil,
                progressFraction: nil
            )
        }
        return Array((rebookItems + serverItems).prefix(2))
    }
}
