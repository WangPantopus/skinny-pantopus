//
//  AddBillWizardView.swift
//  Pantopus
//
//  Wraps the shared `WizardShell` with an `AddBillWizardViewModel`.
//  Renders one of three step bodies + a success step. Hands the bill
//  via the outbound event so the host can route to the new detail.
//

import SwiftUI

struct AddBillWizardView: View {
    @State private var viewModel: AddBillWizardViewModel
    private let onClose: () -> Void
    private let onCreated: (String) -> Void
    private let onUpdated: () -> Void

    init(
        homeId: String,
        billId: String? = nil,
        onClose: @escaping () -> Void,
        onCreated: @escaping (String) -> Void,
        onUpdated: @escaping () -> Void = {}
    ) {
        _viewModel = State(initialValue: AddBillWizardViewModel(homeId: homeId, billId: billId))
        self.onClose = onClose
        self.onCreated = onCreated
        self.onUpdated = onUpdated
    }

    var body: some View {
        WizardShell(model: viewModel) {
            switch viewModel.currentStep {
            case .details: DetailsStep(viewModel: viewModel)
            case .schedule: ScheduleStep(viewModel: viewModel)
            case .review: ReviewStep(viewModel: viewModel)
            case .success: SuccessStep(isEditing: viewModel.isEditing)
            }
        }
        .accessibilityIdentifier("addBillWizard")
        .onAppear {
            Analytics.track(.screenAddBillWizardStepViewed(stepNumber: 1, stepName: "details"))
        }
        .task { await viewModel.load() }
        .onChange(of: viewModel.pendingEvent) { _, event in
            guard let event else { return }
            switch event {
            case .dismiss: onClose()
            case let .created(billId): onCreated(billId)
            case .updated: onUpdated()
            }
        }
    }
}

// MARK: - Step 1 · Details

private struct DetailsStep: View {
    @Bindable var viewModel: AddBillWizardViewModel
    @FocusState private var focused: Field?

    private enum Field { case payee, amount }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HeadlineBlock(
                viewModel.isEditing ? "Edit bill" : "Add a bill",
                subtitle: viewModel.isEditing
                    ? "Update the payee, amount, due date, or schedule."
                    : "Track due dates, schedule payments, and keep the household on the same page."
            )
            if let loadError = viewModel.loadError {
                Text(loadError)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("addBill_loadError")
            }

            FieldLabel("Payee")
            TextField("ConEd Electric", text: $viewModel.payee)
                .textInputAutocapitalization(.words)
                .focused($focused, equals: .payee)
                .font(Theme.Font.body)
                .padding(Spacing.s3)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
                )
                .accessibilityIdentifier("addBill_payee")

            FieldLabel("Amount")
            HStack(spacing: Spacing.s2) {
                Icon(.dollarSign, size: 16, color: Theme.Color.appTextSecondary)
                TextField("0.00", text: $viewModel.amount)
                    .keyboardType(.decimalPad)
                    .focused($focused, equals: .amount)
                    .font(Theme.Font.body)
                    .accessibilityIdentifier("addBill_amount")
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
            )

            FieldLabel("Due date")
            DatePicker(
                "Due date",
                selection: Binding(
                    get: { viewModel.dueDate ?? Date() },
                    set: { viewModel.dueDate = $0 }
                ),
                displayedComponents: .date
            )
            .labelsHidden()
            .accessibilityIdentifier("addBill_dueDate")
        }
        .onAppear { focused = .payee }
    }
}

// MARK: - Step 2 · Schedule

private struct ScheduleStep: View {
    @Bindable var viewModel: AddBillWizardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HeadlineBlock("Schedule", subtitle: "Pick how often this bill repeats.")
            VStack(spacing: Spacing.s2) {
                ForEach(AddBillSchedule.allCases) { schedule in
                    Button {
                        viewModel.schedule = schedule
                    } label: {
                        HStack(spacing: Spacing.s3) {
                            Icon(
                                schedule == .oneTime ? .clock : .arrowsRepeat,
                                size: 18,
                                color: Theme.Color.primary600
                            )
                            Text(schedule.label)
                                .pantopusTextStyle(.body)
                                .foregroundStyle(Theme.Color.appText)
                            Spacer()
                            if viewModel.schedule == schedule {
                                Icon(.checkCircle, size: 20, color: Theme.Color.primary600)
                            } else {
                                Circle()
                                    .stroke(Theme.Color.appBorder, lineWidth: 1)
                                    .frame(width: 20, height: 20)
                            }
                        }
                        .padding(Spacing.s3)
                        .background(Theme.Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md)
                                .stroke(
                                    viewModel.schedule == schedule
                                        ? Theme.Color.primary600
                                        : Theme.Color.appBorderSubtle,
                                    lineWidth: 1
                                )
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("addBill_schedule_\(schedule.rawValue)")
                }
            }
        }
    }
}

// MARK: - Step 3 · Review

private struct ReviewStep: View {
    let viewModel: AddBillWizardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HeadlineBlock("Review", subtitle: "Double-check the details before adding the bill.")
            VStack(spacing: Spacing.s0) {
                reviewRow(label: "Payee", value: viewModel.payee.isEmpty ? "—" : viewModel.payee)
                divider
                reviewRow(label: "Amount", value: viewModel.parsedAmount().map(BillsListViewModel.formatCurrency) ?? "—")
                divider
                reviewRow(label: "Due date", value: viewModel.dueDate.map { Self.format($0) } ?? "—")
                divider
                reviewRow(label: "Schedule", value: viewModel.schedule.label)
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
            )
            if let err = viewModel.submitError {
                Text(err)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.error)
            }
            // Backend note — splits write API isn't shipped yet.
            HStack(spacing: Spacing.s2) {
                Icon(.users, size: 14, color: Theme.Color.appTextSecondary)
                Text("Splits with household members can be configured after the bill is added.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private func reviewRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            Text(value)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
    }

    private var divider: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
    }

    private static func format(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateStyle = .medium
        f.timeStyle = .none
        return f.string(from: date)
    }
}

// MARK: - Step 4 · Success

private struct SuccessStep: View {
    let isEditing: Bool

    var body: some View {
        VStack(spacing: Spacing.s4) {
            ZStack {
                Circle().fill(Theme.Color.successBg).frame(width: 72, height: 72)
                Icon(.checkCircle, size: 32, color: Theme.Color.success)
            }
            Text(isEditing ? "Bill updated" : "Bill added")
                .pantopusTextStyle(.h2)
                .foregroundStyle(Theme.Color.appText)
            Text(
                isEditing
                    ? "Your changes are saved. The detail will reflect them now."
                    : "You can mark it paid or review the schedule from the Bills list."
            )
            .pantopusTextStyle(.body)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, Spacing.s6)
    }
}

// MARK: - Local helpers

private struct FieldLabel: View {
    let text: String
    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
    }
}

#Preview {
    AddBillWizardView(homeId: "preview", onClose: {}, onCreated: { _ in }, onUpdated: {})
}
