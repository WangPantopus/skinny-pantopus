//
//  BookingLimitsView.swift
//  Pantopus
//
//  Stream I3 — B7 Booking Limits & Notice Rules (sheet). One white card per
//  rule: a label, a one-line caption explaining the effect, and a numeric
//  stepper with a unit suffix (or a segmented control). The window-shorter-
//  than-notice conflict outlines in error red and disables Done.
//

import SwiftUI

struct BookingLimitsView: View {
    @State private var viewModel: BookingLimitsViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: BookingLimitsViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
            .accessibilityIdentifier("scheduling.bookingLimits")
            .alert("Couldn't save", isPresented: saveErrorPresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.saveError ?? "")
            }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .loading:
            loadingSkeleton
        case let .error(message):
            ErrorState(headline: "Couldn't load limits", message: message) {
                await viewModel.reload()
            }
        case .ready:
            form
        }
    }

    private var form: some View {
        FormShell(
            title: "Booking limits",
            leading: .close,
            rightActionLabel: "Done",
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: { dismiss() },
            onCommit: { Task { if await viewModel.save() { dismiss() } } },
            content: {
                // Design `Body` stacks its cards 12px apart — the shared shell's
                // default 20pt rhythm is looser than the availability frames.
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    sheetOverline
                    helper
                    noticeRow
                    windowRow
                    dailyCapRow
                    weeklyCapRow
                    perPersonRow
                    startTimesRow
                }
            }
        )
    }

    /// Left-aligned sky overline beneath the top bar — FormShell only offers a
    /// centered title, so the design's "PERSONAL · WORKING HOURS" overline
    /// rides above the cards as a leading label.
    private var sheetOverline: some View {
        Text("PERSONAL · WORKING HOURS")
            .font(.system(size: 9.5, weight: .bold))
            .tracking(0.8)
            .foregroundStyle(Theme.Color.personal)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s3)
            .accessibilityIdentifier("scheduling.bookingLimits.overline")
    }

    private var helper: some View {
        Text("Sensible defaults are set, so you usually don't need to touch these.")
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s3)
    }

    private var noticeRow: some View {
        stepperRow(
            "Minimum notice",
            caption: "Can't be booked inside this window.",
            value: "\(viewModel.minNoticeHours)",
            unit: viewModel.minNoticeHours == 1 ? "hour" : "hours",
            identifier: "scheduling.bookingLimits.minNoticeStepper",
            onMinus: { viewModel.minNoticeHours = max(0, viewModel.minNoticeHours - 1) },
            onPlus: { viewModel.minNoticeHours = min(168, viewModel.minNoticeHours + 1) }
        )
    }

    private var windowRow: some View {
        stepperRow(
            "Book up to",
            caption: "How far ahead people can book.",
            value: "\(viewModel.horizonDays)",
            unit: "days",
            identifier: "scheduling.bookingLimits.horizonStepper",
            error: viewModel.windowConflict
                ? "Your booking window is shorter than your minimum notice, so no times will show."
                : nil,
            onMinus: { viewModel.horizonDays = max(1, viewModel.horizonDays - 1) },
            onPlus: { viewModel.horizonDays = min(730, viewModel.horizonDays + 1) }
        )
    }

    private var dailyCapRow: some View {
        stepperRow(
            "Max per day",
            caption: "Most bookings you'll take in a day.",
            value: "\(viewModel.dailyCap)",
            unit: nil,
            identifier: "scheduling.bookingLimits.dailyCapStepper",
            onMinus: { viewModel.dailyCap = max(1, viewModel.dailyCap - 1) },
            onPlus: { viewModel.dailyCap = min(50, viewModel.dailyCap + 1) }
        )
    }

    /// NOTE: backend has no weekly_cap field — row is rendered per the design
    /// as a disabled placeholder until the backend exposes the field. The
    /// design's `StepperRow label="Max per week"` shows a real value
    /// (booking-limits-frames.jsx:151), so the placeholder carries the frame's
    /// number rather than a dash — same as Android's `form.maxPerWeek`.
    private var weeklyCapRow: some View {
        stepperRow(
            "Max per week",
            caption: "Most bookings you'll take in a week.",
            value: "20",
            unit: nil,
            identifier: "scheduling.bookingLimits.weeklyCapStepper",
            disabled: true,
            onMinus: {},
            onPlus: {}
        )
    }

    private var perPersonRow: some View {
        stepperRow(
            "Per-person limit",
            caption: "How many one person can hold at once.",
            value: "\(viewModel.perBookerCap)",
            unit: viewModel.perBookerCap == 1 ? "booking" : "bookings",
            identifier: "scheduling.bookingLimits.perPersonStepper",
            onMinus: { viewModel.perBookerCap = max(1, viewModel.perBookerCap - 1) },
            onPlus: { viewModel.perBookerCap = min(20, viewModel.perBookerCap + 1) }
        )
    }

    private var startTimesRow: some View {
        rowCard {
            Text("Start times")
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            // Design `SegmentRow` uses the shell's `Segmented` (sunken track,
            // white selected card) — not the native segmented Picker.
            EventTypeSegmented(
                options: SlotInterval.allCases,
                selection: $viewModel.slotInterval,
                label: { $0.label },
                accessibilityID: "scheduling.bookingLimits.slotInterval"
            )
            Text("Where bookings can start within the hour.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    // MARK: Building blocks

    // One rule card: label (semibold) + bordered stepper on one line, caption
    // (or error) below. Mirrors the design's `StepperRow` / `RowCard`.
    // Pass `disabled: true` for placeholder rows whose backend field is not
    // yet available (e.g. "Max per week" awaiting weekly_cap support).
    // swiftlint:disable function_parameter_count
    private func stepperRow(
        _ label: String,
        caption: String,
        value: String,
        unit: String?,
        identifier: String,
        error: String? = nil,
        disabled: Bool = false,
        onMinus: @escaping () -> Void,
        onPlus: @escaping () -> Void
    ) -> some View {
        rowCard {
            HStack(spacing: Spacing.s3) {
                Text(label)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(disabled ? Theme.Color.appTextSecondary : Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                AvailabilityStepper(
                    value: value,
                    unit: unit,
                    error: error != nil,
                    onMinus: onMinus,
                    onPlus: onPlus
                )
                .accessibilityIdentifier(identifier)
                .disabled(disabled)
                .opacity(disabled ? 0.4 : 1)
            }
            if let error {
                HStack(alignment: .top, spacing: Spacing.s1) {
                    Icon(.circleAlert, size: 12, strokeWidth: 2, color: Theme.Color.error)
                    Text(error)
                        .font(.system(size: 10.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.error)
                }
            } else {
                Text(caption)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .opacity(disabled ? 0.7 : 1)
    } // swiftlint:enable function_parameter_count

    private func rowCard(@ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            content()
        }
        .padding(.horizontal, 13)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        // Design `Body` gutter — 12px, matching the availability cards.
        .padding(.horizontal, Spacing.s3)
    }

    private var loadingSkeleton: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                ForEach(0..<6, id: \.self) { _ in
                    Shimmer(height: 64, cornerRadius: Radii.lg)
                        .padding(.horizontal, Spacing.s3)
                }
            }
            .padding(.vertical, Spacing.s4)
        }
    }

    private var saveErrorPresented: Binding<Bool> {
        Binding(get: { viewModel.saveError != nil }, set: { if !$0 { viewModel.saveError = nil } })
    }
}
