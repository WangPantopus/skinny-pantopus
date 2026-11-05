//
//  CrewDayBookingFlowView.swift
//  Pantopus
//
//  The booking flow from the invitation: 2. Your price (1 of 2), 3. Review
//  and book (2 of 2), then 4. You're on the route (board `Booked`), full
//  screen with Close: the prep note, what happens next, Add to calendar,
//  Share with neighbors and See my Crew Day.
//

import EventKit
import EventKitUI
import SwiftUI

struct CrewDayBookingFlowView: View {
    @State var model: CrewDayBookingFlowModel
    let onClose: () -> Void
    let onAsk: () -> Void
    /// "See my Crew Day": the booking's page.
    let onOpenBooking: (String) -> Void

    var body: some View {
        VStack(spacing: 0) {
            if let invitation = model.invitation {
                switch model.step {
                case .price:
                    PlanNavBar(title: "Your price", trailing: "1 of 2", onLeading: onClose)
                    CrewDayPriceView(model: model, invitation: invitation, onAsk: onAsk)
                case .review:
                    PlanNavBar(title: "Review and book", trailing: "2 of 2") { model.backToPrice() }
                    CrewDayReviewView(model: model, invitation: invitation)
                case .booked:
                    CrewDayBookedView(
                        invitation: invitation,
                        booking: model.booked,
                        onClose: onClose,
                        onOpenBooking: onOpenBooking
                    )
                }
            } else if let error = model.loadError {
                PlanNavBar(title: "Your price", onLeading: onClose)
                CrewDayErrorView(message: error) { await model.load() }
            } else {
                PlanNavBar(title: "Your price", onLeading: onClose)
                CrewDayLoadingView()
            }
        }
        .background(Theme.Color.appBg)
        .task { await model.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        // Past step 1 a swipe from the edge would drop the flow; Back steps back instead.
        .swipeBackDisabled(model.step != .price)
    }
}

struct CrewDayBookedView: View {
    let invitation: CrewDayInvitationDTO
    let booking: CrewDayBookingWritten.Booking?
    let onClose: () -> Void
    let onOpenBooking: (String) -> Void
    @State private var systemSheet: SystemSheetRequest?
    @State private var addsToCalendar = false

    private var asked: Bool {
        booking?.status == "price_pending"
    }

    private var crewName: String {
        invitation.crew?.name ?? "The crew"
    }

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: "", leading: .close, onLeading: onClose)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Theme.Color.home)
                        .frame(width: 56, height: 56)
                        .overlay(Icon(.check, size: 28, strokeWidth: 3, color: Theme.Color.appTextInverse))
                        .accessibilityHidden(true)
                    Text(asked ? "We asked \(crewName) for your price" : "You're on the route")
                        .planFont(.h2)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityIdentifier("crewDayBookedTitle")
                    Text(lead)
                        .planFont(.body)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if !asked { whatNext }
                    actions
                }
                .padding(Spacing.s5)
            }
        }
        .sheet(item: $systemSheet) { $0.makeView() }
        .sheet(isPresented: $addsToCalendar) {
            CrewDayCalendarEditor(event: calendarEvent).ignoresSafeArea()
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayBooked")
    }

    private var lead: String {
        let day = CrewDayFormat.longDay(invitation.serviceDate, timezone: invitation.timezone)
        if asked {
            return "You'll hear by \(CrewDayInvitationCopy.closes(invitation)). Nothing is booked or charged until you approve it."
        }
        let window = "between \(CrewDayFormat.clock(invitation.windowStart)) and \(CrewDayFormat.clock(invitation.windowEnd))"
        let home = invitation.outsideOnly ? " You don't need to be home." : ""
        return "\(crewName) comes \(day), \(window).\(home)"
    }

    private var whatNext: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            CrewDayCard {
                CrewDaySectionTitle(text: "What happens next")
                CrewDayCheckRow(text: "We remind you the evening before.", icon: .bell, tint: Theme.Color.appTextSecondary)
                CrewDayCheckRow(text: "The crew tells you when it's on the way.", icon: .truck, tint: Theme.Color.appTextSecondary)
                CrewDayCheckRow(
                    text: "You see photos of the work, then we charge your card.",
                    icon: .camera,
                    tint: Theme.Color.appTextSecondary
                )
            }
        }
    }

    private var actions: some View {
        VStack(spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2) {
                Button { addsToCalendar = true } label: {
                    PlanButtonLabel(title: "Add to calendar", icon: .calendarPlus, kind: .tonal)
                }
                .planButton(.tonal, size: .small)
                .accessibilityIdentifier("crewDayBookedCalendar")
                Button {
                    systemSheet = .share(items: [CrewDayShareText.message(invitation), CrewDayShareText.link(invitation.code)])
                } label: {
                    PlanButtonLabel(title: "Share with neighbors", icon: .share, kind: .tonal)
                }
                .planButton(.tonal, size: .small)
                .accessibilityIdentifier("crewDayBookedShare")
            }
            Text("The preview shows \(invitation.streetLabel) and the date, never your address.")
                .planFont(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            if let bookingId = booking?.id {
                Button("See my Crew Day") { onOpenBooking(bookingId) }
                    .planButton(.primary)
                    .accessibilityIdentifier("crewDayBookedOpen")
            }
        }
    }

    private var calendarEvent: CrewDayCalendarEvent {
        CrewDayCalendarEvent(
            title: invitation.title,
            start: CrewDayFormat.instant(invitation.windowStartsAt),
            end: CrewDayFormat.instant(invitation.windowEndsAt),
            notes: "\(crewName) arrives between \(CrewDayFormat.window(invitation.windowStart, invitation.windowEnd)). Booked in Pantopus."
        )
    }
}

/// The words and link a neighbor gets (the street and the date, never an address).
enum CrewDayShareText {
    static func link(_ code: String) -> String {
        InviteLinks.publicPageURLString(path: "/crew-day/\(code)")
    }

    /// "I'm booked for gutter cleaning on Tuesday, Nov 17. The crew has room for nearby homes if you need yours done too."
    static func message(_ invitation: CrewDayInvitationDTO) -> String {
        let service = (CrewDayService(rawValue: invitation.service)?.label ?? "a Crew Day").lowercased()
        let day = CrewDayFormat.longDay(invitation.serviceDate, timezone: invitation.timezone)
        return "I'm booked for \(service) on \(day). The crew has room for nearby homes if you need yours done too."
    }
}

/// An event to offer to the person's calendar.
struct CrewDayCalendarEvent {
    let title: String
    let start: Date?
    let end: Date?
    let notes: String
}

/// The system's event editor, prefilled (it asks for no calendar access).
struct CrewDayCalendarEditor: UIViewControllerRepresentable {
    let event: CrewDayCalendarEvent
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> EKEventEditViewController {
        let store = EKEventStore()
        let item = EKEvent(eventStore: store)
        item.title = event.title
        item.startDate = event.start ?? Date()
        item.endDate = event.end ?? item.startDate.addingTimeInterval(4 * 3600)
        item.notes = event.notes
        let controller = EKEventEditViewController()
        controller.eventStore = store
        controller.event = item
        controller.editViewDelegate = context.coordinator
        return controller
    }

    func updateUIViewController(_: EKEventEditViewController, context _: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator { dismiss() }
    }

    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let onDone: @MainActor () -> Void

        init(onDone: @escaping @MainActor () -> Void) {
            self.onDone = onDone
        }

        func eventEditViewController(_: EKEventEditViewController, didCompleteWith _: EKEventEditViewAction) {
            // UIKit calls its delegate on the main thread.
            MainActor.assumeIsolated { onDone() }
        }
    }
}
