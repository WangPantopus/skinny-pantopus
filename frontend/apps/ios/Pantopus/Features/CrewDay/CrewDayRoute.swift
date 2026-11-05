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
    /// 2–4. Your price, Review and book, You're on the route.
    case book(code: String)
    /// 5. Your Crew Day: one booking, in every state.
    case booking(bookingId: String)
    /// 10. Your Crew Days.
    case mine
    /// 11. Ask for a Crew Day on your street.
    case ask
    /// 13. The crew's Crew Days (nil: the first business the person is on).
    case crewList(businessId: String?)
    /// 14. New Crew Day for a business.
    case newCrewDay(businessId: String)
    /// 15. The crew's day (Before the day; the route on the day).
    case crewDay(crewDayId: String)

    /// The screen draws its own bar (`PlanNavBar`, the wizard's), so the stack hides its own.
    var drawsOwnHeader: Bool {
        switch self {
        case .crewList, .newCrewDay, .crewDay, .invitation, .book, .booking, .mine, .ask: true
        }
    }
}

extension Notification.Name {
    /// A Crew Day write changed a day or a booking: lists on the stack read again.
    static let crewDayChanged = Notification.Name("crewDayChanged")
}

/// Builds each Crew Day screen for the Place stack.
@MainActor
enum CrewDayRouter {
    @ViewBuilder
    static func destination(
        for route: CrewDayRoute,
        push: @escaping @MainActor @Sendable (HubRoute) -> Void,
        pop: @escaping @MainActor () -> Void
    ) -> some View {
        switch route {
        case let .crewList(businessId):
            CrewDaysCrewView(
                viewModel: CrewDaysCrewViewModel(businessId: businessId),
                onBack: pop,
                onOpenDay: { push(.crewDay(.crewDay(crewDayId: $0))) },
                onNewDay: { push(.crewDay(.newCrewDay(businessId: $0))) },
                onOpenBusinessStep: { push($0) }
            )
        case let .newCrewDay(businessId):
            CrewDayNewView(model: CrewDayNewModel(businessId: businessId, onClose: pop)) { dayId in
                NotificationCenter.default.post(name: .crewDayChanged, object: nil)
                pop()
                if let dayId { push(.crewDay(.crewDay(crewDayId: dayId))) }
            }
        case let .crewDay(crewDayId):
            CrewDayCrewDayView(viewModel: CrewDayCrewDayViewModel(crewDayId: crewDayId), onBack: pop)
        case let .invitation(code):
            CrewDayInvitationView(
                viewModel: CrewDayInvitationViewModel(code: code),
                onBack: pop,
                onSeePrice: { push(.crewDay(.book(code: $0))) },
                onOpenBooking: { push(.crewDay(.booking(bookingId: $0))) },
                onOpenCrewDay: { push(.crewDay(.crewDay(crewDayId: $0))) },
                onAsk: { push(.crewDay(.ask)) }
            )
        case let .book(code):
            CrewDayBookingFlowView(
                model: CrewDayBookingFlowModel(code: code),
                onClose: pop,
                onAsk: { push(.crewDay(.ask)) },
                onOpenBooking: { bookingId in
                    pop()
                    push(.crewDay(.booking(bookingId: bookingId)))
                }
            )
        case let .booking(bookingId):
            CrewDayBookingView(
                viewModel: CrewDayBookingViewModel(bookingId: bookingId),
                onBack: pop,
                onOpenInvoice: { push(.invoiceDetail(invoiceId: $0)) },
                onOpenMine: { push(.crewDay(.mine)) },
                onAsk: { push(.crewDay(.ask)) }
            )
        case .mine:
            CrewDaysMineView(
                viewModel: CrewDaysMineViewModel(),
                onBack: pop,
                onOpenBooking: { push(.crewDay(.booking(bookingId: $0))) },
                onOpenInvitation: { push(.crewDay(.invitation(code: $0))) },
                onAsk: { push(.crewDay(.ask)) }
            )
        case .ask:
            CrewDayAskView(model: CrewDayAskModel(), onBack: pop) { push(.addHome) }
        }
    }
}
