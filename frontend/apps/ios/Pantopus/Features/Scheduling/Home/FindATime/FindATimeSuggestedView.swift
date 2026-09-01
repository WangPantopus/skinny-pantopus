//
//  FindATimeSuggestedView.swift
//  Pantopus
//
//  Stream I11 — F5 Find a Time · Suggested Slots. Ranked find-a-time results
//  with per-member free/busy dots, a Best badge, expand-to-book, and a sticky
//  "Send proposal to members" (opens a time poll). Composing / no-overlap /
//  single-best / proposal-sent / booked states all first-class.
//

import SwiftUI

// swiftlint:disable:next type_body_length
struct FindATimeSuggestedView: View {
    @State private var viewModel: FindATimeSuggestedViewModel
    @State private var showTimezoneSheet = false
    @State private var showEdit = false
    @Environment(\.dismiss) private var dismiss

    init(viewModel: FindATimeSuggestedViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    private var canEdit: Bool {
        switch viewModel.phase {
        case .ready, .noOverlap: true
        default: false
        }
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationTitle("Suggested times")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if canEdit {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Edit") { showEdit = true }
                            .foregroundStyle(Theme.Color.homeDark)
                            .accessibilityIdentifier("scheduling.findATimeSuggested.edit")
                    }
                }
            }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
            .accessibilityIdentifier("scheduling.findATimeSuggested")
            .sheet(isPresented: $showTimezoneSheet) {
                TimezoneSelectorSheet(
                    selectedIdentifier: viewModel.tz,
                    accent: Theme.Color.home,
                    onSelect: { identifier in Task { await viewModel.changeTimezone(identifier) } },
                    onDone: { showTimezoneSheet = false }
                )
            }
            .sheet(isPresented: $showEdit) {
                NavigationStack {
                    FindATimeSetupView(
                        viewModel: viewModel.makeEditViewModel { draft in
                            showEdit = false
                            Task { await viewModel.applyDraft(draft) }
                        }
                    )
                }
            }
            .alert("Something went wrong", isPresented: actionErrorPresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.actionError ?? "")
            }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .loading:
            composingView
        case let .error(message):
            ErrorState(headline: "Couldn't find times", message: message) {
                await viewModel.refresh()
            }
        case .ready:
            if viewModel.isSingleBest {
                singleBestView
            } else {
                resultsView
            }
        case .noOverlap:
            noOverlapView
        case .sent:
            sentView
        case .booked:
            bookedView
        }
    }

    // MARK: Sub-head

    private var subHead: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: Spacing.s2) {
                Text(viewModel.headerSummary)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Button { showTimezoneSheet = true } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.clock, size: 12, color: Theme.Color.appTextSecondary)
                        Text(tzLabel)
                            .font(.system(size: 10.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                        Icon(.chevronDown, size: 11, color: Theme.Color.appTextSecondary)
                    }
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 5)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("scheduling.findATimeSuggested.timezone")
            }
            HStack(spacing: Spacing.s1) {
                Icon(.layers, size: 11, color: Theme.Color.home)
                Text("From everyone's personal availability.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    private var tzLabel: String {
        let zone = TimeZone(identifier: viewModel.tz)
        let abbreviation = zone?.abbreviation() ?? ""
        return abbreviation.isEmpty ? viewModel.tz : "\(abbreviation) · \(viewModel.tz)"
    }

    // MARK: Results list

    private var resultsView: some View {
        VStack(spacing: 0) {
            subHead
            ScrollView {
                LazyVStack(spacing: Spacing.s2) {
                    ForEach(viewModel.suggested) { slot in
                        slotRow(slot)
                    }
                }
                .padding(Spacing.s3)
            }
        }
        .safeAreaInset(edge: .bottom) { sendProposalBar }
    }

    private func slotRow(_ slot: SuggestedSlot) -> some View {
        let expanded = viewModel.expandedSlotStart == slot.slot.start
        let best = viewModel.isBest(slot)
        return VStack(spacing: 0) {
            Button { viewModel.toggleExpand(slot) } label: {
                HStack(spacing: Spacing.s3) {
                    VStack(alignment: .leading, spacing: 7) {
                        HStack(spacing: Spacing.s2) {
                            Text(FindATimeFormat.dayTimeLabel(utcISO: slot.slot.start, tz: viewModel.tz))
                                .font(.system(size: 13.5, weight: .bold))
                                .foregroundStyle(Theme.Color.appText)
                            if best { bestBadge }
                        }
                        HStack(spacing: Spacing.s2) {
                            MemberDotStack(members: slot.members, freeIds: slot.freeMemberIds)
                            Text(slot.coverageLabel)
                                .font(.system(size: 10.5, weight: .semibold))
                                .foregroundStyle(slot.allFree ? Theme.Color.homeDark : Theme.Color.appTextSecondary)
                            if viewModel.mode == .roundRobin, let name = slot.soleCovererName {
                                assigneePill(name)
                            }
                        }
                    }
                    Spacer(minLength: Spacing.s2)
                    Icon(expanded ? .chevronUp : .chevronDown, size: 17, color: Theme.Color.appTextMuted)
                }
                .padding(Spacing.s3)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if expanded {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    HStack(spacing: Spacing.s1) {
                        Icon(.calendarCheck, size: 14, color: Theme.Color.home)
                        Text(
                            "Book \(FindATimeFormat.dayTimeLabel(utcISO: slot.slot.start, tz: viewModel.tz)) · \(viewModel.durationMin) min"
                        )
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextStrong)
                    }
                    FindATimePrimaryButton(title: "Book it", icon: .check, isLoading: viewModel.isActing) {
                        await viewModel.book(slot)
                    }
                }
                .padding(Spacing.s3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Color.homeBg)
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(best || expanded ? Theme.Color.home : Theme.Color.appBorder, lineWidth: 1.5)
        }
    }

    private var bestBadge: some View {
        HStack(spacing: 3) {
            Icon(.star, size: 9, color: Theme.Color.homeDark)
            Text("BEST")
        }
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(Theme.Color.homeDark)
        .padding(.horizontal, Spacing.s1)
        .padding(.vertical, 2)
        .background(Theme.Color.homeBg)
        .clipShape(Capsule())
    }

    private func assigneePill(_ name: String) -> some View {
        HStack(spacing: 3) {
            Icon(.userCheck, size: 10, color: Theme.Color.business)
            Text("\(name) covers")
        }
        .font(.system(size: 9.5, weight: .bold))
        .foregroundStyle(Theme.Color.business)
        .padding(.horizontal, Spacing.s1)
        .padding(.vertical, 2)
        .background(Theme.Color.businessBg)
        .clipShape(Capsule())
    }

    private var sendProposalBar: some View {
        FindATimeSecondaryButton(title: "Send proposal to members", icon: .send, isLoading: viewModel.isActing) {
            await viewModel.sendProposal()
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s3)
        .background(.ultraThinMaterial)
    }

    // MARK: Single best

    private var singleBestView: some View {
        VStack(spacing: 0) {
            subHead
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    Text("One time works for everyone")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    if let slot = viewModel.suggested.first {
                        singleBestCard(slot)
                    }
                }
                .padding(Spacing.s3)
            }
        }
        .safeAreaInset(edge: .bottom) { sendProposalBar }
    }

    private func singleBestCard(_ slot: SuggestedSlot) -> some View {
        VStack(spacing: Spacing.s3) {
            HStack(spacing: 3) {
                Icon(.star, size: 10, color: Theme.Color.homeDark)
                Text("BEST MATCH")
            }
            .font(.system(size: 9.5, weight: .bold))
            .foregroundStyle(Theme.Color.homeDark)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(Theme.Color.homeBg)
            .clipShape(Capsule())

            VStack(spacing: 2) {
                Text(FindATimeFormat.dayLabel(utcISO: slot.slot.start, tz: viewModel.tz))
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("\(FindATimeFormat.timeLabel(utcISO: slot.slot.start, tz: viewModel.tz)) · \(viewModel.durationMin) min")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.homeDark)
            }
            HStack { MemberDotStack(members: slot.members, freeIds: slot.freeMemberIds) }
                .frame(maxWidth: .infinity)
            FindATimePrimaryButton(title: "Book it", icon: .check, isLoading: viewModel.isActing) {
                await viewModel.book(slot)
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous)
                .strokeBorder(Theme.Color.home, lineWidth: 1.5)
        }
    }

    // MARK: No overlap

    private var noOverlapView: some View {
        VStack(spacing: 0) {
            subHead
            VStack(spacing: Spacing.s4) {
                ZStack {
                    Circle().fill(Theme.Color.warningBg).frame(width: 56, height: 56)
                    Icon(.calendarX, size: 26, color: Theme.Color.warning)
                }
                VStack(spacing: 5) {
                    Text("No time works for all \(viewModel.members.count)")
                        .font(.system(size: 15.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Their free hours don't overlap this week. Loosen a constraint to see options.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 240)
                }
                VStack(spacing: Spacing.s2) {
                    FindATimePrimaryButton(title: "Make someone optional", icon: .userMinus) {
                        showEdit = true
                    }
                    FindATimeSecondaryButton(title: "Widen the window", icon: .calendarPlus) {
                        showEdit = true
                    }
                }
                .padding(.top, Spacing.s2)
            }
            .padding(Spacing.s6)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    // MARK: Proposal sent

    private var sentView: some View {
        VStack(spacing: Spacing.s4) {
            ZStack {
                Circle().fill(Theme.Color.homeBg).frame(width: 84, height: 84)
                Circle().fill(Theme.Color.home).frame(width: 52, height: 52)
                Icon(.check, size: 28, strokeWidth: 3, color: Theme.Color.appTextInverse)
            }
            VStack(spacing: Spacing.s2) {
                Text("Proposal sent to \(viewModel.proposalMemberCount) \(viewModel.proposalMemberCount == 1 ? "person" : "people")")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                Text("We'll notify you as they respond. The most-picked time gets booked.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 250)
            }
            VStack(spacing: Spacing.s2) {
                FindATimePrimaryButton(title: "Back to calendar", icon: .home) { dismiss() }
                if viewModel.createdPollId != nil {
                    FindATimeSecondaryButton(title: "View responses", icon: .barChart3) {
                        viewModel.viewProposalResponses()
                    }
                }
            }
            .padding(.top, Spacing.s2)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Booked

    private var bookedView: some View {
        VStack(spacing: Spacing.s4) {
            ZStack {
                Circle().fill(Theme.Color.homeBg).frame(width: 84, height: 84)
                Circle().fill(Theme.Color.home).frame(width: 52, height: 52)
                Icon(.calendarCheck, size: 26, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
            }
            VStack(spacing: Spacing.s2) {
                Text("Added to the family calendar")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                if let label = viewModel.bookedLabel {
                    Text("\(viewModel.title) · \(label)")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                }
            }
            FindATimePrimaryButton(title: "Back to calendar", icon: .home) { dismiss() }
                .padding(.top, Spacing.s2)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Composing

    private var composingView: some View {
        VStack(spacing: 0) {
            subHead
            ScrollView {
                VStack(spacing: Spacing.s2) {
                    VStack(spacing: 3) {
                        Text("Finding times that work for everyone")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        Text(viewModel.composingSubtitle)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    .padding(.vertical, Spacing.s3)
                    ForEach(0..<4, id: \.self) { _ in
                        VStack(alignment: .leading, spacing: Spacing.s2) {
                            Shimmer(width: 150, height: 12, cornerRadius: Radii.xs)
                            HStack(spacing: Spacing.s2) {
                                Shimmer(width: 56, height: 20, cornerRadius: Radii.lg)
                                Shimmer(width: 50, height: 9, cornerRadius: Radii.xs)
                            }
                        }
                        .padding(Spacing.s3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                        }
                    }
                }
                .padding(Spacing.s3)
            }
        }
    }

    private var actionErrorPresented: Binding<Bool> {
        Binding(
            get: { viewModel.actionError != nil },
            set: { if !$0 { viewModel.actionError = nil } }
        )
    }
}
