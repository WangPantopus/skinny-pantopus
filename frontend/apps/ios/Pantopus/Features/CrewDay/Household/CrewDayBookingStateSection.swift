//
//  CrewDayBookingStateSection.swift
//  Pantopus
//
//  5. Your Crew Day's state card, one per row of 01-spec.md screen 5's table
//  (boards `CrewDay`, `CdConfirming`, `CdEvening`, `CdOnTheWay`, `CdDone`,
//  `CdPaid`, `CdNewDates`, `CdAttention`, `CdCancelled`): what happened, in
//  honest words, and the one or two answers that fit.
//

import SwiftUI

struct CrewDayBookingStateSection: View {
    let booking: CrewDayBookingDTO
    let viewModel: CrewDayBookingViewModel
    @Binding var dateChoice: String?
    let onOpenInvoice: (String) -> Void
    let onProblem: () -> Void
    let onEditNote: () -> Void
    let onOpenPhoto: ([CrewDayPhoto], Int) -> Void
    let onFindAnother: () -> Void
    let onAsk: () -> Void

    private var crew: String {
        CrewDayBookingPageCopy.crewName(booking)
    }

    private var price: String? {
        CrewDayBookingPageCopy.price(booking)
    }

    var body: some View {
        let phase = CrewDayBookingPageCopy.phase(booking)
        stateCard(phase).accessibilityIdentifier("crewDayBookingState_\(phase.rawValue)")
    }

    @ViewBuilder
    private func stateCard(_ phase: CrewDayBookingPhase) -> some View {
        switch phase {
        case .attention, .resolved, .paid, .cardFailed, .refunded: moneyCard(phase)
        case .confirming: confirming
        case .priceOffered: priceOffered
        case .newDates: newDates
        case .onTheWay: onTheWay
        case .done: done
        case .ended: ended
        case .today, .evening: dayOf
        case .booked: booked
        }
    }

    /// The cards about the charge: paid, failed, paused, resolved, refunded.
    @ViewBuilder
    private func moneyCard(_ phase: CrewDayBookingPhase) -> some View {
        switch phase {
        case .attention: attention
        case .resolved: resolved
        case .paid: paid
        case .cardFailed: cardFailed
        default: refunded
        }
    }

    // MARK: - Before the day

    private var booked: some View {
        CrewDayStateCard(tone: .success, icon: .check, title: "You're on the route") {
            let home = booking.crewDay.outsideOnly == true ? " You don't need to be home." : ""
            CrewDayStateText(text: CrewDayBookingPageCopy.reminderLine(booking) + home)
            if let note = booking.prepNote, !note.isEmpty {
                CrewDayQuote(label: "From \(crew)", text: note, identifier: "crewDayBookingPrepNote")
            }
        }
    }

    private var confirming: some View {
        CrewDayStateCard(tone: .warning, icon: .hourglass, title: "The crew is checking your price") {
            let by = booking.cancelCutoffAt.map { " You'll hear by \(CrewDayBookingPageCopy.shortDay($0, booking))." } ?? ""
            CrewDayStateText(text: "\(crew) looks at your home before confirming the price.\(by) Nothing is booked or charged yet.")
        }
    }

    private var priceOffered: some View {
        CrewDayStateCard(tone: .info, icon: .tag, title: price.map { "Your price: \($0)" } ?? "Your price is ready") {
            CrewDayStateText(text: "\(crew) looked at your home.")
            buttons {
                primary(price.map { "Approve \($0)" } ?? "Approve", .approve, id: "crewDayBookingApprove") {
                    await viewModel.answerPrice(approve: true)
                }
                secondary("Decline", .decline, id: "crewDayBookingDecline") { await viewModel.answerPrice(approve: false) }
            }
            caption("Declining is free. Nothing is booked until you approve.")
        }
    }

    private var newDates: some View {
        CrewDayStateCard(tone: .warning, icon: .cloudRain, title: "Rain changed the plan") {
            let same = price.map { " Your price stays \($0)." } ?? ""
            CrewDayStateText(text: "\(crew) can come on one of these dates.\(same) No payment has been taken.")
            if let proposal = booking.proposal {
                datePicker(proposal)
                buttons {
                    primary(
                        dateChoice.map { CrewDayBookingPageCopy.bookDayButton($0, booking) } ?? "Pick a date",
                        .newDate,
                        id: "crewDayBookingBookDate",
                        disabled: dateChoice == nil
                    ) {
                        if let dateChoice { await viewModel.answerNewDate(dateChoice) }
                    }
                    secondary("Cancel at no charge", .cancelDate, id: "crewDayBookingCancelDates") {
                        await viewModel.answerNewDate("cancel")
                    }
                }
                if let deadline = proposal.deadlineAt {
                    let when = "\(CrewDayBookingPageCopy.shortDay(deadline, booking)) at \(CrewDayBookingPageCopy.time(deadline, booking))"
                    caption("If you don't answer by \(when), we won't book a new date for you.")
                }
            }
        }
    }

    private func datePicker(_ proposal: CrewDayBookingDTO.Proposal) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(proposal.dates.enumerated()), id: \.element.date) { index, option in
                if index > 0 { Divider().overlay(Theme.Color.appBorder) }
                Button { dateChoice = option.date } label: {
                    HStack(spacing: Spacing.s3) {
                        Icon(
                            dateChoice == option.date ? .circleDot : .circle,
                            size: 22,
                            color: dateChoice == option.date ? Theme.Color.primarySolid : Theme.Color.appBorderStrong
                        )
                        VStack(alignment: .leading, spacing: 2) {
                            Text(CrewDayFormat.longDay(option.date, timezone: booking.crewDay.timezone))
                                .planFont(.bodyStrong)
                                .foregroundStyle(Theme.Color.appText)
                            Text(CrewDayFormat.window(option.windowStart, option.windowEnd))
                                .planFont(.small)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, 14)
                    .frame(minHeight: 56)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(dateChoice == option.date ? [.isSelected] : [])
                .accessibilityIdentifier("crewDayBookingDate_\(option.date)")
            }
        }
        .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayBookingDates")
    }

    // MARK: - The day

    private var dayOf: some View {
        let today = CrewDayBookingPageCopy.phase(booking) == .today
        let window = CrewDayFormat.window(booking.windowStart, booking.windowEnd)
        return CrewDayStateCard(tone: .info, icon: .calendarDays, title: "\(today ? "Today" : "Tomorrow"), \(window)") {
            if booking.crewDay.outsideOnly == true { CrewDayStateText(text: "You don't need to be home.") }
            if let note = booking.prepNote, !note.isEmpty {
                CrewDayQuote(label: "From \(crew)", text: note, identifier: "crewDayBookingPrepNote")
            }
            Button("Edit access note", action: onEditNote)
                .crewDayButton(.secondary)
                .accessibilityIdentifier("crewDayBookingEditAccess")
        }
    }

    private var onTheWay: some View {
        let eta = CrewDayFormat.window(
            from: CrewDayFormat.instant(booking.eta?.start),
            to: CrewDayFormat.instant(booking.eta?.end),
            timezone: booking.crewDay.timezone
        )
        let expected = eta.isEmpty ? CrewDayFormat.window(booking.windowStart, booking.windowEnd) : eta
        return CrewDayStateCard(tone: .info, icon: .truck, title: "On the way · expected \(expected)") {
            if let updated = booking.eta?.updatedAt {
                CrewDayStateText(text: "Updated by \(crew) at \(CrewDayBookingPageCopy.time(updated, booking))")
            }
            if booking.gateReadyAt != nil {
                CrewDayDoneLine(text: "We told the crew the gate is ready.", identifier: "crewDayBookingGateTold")
                secondary("Message the crew", nil, id: "crewDayBookingMessageCrew") { await viewModel.messageCrew() }
            } else {
                buttons {
                    primary("Gate is ready", .gate, id: "crewDayBookingGateReady") { await viewModel.gateReady() }
                    secondary("Message the crew", nil, id: "crewDayBookingMessageCrew") { await viewModel.messageCrew() }
                }
            }
        }
    }

    private var done: some View {
        let at = booking.doneAt.map { " at \(CrewDayBookingPageCopy.time($0, booking))" } ?? ""
        return CrewDayStateCard(tone: .success, icon: .check, title: "Done · reported by the crew\(at)") {
            if !booking.photos.isEmpty {
                CrewDayPhotoGrid(photos: booking.photos) { onOpenPhoto(booking.photos, $0) }
            }
            if let note = booking.doneNote, !note.isEmpty {
                CrewDayQuote(label: "Note from \(crew)", text: note, identifier: "crewDayBookingDoneNote")
            }
            if let price, let due = CrewDayFormat.instant(booking.charge?.dueAt) {
                let day = CrewDayTodayCopy.relativeDay(due, timezone: booking.crewDay.timezone)
                let time = CrewDayFormat.time(due, timezone: booking.crewDay.timezone)
                CrewDayStateText(
                    text: "We'll charge \(price) \(day) at \(time) unless you tell us something needs attention.",
                    identifier: "crewDayBookingChargeLine"
                )
            }
            buttons {
                primary("Everything looks good", .confirm, id: "crewDayBookingLooksGood") { await viewModel.confirm() }
                Button("Something needs attention", action: onProblem)
                    .crewDayButton(.secondary)
                    .accessibilityIdentifier("crewDayBookingProblem")
            }
        }
    }

    // MARK: - Money

    private var paid: some View {
        let on = booking.charge?.paidAt.map { " · \(CrewDayBookingPageCopy.shortDay($0, booking))" } ?? ""
        return CrewDayStateCard(tone: .success, icon: .creditCard, title: "Paid \(price ?? "")\(on)") {
            HStack(spacing: Spacing.s1) {
                Text(CrewDayBookingPageCopy.paidInApp(booking) ? "Paid in Pantopus" : CrewDayBookingPageCopy.cardLabel(booking))
                    .planFont(.body)
                    .foregroundStyle(Theme.Color.appTextStrong)
                if let invoiceId = booking.invoiceId { receiptLink(invoiceId) }
            }
            if !booking.photos.isEmpty {
                CrewDayPhotoGrid(photos: booking.photos) { onOpenPhoto(booking.photos, $0) }
            }
            CrewDayStateText(text: "Want this again next fall? We'll ask you first.")
            if booking.remindNextSeason {
                CrewDayDoneLine(text: "We'll ask you next fall.", identifier: "crewDayBookingReminded")
            } else {
                secondary("Remind me next fall", .remind, id: "crewDayBookingRemind") { await viewModel.remindNextSeason() }
            }
        }
    }

    private var cardFailed: some View {
        CrewDayStateCard(tone: .error, icon: .circleAlert, title: "Your card didn't go through") {
            CrewDayStateText(text: price.map { "Pay \($0) to \(crew) in Pantopus." } ?? "Pay \(crew) in Pantopus.")
            if let invoiceId = booking.invoiceId {
                Button("Pay now") { onOpenInvoice(invoiceId) }
                    .crewDayButton(.primary)
                    .accessibilityIdentifier("crewDayBookingPayNow")
            }
        }
    }

    private var attention: some View {
        CrewDayStateCard(tone: .warning, icon: .lifeBuoy, title: "Pantopus support has this") {
            CrewDayQuote(
                label: "You said",
                text: booking.problem?.note ?? CrewDayBookingPageCopy.problemLabel(booking.problem?.kind),
                identifier: "crewDayBookingProblemNote"
            )
            if !booking.problemPhotos.isEmpty {
                CrewDayPhotoGrid(photos: booking.problemPhotos, what: "you sent") { onOpenPhoto(booking.problemPhotos, $0) }
            }
            CrewDayStateText(text: pausedLine, identifier: "crewDayBookingPaused")
            CrewDayCaseTimeline(lines: CrewDayBookingPageCopy.caseTimeline(booking))
            Button("Add a note or photo", action: onProblem)
                .crewDayButton(.secondary)
                .accessibilityIdentifier("crewDayBookingProblemAdd")
        }
    }

    /// "Your $180 charge is paused while we sort it out. We'll reply by 5 PM Fri, Nov 6."
    private var pausedLine: String {
        let paused = price.map { "Your \($0) charge is paused while we sort it out." } ?? "Your charge is paused while we sort it out."
        guard let due = booking.problem?.dueAt else { return paused }
        return "\(paused) We'll reply by \(CrewDayBookingPageCopy.time(due, booking)) \(CrewDayBookingPageCopy.shortDay(due, booking))."
    }

    private var resolved: some View {
        CrewDayStateCard(tone: .success, icon: .shieldCheck, title: CrewDayBookingPageCopy.resolvedTitle(booking)) {
            if let at = booking.problem?.resolvedAt {
                CrewDayStateText(text: "Pantopus support closed this case on \(CrewDayBookingPageCopy.shortDay(at, booking)).")
            }
            if let invoiceId = booking.invoiceId { receiptLink(invoiceId) }
        }
    }

    private var refunded: some View {
        let amount = booking.charge?.refundedCents.flatMap { $0 > 0 ? $0 : nil } ?? booking.priceCents ?? 0
        return CrewDayStateCard(
            tone: .neutral,
            icon: .creditCard,
            title: "Refunded \(CrewDayFormat.price(amount)) to \(CrewDayBookingPageCopy.cardLabel(booking))"
        ) {
            if let invoiceId = booking.invoiceId { receiptLink(invoiceId) }
        }
    }

    private var ended: some View {
        CrewDayStateCard(tone: .neutral, icon: .calendarX, title: CrewDayBookingPageCopy.endedTitle(booking)) {
            buttons {
                Button("Find another Crew Day", action: onFindAnother)
                    .crewDayButton(.secondary)
                    .accessibilityIdentifier("crewDayBookingFindAnother")
                Button("Ask for one on your street", action: onAsk)
                    .crewDayButton(.secondary)
                    .accessibilityIdentifier("crewDayBookingAsk")
            }
        }
    }
}

// MARK: - Buttons

private extension CrewDayBookingStateSection {
    func buttons(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(spacing: 10) { content() }
    }

    func primary(
        _ title: String,
        _ action: CrewDayBookingViewModel.Action,
        id: String,
        disabled: Bool = false,
        run: @escaping @MainActor () async -> Void
    ) -> some View {
        Button { Task { await run() } } label: {
            PlanButtonLabel(title: title, isLoading: viewModel.working == action)
        }
        .crewDayButton(.primary)
        .disabled(disabled || viewModel.working != nil)
        .accessibilityIdentifier(id)
    }

    func secondary(
        _ title: String,
        _ action: CrewDayBookingViewModel.Action?,
        id: String,
        run: @escaping @MainActor () async -> Void
    ) -> some View {
        Button { Task { await run() } } label: {
            PlanButtonLabel(title: title, kind: .secondary, isLoading: action != nil && viewModel.working == action)
        }
        .crewDayButton(.secondary)
        .disabled(viewModel.working != nil)
        .accessibilityIdentifier(id)
    }

    func caption(_ text: String) -> some View {
        Text(text)
            .planFont(.footnote)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }

    func receiptLink(_ invoiceId: String) -> some View {
        Button("See receipt") { onOpenInvoice(invoiceId) }
            .crewDayButton(.text, size: .extraSmall)
            .accessibilityIdentifier("crewDayBookingReceipt")
    }
}

/// The case so far, oldest first (board `CdAttention`).
struct CrewDayCaseTimeline: View {
    let lines: [CrewDayCaseLine]

    var body: some View {
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ForEach(lines) { line in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(line.at).planFont(.footnote).monospacedDigit().foregroundStyle(Theme.Color.appTextSecondary)
                        Text(line.text)
                            .planFont(.body)
                            .foregroundStyle(Theme.Color.appText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(.leading, Spacing.s3)
            .overlay(alignment: .leading) { Rectangle().fill(Theme.Color.appBorder).frame(width: 2) }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("What has happened")
            .accessibilityIdentifier("crewDayBookingTimeline")
        }
    }
}
