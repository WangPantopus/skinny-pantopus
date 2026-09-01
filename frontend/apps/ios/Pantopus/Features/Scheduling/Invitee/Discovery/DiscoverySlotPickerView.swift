//
//  DiscoverySlotPickerView.swift
//  Pantopus
//
//  C6 Date + Time Slot Picker (Stream I5). Summary header (event type +
//  duration) stacked over the Foundation `SlotPicker` in one scroll. The
//  SlotPicker owns the tappable timezone chip, month calendar, Morning/Afternoon
//  slot groups, and the day-full / no-availability calm states (C8 inline).
//  C7 Timezone Selector is the Foundation `TimezoneSelectorSheet`, presented
//  locally; choosing a zone re-fetches slots.
//

import SwiftUI

struct DiscoverySlotPickerView: View {
    @State private var viewModel: DiscoverySlotPickerViewModel
    @State private var showTimezoneSheet = false

    init(viewModel: DiscoverySlotPickerViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            content
            if viewModel.slotJustTaken {
                slotTakenToast
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(.spring(response: 0.35, dampingFraction: 0.78), value: viewModel.slotJustTaken)
            }
        }
        .background(Theme.Color.appBg)
        .navigationTitle("Pick a time")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
        .onAppear { viewModel.consumeSlotTakenSignal() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.slotPicker")
        .sheet(isPresented: $showTimezoneSheet) {
            TimezoneSelectorSheet(
                selectedIdentifier: viewModel.timezoneId,
                accent: viewModel.accent,
                onSelect: { identifier in
                    Task { await viewModel.changeTimezone(identifier) }
                },
                onDone: { showTimezoneSheet = false }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Slot-just-taken toast (Frame 6)

    /// Floating WARN toast shown when a race condition takes the selected slot.
    /// Design Frame 6: amber fill + 1px amber border + triangle-alert icon +
    /// "That time was just taken". Floats above the home indicator at the bottom.
    private var slotTakenToast: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.triangleAlert, size: 15, strokeWidth: 2.2, color: Theme.Color.warning)
            Text("That time was just taken")
                .font(.system(size: 12.5, weight: .bold))
                .foregroundStyle(Theme.Color.warning)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.warningBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.warningLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .shadow(color: Theme.Color.warning.opacity(0.18), radius: 8, y: 4)
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s5)
        .accessibilityLabel("That time was just taken. Please select another.")
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case let .error(message):
            errorState(message)
        case .paused:
            pausedScroll
        case .loading, .ready:
            pickerScroll
        }
    }

    private var pickerScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                summaryHeader
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
    }

    private var pausedScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                summaryHeader
                DiscoveryNotice(
                    icon: .pause,
                    title: "This page isn't taking bookings right now",
                    message: "Check back later — the host can reopen it at any time."
                )
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s4)
        }
    }

    // MARK: - Summary header

    private var summaryHeader: some View {
        HStack(spacing: Spacing.s3) {
            Icon(
                DiscoveryLocation.icon(mode: viewModel.eventType?.locationMode),
                size: 16,
                color: viewModel.accent
            )
            .frame(width: 34, height: 34)
            .background(viewModel.accentBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                if let name = viewModel.eventType?.name {
                    Text(name)
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                } else {
                    Shimmer(width: 140, height: 14)
                }
                if let detail = viewModel.summaryDetail {
                    Text(detail)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                } else if viewModel.eventType == nil {
                    Shimmer(width: 90, height: 11)
                }
            }
            Spacer(minLength: Spacing.s2)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .fill(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                )
        )
    }

    private func errorState(_ message: String) -> some View {
        VStack {
            Spacer(minLength: Spacing.s0)
            EmptyState(
                icon: .link,
                headline: message,
                subcopy: "It may have been turned off or moved.",
                cta: .init(title: "Try again") { await viewModel.refresh() }
            )
            Spacer(minLength: Spacing.s0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#if DEBUG
#Preview("Slot picker") {
    NavigationStack {
        DiscoverySlotPickerView(viewModel: .previewLoaded())
    }
}

#Preview("Slot picker · Slot just taken") {
    NavigationStack {
        DiscoverySlotPickerView(viewModel: .previewSlotTaken())
    }
}
#endif
