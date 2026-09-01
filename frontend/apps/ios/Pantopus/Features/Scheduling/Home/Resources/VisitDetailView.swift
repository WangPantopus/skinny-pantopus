//
//  VisitDetailView.swift
//  Pantopus
//
//  Stream I12 — F14 Visit Detail. Header + derived status + host members +
//  access note, with Reschedule / Edit / Cancel / Book-again actions. The edit
//  sheet writes through the home-event endpoints.
//

import SwiftUI

// swiftlint:disable:next type_body_length
struct VisitDetailView: View {
    @State private var viewModel: VisitDetailViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: VisitDetailViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                loadingBody
            case .loaded:
                loadedBody
            case let .error(message):
                errorBody(message)
            case .removed:
                removedBody
            }
        }
        .background(Theme.Color.appBg)
        .navigationTitle("Visit")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // Design: Edit button is active (home-green) in non-terminal states
            // (confirmed), muted (gray) in terminal states (done / completed).
            // The full 9-state lifecycle (offered/reserved/link states) is a v1
            // deferral — see F14 finding 2 and 3.
            ToolbarItem(placement: .topBarTrailing) {
                if case .loaded = viewModel.state {
                    switch viewModel.lifecycle {
                    case .confirmed:
                        Button("Edit") { viewModel.beginEdit() }
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.home)
                            .accessibilityIdentifier("scheduling.visitDetail.edit")
                    case .done:
                        // Terminal state: Edit button present but muted per design
                        // (design frames Completed/Cancelled/No-show all show muted Edit).
                        Button("Edit") { viewModel.beginEdit() }
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .disabled(true)
                            .accessibilityIdentifier("scheduling.visitDetail.edit")
                    }
                }
            }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.visitDetail")
        .task { await viewModel.load() }
        .sheet(isPresented: $viewModel.isEditing) {
            VisitEditSheet(viewModel: viewModel)
        }
        .alert("Couldn't update", isPresented: actionErrorPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.actionError ?? "")
        }
        .confirmationDialog(
            "Cancel this visit?",
            isPresented: $viewModel.showCancelConfirm,
            titleVisibility: .visible
        ) {
            Button("Cancel visit", role: .destructive) {
                Task { if await viewModel.cancelVisit() { dismiss() } }
            }
            Button("Keep", role: .cancel) {}
        } message: {
            Text("This removes the visit from the family calendar.")
        }
    }

    // MARK: Loaded

    private var loadedBody: some View {
        VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    headerCard
                    banner
                    statusTimeline
                    hostsCard
                    if viewModel.entryNote != nil {
                        accessCard
                    }
                }
                .padding(Spacing.s3)
                .padding(.bottom, Spacing.s10)
            }
            .refreshable { await viewModel.refresh() }
            footer
        }
    }

    private var headerCard: some View {
        SectionCard {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    // Design avatar gradient runs teal-400 2dd4bf → teal-600
                    // 0d9488. No teal-400/visit-teal token exists in the theme,
                    // so the deep teal-600 `categoryUnboxing` seeds the top stop
                    // into teal-700 `categoryUnboxingDark`; white "PV" initials
                    // stay legible on this pairing. The exact teal-400 top stop
                    // needs a dedicated visit-teal colorset (out of this file's
                    // scope) — tracked as deferred.
                    Circle().fill(
                        LinearGradient(
                            colors: [Theme.Color.categoryUnboxing, Theme.Color.categoryUnboxingDark],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    Text(Self.initials(viewModel.title))
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(viewModel.title)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    visitTypeChip
                }
                Spacer(minLength: 0)
                if let terminal = viewModel.terminalChip {
                    terminalChip(label: terminal.label, icon: terminal.icon)
                }
            }
            HStack(spacing: Spacing.s2) {
                Icon(.clock, size: 14, color: timeColor)
                Text(viewModel.timeText)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(timeColor)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
    }

    /// Teal "Vendor"/"Guest" category chip (the design accents the visit type
    /// with teal `ccfbf1`/`0f766e`, distinct from the home-green pillar).
    private var visitTypeChip: some View {
        HStack(spacing: Spacing.s1) {
            Icon(viewModel.kind.icon, size: 10, color: Theme.Color.categoryUnboxingDark)
            Text(viewModel.kind.label)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.categoryUnboxingDark)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 2)
        .background(Theme.Color.categoryUnboxingBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }

    /// Header terminal chip (Completed) shown in the `done` state.
    private func terminalChip(label: String, icon: PantopusIcon) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon, size: 11, color: Theme.Color.success)
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }

    // MARK: Status timeline

    private static let statusSteps = ["Offered", "Reserved", "Confirmed", "Done"]

    /// 4-step Offered → Reserved → Confirmed → Done progress, mirroring the
    /// design's `StatusTimeline`. `current` is the active step; earlier steps
    /// render completed (check), later steps muted.
    private var statusTimeline: some View {
        let current = viewModel.statusStep
        return SectionCard {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text("Status")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(0.6)
                    .foregroundStyle(Theme.Color.homeDark)
                    .accessibilityAddTraits(.isHeader)
                HStack(alignment: .top, spacing: Spacing.s0) {
                    ForEach(Array(Self.statusSteps.enumerated()), id: \.offset) { index, label in
                        statusStepNode(index: index, label: label, current: current)
                        if index < Self.statusSteps.count - 1 {
                            Rectangle()
                                .fill(index < current ? Theme.Color.home : Theme.Color.appBorder)
                                .frame(height: 2)
                                .frame(maxWidth: .infinity)
                                .padding(.top, 10)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
    }

    private func statusStepNode(index: Int, label: String, current: Int) -> some View {
        let done = index < current
        let active = index == current
        let filled = done || active
        return VStack(spacing: 5) {
            ZStack {
                Circle()
                    .fill(filled ? Theme.Color.home : Theme.Color.appSurfaceSunken)
                if active {
                    Circle()
                        .stroke(Theme.Color.home, lineWidth: 2)
                        .padding(-3)
                }
                if done {
                    Icon(.check, size: 11, strokeWidth: 3, color: Theme.Color.appTextInverse)
                } else {
                    Text("\(index + 1)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(filled ? Theme.Color.appTextInverse : Theme.Color.appTextMuted)
                }
            }
            .frame(width: 22, height: 22)
            Text(label)
                .font(.system(size: 9, weight: active ? .bold : .medium))
                .foregroundStyle(active ? Theme.Color.homeDark : (done ? Theme.Color.appTextStrong : Theme.Color.appTextMuted))
                .multilineTextAlignment(.center)
        }
        .frame(width: 46)
    }

    @ViewBuilder private var banner: some View {
        switch viewModel.lifecycle {
        case .confirmed:
            // Design `home`-tone banner for the confirmed/on-calendar state.
            calloutBanner(
                icon: .calendarCheck,
                title: "On the home calendar",
                body: "This visit shows on the family schedule.",
                bg: Theme.Color.homeBg,
                fg: Theme.Color.home
            )
        case .done:
            // Design's Completed state carries no banner — only the header
            // terminal chip + the timeline at Done.
            EmptyView()
        }
    }

    private func calloutBanner(icon: PantopusIcon, title: String, body: String, bg: Color, fg: Color) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(icon, size: 15, color: fg)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(fg)
                Text(body)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            Spacer(minLength: 0)
        }
        .padding(Spacing.s3)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var hostsCard: some View {
        SectionCard(overline: "Host members") {
            HStack(spacing: Spacing.s2) {
                if viewModel.hostMembers.isEmpty {
                    Icon(.users, size: 18, color: Theme.Color.appTextMuted)
                } else {
                    HomeMemberStack(members: viewModel.hostMembers, size: 30)
                }
                Text(viewModel.hostSummary)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: 0)
            }
        }
    }

    private var accessCard: some View {
        SectionCard {
            HStack(spacing: Spacing.s3) {
                Icon(.keyRound, size: 16, color: Theme.Color.appTextStrong)
                    .frame(width: 32, height: 32)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    ResourceOverlineLabel(text: "Entry note")
                    Text(viewModel.entryNote ?? "")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                }
                Spacer(minLength: 0)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
        }
    }

    private var footer: some View {
        HStack(spacing: Spacing.s2) {
            switch viewModel.lifecycle {
            case .confirmed:
                HomeSecondaryButton(title: "Cancel", icon: .x, tone: Theme.Color.error) {
                    viewModel.showCancelConfirm = true
                }
                HomePrimaryButton(title: "Reschedule", icon: .calendarClock) {
                    viewModel.beginEdit()
                }
            case .done:
                HomeSecondaryButton(title: "Book again", icon: .arrowsRepeat) {
                    viewModel.bookAgain()
                }
            }
            // Design footer always carries a trailing `message-circle` text btn.
            Button { viewModel.messageVisitor() } label: {
                Icon(.messageCircle, size: 18, color: Theme.Color.appTextStrong)
                    .frame(width: 46, height: 46)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Message")
            .accessibilityIdentifier("scheduling.visitDetail.message")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    // MARK: Loading / error / removed

    private var loadingBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(height: 110, cornerRadius: Radii.lg)
                Shimmer(height: 60, cornerRadius: Radii.lg)
                Shimmer(height: 70, cornerRadius: Radii.lg)
            }
            .padding(Spacing.s3)
        }
    }

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.cloudOff, size: 40, color: Theme.Color.error)
            Text("Couldn't load this visit")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            HomePrimaryButton(title: "Retry", icon: .refreshCw) {
                Task { await viewModel.load() }
            }
            .frame(maxWidth: 200)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var removedBody: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.xCircle, size: 40, color: Theme.Color.appTextMuted)
            Text("This visit was cancelled")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
            Text("It's no longer on the family calendar.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            HomeSecondaryButton(title: "Go back", icon: .chevronLeft) { dismiss() }
                .frame(maxWidth: 200)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var timeColor: Color {
        viewModel.lifecycle == .done ? Theme.Color.appTextSecondary : Theme.Color.home
    }

    private static func initials(_ title: String) -> String {
        let parts = title.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init).joined()
        return letters.isEmpty ? "V" : letters.uppercased()
    }

    private var actionErrorPresented: Binding<Bool> {
        Binding(get: { viewModel.actionError != nil }, set: { if !$0 { viewModel.actionError = nil } })
    }
}

// MARK: - Edit sheet

/// Local edit/reschedule sheet for a concrete visit (no route — presented from
/// F14). Writes through `PUT …/events/:eventId`.
private struct VisitEditSheet: View {
    @Bindable var viewModel: VisitDetailViewModel

    var body: some View {
        FormShell(
            title: "Edit visit",
            leading: .close,
            rightActionLabel: "Save",
            isValid: viewModel.editValid,
            isDirty: true,
            isSaving: viewModel.isSavingEdit,
            onClose: { viewModel.isEditing = false },
            onCommit: { Task { await viewModel.saveEdit() } },
            content: {
                FormFieldGroup("Details") {
                    TextField("Visit title", text: $viewModel.editTitle)
                        .font(Theme.Font.body)
                        .foregroundStyle(Theme.Color.appText)
                    Divider().background(Theme.Color.appBorderSubtle)
                    Text("Visit type")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                    HStack(spacing: Spacing.s2) {
                        ForEach(VisitKind.allCases, id: \.self) { kind in
                            SelectChipIcon(label: kind.label, icon: kind.icon, isOn: kind == viewModel.editKind) {
                                viewModel.editKind = kind
                            }
                        }
                        Spacer()
                    }
                }
                FormFieldGroup("Who must be home") {
                    ForEach(Array(viewModel.members.enumerated()), id: \.element.id) { index, member in
                        Button { viewModel.toggleEditHost(member.id) } label: {
                            HStack(spacing: Spacing.s2) {
                                ResourceHomeMemberAvatar(member: member, size: 30)
                                Text(member.name)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Theme.Color.appText)
                                Spacer()
                                SelectionCheck(isOn: viewModel.editWhoIsHome.contains(member.id))
                            }
                        }
                        .buttonStyle(.plain)
                        if index < viewModel.members.count - 1 {
                            Divider().background(Theme.Color.appBorderSubtle)
                        }
                    }
                }
                FormFieldGroup("When") {
                    DatePicker("Date", selection: $viewModel.editDate, displayedComponents: .date)
                        .tint(Theme.Color.home)
                    Divider().background(Theme.Color.appBorderSubtle)
                    DatePicker("Start time", selection: $viewModel.editStart, displayedComponents: .hourAndMinute)
                        .tint(Theme.Color.home)
                    Divider().background(Theme.Color.appBorderSubtle)
                    CounterRow(label: "Visit length", value: $viewModel.editDuration, unit: "hr", range: 1...12)
                }
                FormFieldGroup("Access") {
                    TextField("Entry note for the visitor", text: $viewModel.editNote)
                        .font(Theme.Font.body)
                        .foregroundStyle(Theme.Color.appText)
                }
            }
        )
        .accessibilityIdentifier("scheduling.visitEdit")
    }
}
