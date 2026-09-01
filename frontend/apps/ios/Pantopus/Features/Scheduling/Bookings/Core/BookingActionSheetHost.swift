//
//  BookingActionSheetHost.swift
//  Pantopus
//
//  Stream I8 — the shared presenter for the locally-presented action sheets
//  (E3 approve/decline · E4 reschedule/reassign · E5 cancel/refund) so the inbox
//  (E1) and the booking detail (E2) present them identically. Each parent owns
//  an `activeSheet` and renders `BookingActionSheetView` in `.sheet(item:)`.
//

import SwiftUI

/// Which local action sheet is up, carrying its target booking. Sheets/modals
/// have no route — they are presented locally per the wiring contract.
enum BookingActionSheet: Identifiable, Equatable {
    case review(BookingDTO)
    case decline(BookingDTO)
    case reschedule(BookingDTO)
    case cancel(BookingDTO)

    var id: String {
        switch self {
        case let .review(b): "review-\(b.id)"
        case let .decline(b): "decline-\(b.id)"
        case let .reschedule(b): "reschedule-\(b.id)"
        case let .cancel(b): "cancel-\(b.id)"
        }
    }

    var booking: BookingDTO {
        switch self {
        case let .review(b), let .decline(b), let .reschedule(b), let .cancel(b): b
        }
    }
}

/// Builds the right sheet for an `BookingActionSheet`, wiring its completion back
/// to the parent (which refreshes + dismisses). E3's "propose another time"
/// hands off to the reschedule sheet in propose mode via `onSwitchToReschedule`.
struct BookingActionSheetView: View {
    let sheet: BookingActionSheet
    let owner: SchedulingOwner
    let eventName: String?
    let onCompleted: () async -> Void
    var onSwitchToReschedule: ((BookingDTO) -> Void)?

    private var actions: BookingActions {
        BookingActions(owner: owner)
    }

    var body: some View {
        switch sheet {
        case let .review(booking):
            ApproveDeclineSheet(
                viewModel: ApproveDeclineViewModel(
                    owner: owner,
                    booking: booking,
                    eventName: eventName,
                    startInDecline: false,
                    actions: actions
                ),
                onCompleted: onCompleted,
                onProposeTime: onSwitchToReschedule.map { handler in { handler(booking) } }
            )
        case let .decline(booking):
            ApproveDeclineSheet(
                viewModel: ApproveDeclineViewModel(
                    owner: owner,
                    booking: booking,
                    eventName: eventName,
                    startInDecline: true,
                    actions: actions
                ),
                onCompleted: onCompleted,
                onProposeTime: onSwitchToReschedule.map { handler in { handler(booking) } }
            )
        case let .reschedule(booking):
            RescheduleReassignSheet(
                viewModel: RescheduleReassignViewModel(
                    owner: owner, booking: booking, actions: actions, tz: BookingsTime.displayTimeZone
                ),
                onCompleted: onCompleted
            )
        case let .cancel(booking):
            CancelRefundSheet(
                viewModel: CancelRefundViewModel(
                    owner: owner, booking: booking, eventName: eventName, actions: actions
                ),
                onCompleted: onCompleted
            )
        }
    }
}
