//
//  BookingDetailViewModel.swift
//  Pantopus
//
//  E2 Booking Detail (Stream I8). Owner-scoped `GET /bookings/:id` → booking +
//  attendees + minimal event type. Drives a status-contextual sticky dock and an
//  overflow menu: pending → review/decline (E3); confirmed → reschedule (E4) /
//  cancel (E5) / reassign (home/business) / mark no-show (after the event).
//  Loading / error / terminal states are first-class.
//

import SwiftUI

@Observable
@MainActor
final class BookingDetailViewModel {
    enum Phase: Equatable { case loading, ready, error(message: String) }

    let owner: SchedulingOwner
    let bookingId: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let actions: BookingActions

    private(set) var phase: Phase = .loading
    private(set) var detail: BookingDetailResponse?
    var activeSheet: BookingActionSheet?
    var actionError: String?

    private var didLoad = false

    init(
        owner: SchedulingOwner,
        bookingId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        actions: BookingActions
    ) {
        self.owner = owner
        self.bookingId = bookingId
        self.push = push
        self.actions = actions
    }

    // MARK: - Derived

    var accent: Color {
        owner.theme.accent
    }

    var booking: BookingDTO? {
        detail?.booking
    }

    var attendees: [BookingAttendeeDTO] {
        detail?.attendees ?? []
    }

    var eventName: String? {
        detail?.eventType?.name
    }

    var locationMode: String? {
        detail?.eventType?.locationMode
    }

    var status: SchedulingPillStatus {
        booking.map { SchedulingPillStatus(backend: $0.status) } ?? .unknown
    }

    var headerTime: String {
        BookingsTime.headerWhen(startUTC: booking?.startAt, endUTC: booking?.endAt)
    }

    var eventEnded: Bool {
        guard let end = booking?.endAt, let date = SchedulingTime.parseUTC(end) else { return false }
        return date < Date()
    }

    var canReassign: Bool {
        BookingsPillar.supportsReassign(owner) && (booking?.hostUserId != nil)
    }

    /// Whether this booking overlaps another on the host's calendar. The booking
    /// payload carries no overlap flag yet, so this is `false` until the backend
    /// surfaces a conflict signal — the amber `ConflictBanner` (design frame 6)
    /// is wired and ready, gated on this. (deferredBackend: conflict detection.)
    var hasConflict: Bool {
        false
    }

    /// The cancelled banner line — actor + date + quoted reason when available
    /// ("Cancelled by host on Jun 11 · '<reason>'"), matching design frame 4.
    /// Falls back to the bare sentence when the payload omits a reason.
    var cancelledBannerText: String {
        let isDeclined = status == .declined
        let verb = isDeclined ? "Declined" : "Cancelled"
        var line = "\(verb) by host"
        if let when = shortStamp(booking?.updatedAt) {
            line += " on \(when)"
        }
        if let reason = booking?.cancelReason?.trimmingCharacters(in: .whitespacesAndNewlines),
           !reason.isEmpty {
            line += " · \u{201C}\(reason)\u{201D}"
        }
        return line
    }

    /// The status-timeline steps derived from created_at / status / start_at.
    var timelineSteps: [BookingTimelineStep] {
        guard let booking else { return [] }
        var steps: [BookingTimelineStep] = [
            BookingTimelineStep(label: "Requested", time: shortStamp(booking.createdAt), done: true)
        ]
        switch SchedulingPillStatus(backend: booking.status) {
        case .pending:
            steps.append(BookingTimelineStep(label: "Awaiting approval", time: nil, done: false))
        case .confirmed, .active, .completed, .past:
            steps.append(BookingTimelineStep(label: "Confirmed", time: shortStamp(booking.updatedAt), done: true))
            steps.append(BookingTimelineStep(
                label: eventEnded ? "Met" : "Meeting",
                time: BookingsTime.shortWhen(startUTC: booking.startAt),
                done: eventEnded
            ))
            // Design frame 3: a trailing not-done "Follow-up · Pending" node once
            // the meeting has passed.
            if eventEnded {
                steps.append(BookingTimelineStep(label: "Follow-up", time: "Pending", done: false))
            }
        case .noShow:
            steps.append(BookingTimelineStep(label: "Confirmed", time: nil, done: true))
            steps.append(BookingTimelineStep(label: "No-show", time: shortStamp(booking.updatedAt), done: true))
        case .cancelled, .declined:
            steps.append(BookingTimelineStep(
                label: SchedulingPillStatus(backend: booking.status) == .declined ? "Declined" : "Cancelled",
                time: shortStamp(booking.updatedAt),
                done: true
            ))
        default:
            break
        }
        return steps
    }

    /// Overflow-menu actions, contextual to status.
    var overflowActions: [BookingRowAction] {
        guard let booking else { return [] }
        var items: [BookingRowAction] = []
        switch SchedulingPillStatus(backend: booking.status) {
        case .confirmed, .active:
            if canReassign {
                items.append(BookingRowAction(title: "Reassign", icon: .userRound) { [weak self] in
                    self?.presentReschedule()
                })
            }
            if eventEnded {
                items.append(BookingRowAction(title: "Mark no-show", icon: .ban, isDestructive: true) { [weak self] in
                    Task { await self?.markNoShow() }
                })
            }
            // Cancel moves to the overflow now that the confirmed dock surfaces
            // Message as its primary (design frame 1/8); keep it reachable here.
            items.append(BookingRowAction(title: "Cancel booking", icon: .xCircle, isDestructive: true) { [weak self] in
                self?.presentCancel()
            })
        default:
            break
        }
        return items
    }

    // MARK: - Loading

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    private func fetch() async {
        phase = .loading
        do {
            detail = try await actions.detail(id: bookingId)
            phase = .ready
        } catch let error as SchedulingError {
            phase = .error(message: error.userMessage ?? "Couldn't load this booking.")
        } catch {
            phase = .error(message: "Couldn't load this booking.")
        }
    }

    // MARK: - Actions

    func presentReview() {
        if let booking { activeSheet = .review(booking) }
    }

    func presentDecline() {
        if let booking { activeSheet = .decline(booking) }
    }

    func presentReschedule() {
        if let booking { activeSheet = .reschedule(booking) }
    }

    func presentCancel() {
        if let booking { activeSheet = .cancel(booking) }
    }

    func switchToReschedule(_ booking: BookingDTO) {
        activeSheet = .reschedule(booking)
    }

    // MARK: - Dock CTAs awaiting backend wiring

    //
    // The per-state docks (design frames 3/4/5/8) surface Message, Follow up,
    // Rebook, Send rebook link and a conflict-banner "View". None of these have
    // an endpoint, route, or local sheet yet (`BookingActions`/`SchedulingRoute`/
    // `BookingActionSheet` carry no message/follow-up/rebook/conflict member),
    // so the buttons render JSX-faithfully and these handlers are intentional
    // no-ops pending that wiring. (deferredBackend.)

    /// Message the invitee (design confirmed/no-show/member docks + requester row).
    func message() { /* deferredBackend: messaging route/endpoint */ }

    /// Send a post-meeting follow-up (design past dock primary).
    func followUp() { /* deferredBackend: follow-up composer sheet/endpoint */ }

    /// Re-create this booking at a fresh time (design past/cancelled docks).
    func rebook() { /* deferredBackend: rebook flow/endpoint */ }

    /// Send the invitee a link to rebook (design no-show dock primary).
    func sendRebookLink() { /* deferredBackend: rebook-link endpoint */ }

    /// View the overlapping booking (design conflict banner "View").
    func viewConflict() { /* deferredBackend: conflict target id */ }

    func markNoShow() async {
        actionError = nil
        do {
            _ = try await actions.markNoShow(id: bookingId)
            await refresh()
        } catch let scheduling as SchedulingError {
            if case let .conflict(code, message) = scheduling, code == "NOT_APPLICABLE_YET" {
                actionError = "You can mark a no-show once the meeting time has passed."
            } else {
                actionError = scheduling.userMessage ?? "Couldn't mark no-show."
            }
        } catch {
            actionError = "Couldn't mark no-show."
        }
    }

    func handleSheetCompleted() async {
        activeSheet = nil
        await refresh()
    }

    private func shortStamp(_ iso: String?) -> String? {
        guard let iso else { return nil }
        return SchedulingTime.localString(utcISO: iso, tz: BookingsTime.displayTimeZone, dateStyle: .medium, timeStyle: .short)
    }
}

/// One node in the booking status timeline.
struct BookingTimelineStep: Identifiable, Hashable {
    var id: String {
        label
    }

    let label: String
    let time: String?
    let done: Bool
}

#if DEBUG
extension BookingDetailViewModel {
    static func preview(status: String = "confirmed", ownerType: String = "user", paid: Bool = false) -> BookingDetailViewModel {
        let vm = BookingDetailViewModel(
            owner: ownerType == "business" ? .business(id: "b") : (ownerType == "home" ? .home(homeId: "h") : .personal),
            bookingId: "bk_preview",
            push: { _ in },
            actions: BookingActions(owner: .personal)
        )
        vm.detail = .preview(status: status, ownerType: ownerType, paymentId: paid ? "pay_1" : nil)
        vm.phase = .ready
        vm.didLoad = true
        return vm
    }
}
#endif
