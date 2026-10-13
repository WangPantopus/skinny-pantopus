//
//  PlanGoingAndHosting.swift
//  Pantopus
//
//  Board J7 "You're in" (the exact place, the host's note, Directions,
//  Calendar, the group chat, who's going) and board H9 "Your plan" for its
//  host (requests, who's going, message guests, share, change, cancel).
//

import EventKit
import EventKitUI
import MapKit
import SwiftUI

// MARK: - J7

struct PlanGoingSection: View {
    let viewModel: PlanScreenViewModel
    let card: PlanCardDTO
    let onOpenChat: () -> Void
    let onConfirm: (PlanConfirmation) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var bannerShift: CGFloat = 0
    @State private var bannerOpacity: Double = 1
    @State private var justNow = false
    @State private var showsCalendar = false

    var body: some View {
        PlanBanner(
            tone: .success,
            icon: .check,
            title: "You're in",
            message: "\(hostFirst) said yes\(justNow ? " · just now" : "")"
        )
        .offset(y: bannerShift)
        .opacity(bannerOpacity)
        .onChange(of: viewModel.revealToken) { _, _ in playBanner() }
        if viewModel.plan?.myRequest?.reconfirmNeeded == true {
            reconfirm
        }
        VStack(alignment: .leading, spacing: 6) {
            Text(card.title)
                .planFont(.h2)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            if let place = viewModel.plan?.place {
                placeLine(place)
            }
            PlanFactRow(icon: .calendar, text: PlanScreenLines.when(card))
        }
        if let note = viewModel.plan?.place?.note, !note.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                HStack(spacing: Spacing.s2) {
                    Icon(.lock, size: 14, color: Theme.Color.appTextSecondary)
                    Text("From \(hostFirst), only for people who are in")
                        .planFont(.footnote)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Text(note).planFont(.body).foregroundStyle(Theme.Color.appText).fixedSize(horizontal: false, vertical: true)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).fill(card.kind.tint))
            .accessibilityElement(children: .combine)
        }
        HStack(spacing: Spacing.s2) {
            Button(action: openDirections) { PlanButtonLabel(title: "Directions", icon: .locationArrow, kind: .tonal, stacked: true) }
                .planButton(.tonal, size: .stack)
                .disabled(viewModel.plan?.place == nil)
                .accessibilityIdentifier("planDirections")
            Button { showsCalendar = true } label: {
                PlanButtonLabel(title: "Calendar", icon: .calendar, kind: .tonal, stacked: true)
            }
            .planButton(.tonal, size: .stack)
            .disabled(card.startsAtDate == nil)
            .accessibilityLabel("Add to calendar")
            .accessibilityIdentifier("planCalendar")
            Button(action: onOpenChat) { PlanButtonLabel(title: "Group chat", icon: .messageCircle, kind: .tonal, stacked: true) }
                .planButton(.tonal, size: .stack)
                .disabled(viewModel.plan?.chatRoomId == nil)
                .accessibilityIdentifier("planGroupChat")
        }
        if let people = viewModel.plan?.people, !people.isEmpty {
            PlanPeopleLine(people: people, myPartySize: viewModel.plan?.myRequest?.partySize ?? 1)
        }
        Color.clear.frame(height: 1)
            .sheet(isPresented: $showsCalendar) {
                PlanCalendarEditor(card: card, place: viewModel.plan?.place) { showsCalendar = false }
                    .ignoresSafeArea()
            }
    }

    private var hostFirst: String {
        PlanCardLines.firstName(card.host.displayName)
    }

    private func placeLine(_ place: PlanPlaceDTO) -> some View {
        let name = place.name ?? (card.placeKind == .home ? "\(hostFirst)'s place" : "The place")
        return HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            Icon(card.placeKind == .home ? .home : .mapPin, size: 16, color: Theme.Color.appTextSecondary)
                .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 3 }
            (Text(name).fontWeight(.semibold) + Text(place.address.map { " · \($0)" } ?? ""))
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
        }
        .accessibilityElement(children: .combine)
    }

    private var reconfirm: some View {
        VStack(alignment: .leading, spacing: 10) {
            PlanBanner(
                tone: .warning,
                icon: .alertTriangle,
                title: "\(hostFirst) changed the plan",
                message: "It's now \(PlanScreenLines.when(card)). Still coming?"
            )
            HStack(spacing: 10) {
                Button("Can't make it") { onConfirm(.cantMakeIt(host: card.host.displayName)) }
                    .planButton(.secondary, size: .small)
                Button("Still coming") { Task { _ = await viewModel.stillComing(true) } }
                    .planButton(.primary, size: .small)
                    .accessibilityIdentifier("planStillComing")
            }
        }
    }

    /// "You're in" slides up 8 pt and fades in (300–450 ms of the reveal).
    private func playBanner() {
        justNow = true
        guard !reduceMotion else { return }
        bannerShift = 8
        bannerOpacity = 0
        withAnimation(.easeOut(duration: 0.15).delay(0.3)) {
            bannerShift = 0
            bannerOpacity = 1
        }
    }

    private func openDirections() {
        guard let place = viewModel.plan?.place else { return }
        let item = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(
            latitude: place.latitude,
            longitude: place.longitude
        )))
        item.name = place.name ?? card.title
        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDefault])
    }
}

/// "Sam (host), you + 1, Alex, Jordan and 2 more", with overlapping avatars.
struct PlanPeopleLine: View {
    let people: [PlanPersonDTO]
    let myPartySize: Int

    var body: some View {
        HStack(spacing: Spacing.s3) {
            HStack(spacing: -8) {
                ForEach(people.prefix(4)) { person in
                    PlanAvatar(name: person.displayName, url: person.avatarUrl, size: 30)
                        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                }
            }
            Text(summary)
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }

    private var summary: String {
        let me = PlansStoreReads.viewerId
        var names: [String] = []
        for person in people {
            if person.userId == me {
                names.append(myPartySize > 1 ? "you + \(myPartySize - 1)" : "you")
            } else {
                let first = PlanCardLines.firstName(person.displayName)
                let name = person.isHost ? "\(first) (host)" : person.partySize > 1 ? "\(first) + \(person.partySize - 1)" : first
                names.append(name)
            }
        }
        let shown = names.prefix(4)
        let more = names.count - shown.count
        if more > 0 { return shown.joined(separator: ", ") + " and \(more) more" }
        guard shown.count > 1 else { return shown.first ?? "" }
        return shown.dropLast().joined(separator: ", ") + " and " + (shown.last ?? "")
    }
}

/// Adds the plan to the calendar with the system editor (no calendar access needed).
struct PlanCalendarEditor: UIViewControllerRepresentable {
    let card: PlanCardDTO
    let place: PlanPlaceDTO?
    let onDone: () -> Void

    func makeUIViewController(context: Context) -> EKEventEditViewController {
        let store = EKEventStore()
        let event = EKEvent(eventStore: store)
        event.title = card.title
        event.startDate = card.startsAtDate ?? Date()
        event.endDate = card.endsAtDate ?? event.startDate.addingTimeInterval(7200)
        if let place {
            event.location = [place.name, place.address].compactMap { $0 }.joined(separator: ", ")
        }
        event.url = card.shareUrl.flatMap(URL.init(string:))
        let controller = EKEventEditViewController()
        controller.eventStore = store
        controller.event = event
        controller.editViewDelegate = context.coordinator
        return controller
    }

    func updateUIViewController(_: EKEventEditViewController, context _: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onDone: onDone)
    }

    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let onDone: () -> Void

        init(onDone: @escaping () -> Void) {
            self.onDone = onDone
        }

        func eventEditViewController(_: EKEventEditViewController, didCompleteWith _: EKEventEditViewAction) {
            onDone()
        }
    }
}

// MARK: - H9

struct PlanHostingSection: View {
    let viewModel: PlanScreenViewModel
    let card: PlanCardDTO
    let onOpenRequests: () -> Void
    let onOpenChat: () -> Void
    let onChange: () -> Void
    let onCancel: () -> Void
    let onConfirm: (PlanConfirmation) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            StatusChip("You're hosting", variant: .neutral, icon: .flag)
            Text(card.title)
                .planFont(.h2)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text("\(PlanScreenLines.when(card)) · \(placeName)")
                .planFont(.small)
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
        if card.state == .cancelled || card.state == .ended {
            PlanClosedSection(card: card)
        } else {
            requests
            going
            HStack(spacing: 10) {
                Button(action: onOpenChat) { PlanButtonLabel(title: "Message guests", icon: .messageCircle, kind: .secondary) }
                    .planButton(.secondary, size: .small)
                    .disabled(viewModel.plan?.chatRoomId == nil)
                    .accessibilityIdentifier("planMessageGuests")
                if let url = card.shareUrl.flatMap(URL.init(string:)) {
                    ShareLink(item: url, message: Text(card.title)) {
                        PlanButtonLabel(title: "Share", icon: .share, kind: .secondary)
                    }
                    .planButton(.secondary, size: .small)
                }
            }
            VStack(spacing: 0) {
                Button("Change the time or place", action: onChange)
                    .planButton(.text, size: .small)
                    .accessibilityIdentifier("planChange")
                Button("Cancel plan", action: onCancel)
                    .planButton(.textDanger, size: .small)
                    .accessibilityIdentifier("planCancel")
            }
        }
    }

    private var placeName: String {
        if card.placeKind == .home { return "Your place" }
        return viewModel.plan?.place?.name ?? card.area.label
    }

    @ViewBuilder private var requests: some View {
        let count = card.requestsCount ?? viewModel.hostRequests?.pending.count ?? 0
        if count > 0 {
            Button(action: onOpenRequests) {
                HStack(spacing: Spacing.s3) {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .fill(Theme.Color.primary100)
                        .frame(width: 44, height: 44)
                        .overlay(Icon(.bell, size: 22, color: Theme.Color.primary700))
                    VStack(alignment: .leading, spacing: 0) {
                        Text("\(count) request\(count == 1 ? "" : "s")").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                        Text(requestNames(count))
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(2)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(14)
                .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
                .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
            .accessibilityIdentifier("planRequestsCard")
        }
    }

    /// "Priya K. and Jordan T. asked to join".
    private func requestNames(_ count: Int) -> String {
        let names = (viewModel.hostRequests?.pending ?? []).map(\.user.displayName)
        guard !names.isEmpty else { return count == 1 ? "Someone asked to join" : "\(count) people asked to join" }
        if names.count == 1 { return "\(names[0]) asked to join" }
        if names.count == 2 { return "\(names[0]) and \(names[1]) asked to join" }
        return "\(names[0]), \(names[1]) and \(names.count - 2) more asked to join"
    }

    private var going: some View {
        let guests = (viewModel.plan?.people ?? []).filter { !$0.isHost }
        let filled = guests.reduce(0) { $0 + max($1.partySize, 1) }
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text.planOverline("Going · \(filled) of \(card.spots)")
                Spacer()
                Text(card.isFull ? "Full" : "\(card.spotsLeft) spot\(card.spotsLeft == 1 ? "" : "s") left")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.bottom, Spacing.s1)
            PlanSlotMeter(spots: card.spots, filled: filled).padding(.bottom, 6)
            if guests.isEmpty {
                Text("Nobody yet. We'll tell you when someone asks.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.vertical, Spacing.s2)
            }
            ForEach(Array(guests.enumerated()), id: \.element.id) { index, person in
                guestRow(person, divider: index > 0)
            }
        }
    }

    private func guestRow(_ person: PlanPersonDTO, divider: Bool) -> some View {
        VStack(spacing: 0) {
            if divider { Divider().overlay(Theme.Color.appBorder) }
            HStack(spacing: Spacing.s3) {
                PlanAvatar(name: person.displayName, url: person.avatarUrl)
                VStack(alignment: .leading, spacing: 0) {
                    Text(person.partySize > 1 ? "\(person.displayName) + \(person.partySize - 1)" : person.displayName)
                        .planFont(.rowTitle)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(guestFacts(person))
                        .planFont(.footnote)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Menu {
                    if let requestId = viewModel.requestId(for: person) {
                        Button("Remove from plan", role: .destructive) {
                            onConfirm(.removeGuest(name: person.displayName, requestId: requestId, atHome: card.placeKind == .home))
                        }
                    }
                } label: {
                    Icon(.moreHorizontal, size: 20, color: Theme.Color.appTextSecondary)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Options for \(PlanCardLines.firstName(person.displayName))")
            }
            .padding(.vertical, 11)
        }
    }

    /// "Verified · about 1 mi · you hosted Alex before", "About 1 mi · new to Pantopus".
    private func guestFacts(_ person: PlanPersonDTO) -> String {
        var parts: [String] = []
        if person.onMyWay { parts.append("On the way") }
        if person.verifiedAddress { parts.append("Verified") }
        if let distance = PlanFormat.distance(person.distanceBand) { parts.append(distance) }
        if person.hostedBefore {
            parts.append("you hosted \(PlanCardLines.firstName(person.displayName)) before")
        } else if person.newToPantopus {
            parts.append("new to Pantopus")
        }
        if person.reconfirmNeeded { parts.append("asked \u{201C}Still coming?\u{201D}") }
        guard let first = parts.first else { return "Going" }
        parts[0] = first.prefix(1).uppercased() + first.dropFirst()
        return parts.joined(separator: " · ")
    }
}
