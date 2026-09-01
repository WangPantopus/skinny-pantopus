//
//  RescheduleReassignSheet.swift
//  Pantopus
//
//  E4 Reschedule / Reassign Sheet (Stream I8). Wraps the Foundation `SlotPicker`
//  for the host: a strikethrough current-time → new-time header, the tz-aware
//  picker, an apply-mode toggle (propose vs reschedule now), a notify row, and —
//  for home/business owners — a reassign-to-an-available-teammate option. A 409
//  `SLOT_CONFLICT` recovers through the Foundation `SlotTakenSheet`. The
//  view-model lives in `RescheduleReassignViewModel.swift`.
//

import SwiftUI

// swiftlint:disable file_length

// swiftlint:disable:next type_body_length
struct RescheduleReassignSheet: View {
    @State private var viewModel: RescheduleReassignViewModel
    @State private var showTimezone = false
    let onCompleted: () async -> Void

    init(viewModel: RescheduleReassignViewModel, onCompleted: @escaping () async -> Void) {
        _viewModel = State(wrappedValue: viewModel)
        self.onCompleted = onCompleted
    }

    var body: some View {
        @Bindable var viewModel = viewModel
        return Group {
            if viewModel.proposalSent {
                proposalSentView
            } else {
                pickerView
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .background(Theme.Color.appSurface)
        .task { await viewModel.load() }
        .sheet(isPresented: $showTimezone) {
            TimezoneSelectorSheet(
                selectedIdentifier: viewModel.timezoneId,
                accent: viewModel.accent,
                onSelect: { id in Task { await viewModel.changeTimezone(id) } },
                onDone: { showTimezone = false }
            )
        }
        .sheet(isPresented: $viewModel.showSlotTaken) {
            SlotTakenSheet(
                mode: viewModel.conflictAlternatives.isEmpty ? .fullyBooked : .alternatives,
                alternatives: viewModel.conflictAlternatives,
                takenTimeLabel: viewModel.newTimeLabel,
                timeZoneIdentifier: viewModel.timezoneId,
                accent: viewModel.accent,
                onSelect: { alt in Task { await viewModel.chooseAlternative(alt) } },
                onPickAnotherTime: { viewModel.dismissSlotTaken() }
            )
            .presentationDetents([.medium, .large])
        }
        .accessibilityIdentifier("scheduling.rescheduleSheet")
    }

    // MARK: - Picker

    private var pickerView: some View {
        VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    // JSX SectionTitle: 16.5pt/700 (not the shared 17pt SheetTitle).
                    Text(viewModel.canReassign ? "Reschedule & reassign" : "Pick a new time")
                        .font(.system(size: 16.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    currentToNew
                    // JSX FrameMemberPicker: the "Assign to" avatar rail sits
                    // between the current→new header and the tz/day/slot picker.
                    if viewModel.canReassign {
                        assignToSection
                    }
                    slotSection
                    // FrameMemberPicker shows the reassign explainer when a
                    // teammate is targeted; the apply-mode toggle + notify row
                    // always drive how the change is applied.
                    if viewModel.canReassign, viewModel.selectedReassignHostId != nil {
                        reassignExplainer
                    }
                    authorityToggle
                    notifyRow
                    if let error = viewModel.error { inlineError(error) }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s4)
                .padding(.bottom, Spacing.s4)
            }
            footer
        }
    }

    /// JSX Frames 1/2/3: tz chip → 5-day weekday strip → flat slot list, with a
    /// loading shimmer and a no-availability empty card. Mirrors the design (and
    /// Android) rather than reusing the month-calendar SlotPicker.
    @ViewBuilder
    private var slotSection: some View {
        tzChip
        switch viewModel.slotPickerState {
        // Reschedule is single-owner, so the team-compose states (.composing /
        // .composedEmpty) and the .noAvailabilityAnywhere terminal don't arise;
        // map them onto the nearest single-owner rendering defensively.
        case .loading, .composing:
            slotLoadingSkeleton
        case .noAvailability, .noAvailabilityAnywhere, .composedEmpty:
            dayStrip
            noAvailabilityCard
        case .dayFull, .loaded:
            dayStrip
            if viewModel.daySlots.isEmpty {
                noAvailabilityCard
            } else {
                slotList
            }
        }
    }

    /// JSX TzChip: globe + "Times in <zone> · tap to change", no trailing chevron.
    private var tzChip: some View {
        Button { showTimezone = true } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.globe, size: 13, color: Theme.Color.appTextSecondary)
                Text("Times in \(viewModel.timezoneLabel) · tap to change")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 28)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.reschedule.timezone")
    }

    /// JSX DayStrip: a horizontal 48×58 weekday-chip strip (radius 13), accent
    /// fill on the selected day.
    private var dayStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(viewModel.dayStripEntries) { entry in
                    let isOn = entry.isSelected
                    Button { viewModel.selectDate(entry.date) } label: {
                        VStack(spacing: 3) {
                            Text(entry.weekday)
                                .font(.system(size: 10.5, weight: .semibold))
                                .foregroundStyle(isOn ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                            Text(entry.dayNumber)
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(isOn ? Theme.Color.appTextInverse : Theme.Color.appText)
                        }
                        .frame(width: 48, height: 58)
                        .background {
                            RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .fill(isOn ? viewModel.accent : Theme.Color.appSurface)
                        }
                        .overlay {
                            if !isOn {
                                RoundedRectangle(cornerRadius: 13, style: .continuous)
                                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .accessibilityIdentifier("scheduling.reschedule.dayStrip")
    }

    /// JSX SlotList: a flat stack of full-label slot rows ("Tue Oct 21 ·
    /// 2:00–2:30 PM · PT"), selected row tinted + check-circle.
    private var slotList: some View {
        VStack(spacing: Spacing.s2) {
            ForEach(viewModel.daySlots, id: \.self) { slot in
                let isOn = slot.start == viewModel.selectedSlot?.start
                Button { viewModel.selectSlot(slot) } label: {
                    HStack(spacing: Spacing.s2) {
                        Text(viewModel.slotRowLabel(slot))
                            .font(.system(size: 12.5, weight: isOn ? .bold : .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Spacer(minLength: Spacing.s0)
                        if isOn {
                            Icon(.checkCircle, size: 18, color: viewModel.accent)
                        }
                    }
                    .padding(.horizontal, Spacing.s4)
                    .frame(minHeight: 46)
                    .frame(maxWidth: .infinity)
                    .background(isOn ? viewModel.owner.theme.accentBg : Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .strokeBorder(isOn ? viewModel.accent : Theme.Color.appBorder, lineWidth: 1.5)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .accessibilityIdentifier("scheduling.reschedule.slotList")
    }

    /// JSX Frame 1 shimmer: a 5-chip day-strip row over four flat slot rows.
    private var slotLoadingSkeleton: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2) {
                ForEach(0..<5, id: \.self) { _ in
                    Shimmer(width: 48, height: 58, cornerRadius: 13)
                }
            }
            VStack(spacing: Spacing.s2) {
                ForEach(0..<4, id: \.self) { _ in
                    Shimmer(height: 46, cornerRadius: Radii.md)
                }
            }
        }
        .accessibilityLabel("Loading times")
    }

    /// JSX FrameNoAvail: a 64pt sunken disc + headline + body.
    private var noAvailabilityCard: some View {
        VStack(spacing: Spacing.s4) {
            ZStack {
                Circle()
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(width: 64, height: 64)
                Icon(.calendarX, size: 28, color: Theme.Color.appTextSecondary)
            }
            VStack(spacing: Spacing.s1) {
                Text("No open times in this range")
                    .font(.system(size: 14.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Widen the window or message the invitee.")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s6)
    }

    private var currentToNew: some View {
        VStack(spacing: Spacing.s1) {
            HStack(spacing: Spacing.s2) {
                Icon(.calendar, size: 16, color: Theme.Color.appTextMuted)
                Text(viewModel.currentTimeLabel)
                    .font(.system(size: 12.5))
                    .strikethrough()
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 40)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))

            Icon(.arrowDown, size: 16, color: Theme.Color.appTextMuted)

            HStack(spacing: Spacing.s2) {
                Icon(.calendarClock, size: 16, color: viewModel.newTimeLabel == nil ? Theme.Color.appTextMuted : viewModel.accent)
                Text(viewModel.newTimeLabel ?? "New time")
                    .font(.system(size: 12.5, weight: viewModel.newTimeLabel == nil ? .medium : .bold))
                    .foregroundStyle(viewModel.newTimeLabel == nil ? Theme.Color.appTextMuted : Theme.Color.appText)
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 40)
            .background(viewModel.newTimeLabel == nil ? Theme.Color.appSurface : viewModel.owner.theme.accentBg)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(
                        viewModel.newTimeLabel == nil ? Theme.Color.appBorderStrong : viewModel.accent,
                        style: StrokeStyle(lineWidth: 1.5, dash: viewModel.newTimeLabel == nil ? [4, 4] : [])
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
    }

    private var authorityToggle: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("How to apply")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: 3) {
                ForEach(RescheduleMode.allCases, id: \.self) { option in
                    let isOn = viewModel.mode == option
                    Button { viewModel.mode = option } label: {
                        Text(option.label)
                            .font(.system(size: 11, weight: isOn ? .bold : .semibold))
                            .foregroundStyle(isOn ? viewModel.accent : Theme.Color.appTextSecondary)
                            .frame(maxWidth: .infinity, minHeight: 38)
                            .background {
                                if isOn {
                                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                        .fill(Theme.Color.appSurface)
                                        .pantopusShadow(.sm)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(3)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            Text("Propose sends the new time for the invitee to accept.")
                .font(.system(size: 10))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    /// JSX FrameMemberPicker "Assign to" block: an uppercase overline above a
    /// horizontal avatar rail. Ids only (no roster names yet, same data-gap as
    /// Android's MemberOption) — the rail shows id-initials with a leading
    /// "keep current host" affordance (the design's `+`/`All` avatar).
    @ViewBuilder
    private var assignToSection: some View {
        if viewModel.eligibleHostCount > 0 {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Assign to")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                memberRail
            }
            .accessibilityIdentifier("scheduling.reschedule.reassign")
        }
    }

    private var memberRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ForEach(viewModel.reassignCandidates) { candidate in
                    let isOn = viewModel.selectedReassignHostId == candidate.id
                    avatarChip(
                        initials: candidate.initials,
                        label: candidate.label,
                        isOn: isOn,
                        isKeep: false
                    ) { viewModel.selectReassignHost(candidate.id) }
                }
                // JSX trailing `+`/`All` avatar — keep the original host.
                avatarChip(
                    initials: "+",
                    label: "Keep",
                    isOn: viewModel.selectedReassignHostId == nil,
                    isKeep: true
                ) { viewModel.selectReassignHost(nil) }
            }
            .padding(.vertical, Spacing.s1)
        }
    }

    private func avatarChip(
        initials: String,
        label: String,
        isOn: Bool,
        isKeep: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: Spacing.s1) {
                Text(initials)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(isKeep ? Theme.Color.appTextSecondary : Theme.Color.appTextInverse)
                    .frame(width: 46, height: 46)
                    .background {
                        // JSX AV.business is a purple gradient w/ white initials;
                        // a solid pillar accent is the token-only native form
                        // (Android accepts the same flat fill).
                        Circle().fill(isKeep ? Theme.Color.appSurfaceSunken : viewModel.accent)
                    }
                    .overlay {
                        Circle().strokeBorder(isOn ? viewModel.accent : .clear, lineWidth: 2.5)
                    }
                Text(label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(isOn ? viewModel.accent : Theme.Color.appTextSecondary)
            }
        }
        .buttonStyle(.plain)
    }

    /// JSX `Explainer` (reschedule-frames FrameMemberPicker): reassign times are
    /// each member's own availability.
    private var reassignExplainer: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.info, size: 12, color: Theme.Color.appTextSecondary)
            Text("Times come from each member's personal availability.")
                .font(.system(size: 10.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
        }
    }

    private var notifyRow: some View {
        @Bindable var viewModel = viewModel
        return Toggle(isOn: $viewModel.notifyInvitee) {
            HStack(spacing: Spacing.s3) {
                // JSX NotifySwitch: leading `bell` glyph (fg2) before the label block.
                Icon(.bell, size: 17, color: Theme.Color.appTextStrong)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Notify invitee")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Push + message")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
        .tint(viewModel.accent)
        .padding(Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private var footer: some View {
        SheetCTAButton(
            title: viewModel.ctaTitle,
            icon: viewModel.ctaIcon,
            tone: .accent(viewModel.accent),
            isLoading: viewModel.submitting,
            isEnabled: viewModel.canSubmit
        ) {
            if await viewModel.submit() { await onCompleted() }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s5)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
    }

    // MARK: - Proposal sent

    private var proposalSentView: some View {
        VStack(spacing: Spacing.s4) {
            ZStack {
                Circle()
                    .fill(Theme.Color.successBg)
                    .overlay(Circle().strokeBorder(Theme.Color.successLight, lineWidth: 1))
                    .frame(width: 72, height: 72)
                Icon(.send, size: 30, color: Theme.Color.success)
            }
            VStack(spacing: Spacing.s2) {
                Text("Proposal sent")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(viewModel.proposalSentDetail)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
            }
            Text("Waiting on \(viewModel.booking.inviteeName ?? "the invitee") to accept")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Capsule())
            PrimaryButton(title: "Done") { await onCompleted() }
                .padding(.top, Spacing.s2)
        }
        // JSX FrameProposed: 40px top / 24px horizontal centered block.
        .padding(.horizontal, Spacing.s6)
        .padding(.top, Spacing.s10)
        .padding(.bottom, Spacing.s6)
        .frame(maxWidth: .infinity)
    }

    private func inlineError(_ message: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 16, color: Theme.Color.error)
            Text(message)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.error)
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.errorLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

#if DEBUG
#Preview {
    Color.clear.sheet(isPresented: .constant(true)) {
        RescheduleReassignSheet(
            viewModel: RescheduleReassignViewModel(
                owner: .business(id: "b"),
                booking: .preview(status: "confirmed", ownerType: "business"),
                actions: BookingActions(owner: .business(id: "b")),
                tz: "America/Los_Angeles"
            )
        ) {}
    }
}
#endif
