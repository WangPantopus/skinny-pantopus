//
//  ReportUserSheet.swift
//  Pantopus
//
//  P6.2 — Report-a-user form, presented as a sheet from the public
//  profile overflow menu. Posts to `POST /api/users/:userId/report`
//  (route `backend/routes/users.js:4153`).
//

import Foundation
import Logging
import Observation
import SwiftUI

/// Reasons surfaced by the design's radio group. Each carries the
/// backend-accepted `reason` key — the Joi schema only accepts a
/// fixed set so design-only categories (impersonation, fraud, hate
/// speech) collapse to a backend bucket and prefix the moderator-visible
/// `details` with their user-facing label.
public enum ReportReason: String, CaseIterable, Identifiable, Sendable {
    case spam
    case harassment
    case impersonation
    case fraud
    case hateSpeech = "hate_speech"
    /// A card's report only (wave 4 drawing 7).
    case inappropriate
    case safety
    case other

    /// What a person's report offers.
    static let forPerson: [ReportReason] = [.spam, .harassment, .impersonation, .fraud, .hateSpeech, .other]
    /// What "Report this card" offers, as drawn: the existing card reasons without "Misinformation" (it doesn't fit a
    /// card; the founder's choice with the wave 4 drawings).
    static let forCard: [ReportReason] = [.spam, .harassment, .inappropriate, .safety, .other]

    public var id: String {
        rawValue
    }

    /// Label rendered in the radio row.
    public var label: String {
        switch self {
        case .spam: "Spam"
        case .harassment: "Harassment"
        case .impersonation: "Impersonation"
        case .fraud: "Fraud"
        case .hateSpeech: "Hate speech"
        case .inappropriate: "Inappropriate content"
        case .safety: "Safety concern"
        case .other: "Other"
        }
    }

    /// A card's label, as web's list and the drawing word it.
    func label(onCard: Bool) -> String {
        guard onCard else { return label }
        switch self {
        case .spam: return "Spam or misleading"
        case .harassment: return "Harassment or bullying"
        default: return label
        }
    }

    /// Backend-valid key submitted in the `reason` field.
    var backendKey: String {
        switch self {
        case .spam: "spam"
        case .harassment, .hateSpeech: "harassment"
        case .inappropriate: "inappropriate"
        case .safety: "safety"
        case .impersonation, .fraud, .other: "other"
        }
    }

    /// Prefix prepended to the moderator-visible `details` body when this
    /// reason is collapsed onto a generic backend key. `nil` means the
    /// backend key already matches the design category.
    var detailsPrefix: String? {
        switch self {
        case .impersonation: "[Impersonation]"
        case .fraud: "[Fraud]"
        case .hateSpeech: "[Hate speech]"
        case .spam, .harassment, .inappropriate, .safety, .other: nil
        }
    }
}

/// Submission state for the report sheet.
public enum ReportUserSheetState: Sendable, Equatable {
    case idle
    case submitting
    case succeeded
    case failed(message: String)
}

/// View-model behind `ReportUserSheet`. Owns the radio selection, the
/// details field, and the submit lifecycle.
@MainActor
@Observable
public final class ReportUserSheetViewModel {
    public private(set) var state: ReportUserSheetState = .idle
    public var selectedReason: ReportReason?
    public var details: String = ""

    private let userId: String
    /// "Report this card": the card shared with admins with this report.
    private let mailId: String?
    private let client: APIClient
    private let logger = Logger(label: "app.pantopus.ios.ReportUser")

    init(userId: String, mailId: String? = nil, client: APIClient = .shared) {
        self.userId = userId
        self.mailId = mailId
        self.client = client
    }

    /// Submit is enabled when a reason is picked and — for `.other` — a
    /// non-empty `details` string is provided. The same rule mirrors on
    /// Android (`ReportUserSheetViewModel#canSubmit`).
    public var canSubmit: Bool {
        guard let selectedReason else { return false }
        if selectedReason == .other {
            return !details.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        return true
    }

    /// Whether the `details` field is gated as required by the current
    /// reason. Drives the "Required" caption + placeholder copy.
    public var detailsRequired: Bool {
        selectedReason == .other
    }

    public func submit() async {
        guard let selectedReason, canSubmit else { return }
        guard state != .submitting, state != .succeeded else { return }
        state = .submitting
        let trimmed = details.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = UserReportBody(
            reason: selectedReason.backendKey,
            details: payloadDetails(for: selectedReason, userDetails: trimmed),
            mailId: mailId
        )
        do {
            _ = try await client.request(
                UserReportsEndpoints.report(userId: userId, body: body),
                as: EmptyResponse.self
            )
            state = .succeeded
        } catch let error as APIError {
            logger.warning("Report submit failed: \(error)")
            state = .failed(message: friendlyMessage(for: error))
        } catch {
            logger.warning("Report submit failed: \(error)")
            state = .failed(message: "Couldn't submit your report.")
        }
    }

    private func payloadDetails(for reason: ReportReason, userDetails: String) -> String? {
        switch (reason.detailsPrefix, userDetails.isEmpty) {
        case (nil, true): nil
        case (nil, false): userDetails
        case let (prefix?, true): prefix
        case let (prefix?, false): "\(prefix) \(userDetails)"
        }
    }

    private func friendlyMessage(for error: APIError) -> String {
        switch error {
        case .notFound: "We couldn't find that user."
        case .forbidden: "You don't have permission to do that."
        case .transport: "Check your connection and try again."
        default: "Couldn't submit your report."
        }
    }
}

/// "Report this card" (launch key `holiday_card_memories`; wave 4 drawing 7): the card received from this person is
/// shared with Pantopus admins for review, that card only, and the sheet says so plainly.
public struct ReportedCard: Sendable, Equatable {
    public let mailId: String
    public let senderFirstName: String

    public init(mailId: String, senderFirstName: String) {
        self.mailId = mailId
        self.senderFirstName = senderFirstName
    }
}

/// Sheet content presented from `PublicProfileView` when the overflow's
/// Report row is tapped.
@MainActor
public struct ReportUserSheet: View {
    @State private var viewModel: ReportUserSheetViewModel
    private let handle: String?
    private let displayName: String
    private let card: ReportedCard?
    private let onClose: @MainActor () -> Void
    private let onSubmitted: @MainActor () -> Void
    @FocusState private var detailsFocused: Bool

    public init(
        userId: String,
        handle: String?,
        displayName: String,
        card: ReportedCard? = nil,
        onClose: @escaping @MainActor () -> Void,
        onSubmitted: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: ReportUserSheetViewModel(userId: userId, mailId: card?.mailId))
        self.handle = handle
        self.displayName = displayName
        self.card = card
        self.onClose = onClose
        self.onSubmitted = onSubmitted
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    intro

                    reasonGroup
                    detailsField

                    if case let .failed(message) = viewModel.state {
                        Text(message)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.error)
                            .accessibilityIdentifier("reportUser_error")
                    }

                    actions
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s3)
                .padding(.bottom, Spacing.s10)
            }
            .background(Theme.Color.appBg.ignoresSafeArea())
            .navigationTitle(titleText)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel", action: onClose)
                        .accessibilityIdentifier("reportUser_cancel")
                }
            }
            .accessibilityIdentifier("reportUserSheet")
            .onChange(of: viewModel.state) { _, newState in
                if newState == .succeeded { onSubmitted() }
            }
        }
    }

    @ViewBuilder private var intro: some View {
        if let card {
            // Said plainly, as drawn: what the report shares.
            (Text("Pantopus will be able to see this card to review it.").bold()
                + Text(" Only this card: nothing else in your mail or \(card.senderFirstName)’s is shared."))
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("reportUser_cardDisclosure")
        } else {
            Text("Tell us why you're reporting this account. Our moderators review every report.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var titleText: String {
        if card != nil { return "Report this card" }
        if let handle, !handle.isEmpty { return "Report @\(handle)" }
        return "Report \(displayName)"
    }

    private var reasonGroup: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Reason")
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: Spacing.s0) {
                let reasons = card == nil ? ReportReason.forPerson : ReportReason.forCard
                ForEach(Array(reasons.enumerated()), id: \.element) { index, reason in
                    ReportReasonRow(
                        reason: reason,
                        label: reason.label(onCard: card != nil),
                        isSelected: viewModel.selectedReason == reason,
                        isLast: index == reasons.count - 1
                    ) {
                        viewModel.selectedReason = reason
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
            )
            .accessibilityIdentifier("reportUser_reasons")
        }
    }

    private var detailsField: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Text("Details")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if viewModel.detailsRequired {
                    Text("Required")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityIdentifier("reportUser_detailsRequired")
                }
            }
            .accessibilityAddTraits(.isHeader)
            TextField(
                viewModel.detailsRequired
                    ? "Tell us what happened"
                    : "Add anything that helps (optional)",
                text: Binding(
                    get: { viewModel.details },
                    set: { viewModel.details = $0 }
                ),
                axis: .vertical
            )
            .focused($detailsFocused)
            .lineLimit(4...8)
            .font(Theme.Font.body)
            .foregroundStyle(Theme.Color.appText)
            .padding(Spacing.s3)
            .typesInFieldOnTap($detailsFocused)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
            )
            .accessibilityIdentifier("reportUser_details")
        }
    }

    @ViewBuilder private var actions: some View {
        let isSubmitting = viewModel.state == .submitting
        VStack(spacing: Spacing.s2) {
            PrimaryButton(
                title: card == nil ? "Submit report" : "Report",
                isLoading: isSubmitting,
                isEnabled: viewModel.canSubmit && !isSubmitting
            ) {
                await viewModel.submit()
            }
            .accessibilityIdentifier("reportUser_submit")

            GhostButton(title: "Cancel", isEnabled: !isSubmitting) {
                await MainActor.run { onClose() }
            }
            .accessibilityIdentifier("reportUser_cancelGhost")
        }
        .padding(.top, Spacing.s2)
    }
}

/// One tappable row in the reason radio group.
private struct ReportReasonRow: View {
    let reason: ReportReason
    let label: String
    let isSelected: Bool
    let isLast: Bool
    let onTap: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Button(action: onTap) {
                HStack(spacing: Spacing.s3) {
                    Text(label)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Spacer()
                    RadioDot(isSelected: isSelected)
                }
                .contentShape(Rectangle())
                .padding(.horizontal, Spacing.s4)
                .frame(minHeight: 48)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("reportUser_reason_\(reason.rawValue)")
            .accessibilityLabel(label)
            .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)

            if !isLast {
                Divider()
                    .background(Theme.Color.appBorderSubtle)
                    .padding(.leading, Spacing.s4)
            }
        }
    }
}

private struct RadioDot: View {
    let isSelected: Bool

    var body: some View {
        ZStack {
            Circle()
                .stroke(
                    isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                    lineWidth: 1.5
                )
                .frame(width: 22, height: 22)
            if isSelected {
                Circle()
                    .fill(Theme.Color.primary600)
                    .frame(width: 11, height: 11)
            }
        }
        .accessibilityHidden(true)
    }
}

#Preview {
    ReportUserSheet(
        userId: "preview",
        handle: "alex",
        displayName: "Alex Rivera",
        onClose: {},
        onSubmitted: {}
    )
}
