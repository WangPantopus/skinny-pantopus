//
//  GatedSchedulerView.swift
//  Pantopus
//
//  Stream I10 — F15 Permission-Gated Scheduler View.
//  The Home Calendar/Agenda in read-only mode for a member lacking
//  `calendar.edit`: no FAB, no per-row edit, a slim info hint bar, and the
//  member's own assignments pinned + actionable (Accept / Decline). A member
//  lacking `calendar.view` sees the no-access state. Home pillar green; own
//  slots in Personal sky.
//

import SwiftUI

struct GatedSchedulerView: View {
    @State private var viewModel: GatedSchedulerViewModel

    init(viewModel: GatedSchedulerViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .navigationTitle("Calendar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if viewModel.phase == .loaded || viewModel.phase == .loading {
                        accessAction
                    }
                }
            }
            .background(Theme.Color.appBg)
            .accessibilityIdentifier("gatedScheduler")
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
    }

    @ViewBuilder private var accessAction: some View {
        if viewModel.requested {
            HStack(spacing: 5) {
                Icon(.clock, size: 12, color: Theme.Color.appTextMuted)
                Text("Request sent")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 5)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(Capsule())
            .accessibilityIdentifier("gatedScheduler_requestSent")
        } else {
            Button {
                viewModel.requestAccess()
            } label: {
                HStack(spacing: 5) {
                    Icon(.shieldPlus, size: 12, color: Theme.Color.homeDark)
                    Text("Ask to manage")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.Color.homeDark)
                }
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 5)
                .background(Theme.Color.homeBg)
                .clipShape(Capsule())
                // Design: pale-green pill carries a 1px green-200 (`H.bg200`)
                // border; no exact green-200 token exists, so the home accent at
                // low opacity reproduces the faint outline.
                .overlay(
                    Capsule().stroke(Theme.Color.home.opacity(0.25), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("gatedScheduler_askToManage")
        }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.phase {
        case .loading:
            VStack(spacing: 0) {
                HintBar()
                loadingList
            }
        case .noAccess:
            EmptyState(
                icon: .shieldAlert,
                headline: "No access to this schedule",
                subcopy: "You don't have permission to view this household's calendar. Ask an admin to give you access.",
                cta: viewModel.requested ? nil : EmptyState.CTA(title: "Ask to manage") {
                    await MainActor.run { viewModel.requestAccess() }
                },
                tint: Theme.Color.homeBg,
                accent: Theme.Color.home
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case let .error(message):
            EmptyState(
                icon: .cloudOff,
                headline: "Couldn't load the schedule",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") { await viewModel.load() }
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .loaded:
            loaded
        }
    }

    private var loaded: some View {
        VStack(spacing: 0) {
            if viewModel.requested {
                HomeInfoBanner(
                    icon: .clock,
                    title: "Request sent",
                    message: "We asked an admin to give you scheduling access. You'll be notified when they respond."
                )
                .padding(.horizontal, Spacing.s3)
                .padding(.top, Spacing.s2)
            } else {
                HintBar()
            }
            // Design: the read-only (Frame 1) and pending (Frame 3) frames show
            // the MonthStrip; the my-assignments frame (Frame 2) omits it so the
            // pinned assignments lead the body.
            if viewModel.assignments.isEmpty, let strip = viewModel.monthStrip {
                MonthStripHeader(
                    state: strip,
                    onSelectDay: { _ in },
                    onPrevMonth: { viewModel.shiftWeek(.previous) },
                    onNextMonth: { viewModel.shiftWeek(.next) }
                )
            }
            agenda
        }
    }

    private var agenda: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                if !viewModel.assignments.isEmpty {
                    HStack(spacing: Spacing.s1) {
                        Icon(.userCheck, size: 13, color: Theme.Color.personal)
                        Text("MY ASSIGNMENTS · \(viewModel.assignments.count)")
                            .font(.system(size: 11, weight: .bold))
                            .tracking(0.6)
                            .foregroundStyle(Theme.Color.personal)
                    }
                    .padding(.horizontal, Spacing.s1)
                    .padding(.top, Spacing.s1)
                    ForEach(viewModel.assignments) { item in
                        AssignmentRow(
                            item: item,
                            isActioning: viewModel.actioningId == item.id,
                            onAccept: { Task { await viewModel.accept(item) } },
                            onDecline: { Task { await viewModel.decline(item) } }
                        )
                    }
                    Color.clear.frame(height: Spacing.s1)
                }
                ForEach(viewModel.agendaSections) { section in
                    Text(section.header)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.horizontal, Spacing.s1)
                        .padding(.top, Spacing.s1)
                    ForEach(section.items) { item in
                        // Read-only — taps are inert in the gated mode.
                        HomeAgendaRowCard(item: item) {}
                            .allowsHitTesting(false)
                    }
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
        }
    }

    private var loadingList: some View {
        ScrollView {
            VStack(spacing: Spacing.s2) {
                ForEach(0..<5, id: \.self) { _ in HomeAgendaSkeletonRow() }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
        }
    }
}

// MARK: - Hint bar

private struct HintBar: View {
    var text = "You can view the schedule. Ask an admin to make changes."
    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.eye, size: 14, color: Theme.Color.info)
            Text(text)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Color.primary800)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.infoBg)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.infoLight).frame(height: 1)
        }
    }
}

// MARK: - Assignment row (own slot — Personal sky outline)

private struct AssignmentRow: View {
    let item: HomeAgendaItem
    let isActioning: Bool
    let onAccept: @MainActor () -> Void
    let onDecline: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            HStack(spacing: Spacing.s3) {
                VStack(spacing: 1) {
                    Text(item.time)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .monospacedDigit()
                    if !item.ampm.isEmpty {
                        Text(item.ampm)
                            .font(.system(size: 9.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
                .frame(width: 42)
                Rectangle().fill(Theme.Color.infoLight).frame(width: 1)
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title)
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    HStack(spacing: Spacing.s1) {
                        HStack(spacing: Spacing.s1) {
                            Icon(.userCheck, size: 10, color: Theme.Color.personal)
                            Text("Your slot")
                                .font(.system(size: 9.5, weight: .bold))
                                .foregroundStyle(Theme.Color.personal)
                        }
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(Theme.Color.personalBg)
                        .clipShape(Capsule())
                        if let location = item.location {
                            Text(location)
                                .font(.system(size: 10.5))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: Spacing.s2) {
                Button(action: onAccept) {
                    actionLabel(icon: .check, title: "Accept", filled: true)
                }
                .buttonStyle(.plain)
                .disabled(isActioning)
                .accessibilityIdentifier("gatedScheduler_accept_\(item.id)")
                Button(action: onDecline) {
                    actionLabel(icon: .x, title: "Decline", filled: false)
                }
                .buttonStyle(.plain)
                .disabled(isActioning)
                .accessibilityIdentifier("gatedScheduler_decline_\(item.id)")
            }
            .opacity(isActioning ? 0.5 : 1)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 11)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.infoLight, lineWidth: 1.5)
        )
        // Design: subtle sky drop shadow `0 1px 3px rgba(2,132,199,0.08)`.
        .shadow(color: Theme.Color.personal.opacity(0.08), radius: 1.5, x: 0, y: 1)
    }

    private func actionLabel(icon: PantopusIcon, title: String, filled: Bool) -> some View {
        HStack(spacing: 5) {
            Icon(icon, size: 13, color: filled ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            Text(title)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(filled ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
        }
        .frame(maxWidth: .infinity, minHeight: 34)
        .background(filled ? Theme.Color.home : Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(filled ? Color.clear : Theme.Color.appBorderStrong, lineWidth: 1)
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        GatedSchedulerView(viewModel: GatedSchedulerViewModel(homeId: "preview", currentUserId: "me"))
    }
}
#endif
