//
//  CrewDaysCrewView.swift
//  Pantopus
//
//  13. Crew Days for a crew (build kit 01-spec.md, board `CrewList`):
//  Today, Upcoming, Waiting for Pantopus, Drafts and Past, New Crew Day,
//  and a readiness card until the business can run one. Opened from the
//  side menu's Business section and the crew's notices.
//

import SwiftUI

struct CrewDaysCrewView: View {
    @State var viewModel: CrewDaysCrewViewModel
    let onBack: () -> Void
    let onOpenDay: (String) -> Void
    let onNewDay: (String) -> Void
    /// A readiness step: the business page, payouts or documents.
    let onOpenBusinessStep: (HubRoute) -> Void
    /// A day's route (Today's days).
    var onOpenRoute: (String) -> Void = { _ in }

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: "Crew Days", onLeading: onBack)
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        // A day sent, cancelled or changed on a screen above this one.
        .onReceive(NotificationCenter.default.publisher(for: .crewDayChanged)) { _ in
            Task { await viewModel.refresh() }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDaysCrew")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            CrewDayLoadingView()
        case let .failed(message):
            CrewDayErrorView(message: message) { await viewModel.refresh() }
        case let .loaded(response):
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    if viewModel.businesses.count > 1 { businessPicker }
                    if let readiness = response.readiness, !readiness.isReady || !readiness.documentsVerified {
                        readinessCard(readiness)
                    }
                    if response.isEmpty {
                        empty(ready: response.readiness?.isReady ?? true)
                    } else {
                        section("Today", response.today, route: true)
                        section("Upcoming", response.upcoming)
                        section("Waiting for Pantopus", response.pending)
                        section("Drafts", response.drafts)
                        section("Past", response.past)
                    }
                }
                .padding(Spacing.s4)
            }
            .refreshable { await viewModel.refresh() }
            if response.canEdit, response.readiness?.isReady ?? true, let businessId = viewModel.businessId {
                CrewDayFooter {
                    Button { onNewDay(businessId) } label: {
                        PlanButtonLabel(title: "New Crew Day", icon: .plus)
                    }
                    .planButton(.primary)
                    .accessibilityIdentifier("crewDaysCrewNew")
                }
            }
        }
    }

    // MARK: - Business picker

    private var businessPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(viewModel.businesses) { membership in
                    let selected = membership.businessUserId == viewModel.businessId
                    Button { Task { await viewModel.select(membership.businessUserId) } } label: {
                        Text(membership.business.name ?? "Business")
                            .planFont(.label)
                            .foregroundStyle(selected ? Theme.Color.appTextInverse : Theme.Color.appText)
                            .padding(.horizontal, Spacing.s3)
                            .frame(minHeight: 36)
                            .background(Capsule().fill(selected ? Theme.Color.business : Theme.Color.appSurfaceSunken))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                    .accessibilityIdentifier("crewDaysCrewBusiness_\(membership.businessUserId)")
                }
            }
        }
    }

    // MARK: - Readiness

    private func readinessCard(_ readiness: CrewDayReadinessDTO) -> some View {
        CrewDayCard {
            CrewDaySectionTitle(text: readiness.isReady ? "Add the badge" : "Before your first Crew Day")
            if !readiness.isReady {
                Text("Pantopus checks every Crew Day before neighbors can book it.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if readiness.missing.contains("publish_page") || !readiness.published {
                readinessRow("Publish your business page", line: "Households see it on the invitation.", id: "publish") {
                    .businessOwner(businessId: $0)
                }
            }
            if readiness.missing.contains("set_up_payouts") || !readiness.payoutsEnabled {
                readinessRow("Set up payouts", line: "Charges reach your bank through Stripe.", id: "payouts") {
                    .businessPaymentsOwner(businessId: $0)
                }
            }
            if !readiness.documentsVerified {
                readinessRow(
                    "Add your insurance and registration",
                    line: "Optional: needed for the \"Insured and registered\" badge.",
                    id: "documents"
                ) {
                    .businessLegal(businessId: $0)
                }
            }
        }
    }

    private func readinessRow(
        _ title: String,
        line: String,
        id: String,
        route: @escaping (String) -> HubRoute
    ) -> some View {
        Button {
            if let businessId = viewModel.businessId { onOpenBusinessStep(route(businessId)) }
        } label: {
            HStack(spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    Text(line)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("crewDaysCrewReady_\(id)")
    }

    // MARK: - Sections

    @ViewBuilder
    private func section(_ title: String, _ days: [CrewDaySummaryDTO], route: Bool = false) -> some View {
        if !days.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text.planOverline(title)
                ForEach(days) { day in
                    row(day)
                    if route, ["open", "in_progress"].contains(day.status) {
                        Button("Open the route") { onOpenRoute(day.id) }
                            .planButton(.primary, size: .small)
                            .accessibilityIdentifier("crewDaysCrewRoute_\(day.id)")
                    }
                }
            }
        }
    }

    private func row(_ day: CrewDaySummaryDTO) -> some View {
        Button { onOpenDay(day.id) } label: {
            CrewDayCard {
                HStack(alignment: .top, spacing: Spacing.s3) {
                    CrewDayTile()
                    VStack(alignment: .leading, spacing: 2) {
                        Text(day.title)
                            .planFont(.rowTitle)
                            .foregroundStyle(Theme.Color.appText)
                            .multilineTextAlignment(.leading)
                        Text(CrewDayCrewCopy.when(day))
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Text(CrewDayCrewCopy.counts(day))
                            .planFont(.small)
                            .monospacedDigit()
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        if day.status == "declined", let note = day.reviewNote, !note.isEmpty {
                            Text("Pantopus: \(note)")
                                .planFont(.small)
                                .foregroundStyle(Theme.Color.error)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if let chip = CrewDayCrewCopy.chip(day) {
                        CrewDayChip(text: chip.text, tone: chip.tone)
                    }
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("crewDaysCrewRow_\(day.id)")
    }

    private func empty(ready: Bool) -> some View {
        VStack(spacing: Spacing.s3) {
            CrewDayTile(size: 56)
            Text("No Crew Days yet")
                .planFont(.h3)
                .foregroundStyle(Theme.Color.appText)
            Text(ready
                ? "Pick a street and a date and set your prices. Pantopus checks it within a business day."
                : "Finish the steps above, then pick a street and a date.")
                .planFont(.body)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s8)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("crewDaysCrewEmpty")
    }
}

/// The crew list's words for one day.
enum CrewDayCrewCopy {
    /// "Tue, Nov 17 · 9 AM–1 PM".
    static func when(_ day: CrewDaySummaryDTO) -> String {
        [CrewDayFormat.shortDay(day.serviceDate, timezone: day.timezone), CrewDayFormat.window(day.windowStart, day.windowEnd)]
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    /// "6 of 10 booked · 1 price to confirm", or "8 homes · $1,440 charged" once it's done.
    static func counts(_ day: CrewDaySummaryDTO) -> String {
        if day.status == "done" {
            let homes = CrewDayFormat.homes(day.doneCount)
            return day.chargedCents > 0 ? "\(homes) · \(CrewDayFormat.price(day.chargedCents)) charged" : homes
        }
        var parts = ["\(day.bookedCount) of \(day.capacity) booked"]
        if day.priceChecks > 0 {
            parts.append(day.priceChecks == 1 ? "1 price to confirm" : "\(day.priceChecks) prices to confirm")
        }
        if day.releaseAsks > 0 {
            parts.append(day.releaseAsks == 1 ? "1 home asks to cancel" : "\(day.releaseAsks) homes ask to cancel")
        }
        return parts.joined(separator: " · ")
    }

    static func chip(_ day: CrewDaySummaryDTO) -> (text: String, tone: CrewDayChip.Tone)? {
        switch day.status {
        case "open": day.isFull ? ("Full", .good) : ("Open", .good)
        case "in_progress": ("Today", .business)
        case "pending_review": ("Waiting for approval", .waiting)
        case "declined": ("Not approved", .bad)
        case "draft": ("Draft", .neutral)
        case "cancelled": ("Cancelled", .bad)
        case "done": ("Done", .neutral)
        default: nil
        }
    }
}
