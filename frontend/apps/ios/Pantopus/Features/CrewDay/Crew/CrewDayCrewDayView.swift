//
//  CrewDayCrewDayView.swift
//  Pantopus
//
//  15. Before the day (build kit 01-spec.md, board `CrewDayPrep`): the
//  status, date and window, the homes booked on a slot meter, when booking
//  closes; what Pantopus said; the link, QR code and flyer to bring in more
//  homes; the money preview; and Cancel this Crew Day.
//

import SwiftUI
import UIKit

struct CrewDayCrewDayView: View {
    @State var viewModel: CrewDayCrewDayViewModel
    let onBack: () -> Void
    @State private var systemSheet: SystemSheetRequest?
    @State private var showsQR = false
    @State private var confirmsCancel = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: viewModel.day?.card.title ?? "Crew Day", onLeading: onBack)
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .sheet(item: $systemSheet) { $0.makeView() }
        .sheet(isPresented: $showsQR) {
            if let link = viewModel.day?.card.share?.url {
                CrewDayQRSheet(link: link, title: viewModel.day?.card.title ?? "Crew Day")
            }
        }
        .alert(cancelTitle, isPresented: $confirmsCancel) {
            Button("Cancel the day", role: .destructive) {
                Task { await viewModel.cancel(reason: "The crew cancelled this Crew Day.") }
            }
            Button("Keep it", role: .cancel) {}
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayPrep")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            CrewDayLoadingView()
        case let .failed(message):
            CrewDayErrorView(message: message) { await viewModel.load() }
        case let .loaded(day):
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    header(day)
                    statusCard(day)
                    if ["open", "in_progress"].contains(day.card.status), let share = day.card.share {
                        bringMore(share)
                    }
                    if let money = day.money, (money.grossCents ?? 0) > 0 { moneyCard(money, day: day) }
                    if day.canEdit, ["open", "pending_review", "draft", "declined"].contains(day.card.status) {
                        plansChange(day)
                    }
                    if let error = viewModel.actionError { CrewDayErrorText(text: error, identifier: "crewDayPrepError") }
                    if let notice = viewModel.notice {
                        Text(notice)
                            .planFont(.footnote)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .accessibilityIdentifier("crewDayPrepNotice")
                    }
                }
                .padding(Spacing.s4)
            }
            .refreshable { await viewModel.load() }
        }
    }

    // MARK: - Header

    private func header(_ day: CrewDayCrewDayDTO) -> some View {
        let card = day.card
        return CrewDayCard {
            HStack {
                CrewDayServiceTag(service: card.service)
                Spacer()
                if let chip = CrewDayCrewCopy.chip(card) { CrewDayChip(text: chip.text, tone: chip.tone) }
            }
            Text(card.title).planFont(.h3).foregroundStyle(Theme.Color.appText)
            Text(Self.when(card))
                .planFont(.body)
                .foregroundStyle(Theme.Color.appTextSecondary)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("\(card.bookedCount) of \(CrewDayFormat.homes(card.capacity)) booked")
                    .planFont(.bodyStrong)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appText)
                PlanSlotMeter(spots: card.capacity, filled: card.bookedCount)
            }
            .accessibilityElement(children: .combine)
            Text(closesLine(card))
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    /// "Tuesday, Nov 17 · Arriving 9 AM–1 PM".
    static func when(_ card: CrewDaySummaryDTO) -> String {
        let day = CrewDayFormat.longDay(card.serviceDate, timezone: card.timezone)
        return "\(day) · Arriving \(CrewDayFormat.window(card.windowStart, card.windowEnd))"
    }

    private func closesLine(_ card: CrewDaySummaryDTO) -> String {
        let closes = CrewDayFormat.instant(card.bookingClosesAt)
        let when = CrewDayFormat.dayAndTime(closes, timezone: card.timezone)
        return card.isClosed ? "Booking closed \(when)" : "Booking closes \(when)"
    }

    // MARK: - What Pantopus said

    @ViewBuilder
    private func statusCard(_ day: CrewDayCrewDayDTO) -> some View {
        switch day.card.status {
        case "draft":
            notice(
                title: "This is a draft",
                line: "Send it to Pantopus when it's ready. Neighbors can book once it's approved.",
                action: day.canEdit ? ("Send to Pantopus for approval", "crewDayPrepSubmit") : nil
            )
        case "pending_review":
            notice(title: "Waiting for Pantopus", line: "We'll tell you within a business day. The link works once it's approved.")
        case "declined":
            notice(
                title: "Pantopus didn't approve this day",
                line: day.card.reviewNote.map { "Pantopus: \($0)" } ?? "Check the details, then send it again.",
                action: day.canEdit ? ("Send it again", "crewDayPrepSubmit") : nil
            )
        case "cancelled":
            notice(title: "This Crew Day was cancelled", line: "Nobody was charged. Every home was told.")
        default:
            EmptyView()
        }
    }

    private func notice(title: String, line: String, action: (String, String)? = nil) -> some View {
        CrewDayCard {
            CrewDaySectionTitle(text: title)
            Text(line)
                .planFont(.body)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if let action {
                Button { Task { await viewModel.submit() } } label: {
                    PlanButtonLabel(title: action.0, isLoading: viewModel.working)
                }
                .planButton(.primary)
                .disabled(viewModel.working)
                .accessibilityIdentifier(action.1)
            }
        }
    }

    // MARK: - Bring in more homes

    private func bringMore(_ share: CrewDayShareDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text.planOverline("Bring in more homes")
            CrewDayCard {
                if let url = share.url {
                    Text(url)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .textSelection(.enabled)
                    HStack(spacing: Spacing.s2) {
                        Button {
                            UIPasteboard.general.string = url
                            viewModel.notice = "Link copied."
                        } label: { PlanButtonLabel(title: "Copy link", icon: .copy, kind: .tonal) }
                            .planButton(.tonal, size: .small)
                            .accessibilityIdentifier("crewDayPrepCopyLink")
                        Button { systemSheet = .share(items: [url]) } label: {
                            PlanButtonLabel(title: "Share…", icon: .share, kind: .tonal)
                        }
                        .planButton(.tonal, size: .small)
                        .accessibilityIdentifier("crewDayPrepShare")
                    }
                    HStack(spacing: Spacing.s2) {
                        Button { showsQR = true } label: { PlanButtonLabel(title: "QR code", icon: .qrCode, kind: .tonal) }
                            .planButton(.tonal, size: .small)
                            .accessibilityIdentifier("crewDayPrepQR")
                        if let flyer = share.flyerURL.flatMap(URL.init(string:)) {
                            Button { openURL(flyer) } label: {
                                PlanButtonLabel(title: "Printable flyer", icon: .printer, kind: .tonal)
                            }
                            .planButton(.tonal, size: .small)
                            .accessibilityIdentifier("crewDayPrepFlyer")
                        }
                    }
                }
            }
        }
    }

    // MARK: - Money

    private func moneyCard(_ money: CrewDayMoneyDTO, day: CrewDayCrewDayDTO) -> some View {
        CrewDayCard {
            CrewDaySectionTitle(text: "Money")
            Text(CrewDayCrewDayCopy.preview(money, homes: day.card.bookedCount))
                .planFont(.body)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("crewDayPrepMoney")
        }
    }

    // MARK: - If plans change

    private func plansChange(_: CrewDayCrewDayDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text.planOverline("If plans change")
            Button { confirmsCancel = true } label: { PlanButtonLabel(title: "Cancel this Crew Day", kind: .textDanger) }
                .planButton(.textDanger)
                .disabled(viewModel.working)
                .accessibilityIdentifier("crewDayPrepCancel")
        }
    }

    private var cancelTitle: String {
        let homes = viewModel.day?.card.bookedCount ?? 0
        return homes > 0 ? "Cancel for all \(CrewDayFormat.homes(homes))? Nobody is charged." : "Cancel this Crew Day?"
    }
}

enum CrewDayCrewDayCopy {
    /// "If all 6 are done: $1,020 charged · you receive $918 after the 10% founding fee."
    static func preview(_ money: CrewDayMoneyDTO, homes: Int) -> String {
        let gross = CrewDayFormat.price(money.grossCents ?? 0)
        guard let net = money.netCents, let rate = money.feeRate else { return "If all \(homes) are done: \(gross) charged." }
        return "If all \(homes) are done: \(gross) charged · you receive \(CrewDayFormat.price(net)) after the \(Int(rate))% fee."
    }
}
