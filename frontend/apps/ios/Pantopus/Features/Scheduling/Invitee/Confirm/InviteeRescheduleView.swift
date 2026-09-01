//
//  InviteeRescheduleView.swift
//  Pantopus
//
//  Stream I6 — the invitee reschedule sheet presented from D4 Manage. Wraps the
//  Foundation `SlotPicker` (tz-aware grid + calm states) with a "Confirm new
//  time" CTA; commits via the reschedule view-model. A 409 surfaces the shared
//  `SlotTakenSheet`. Presented locally (no global route).
//

import SwiftUI

struct InviteeRescheduleView: View {
    @State private var viewModel: InviteeRescheduleViewModel
    @State private var showTimezoneSheet = false
    let onClose: () -> Void
    let onRescheduled: () -> Void

    init(viewModel: InviteeRescheduleViewModel, onClose: @escaping () -> Void, onRescheduled: @escaping () -> Void) {
        _viewModel = State(wrappedValue: viewModel)
        self.onClose = onClose
        self.onRescheduled = onRescheduled
    }

    var body: some View {
        @Bindable var viewModel = viewModel
        return NavigationStack {
            content
                .background(Theme.Color.appBg)
                .navigationTitle("Reschedule")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Cancel", action: onClose)
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                }
                .task { await viewModel.load() }
                .accessibilityIdentifier("scheduling.inviteeReschedule")
                .sheet(isPresented: $showTimezoneSheet) {
                    TimezoneSelectorSheet(
                        selectedIdentifier: viewModel.timezoneId,
                        accent: viewModel.accent,
                        onSelect: { id in Task { await viewModel.changeTimezone(id) } },
                        onDone: { showTimezoneSheet = false }
                    )
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
                }
                .sheet(isPresented: $viewModel.showSlotTakenSheet) {
                    SlotTakenSheet(
                        mode: viewModel.slotTakenAlternatives.isEmpty ? .fullyBooked : .alternatives,
                        alternatives: viewModel.slotTakenAlternatives,
                        takenTimeLabel: viewModel.slotTakenLabel,
                        timeZoneIdentifier: viewModel.timezoneId,
                        accent: viewModel.accent,
                        onSelect: { viewModel.selectAlternative($0) },
                        onPickAnotherTime: { viewModel.showSlotTakenSheet = false }
                    )
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case let .error(message):
            VStack {
                Spacer(minLength: Spacing.s0)
                EmptyState(
                    icon: .calendar,
                    headline: message,
                    subcopy: "Check your connection and try again.",
                    cta: .init(title: "Try again") { await viewModel.refresh() }
                )
                Spacer(minLength: Spacing.s0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .loading, .ready:
            pickerScroll
        }
    }

    private var pickerScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                if let banner = viewModel.inlineBanner {
                    ConfirmBanner(tone: .warning, icon: .alertTriangle, title: "Couldn't reschedule", message: banner)
                }
                SlotPicker(
                    state: viewModel.slotPickerState,
                    slots: viewModel.daySlots,
                    timeZoneIdentifier: viewModel.timezoneId,
                    timeZoneLabel: viewModel.timezoneLabel,
                    accent: viewModel.accent,
                    monthAnchor: viewModel.monthAnchor,
                    selectedDate: viewModel.selectedDate,
                    availableDays: viewModel.availableDays,
                    selectedSlotStart: viewModel.selectedSlotStart,
                    dstHint: viewModel.dstHint,
                    onSelectDate: { viewModel.selectDate($0) },
                    onSelectSlot: { viewModel.selectSlot($0) },
                    onChangeMonth: { delta in Task { await viewModel.changeMonth(delta) } },
                    onTapTimeZone: { showTimezoneSheet = true },
                    onJumpNextAvailable: { Task { await viewModel.jumpNextAvailable() } }
                )
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s4)
        }
        .safeAreaInset(edge: .bottom) {
            ConfirmFooter {
                if viewModel.submitting {
                    ConfirmShimmerButton(label: "Rescheduling")
                } else {
                    ConfirmPrimaryButton(
                        label: "Confirm new time",
                        icon: .calendarClock,
                        accent: viewModel.accent,
                        isDisabled: !viewModel.canSubmit
                    ) {
                        Task { @MainActor in if await viewModel.reschedule() { onRescheduled() } }
                    }
                    .accessibilityIdentifier("scheduling.inviteeReschedule.cta")
                }
            }
        }
    }
}
