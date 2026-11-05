//
//  CrewDayInvitationView.swift
//  Pantopus
//
//  1. The invitation, native (build kit 01-spec.md, boards `Main` and
//  `InvitationDark`): the street, the day and window, the price from, the
//  crew, the homes booked, then See my price; how it works for you, what
//  the crew does, and who organizes it. Its states: full, closed,
//  cancelled, done, not available, already booked, and the crew's own day.
//

import SwiftUI

@Observable
@MainActor
final class CrewDayInvitationViewModel {
    let code: String
    private(set) var state: CrewDayLoad<CrewDayInvitationDTO> = .loading
    private(set) var unavailable = false

    init(code: String) {
        self.code = code
    }

    func load() async {
        do {
            let invitation: CrewDayInvitationDTO = try await APIClient.shared.request(CrewDayEndpoints.invitation(code: code))
            CrewDayInvitationCache.shared.store(invitation)
            state = .loaded(invitation)
        } catch {
            if case APIError.notFound = error {
                unavailable = true
                state = .failed("This Crew Day isn't available.")
            } else if state.value == nil {
                state = .failed(CrewDayErrors.sentence(for: error))
            }
        }
    }
}

/// The last invitation read per code, so Your price opens with it at once.
@MainActor
final class CrewDayInvitationCache {
    static let shared = CrewDayInvitationCache()
    private var byCode: [String: CrewDayInvitationDTO] = [:]

    func store(_ invitation: CrewDayInvitationDTO) {
        byCode[invitation.code] = invitation
    }

    func invitation(_ code: String) -> CrewDayInvitationDTO? {
        byCode[code]
    }
}

struct CrewDayInvitationView: View {
    @State var viewModel: CrewDayInvitationViewModel
    let onBack: () -> Void
    let onSeePrice: (String) -> Void
    let onOpenBooking: (String) -> Void
    let onOpenCrewDay: (String) -> Void
    let onAsk: () -> Void
    @Environment(\.openURL) private var openURL
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar.crewDay(title: "Crew Day", onLeading: onBack)
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        // Booked on the screen above: the button becomes "Open my Crew Day".
        .onReceive(NotificationCenter.default.publisher(for: .crewDayChanged)) { _ in
            Task { await viewModel.load() }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayInvitation")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            CrewDayLoadingView()
        case let .failed(message):
            if viewModel.unavailable {
                unavailable
            } else {
                CrewDayErrorView(message: message) { await viewModel.load() }
            }
        case let .loaded(invitation):
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    Text(intro(invitation))
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    dayCard(invitation)
                    action(invitation)
                    howItWorks
                    crewDoes(invitation)
                    footer(invitation)
                }
                .padding(Spacing.s4)
            }
            .refreshable { await viewModel.load() }
        }
    }

    /// "A local crew is coming to Maple Lane in Camas."
    private func intro(_ invitation: CrewDayInvitationDTO) -> String {
        let place = [invitation.streetLabel, invitation.city].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " in ")
        return "A local crew is coming to \(place)."
    }

    // MARK: - The day

    private func dayCard(_ invitation: CrewDayInvitationDTO) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            CrewDayStreetMap(street: invitation.streetLabel)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                CrewDayServiceTag(service: invitation.service)
                Text(invitation.title)
                    .planFont(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text(CrewDayInvitationCopy.when(invitation))
                    .planFont(.small)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appText)
                if let from = invitation.priceFromCents {
                    (Text("From \(CrewDayFormat.price(from))").fontWeight(.semibold) + Text(" a home, including tax"))
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appText)
                }
                if let crew = invitation.crew {
                    CrewDayCrewRow(crew: crew).padding(.top, Spacing.s1)
                }
                Text(CrewDayInvitationCopy.homes(invitation))
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("crewDayInvitationCount")
            }
            .padding(Spacing.s4)
        }
        .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
    }

    // MARK: - The one action

    private func action(_ invitation: CrewDayInvitationDTO) -> some View {
        VStack(spacing: Spacing.s2) {
            if invitation.viewer?.role == "crew" {
                Text("This is your Crew Day")
                    .planFont(.bodyStrong)
                    .foregroundStyle(Theme.Color.appText)
                Button("Open the dashboard") { onOpenCrewDay(invitation.id) }
                    .crewDayButton(.primary)
                    .accessibilityIdentifier("crewDayInvitationDashboard")
            } else if let bookingId = invitation.viewer?.bookingId {
                Button("Open my Crew Day") { onOpenBooking(bookingId) }
                    .crewDayButton(.primary)
                    .accessibilityIdentifier("crewDayInvitationOpenBooking")
            } else {
                switch invitation.dayState {
                case "open":
                    Button("See my price") { onSeePrice(invitation.code) }
                        .crewDayButton(.primary)
                        .accessibilityIdentifier("crewDayInvitationSeePrice")
                    caption("Booking closes \(CrewDayInvitationCopy.closes(invitation)).")
                case "full":
                    stateLine("All \(invitation.capacity) spots are taken.")
                    Button("Ask for the next one", action: onAsk)
                        .crewDayButton(.secondary)
                        .accessibilityIdentifier("crewDayInvitationAsk")
                case "closed":
                    stateLine("Booking closed on \(CrewDayInvitationCopy.closes(invitation)).")
                case "cancelled":
                    stateLine("This Crew Day was cancelled. Nobody was charged.")
                default:
                    stateLine("This Crew Day is done.")
                    Button("Ask for one on your street", action: onAsk)
                        .crewDayButton(.secondary)
                        .accessibilityIdentifier("crewDayInvitationAsk")
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func stateLine(_ text: String) -> some View {
        Text(text)
            .planFont(.bodyStrong)
            .foregroundStyle(Theme.Color.appText)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("crewDayInvitationState")
    }

    private func caption(_ text: String) -> some View {
        Text(text)
            .planFont(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .multilineTextAlignment(.center)
    }

    // MARK: - How it works, what the crew does

    private var howItWorks: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("How it works for you")
            CrewDayCard {
                CrewDayPromiseRow(
                    icon: .house,
                    title: "Your home, your own price",
                    line: "It's set by your home's size, never by how many neighbors join."
                )
                CrewDayPromiseRow(
                    icon: .creditCard,
                    title: "Pay once it's done",
                    line: "Your card is saved when you book and charged the day after the crew finishes your home, "
                        + "unless you tell us something's wrong."
                )
                CrewDayPromiseRow(
                    icon: .cloudRain,
                    title: "Rain never changes your price",
                    line: "If the day moves, you pick a new date or cancel at no charge. Cancelling is free until 48 hours before."
                )
                CrewDayPromiseRow(
                    icon: .lock,
                    title: "Your address stays private",
                    line: "Only the crew and Pantopus see it. Neighbors see how many homes booked, never which ones."
                )
            }
        }
    }

    private func crewDoes(_ invitation: CrewDayInvitationDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("What the crew does")
            CrewDayCard {
                ForEach(invitation.included, id: \.self) { item in CrewDayCheckRow(text: item, tint: Theme.Color.home) }
                if invitation.outsideOnly {
                    Divider().overlay(Theme.Color.appBorder)
                    CrewDayCheckRow(
                        text: "Outside only. You don't need to be home.",
                        icon: .house,
                        tint: Theme.Color.appTextSecondary
                    )
                }
            }
        }
    }

    private func footer(_ invitation: CrewDayInvitationDTO) -> some View {
        VStack(spacing: Spacing.s2) {
            Text("Pantopus organizes this Crew Day. \(invitation.crew?.name ?? "The crew") does the work.")
                .planFont(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            CrewDayButtonRow(spacing: Spacing.s2) {
                Button("How Crew Day works") { open("/crew-day/how-it-works") }
                    .crewDayButton(.text, size: .extraSmall)
                    .accessibilityIdentifier("crewDayInvitationHowItWorks")
                if !typeSize.isAccessibilitySize { Text("·").foregroundStyle(Theme.Color.appTextSecondary).accessibilityHidden(true) }
                Button("Who sees what") { open("/crew-day/who-sees-what") }
                    .crewDayButton(.text, size: .extraSmall)
                    .accessibilityIdentifier("crewDayInvitationWhoSees")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s2)
    }

    private func open(_ path: String) {
        if let url = URL(string: InviteLinks.publicPageURLString(path: path)) { openURL(url) }
    }

    // MARK: - Not available

    private var unavailable: some View {
        EmptyState(
            icon: .truck,
            headline: "This Crew Day isn't available",
            subcopy: "The link may be old, or the day isn't open yet. Ask for one on your street instead.",
            cta: EmptyState.CTA(title: "Ask for a Crew Day") { @MainActor in onAsk() },
            tint: Theme.Color.homeBg,
            accent: Theme.Color.home
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("crewDayInvitationUnavailable")
    }
}

enum CrewDayInvitationCopy {
    /// "Tuesday, Nov 17 · Arriving 9 AM–1 PM".
    static func when(_ invitation: CrewDayInvitationDTO) -> String {
        let day = CrewDayFormat.longDay(invitation.serviceDate, timezone: invitation.timezone)
        return "\(day) · Arriving \(CrewDayFormat.window(invitation.windowStart, invitation.windowEnd))"
    }

    /// "6 homes booked · room for 4 more" (counts only, never which homes).
    static func homes(_ invitation: CrewDayInvitationDTO) -> String {
        let booked = invitation.bookedCount == 1 ? "1 home booked" : "\(invitation.bookedCount) homes booked"
        guard invitation.spotsLeft > 0 else { return "\(booked) · full" }
        return "\(booked) · room for \(invitation.spotsLeft) more"
    }

    /// "Sunday, Nov 15" (the day booking closes, in the Crew Day's zone).
    static func closes(_ invitation: CrewDayInvitationDTO) -> String {
        let closes = CrewDayFormat.instant(invitation.bookingClosesAt)
        return closes.map { CrewDayFormat.longDay(instant: $0, timezone: invitation.timezone) } ?? ""
    }
}

/// The illustrated mini-map on the invitation: the street highlighted and
/// labelled, never houses, pins or the real area.
struct CrewDayStreetMap: View {
    let street: String

    var body: some View {
        ZStack(alignment: .topLeading) {
            Theme.Color.appSurfaceSunken
            GeometryReader { geo in
                let w = geo.size.width
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 22)
                        .fill(Theme.Color.successBg)
                        .frame(width: w * 0.23, height: 52)
                        .offset(x: w * 0.04, y: 12)
                    ForEach([0.33, 0.57, 0.80], id: \.self) { x in
                        block(width: w * (x == 0.57 ? 0.15 : 0.18)).offset(x: w * x, y: 14)
                    }
                    ForEach([0.06, 0.33, 0.57, 0.80], id: \.self) { x in
                        block(width: w * (x == 0.57 ? 0.15 : 0.19), height: 32).offset(x: w * x, y: 104)
                    }
                    Capsule().fill(Theme.Color.home.opacity(0.2)).frame(width: w * 0.86, height: 34).offset(x: w * 0.08, y: 63)
                    Rectangle().fill(Theme.Color.appSurface).frame(width: w * 1.1, height: 8).offset(x: -w * 0.05, y: 76)
                    Rectangle().fill(Theme.Color.appSurface).frame(width: 6, height: 170).offset(x: w * 0.29, y: -10)
                    Rectangle().fill(Theme.Color.appSurface).frame(width: 5, height: 170).offset(x: w * 0.755, y: -10)
                    Text(street)
                        .planFont(.chip)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .padding(.horizontal, 9)
                        .frame(height: 22)
                        .background(Capsule().fill(Theme.Color.appSurface).shadow(color: .black.opacity(0.14), radius: 3, y: 1))
                        .offset(x: w * 0.41, y: 69)
                }
            }
        }
        .frame(height: 150)
        .clipped()
        .accessibilityHidden(true)
    }

    private func block(width: CGFloat, height: CGFloat = 38) -> some View {
        RoundedRectangle(cornerRadius: 4).fill(Theme.Color.appBorderSubtle).frame(width: width, height: height)
    }
}
