//
//  BookResourceView.swift
//  Pantopus
//
//  Stream I12 — F12 Book a Resource. Hour grid + rule-aware conflict line +
//  for-whom picker + sticky submit. 409 → Foundation SlotTakenSheet. Resolves
//  to a confirmed / approval-requested success screen.
//

import SwiftUI

// swiftlint:disable:next type_body_length
struct BookResourceView: View {
    @State private var viewModel: BookResourceViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: BookResourceViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        Group {
            switch viewModel.phase {
            case .loading:
                loadingBody
            case .form:
                formBody
            case let .error(message):
                errorBody(message)
            case let .success(approval):
                successBody(approval: approval)
            }
        }
        .background(Theme.Color.appBg)
        .navigationTitle(navTitle)
        .navigationBarTitleDisplayMode(.inline)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.bookResource")
        .task { await viewModel.load() }
        .sheet(item: $viewModel.slotConflict) { conflict in
            SlotTakenSheet(
                mode: conflict.alternatives.isEmpty ? .fullyBooked : .alternatives,
                alternatives: conflict.alternatives,
                takenTimeLabel: conflict.takenLabel,
                timeZoneIdentifier: ResourceTime.tz,
                accent: Theme.Color.home,
                onSelect: { viewModel.applyAlternative($0) },
                onPickAnotherTime: { viewModel.dismissConflict() }
            )
            .presentationDetents([.medium, .large])
        }
        .alert("Couldn't book", isPresented: saveErrorPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.saveError ?? "")
        }
    }

    private var navTitle: String {
        switch viewModel.phase {
        case .success: ""
        default: viewModel.resourceName.isEmpty ? "Book" : "Book \(viewModel.resourceName)"
        }
    }

    // MARK: Form

    private var formBody: some View {
        VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    reminderRow
                    whenSection
                    forWhomSection
                    notesSection
                }
                .padding(Spacing.s3)
                .padding(.bottom, Spacing.s6)
            }
            stickyFooter
        }
        .opacity(viewModel.isSubmitting ? 0.45 : 1)
        .allowsHitTesting(!viewModel.isSubmitting)
        .overlay {
            if viewModel.isSubmitting {
                submittingOverlay
            }
        }
    }

    private var submittingOverlay: some View {
        VStack(spacing: Spacing.s2) {
            SpinningLoader(size: 26, color: Theme.Color.home)
            Text("Booking the charger")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.horizontal, Spacing.s6)
        .padding(.vertical, Spacing.s4)
        .background(Theme.Color.appSurface.opacity(0.9))
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .shadow(color: Color.black.opacity(0.1), radius: 12, y: 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Booking the charger")
    }

    private var reminderRow: some View {
        // Design RulesReminder is a content-hugging flex-row (gap 6, wrapping).
        HStack(spacing: Spacing.s1 + 2) {
            ForEach(viewModel.ruleChips) { chip in
                RuleChip(icon: chip.icon, text: chip.text, tone: .neutral)
            }
            Spacer(minLength: 0)
        }
    }

    private var whenSection: some View {
        SectionCard(overline: "When") {
            HStack {
                Button { viewModel.stepDay(-1) } label: {
                    Icon(.chevronLeft, size: 18, color: viewModel.canStepBack ? Theme.Color.appTextStrong : Theme.Color.appTextMuted)
                }
                .disabled(!viewModel.canStepBack)
                .accessibilityLabel("Previous day")
                Spacer()
                Text(viewModel.dayLabel)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Button { viewModel.stepDay(1) } label: {
                    Icon(.chevronRight, size: 18, color: Theme.Color.appTextStrong)
                }
                .accessibilityLabel("Next day")
            }
            hourGrid
            if let status = viewModel.statusLine {
                statusPill(status)
            }
        }
    }

    private var hourGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: 4), spacing: Spacing.s2) {
            ForEach(viewModel.hours, id: \.self) { hour in
                let state = viewModel.cellState(for: hour)
                Button { viewModel.tap(hour: hour) } label: {
                    Text(Self.hourLabel(hour))
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundStyle(cellForeground(state))
                        .strikethrough(state == .taken)
                        .frame(maxWidth: .infinity, minHeight: 34)
                        .background(cellBackground(state))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .stroke(cellBorder(state), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        .opacity(state == .off ? 0.5 : 1)
                }
                .buttonStyle(.plain)
                .disabled(state == .off)
                .accessibilityLabel("\(Self.hourLabel(hour)) \(Self.a11y(state))")
            }
        }
    }

    private func statusPill(_ status: (tone: BookResourceViewModel.StatusTone, text: String)) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(statusIcon(status.tone), size: 14, color: statusColor(status.tone))
            Text(status.text)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(statusColor(status.tone))
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(statusBg(status.tone))
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    private var forWhomSection: some View {
        SectionCard(overline: "For whom") {
            Menu {
                ForEach(viewModel.members) { member in
                    Button(member.name) { viewModel.forWhom = member }
                }
            } label: {
                HStack(spacing: Spacing.s2) {
                    if let member = viewModel.forWhom {
                        ResourceHomeMemberAvatar(member: member, size: 28)
                        Text(member.name)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                    } else {
                        Text("Choose a member")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer()
                    Icon(.chevronDown, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(Spacing.s2)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .disabled(viewModel.members.isEmpty)
        }
    }

    private var notesSection: some View {
        SectionCard(overline: "Notes") {
            TextField("Add a note (optional)", text: $viewModel.note, axis: .vertical)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(3...6)
                .padding(Spacing.s2)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("scheduling.bookResource.noteField")
        }
    }

    private var stickyFooter: some View {
        HomePrimaryButton(
            title: "Submit booking",
            icon: .check,
            isEnabled: viewModel.canSubmit,
            isLoading: viewModel.isSubmitting
        ) {
            Task { await viewModel.submit() }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    // MARK: Success / loading / error

    private func successBody(approval: Bool) -> some View {
        let accent = approval ? Theme.Color.warning : Theme.Color.home
        // Design halo: `radial-gradient(circle at 30% 30%, bg50, bg100)` —
        // confirmed fades homeBg→homeBg (the lighter `f0fdf4` inner tint has
        // no token); approval fades warningBg→warningLight. Both stay in-family
        // (never a white fade).
        let haloInner = approval ? Theme.Color.warningBg : Theme.Color.homeBg
        let haloOuter = approval ? Theme.Color.warningLight : Theme.Color.homeBg
        return VStack(spacing: Spacing.s4) {
            ZStack {
                // 84pt radial-gradient halo (lit from the upper-left).
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [haloInner, haloOuter],
                            center: UnitPoint(x: 0.3, y: 0.3),
                            startRadius: 0,
                            endRadius: 60
                        )
                    )
                    .frame(width: 84, height: 84)
                // Inset 52pt solid accent disc with a coloured glow.
                Circle()
                    .fill(accent)
                    .frame(width: 52, height: 52)
                    .shadow(color: accent.opacity(0.3), radius: 10, y: 8)
                Icon(approval ? .clock : .check, size: 28, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
            }
            .frame(width: 84, height: 84)
            Text(viewModel.successTitle)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text(viewModel.successBody)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            if !viewModel.successNote.isEmpty {
                HStack(spacing: Spacing.s1) {
                    Icon(.calendarCheck, size: 13, color: Theme.Color.homeDark)
                    Text(viewModel.successNote)
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundStyle(Theme.Color.homeDark)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.homeBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
            }
            HomePrimaryButton(title: "Back to calendar", icon: .house) {
                viewModel.backToCalendar()
            }
            .frame(maxWidth: 240)
            .padding(.top, Spacing.s2)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var loadingBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(width: 200, height: 20)
            Shimmer(height: 160, cornerRadius: Radii.lg)
            Shimmer(height: 70, cornerRadius: Radii.lg)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.cloudOff, size: 40, color: Theme.Color.error)
            Text("Couldn't open this resource")
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

    // MARK: Cell + status styling

    private func cellForeground(_ state: BookResourceViewModel.CellState) -> Color {
        switch state {
        case .selected: Theme.Color.appTextInverse
        case .selectedConflict: Theme.Color.error
        case .taken, .off: Theme.Color.appTextMuted
        case .free: Theme.Color.appTextStrong
        }
    }

    private func cellBackground(_ state: BookResourceViewModel.CellState) -> Color {
        switch state {
        case .selected: Theme.Color.home
        case .selectedConflict: Theme.Color.errorBg
        case .taken, .off: Theme.Color.appSurfaceSunken
        case .free: Theme.Color.appSurface
        }
    }

    private func cellBorder(_ state: BookResourceViewModel.CellState) -> Color {
        switch state {
        case .selectedConflict: Theme.Color.error
        case .free: Theme.Color.appBorder
        default: .clear
        }
    }

    private func statusIcon(_ tone: BookResourceViewModel.StatusTone) -> PantopusIcon {
        switch tone {
        case .ok: .checkCircle
        case .conflict: .xCircle
        case .warning: .triangleAlert
        }
    }

    private func statusColor(_ tone: BookResourceViewModel.StatusTone) -> Color {
        switch tone {
        case .ok: Theme.Color.success
        case .conflict: Theme.Color.error
        case .warning: Theme.Color.warning
        }
    }

    private func statusBg(_ tone: BookResourceViewModel.StatusTone) -> Color {
        switch tone {
        case .ok: Theme.Color.successBg
        case .conflict: Theme.Color.errorBg
        case .warning: Theme.Color.warningBg
        }
    }

    private static func hourLabel(_ hour: Int) -> String {
        let period = hour < 12 ? "a" : "p"
        let display = hour % 12 == 0 ? 12 : hour % 12
        return "\(display)\(period)"
    }

    private static func a11y(_ state: BookResourceViewModel.CellState) -> String {
        switch state {
        case .free: "free"
        case .selected: "selected"
        case .selectedConflict: "selected, conflicts"
        case .taken: "taken"
        case .off: "unavailable"
        }
    }

    private var saveErrorPresented: Binding<Bool> {
        Binding(get: { viewModel.saveError != nil }, set: { if !$0 { viewModel.saveError = nil } })
    }
}

/// Continuously rotating `loader-circle` glyph, mirroring the design's
/// `sh-spin 0.8s linear infinite` submitting spinner.
private struct SpinningLoader: View {
    let size: CGFloat
    let color: Color
    @State private var isSpinning = false

    var body: some View {
        Icon(.loaderCircle, size: size, color: color)
            .rotationEffect(.degrees(isSpinning ? 360 : 0))
            .animation(.linear(duration: 0.8).repeatForever(autoreverses: false), value: isSpinning)
            .onAppear { isSpinning = true }
            .accessibilityHidden(true)
    }
}
