//
//  CrewDayPrepSections.swift
//  Pantopus
//
//  15. Before the day's working sections (build kit 01-spec.md, boards
//  `CrewDayPrep`, `DatesAnswers`, `AfterDay`): the route from 6 PM the
//  evening before, the rain answers, what needs the crew (price checks,
//  release asks), the homes booked ("Home 1 · Two stories · $180" until the
//  job window), and after the day the money and any problem.
//

import SwiftUI

struct CrewDayPrepSections: View {
    let page: CrewDayCrewPageDTO
    let viewModel: CrewDayCrewDayViewModel
    let onOpenRoute: (String?) -> Void
    let onOpenHome: (CrewDayHomeDTO) -> Void
    let onOpenInvoices: () -> Void
    var onRepeat: () -> Void = {}
    @State private var pricing: CrewDayHomeDTO?
    @State private var showsPricing = false
    @State private var priceText = ""
    @State private var declining: CrewDayHomeDTO?
    @State private var showsDeclining = false
    @State private var declineNote = ""

    private var card: CrewDaySummaryDTO {
        page.day.card
    }

    private var timezone: String? {
        card.timezone
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            if CrewDayPrepCopy.isAfter(page) {
                afterDay
            } else if CrewDayPrepCopy.routeOpen(page) {
                routeCard
            }
            if let proposal = page.proposal { answers(proposal) }
            if !page.priceChecks.isEmpty || !page.releaseAsks.isEmpty { needsYou }
            if !page.bookings.isEmpty, !CrewDayPrepCopy.isAfter(page) { homesBooked }
        }
        // `presenting` hands the home to the action: the alert clears its own state before the action runs.
        .alert("Set the price", isPresented: $showsPricing, presenting: pricing) { home in
            TextField("Price in dollars", text: $priceText).keyboardType(.numberPad)
            Button("Send") {
                guard let dollars = Int(priceText.filter(\.isNumber)), dollars > 0 else { return }
                Task { await viewModel.setPrice(home, cents: dollars * 100) }
            }
            Button("Cancel", role: .cancel) {}
        } message: { _ in
            Text("The household approves it before the home is booked. Add-ons keep their prices.")
        }
        .alert("Can't take this home?", isPresented: $showsDeclining, presenting: declining) { home in
            TextField("A note to the household", text: $declineNote)
            Button("Tell the household", role: .destructive) {
                let note = declineNote.trimmingCharacters(in: .whitespacesAndNewlines)
                Task { await viewModel.cantTake(home, note: note.isEmpty ? "We can't take this home this time." : note) }
            }
            Button("Keep it", role: .cancel) {}
        } message: { _ in
            Text("The booking ends at no charge.")
        }
    }

    // MARK: - Route

    private var routeCard: some View {
        CrewDayCard {
            CrewDaySectionTitle(text: CrewDayPrepCopy.routeTitle(page))
            Text("Addresses, first names and access notes are on the route now.")
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Button("Open the route") { onOpenRoute(nil) }
                .crewDayButton(.primary)
                .accessibilityIdentifier("crewDayPrepRoute")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayPrepRouteCard")
    }

    // MARK: - Rain answers (board `DatesAnswers`)

    private func answers(_ proposal: CrewDayCrewPageDTO.Proposal) -> some View {
        let homes = CrewDayPrepCopy.proposalHomes(page, proposalId: proposal.id)
        let counts = CrewDayPrepCopy.answerCounts(homes, proposalId: proposal.id)
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("New dates")
            CrewDayCard {
                CrewDayChip(text: "Waiting for answers", tone: .waiting)
                Text("Rain moved \(CrewDayFormat.shortDay(card.serviceDate, timezone: timezone))")
                    .planFont(.h4)
                    .foregroundStyle(Theme.Color.appText)
                if let due = proposal.deadlineAt {
                    Text("Answers due \(CrewDayFormat.dayAndTime(CrewDayFormat.instant(due), timezone: timezone))")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Text(counts)
                    .planFont(.smallStrong)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .accessibilityIdentifier("crewDayDatesAnswersCounts")
                Divider().overlay(Theme.Color.appBorder)
                ForEach(homes) { home in
                    HStack {
                        Text(home.label).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                        Spacer()
                        let answer = CrewDayPrepCopy.answer(home, proposalId: proposal.id, timezone: timezone)
                        CrewDayChip(text: answer.text, tone: answer.tone)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("crewDayDatesAnswer_\(home.id)")
                }
                ForEach(proposal.dates, id: \.date) { date in
                    Button { onOpenRoute(date.date) } label: {
                        PlanButtonLabel(
                            title: "Route · \(CrewDayFormat.shortDay(date.date, timezone: timezone))",
                            icon: .mapPin,
                            kind: .tonal
                        )
                    }
                    .crewDayButton(.tonal, size: .small)
                    .accessibilityIdentifier("crewDayDatesOpenRoute_\(date.date)")
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("crewDayDatesAnswers")
        }
    }

    // MARK: - Needs you

    private var needsYou: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("Needs you")
            CrewDayCard {
                ForEach(page.priceChecks) { home in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Text(CrewDayPrepCopy.priceCheckLine(home, timezone: timezone))
                            .planFont(.bodyStrong)
                            .foregroundStyle(Theme.Color.appText)
                            .fixedSize(horizontal: false, vertical: true)
                        if page.day.canEdit {
                            CrewDayButtonRow(spacing: Spacing.s2) {
                                Button("Set price") {
                                    priceText = ""
                                    pricing = home
                                    showsPricing = true
                                }
                                .crewDayButton(.primary, size: .small)
                                .accessibilityIdentifier("crewDayPrepSetPrice")
                                Button("Can't take it") {
                                    declineNote = ""
                                    declining = home
                                    showsDeclining = true
                                }
                                .crewDayButton(.secondary, size: .small)
                                .accessibilityIdentifier("crewDayPrepCantTake")
                            }
                        }
                    }
                }
                if !page.priceChecks.isEmpty, !page.releaseAsks.isEmpty { Divider().overlay(Theme.Color.appBorder) }
                ForEach(page.releaseAsks) { home in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Text("\(CrewDayRouteCopy.place(home)) asks to cancel")
                            .planFont(.bodyStrong)
                            .foregroundStyle(Theme.Color.appText)
                        Text("It's inside 48 hours. Release it at no charge, or message them first.")
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                        if page.day.canEdit {
                            Button { Task { await viewModel.release(home) } } label: {
                                PlanButtonLabel(title: "Release at no charge", kind: .secondary, isLoading: viewModel.working)
                            }
                            .crewDayButton(.secondary, size: .small)
                            .disabled(viewModel.working)
                            .accessibilityIdentifier("crewDayPrepRelease")
                        }
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("crewDayPrepNeedsYou")
        }
    }

    // MARK: - Homes booked

    private var homesBooked: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("Homes booked")
            CrewDayCard(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(page.bookings.enumerated()), id: \.element.id) { index, home in
                        if index > 0 { Divider().overlay(Theme.Color.appBorder) }
                        Button { onOpenHome(home) } label: {
                            HStack(spacing: Spacing.s3) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(CrewDayPrepCopy.homeLine(home))
                                        .planFont(.body)
                                        .foregroundStyle(Theme.Color.appText)
                                        .fixedSize(horizontal: false, vertical: true)
                                    Text(CrewDayRouteCopy.status(home, timezone: timezone))
                                        .planFont(.footnote)
                                        .foregroundStyle(Theme.Color.appTextSecondary)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
                            }
                            .padding(.horizontal, Spacing.s4)
                            .frame(minHeight: 56)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("crewDayPrepHome_\(home.id)")
                    }
                }
            }
            if !CrewDayPrepCopy.routeOpen(page) {
                CrewDayLockLine(text: "Addresses show at 6 PM the evening before.")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayPrepHomes")
    }

    // MARK: - After the day (board `AfterDay`)

    private var afterDay: some View {
        let money = page.day.money
        let problems = page.bookings.filter { $0.problem?.status == "open" }
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            CrewDayCard {
                Text(CrewDayPrepCopy.afterTitle(page))
                    .planFont(.h4)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityIdentifier("crewDayAfterTitle")
                moneyRow(
                    "Charged",
                    money?.chargedCents,
                    // A home Pantopus support took money off was still charged for the rest (as on the web and Android).
                    line: CrewDayPrepCopy.homesLine(page.bookings, states: ["charged", "partially_refunded"]),
                    id: "crewDayAfterCharged"
                )
                moneyRow(
                    "Scheduled",
                    money?.scheduledCents,
                    line: CrewDayPrepCopy.homesLine(page.bookings, states: ["scheduled"]),
                    id: "crewDayAfterScheduled"
                )
                moneyRow(
                    "Paused",
                    money?.pausedCents,
                    line: problems.isEmpty ? nil : "Pantopus support has it",
                    id: "crewDayAfterPaused"
                )
                if let rate = money?.feeRate {
                    Text("You receive \(100 - Int(rate))% of each charge, 48 hours after it.")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Button("See invoices", action: onOpenInvoices)
                    .crewDayButton(.secondary, size: .small)
                    .accessibilityIdentifier("crewDayAfterInvoices")
            }
            if page.day.canEdit {
                Button("Offer a Crew Day here again", action: onRepeat)
                    .crewDayButton(.primary)
                    .accessibilityIdentifier("crewDayAfterRepeat")
            }
            ForEach(problems) { home in
                CrewDayCard {
                    Text("\(home.label) · \(home.problem?.note ?? "a problem")")
                        .planFont(.bodyStrong)
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("Pantopus support is on it. This home's charge waits.")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("crewDayAfterProblem_\(home.id)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayAfter")
    }

    private func moneyRow(_ title: String, _ cents: Int?, line: String?, id: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).planFont(.body).foregroundStyle(Theme.Color.appText)
                if let line { Text(line).planFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary) }
            }
            Spacer()
            Text(CrewDayFormat.price(cents ?? 0)).planFont(.bodyStrong).monospacedDigit().foregroundStyle(Theme.Color.appText)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(id)
    }
}

/// Before the day's words.
enum CrewDayPrepCopy {
    /// From 6 PM the evening before the earliest date through that day (the job window).
    static func routeOpen(_ page: CrewDayCrewPageDTO) -> Bool {
        page.bookings.contains { $0.addressVisible && !["price_pending", "price_offered"].contains($0.status) }
    }

    /// Every date has passed, or the day is done.
    static func isAfter(_ page: CrewDayCrewPageDTO) -> Bool {
        if page.day.card.status == "done" { return true }
        guard !page.bookings.isEmpty else { return false }
        return page.bookings.allSatisfy { ["done", "paid", "payment_failed", "refunded"].contains($0.status) }
    }

    /// "The route is ready" (or "Route · Tue, Nov 17" on the day).
    static func routeTitle(_ page: CrewDayCrewPageDTO) -> String {
        let card = page.day.card
        guard let day = CrewDayFormat.day(card.serviceDate, timezone: card.timezone) else { return "The route is ready" }
        return CrewDayFormat.calendar(card.timezone).isDateInToday(day) ? "Today's route" : "Tomorrow's route is ready"
    }

    /// "Every home is done · Tue, Nov 17", or "4 of 6 homes done · Tue, Nov 17".
    static func afterTitle(_ page: CrewDayCrewPageDTO) -> String {
        let done = page.bookings.filter { ["done", "paid", "payment_failed", "refunded"].contains($0.status) }.count
        let day = CrewDayFormat.shortDay(page.day.card.serviceDate, timezone: page.day.card.timezone)
        // No count once every home is done: a home refunded in full before its charge has left the list (the web's words).
        let lead = done < page.bookings.count
            ? "\(done) of \(page.bookings.count) homes done"
            : page.bookings.isEmpty ? "This day is over" : page.bookings.count == 1 ? "The home is done" : "Every home is done"
        return "\(lead) · \(day)"
    }

    /// "4 homes" with a charge state.
    static func homesLine(_ homes: [CrewDayHomeDTO], states: Set<String>) -> String? {
        let count = homes.filter { states.contains($0.chargeState ?? "") }.count
        return count == 0 ? nil : CrewDayFormat.homes(count)
    }

    /// "131 Maple Lane · Three or more stories · asked Nov 10".
    static func priceCheckLine(_ home: CrewDayHomeDTO, timezone: String?) -> String {
        let asked = CrewDayFormat.instant(home.createdAt).map { date -> String in
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = CrewDayFormat.calendar(timezone).timeZone
            formatter.dateFormat = "MMM d"
            return "asked \(formatter.string(from: date))"
        }
        return [CrewDayRouteCopy.place(home), home.details.isEmpty ? nil : home.details, asked]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    /// "Home 1 · Two stories · $180".
    static func homeLine(_ home: CrewDayHomeDTO) -> String {
        let place = home.address?.line ?? home.label
        let price = home.priceCents.map(CrewDayFormat.price)
        return [place, home.details.isEmpty ? nil : home.details, price].compactMap { $0 }.joined(separator: " · ")
    }

    /// The homes a proposal went to: every active one, and the ones it ended (cancelled in answer to it).
    static func proposalHomes(_ page: CrewDayCrewPageDTO, proposalId: String) -> [CrewDayHomeDTO] {
        page.bookings + page.ended.filter { $0.newDateChoice?.proposalId == proposalId }
    }

    /// "4 picked a date · 1 cancelled · 1 no answer yet".
    static func answerCounts(_ homes: [CrewDayHomeDTO], proposalId: String) -> String {
        let answers = homes.map { $0.newDateChoice?.proposalId == proposalId ? $0.newDateChoice?.date : nil }
        let picked = answers.filter { $0 != nil && $0 != "cancel" }.count
        let cancelled = answers.filter { $0 == "cancel" }.count
        let waiting = homes.filter { $0.status == "new_dates" }.count
        return "\(picked) picked a date · \(cancelled) cancelled · \(waiting) no answer yet"
    }

    static func answer(_ home: CrewDayHomeDTO, proposalId: String, timezone: String?) -> (text: String, tone: CrewDayChip.Tone) {
        guard home.newDateChoice?.proposalId == proposalId, let date = home.newDateChoice?.date else {
            return ("No answer yet", .waiting)
        }
        return date == "cancel" ? ("Cancelled", .neutral) : (CrewDayFormat.shortDay(date, timezone: timezone), .info)
    }
}
