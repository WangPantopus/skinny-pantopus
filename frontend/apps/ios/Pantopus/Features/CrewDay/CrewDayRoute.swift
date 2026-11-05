//
//  CrewDayRoute.swift
//  Pantopus
//
//  Crew Day's screens (launch cut #13, build kit 01-spec.md), pushed on the
//  Place stack as `HubRoute.crewDay`: the side menu's two Crew Days rows,
//  the Today cards, invitation links and every Crew Day notice open here.
//  Screens arrive slice by slice (03-slices.md APP-1 to APP-6); a screen
//  not built yet shows the "not in the app yet" page.
//

import SwiftUI

/// One Crew Day screen.
public enum CrewDayRoute: Hashable {
    /// 1. The invitation (`/crew-day/<code>`).
    case invitation(code: String)
    /// 5. Your Crew Day: one booking, in every state.
    case booking(bookingId: String)
    /// 10. Your Crew Days.
    case mine
    /// 11. Ask for a Crew Day on your street.
    case ask
    /// 13. The crew's Crew Days (nil: the first business the person is on).
    case crewList(businessId: String?)
    /// 15. The crew's day (Before the day; the route on the day).
    case crewDay(crewDayId: String)

    /// The screen draws its own bar (`PlanNavBar`), so the stack hides its own.
    var drawsOwnHeader: Bool {
        false
    }
}

/// Builds each Crew Day screen for the Place stack.
@MainActor
enum CrewDayRouter {
    @ViewBuilder
    static func destination(
        for route: CrewDayRoute,
        push _: @escaping @MainActor @Sendable (HubRoute) -> Void,
        pop: @escaping @MainActor () -> Void
    ) -> some View {
        switch route {
        case .invitation, .booking, .mine, .ask, .crewList, .crewDay:
            NotYetAvailableView(tabName: "Crew Day", icon: .truck, onBack: pop)
        }
    }
}
