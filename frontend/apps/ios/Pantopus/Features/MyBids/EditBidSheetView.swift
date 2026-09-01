//
//  EditBidSheetView.swift
//  Pantopus
//
//  P3.4 — Bid form, presented as a sheet. Single source of truth for the
//  bid-entry UX, reused by:
//
//    • `GigDetailView`     → place a new bid (POST /api/gigs/:gigId/bids)
//    • `MyBidsView`        → edit an existing bid (PUT /api/gigs/:gigId/bids/:bidId)
//
//  Fields: amount (required), message (optional), ETA / proposed time
//  (optional), terms (optional). Terms append to the message body at
//  submission since the backend doesn't carry a dedicated `terms` field.
//

import SwiftUI

/// Presentation handed to the sheet. `bidId` is `nil` when placing a new
/// bid; non-nil when editing an existing one. The view binds these as
/// initial values, the host VM keeps the canonical write path.
public struct EditBidSheetTarget: Identifiable, Sendable, Hashable {
    public let id: String
    public let gigId: String
    public let gigTitle: String
    public let bidId: String?
    public let initialAmount: Double?
    public let initialMessage: String?
    public let initialProposedTime: String?
    public let initialTerms: String?

    public init(
        id: String,
        gigId: String,
        gigTitle: String,
        bidId: String?,
        initialAmount: Double? = nil,
        initialMessage: String? = nil,
        initialProposedTime: String? = nil,
        initialTerms: String? = nil
    ) {
        self.id = id
        self.gigId = gigId
        self.gigTitle = gigTitle
        self.bidId = bidId
        self.initialAmount = initialAmount
        self.initialMessage = initialMessage
        self.initialProposedTime = initialProposedTime
        self.initialTerms = initialTerms
    }

    /// True when the sheet is editing an existing bid (vs placing new).
    public var isEditing: Bool {
        bidId != nil
    }
}

/// Form draft pushed back to the host on submit. The host turns this
/// into a `PlaceBidBody` for either POST or PUT.
public struct EditBidDraft: Sendable, Equatable {
    public let amount: Double
    public let message: String?
    public let proposedTime: String?

    public init(amount: Double, message: String?, proposedTime: String?) {
        self.amount = amount
        self.message = message
        self.proposedTime = proposedTime
    }
}

/// Reusable bid-entry sheet. The host owns the network roundtrip; the
/// sheet just collects values and reports a result.
@MainActor
public struct EditBidSheetView: View {
    public typealias Submit = @MainActor (EditBidDraft) async -> Bool

    private let target: EditBidSheetTarget
    private let onSubmit: Submit
    private let onCancel: @MainActor () -> Void

    @State private var amount: String
    @State private var message: String
    @State private var eta: String
    @State private var terms: String
    @State private var submitting: Bool = false
    @State private var errorText: String?

    public init(
        target: EditBidSheetTarget,
        onSubmit: @escaping Submit,
        onCancel: @escaping @MainActor () -> Void
    ) {
        self.target = target
        self.onSubmit = onSubmit
        self.onCancel = onCancel
        let amountString: String = if let initial = target.initialAmount {
            initial.truncatingRemainder(dividingBy: 1) == 0
                ? "\(Int(initial))"
                : String(format: "%.2f", initial)
        } else {
            ""
        }
        _amount = State(initialValue: amountString)
        _message = State(initialValue: target.initialMessage ?? "")
        _eta = State(initialValue: target.initialProposedTime ?? "")
        _terms = State(initialValue: target.initialTerms ?? "")
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                header
                amountField
                messageField
                etaField
                termsField
                if let errorText, !errorText.isEmpty {
                    Text(errorText)
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityIdentifier("edit-bid-error")
                }
                actions
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("edit-bid-sheet")
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(target.isEditing ? "Edit bid" : "Place a bid")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(headerCopy)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var headerCopy: String {
        if target.isEditing {
            return "Update your offer on \(target.gigTitle). The poster will see your latest amount and message."
        }
        return "Tell the poster what you'd charge and add a short message about your approach."
    }

    private var amountField: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Amount")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                Text("$")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextField("0", text: $amount)
                    .keyboardType(.decimalPad)
                    .font(Theme.Font.body)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityIdentifier("edit-bid-amount")
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
    }

    private var messageField: some View {
        multilineField(
            label: "Message",
            placeholder: "Tell the poster how you'd approach the job.",
            text: $message,
            identifier: "edit-bid-message"
        )
    }

    private var etaField: some View {
        textField(
            label: "ETA (optional)",
            placeholder: "e.g. Saturday afternoon or 2026-05-22",
            text: $eta,
            identifier: "edit-bid-eta"
        )
    }

    private var termsField: some View {
        multilineField(
            label: "Terms (optional)",
            placeholder: "Anything the poster should agree to up front (deposit, cancellation, …).",
            text: $terms,
            identifier: "edit-bid-terms"
        )
    }

    private var actions: some View {
        HStack(spacing: Spacing.s2) {
            Button {
                onCancel()
            } label: {
                Text("Cancel")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.vertical, Spacing.s3)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
            .disabled(submitting)
            .accessibilityIdentifier("edit-bid-cancel")

            Button {
                Task { await submit() }
            } label: {
                Group {
                    if submitting {
                        ProgressView()
                            .tint(Theme.Color.appTextInverse)
                    } else {
                        Text(target.isEditing ? "Save bid" : "Submit bid")
                            .pantopusTextStyle(.body)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                }
                .padding(.vertical, Spacing.s3)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(canSubmit ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
                )
            }
            .buttonStyle(.plain)
            .disabled(!canSubmit || submitting)
            .accessibilityIdentifier("edit-bid-submit")
        }
    }

    // MARK: - Helpers

    private var canSubmit: Bool {
        parsedAmount() != nil
    }

    private func parsedAmount() -> Double? {
        let trimmed = amount.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, let value = Double(trimmed), value > 0 else { return nil }
        return value
    }

    private func submit() async {
        guard let value = parsedAmount() else { return }
        submitting = true
        defer { submitting = false }
        errorText = nil
        let trimmedMessage = message.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedTerms = terms.trimmingCharacters(in: .whitespacesAndNewlines)
        let composedMessage = Self.composeMessage(message: trimmedMessage, terms: trimmedTerms)
        let trimmedEta = eta.trimmingCharacters(in: .whitespacesAndNewlines)
        let draft = EditBidDraft(
            amount: value,
            message: composedMessage,
            proposedTime: trimmedEta.isEmpty ? nil : trimmedEta
        )
        let ok = await onSubmit(draft)
        if !ok {
            errorText = "Couldn't submit. Try again in a moment."
        }
    }

    /// Folds the optional terms field into the message body. The
    /// backend's `PlaceBidBody` doesn't carry a dedicated `terms` column,
    /// so terms ride along under a "Terms:" prefix. Keeps the wire shape
    /// boring while still surfacing the agreement copy to the poster.
    public static func composeMessage(message: String, terms: String) -> String? {
        let m = message.trimmingCharacters(in: .whitespacesAndNewlines)
        let t = terms.trimmingCharacters(in: .whitespacesAndNewlines)
        switch (m.isEmpty, t.isEmpty) {
        case (true, true): return nil
        case (false, true): return m
        case (true, false): return "Terms: \(t)"
        case (false, false): return "\(m)\n\nTerms: \(t)"
        }
    }

    private func textField(
        label: String,
        placeholder: String,
        text: Binding<String>,
        identifier: String
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            TextField(placeholder, text: text)
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 44)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .accessibilityIdentifier(identifier)
        }
    }

    private func multilineField(
        label: String,
        placeholder: String,
        text: Binding<String>,
        identifier: String
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            TextField(placeholder, text: text, axis: .vertical)
                .lineLimit(2...5)
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .frame(minHeight: 44, alignment: .topLeading)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .accessibilityIdentifier(identifier)
        }
    }
}

#Preview("Place new bid") {
    EditBidSheetView(
        target: EditBidSheetTarget(
            id: "preview",
            gigId: "g_preview",
            gigTitle: "Mount a TV",
            bidId: nil
        ),
        onSubmit: { _ in true },
        onCancel: {}
    )
    .background(Theme.Color.appBg)
}

#Preview("Edit existing bid") {
    EditBidSheetView(
        target: EditBidSheetTarget(
            id: "preview",
            gigId: "g_preview",
            gigTitle: "Mount a TV",
            bidId: "bid_1",
            initialAmount: 95,
            initialMessage: "I've mounted 40 TVs across the neighborhood.",
            initialProposedTime: "Saturday afternoon",
            initialTerms: nil
        ),
        onSubmit: { _ in true },
        onCancel: {}
    )
    .background(Theme.Color.appBg)
}
