//
//  ReserveSlotSheet.swift
//  Pantopus
//
//  S1 — the helper sign-up flow the A10.9 detail screen was missing.
//  Mirrors RN's `components/support-trains/ReserveSheet.tsx`: pick the
//  date (skipped when the user tapped a specific slot row) → pick a
//  contribution lane → optional detail → confirm → success, then
//  `POST /api/activities/support-trains/:id/slots/:slotId/reserve`.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

/// Sheet presentation payload. `slotId` is pre-filled when the user
/// tapped a specific open slot; nil starts on the date-picker step.
public struct ReserveSheetSelection: Identifiable, Hashable, Sendable {
    public let slotId: String?

    public init(slotId: String?) {
        self.slotId = slotId
    }

    public var id: String {
        slotId ?? "picker"
    }
}

@MainActor
public struct ReserveSlotSheet: View {
    public enum Step: Hashable, Sendable {
        case date
        case mode
        case details
        case confirm
        case success
    }

    private let options: [ReserveSlotOption]
    private let context: ReserveSheetContext
    private let isSubmitting: Bool
    /// Returns nil on success, or the message to render inline.
    private let onSubmit: @MainActor (String, ReserveSlotBody) async -> String?
    private let onClose: @MainActor () -> Void

    @State private var step: Step
    @State private var slotId: String?
    @State private var mode: SupportTrainContributionMode?
    @State private var dishTitle = ""
    @State private var restaurantName = ""
    @State private var arrivalTime = Date()
    @State private var hasArrivalTime = false
    @State private var noteToRecipient = ""
    @State private var errorMessage: String?

    public init(
        selection: ReserveSheetSelection,
        options: [ReserveSlotOption],
        context: ReserveSheetContext,
        isSubmitting: Bool,
        onSubmit: @escaping @MainActor (String, ReserveSlotBody) async -> String?,
        onClose: @escaping @MainActor () -> Void
    ) {
        self.options = options
        self.context = context
        self.isSubmitting = isSubmitting
        self.onSubmit = onSubmit
        self.onClose = onClose
        _slotId = State(initialValue: selection.slotId)
        _step = State(initialValue: selection.slotId == nil ? .date : .mode)
    }

    private var selectedOption: ReserveSlotOption? {
        options.first { $0.id == slotId }
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    switch step {
                    case .date: dateStep
                    case .mode: modeStep
                    case .details: detailsStep
                    case .confirm: confirmStep
                    case .success: successStep
                    }
                    if let errorMessage {
                        errorBox(errorMessage)
                    }
                }
                .padding(Spacing.s5)
            }
            footer
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("supportTrainReserveSheet")
    }

    // MARK: - Chrome

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onClose) {
                Icon(.x, size: 20, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("supportTrainReserveCloseButton")

            Spacer(minLength: Spacing.s0)

            Text(headerTitle)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .accessibilityAddTraits(.isHeader)

            Spacer(minLength: Spacing.s0)

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    private var headerTitle: String {
        if step == .success { return "Signed up!" }
        guard let option = selectedOption else { return "Pick a date" }
        return "\(option.slotLabel) — \(option.dateLabel)"
    }

    // MARK: - Steps

    private var dateStep: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            stepTitle("Which date can you take?")
            ForEach(options) { option in
                selectableCard(
                    isSelected: option.id == slotId,
                    identifier: "supportTrainReserveDate-\(option.id)"
                ) {
                    slotId = option.id
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(option.dateLabel)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Text([option.slotLabel, option.windowLabel].compactMap { $0 }.joined(separator: " · "))
                            .font(.system(size: 12.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
            }
        }
    }

    private var modeStep: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            stepTitle("How would you like to help?")
            ForEach(context.enabledModes, id: \.self) { option in
                selectableCard(
                    isSelected: option == mode,
                    identifier: "supportTrainReserveMode-\(option.rawValue)"
                ) {
                    mode = option
                } label: {
                    HStack(spacing: Spacing.s3) {
                        Icon(
                            option.icon,
                            size: 20,
                            color: option == mode ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                        )
                        Text(option.label)
                            .font(.system(size: 15, weight: option == mode ? .semibold : .regular))
                            .foregroundStyle(Theme.Color.appText)
                    }
                }
            }
            reminders
        }
    }

    @ViewBuilder
    private var reminders: some View {
        if !context.restrictionChips.isEmpty {
            reminderBox(
                icon: .alertTriangle,
                text: "Remember: \(context.restrictionChips.joined(separator: ", "))"
            )
        }
        if context.contactlessPreferred {
            reminderBox(icon: .lock, text: "Contactless drop-off preferred")
        }
    }

    private var detailsStep: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            stepTitle("Any details? (optional)")
            if mode == .cook || mode == .takeout {
                fieldLabel(mode == .cook ? "What are you making?" : "Dish name")
                TextField("e.g. Chicken soup", text: $dishTitle)
                    .textFieldStyle(.plain)
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                    .accessibilityIdentifier("supportTrainReserveDishField")
            }
            if mode == .takeout {
                fieldLabel("Restaurant name")
                TextField("e.g. Thai Palace", text: $restaurantName)
                    .textFieldStyle(.plain)
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                    .accessibilityIdentifier("supportTrainReserveRestaurantField")
            }
            Toggle(isOn: $hasArrivalTime) {
                Text("Set an estimated arrival time")
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appText)
            }
            .tint(Theme.Color.primary600)
            .accessibilityIdentifier("supportTrainReserveArrivalToggle")
            if hasArrivalTime {
                DatePicker(
                    "Estimated arrival",
                    selection: $arrivalTime,
                    displayedComponents: .hourAndMinute
                )
                .datePickerStyle(.compact)
                .accessibilityIdentifier("supportTrainReserveArrivalPicker")
            }
            fieldLabel("Note to recipient")
            TextEditor(text: $noteToRecipient)
                .frame(minHeight: 84)
                .padding(Spacing.s2)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                .accessibilityIdentifier("supportTrainReserveNoteField")
        }
    }

    private var confirmStep: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            stepTitle("Confirm your signup")
            VStack(spacing: Spacing.s0) {
                summaryRow("Date", selectedOption?.dateLabel ?? "")
                summaryRow("Slot", selectedOption?.slotLabel ?? "")
                summaryRow("Contributing", mode?.label ?? "")
                if !dishTitle.isEmpty { summaryRow("Dish", dishTitle) }
                if !restaurantName.isEmpty { summaryRow("Restaurant", restaurantName) }
                if hasArrivalTime { summaryRow("Estimated arrival", Self.timeLabel(arrivalTime)) }
                if let window = selectedOption?.windowLabel { summaryRow("Time window", window) }
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )

            Text("You'll get a reminder before your date. The organizer shares the exact address here when it's time to deliver.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextMuted)
                .frame(maxWidth: .infinity, alignment: .center)
                .multilineTextAlignment(.center)
                .padding(.top, Spacing.s2)
        }
    }

    private var successStep: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.checkCircle, size: 56, color: Theme.Color.success)
                .padding(.top, Spacing.s5)
            Text("You're signed up!")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("Thank you for helping out. You'll get a reminder before your date.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            if !context.restrictionChips.isEmpty {
                reminderBox(
                    icon: .alertTriangle,
                    text: "Please remember: \(context.restrictionChips.joined(separator: ", "))"
                )
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("supportTrainReserveSuccess")
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            HStack(spacing: Spacing.s2) {
                if step != .date, step != .success {
                    secondaryButton("Back") { goBack() }
                }
                primaryButton(primaryLabel, enabled: primaryEnabled) {
                    Task { await advance() }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
        }
        .background(Theme.Color.appBg)
    }

    private var primaryLabel: String {
        switch step {
        case .date: "Next"
        case .mode: "Next"
        case .details: "Review"
        case .confirm: isSubmitting ? "Signing up…" : "Confirm signup"
        case .success: "Done"
        }
    }

    private var primaryEnabled: Bool {
        switch step {
        case .date: slotId != nil
        case .mode: mode != nil
        case .details, .success: true
        case .confirm: !isSubmitting
        }
    }

    private func goBack() {
        switch step {
        case .mode: step = options.count > 1 ? .date : .mode
        case .details: step = .mode
        case .confirm: step = .details
        default: break
        }
    }

    private func advance() async {
        errorMessage = nil
        switch step {
        case .date: step = .mode
        case .mode: step = .details
        case .details: step = .confirm
        case .confirm: await submit()
        case .success: onClose()
        }
    }

    private func submit() async {
        guard let slotId, let mode else { return }
        let body = ReserveSlotBody(
            contributionMode: mode.rawValue,
            dishTitle: dishTitle.isEmpty ? nil : dishTitle,
            restaurantName: restaurantName.isEmpty ? nil : restaurantName,
            estimatedArrivalAt: hasArrivalTime ? Self.isoTimestamp(arrivalTime) : nil,
            noteToRecipient: noteToRecipient.isEmpty ? nil : noteToRecipient
        )
        if let failure = await onSubmit(slotId, body) {
            errorMessage = failure
        } else {
            step = .success
        }
    }

    // MARK: - Building blocks

    private func stepTitle(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 18, weight: .bold))
            .foregroundStyle(Theme.Color.appText)
            .accessibilityAddTraits(.isHeader)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12.5, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.top, Spacing.s2)
    }

    private func summaryRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s3)
            Text(value)
                .font(.system(size: 13.5, weight: .medium))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, Spacing.s2)
    }

    private func selectableCard(
        isSelected: Bool,
        identifier: String,
        action: @escaping @MainActor () -> Void,
        @ViewBuilder label: () -> some View
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                label()
                Spacer(minLength: Spacing.s2)
                if isSelected {
                    Icon(.checkCircle, size: 20, color: Theme.Color.primary600)
                }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    private func reminderBox(icon: PantopusIcon, text: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(icon, size: 15, color: Theme.Color.warning)
            Text(text)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.warning)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("supportTrainReserveReminder")
    }

    private func errorBox(_ message: String) -> some View {
        Text(message)
            .font(.system(size: 13))
            .foregroundStyle(Theme.Color.error)
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.errorBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .accessibilityIdentifier("supportTrainReserveError")
    }

    private func primaryButton(
        _ title: String,
        enabled: Bool,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(enabled ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityIdentifier("supportTrainReservePrimaryCTA")
    }

    private func secondaryButton(
        _ title: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s5)
                .frame(height: 48)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("supportTrainReserveBackButton")
    }

    // MARK: - Formatting

    /// Backend validates `estimated_arrival_at` with `Joi.isoDate()`.
    private static func isoTimestamp(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }

    private static func timeLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
}

#Preview("Reserve — picker") {
    ReserveSlotSheet(
        selection: ReserveSheetSelection(slotId: nil),
        options: [
            ReserveSlotOption(
                id: "s1",
                dateLabel: "Tuesday, June 3",
                slotLabel: "Dinner",
                windowLabel: "5:00 pm – 7:00 pm"
            ),
            ReserveSlotOption(
                id: "s2",
                dateLabel: "Thursday, June 5",
                slotLabel: "Groceries",
                windowLabel: nil
            )
        ],
        context: ReserveSheetContext(
            enabledModes: SupportTrainContributionMode.allCases,
            restrictionChips: ["No peanuts", "Vegetarian"],
            contactlessPreferred: true
        ),
        isSubmitting: false,
        onSubmit: { _, _ in nil },
        onClose: {}
    )
}
