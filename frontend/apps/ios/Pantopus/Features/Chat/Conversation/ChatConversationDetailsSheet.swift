//
//  ChatConversationDetailsSheet.swift
//  Pantopus
//
//  Conversation-details drawer (Phase 3) opened from the person-thread
//  header's info button. Shows the pair's topics and a Safety section
//  with a confirm-to-block action (`POST /api/users/:userId/block`) and
//  a "Report" row that submits to `POST /api/users/:userId/report`
//  (route `backend/routes/users.js:4153`) via a reason picker sheet.
//

import SwiftUI

struct ChatConversationDetailsSheet: View {
    let viewModel: ChatConversationViewModel
    /// Called after a successful block — the host dismisses the drawer
    /// and pops the thread.
    let onBlocked: @MainActor () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var blockConfirmPresented = false
    @State private var blockFailedPresented = false
    @State private var reportSheetPresented = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    topicsSection
                    safetySection
                }
                .padding(.top, Spacing.s2)
                .padding(.bottom, Spacing.s6)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
        .background(Theme.Color.appSurface)
        .alert("Block \(firstName)?", isPresented: $blockConfirmPresented) {
            Button("Cancel", role: .cancel) {}
            Button("Block", role: .destructive) {
                Task {
                    if await viewModel.blockCounterparty() {
                        onBlocked()
                    } else {
                        blockFailedPresented = true
                    }
                }
            }
        } message: {
            Text("\(firstName) won't be able to message you, and new conversations with them are prevented.")
        }
        .alert("Couldn't block \(firstName)", isPresented: $blockFailedPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Please try again.")
        }
        .sheet(isPresented: $reportSheetPresented) {
            ChatReportUserSheet(viewModel: viewModel, firstName: firstName)
                .presentationDetents([.medium, .large])
        }
        .accessibilityIdentifier("chatConversationDetails")
    }

    private var header: some View {
        HStack {
            Text("Conversation details")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: Spacing.s0)
            Button { dismiss() } label: {
                Icon(.x, size: 16, strokeWidth: 2.5, color: Theme.Color.appTextSecondary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("chatDetailsClose")
        }
    }

    // MARK: - Topics

    private var topicsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionLabel("Topics")
            if viewModel.topics.isEmpty {
                Text("No topics yet — share a task or listing to start one.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            } else {
                ForEach(viewModel.topics) { topic in
                    topicRow(topic)
                }
            }
        }
    }

    private func topicRow(_ topic: ChatConversationTopic) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(icon(for: topic.topicType), size: 14, strokeWidth: 2.2, color: Theme.Color.primary600)
                .frame(width: 30, height: 30)
                .background(Theme.Color.primary50)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            Text(topic.title)
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
            Spacer(minLength: Spacing.s0)
            if let status = topic.status, !status.isEmpty {
                Text(status.capitalized)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 2)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(Capsule())
            }
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("chatDetailsTopic_\(topic.id)")
    }

    // MARK: - Safety

    private var safetySection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionLabel("Safety")
            Button {
                reportSheetPresented = true
            } label: {
                HStack(spacing: Spacing.s3) {
                    Icon(.flag, size: 14, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
                        .frame(width: 30, height: 30)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    Text("Report \(firstName)")
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: Spacing.s0)
                }
                .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("chatDetailsReport")
            Button {
                blockConfirmPresented = true
            } label: {
                HStack(spacing: Spacing.s3) {
                    Icon(.ban, size: 14, strokeWidth: 2.4, color: Theme.Color.error)
                        .frame(width: 30, height: 30)
                        .background(Theme.Color.errorBg)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    Text("Block \(firstName)")
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.error)
                    Spacer(minLength: Spacing.s0)
                    if viewModel.isBlocking {
                        ProgressView().tint(Theme.Color.error)
                    }
                }
                .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isBlocking)
            .accessibilityIdentifier("chatDetailsBlock")
        }
    }

    // MARK: - Helpers

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 10.5, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(Theme.Color.appTextMuted)
    }

    private var firstName: String {
        let name = viewModel.counterparty.displayName
        return name.split(separator: " ").first.map(String.init) ?? name
    }

    /// Same topicType → icon mapping as the topic strip.
    private func icon(for type: String) -> PantopusIcon {
        switch type {
        case "task": .briefcase
        case "listing": .tag
        case "home": .home
        case "business": .building2
        default: .messageCircle
        }
    }
}

// MARK: - Report sheet

/// Reason picker + optional details for `POST /api/users/:userId/report`
/// (route `backend/routes/users.js:4153`, validator `:4137`). Person
/// threads only — submission goes through
/// `ChatConversationViewModel.reportCounterparty(reason:details:)`.
struct ChatReportUserSheet: View {
    let viewModel: ChatConversationViewModel
    let firstName: String

    @Environment(\.dismiss) private var dismiss
    @State private var selectedReason: String?
    @State private var details = ""
    @State private var submitted = false
    @State private var failedPresented = false

    /// Backend reason code → friendly label, in display order. Codes
    /// match the validator's enum at `backend/routes/users.js:4137`.
    private static let reasons: [(code: String, label: String)] = [
        ("spam", "Spam"),
        ("harassment", "Harassment or bullying"),
        ("inappropriate", "Inappropriate content"),
        ("misinformation", "Misinformation"),
        ("safety", "Safety concern"),
        ("other", "Something else")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
            if submitted {
                successBody
            } else {
                formBody
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Theme.Color.appSurface)
        .alert("Couldn't send your report", isPresented: $failedPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Something went wrong on our end. Please try again.")
        }
        .accessibilityIdentifier("chatReportUserSheet")
    }

    private var header: some View {
        HStack {
            Text("Report \(firstName)")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: Spacing.s0)
            Button { dismiss() } label: {
                Icon(.x, size: 16, strokeWidth: 2.5, color: Theme.Color.appTextSecondary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("chatReportClose")
        }
    }

    private var formBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Text("Your report is confidential — \(firstName) won't know who flagged the conversation.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    ForEach(Self.reasons, id: \.code) { reason in
                        reasonRow(reason.code, reason.label)
                    }
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("DETAILS (OPTIONAL)")
                        .font(.system(size: 10.5, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(Theme.Color.appTextMuted)
                    TextField("Anything else we should know?", text: $details, axis: .vertical)
                        .font(.system(size: 13.5))
                        .lineLimit(3...6)
                        .padding(Spacing.s3)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        .accessibilityIdentifier("chatReportDetails")
                }
                submitButton
            }
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s6)
        }
    }

    private func reasonRow(_ code: String, _ label: String) -> some View {
        Button {
            selectedReason = code
        } label: {
            HStack(spacing: Spacing.s3) {
                Icon(
                    selectedReason == code ? .checkCircle : .circle,
                    size: 16,
                    strokeWidth: 2.2,
                    color: selectedReason == code ? Theme.Color.primary600 : Theme.Color.appTextMuted
                )
                Text(label)
                    .font(.system(size: 13.5, weight: selectedReason == code ? .semibold : .regular))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s0)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selectedReason == code ? .isSelected : [])
        .accessibilityIdentifier("chatReportReason_\(code)")
    }

    private var submitButton: some View {
        Button {
            Task { await submit() }
        } label: {
            HStack(spacing: Spacing.s2) {
                if viewModel.isReporting {
                    ProgressView().tint(Theme.Color.appTextInverse)
                }
                Text("Submit report")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(selectedReason == nil ? Theme.Color.appTextMuted : Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(selectedReason == nil || viewModel.isReporting)
        .accessibilityIdentifier("chatReportSubmit")
    }

    private var successBody: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.checkCircle, size: 28, strokeWidth: 2.2, color: Theme.Color.success)
                .frame(width: 56, height: 56)
                .background(Theme.Color.successBg)
                .clipShape(Circle())
            Text("Report submitted — thanks for keeping the neighborhood safe")
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s10)
        .accessibilityIdentifier("chatReportSuccess")
    }

    private func submit() async {
        guard let reason = selectedReason else { return }
        let trimmed = String(details.trimmingCharacters(in: .whitespacesAndNewlines).prefix(1000))
        let ok = await viewModel.reportCounterparty(
            reason: reason,
            details: trimmed.isEmpty ? nil : trimmed
        )
        if ok {
            submitted = true
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            dismiss()
        } else {
            failedPresented = true
        }
    }
}
