//
//  GigQuestionsSection.swift
//  Pantopus
//
//  Structured Q&A block on Task Details — ask form, thread list, and
//  poster answer affordance. Matches RN/web `QASection`.
//

// swiftlint:disable type_body_length

import SwiftUI

struct GigQuestionsSection: View {
    @Bindable var viewModel: GigDetailViewModel
    var onError: (@MainActor (String) -> Void)?

    private let maxQuestionLength = 1000
    private let maxAnswerLength = 2000

    /// Set while the destructive confirm for a question is on screen.
    @State private var pendingDelete: GigQuestionDTO?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            header
            if viewModel.canAskQuestion {
                askForm
            }
            questionsBody
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, 22)
        .accessibilityIdentifier("gigQuestionsSection")
        .confirmationDialog(
            "Delete question",
            isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                guard let target = pendingDelete else { return }
                pendingDelete = nil
                Task {
                    if let message = await viewModel.deleteQuestion(questionId: target.id) {
                        onError?(message)
                    }
                }
            }
            .accessibilityIdentifier("gigQuestionsDeleteConfirm")
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        } message: {
            Text(deleteConfirmMessage)
        }
    }

    /// Mirrors RN's `confirm({ title: 'Delete Question', … })` but names
    /// the question being removed, per the native destructive-copy rule.
    private var deleteConfirmMessage: String {
        guard let question = pendingDelete else { return "Are you sure?" }
        let trimmed = question.question.trimmingCharacters(in: .whitespacesAndNewlines)
        let preview = trimmed.count > 60 ? String(trimmed.prefix(60)) + "…" : trimmed
        return "\u{201C}\(preview)\u{201D} will be removed for everyone. This can't be undone."
    }

    private var header: some View {
        HStack {
            Text("Questions (\(viewModel.questions.count))")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            statusChips
        }
        .accessibilityIdentifier("gigQuestionsHeader")
    }

    @ViewBuilder private var statusChips: some View {
        let answered = viewModel.questions.filter(\.isAnswered).count
        let open = viewModel.questions.count - answered
        HStack(spacing: 6) {
            if answered > 0 {
                Text("\(answered) answered")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.Color.success)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Theme.Color.success.opacity(0.12))
                    .clipShape(Capsule())
            }
            if open > 0 {
                Text("\(open) awaiting")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.Color.warning)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Theme.Color.warning.opacity(0.12))
                    .clipShape(Capsule())
            }
        }
    }

    private var askForm: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            TextField(
                "Ask a question about this gig...",
                text: $viewModel.newQuestionText,
                axis: .vertical
            )
            .lineLimit(2...4)
            .font(.system(size: 13.5))
            .foregroundStyle(Theme.Color.appText)
            .accessibilityIdentifier("gigQuestionsAskInput")
            HStack {
                Text("\(viewModel.newQuestionText.count)/\(maxQuestionLength)")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
                Spacer()
                Button {
                    Task {
                        if let message = await viewModel.submitQuestion() {
                            onError?(message)
                        }
                    }
                } label: {
                    Text(viewModel.questionSubmitting ? "Posting…" : "Ask Question")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(canSubmitQuestion ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .disabled(!canSubmitQuestion || viewModel.questionSubmitting)
                .buttonStyle(.plain)
                .accessibilityIdentifier("gigQuestionsAskButton")
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .onChange(of: viewModel.newQuestionText) { _, newValue in
            if newValue.count > maxQuestionLength {
                viewModel.newQuestionText = String(newValue.prefix(maxQuestionLength))
            }
        }
    }

    private var canSubmitQuestion: Bool {
        viewModel.newQuestionText.trimmingCharacters(in: .whitespacesAndNewlines).count >= 5
    }

    @ViewBuilder private var questionsBody: some View {
        if viewModel.questionsLoading {
            Text("Loading questions...")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s4)
        } else if viewModel.questions.isEmpty {
            Text("No questions yet. Be the first to ask!")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s4)
                .accessibilityIdentifier("gigQuestionsEmpty")
        } else {
            VStack(spacing: Spacing.s3) {
                ForEach(viewModel.pinnedQuestions) { question in
                    pinnedCard(question)
                }
                ForEach(viewModel.unpinnedQuestions) { question in
                    questionRow(question)
                }
            }
        }
    }

    /// Pinned answers get their own highlighted card above the thread —
    /// mirrors RN `QASection`'s `pinnedQuestions` block.
    private func pinnedCard(_ question: GigQuestionDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: 6) {
                Icon(.pin, size: 12, strokeWidth: 2.4, color: Theme.Color.primary600)
                Text("Pinned answer")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                Spacer()
                if viewModel.canPinQuestion(question) {
                    actionLink(
                        "Unpin",
                        tint: Theme.Color.primary600,
                        identifier: "gigQuestion.\(question.id).unpin",
                        enabled: viewModel.questionActionInFlight == nil
                    ) {
                        Task {
                            if let message = await viewModel.toggleQuestionPin(questionId: question.id) {
                                onError?(message)
                            }
                        }
                    }
                }
            }
            Text("Q: \(question.question)")
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            if let answer = question.answer, !answer.isEmpty {
                Text("A: \(answer)")
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.personalBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary600.opacity(0.35), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("gigQuestionPinned.\(question.id)")
    }

    private func questionRow(_ question: GigQuestionDTO) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            upvoteColumn(question)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(question.question)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                metaRow(question)
                if let answer = question.answer, !answer.isEmpty {
                    answerBlock(question, answer: answer)
                }
                if viewModel.viewerIsOwner, !question.isAnswered {
                    ownerAnswerControls(question)
                }
                actionsRow(question)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("gigQuestion.\(question.id)")
    }

    /// Chevron + count column on the leading edge — tapping toggles the
    /// viewer's upvote (`POST .../questions/:id/upvote`).
    private func upvoteColumn(_ question: GigQuestionDTO) -> some View {
        Button {
            Task {
                if let message = await viewModel.toggleQuestionUpvote(questionId: question.id) {
                    onError?(message)
                }
            }
        } label: {
            VStack(spacing: 2) {
                Icon(.chevronUp, size: 18, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                Text("\(question.upvoteCount ?? 0)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(minWidth: 28)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!viewModel.canUpvoteQuestion || viewModel.questionActionInFlight != nil)
        .accessibilityLabel("Upvote question")
        .accessibilityIdentifier("gigQuestion.\(question.id).upvote")
    }

    /// Pin/Unpin (poster, answered) + Delete (asker or poster). The
    /// "Answer" affordance stays in `ownerAnswerControls`, matching RN.
    @ViewBuilder private func actionsRow(_ question: GigQuestionDTO) -> some View {
        let canPin = viewModel.canPinQuestion(question)
        let canDelete = viewModel.canDeleteQuestion(question)
        if canPin || canDelete {
            HStack(spacing: Spacing.s4) {
                if canPin {
                    actionLink(
                        (question.isPinned ?? false) ? "Unpin" : "Pin",
                        tint: Theme.Color.primary600,
                        identifier: "gigQuestion.\(question.id).pin",
                        enabled: viewModel.questionActionInFlight == nil
                    ) {
                        Task {
                            if let message = await viewModel.toggleQuestionPin(questionId: question.id) {
                                onError?(message)
                            }
                        }
                    }
                }
                if canDelete {
                    actionLink(
                        "Delete",
                        tint: Theme.Color.error,
                        identifier: "gigQuestion.\(question.id).delete",
                        enabled: viewModel.questionActionInFlight == nil
                    ) {
                        pendingDelete = question
                    }
                }
                Spacer()
            }
        }
    }

    private func actionLink(
        _ title: String,
        tint: Color,
        identifier: String,
        enabled: Bool,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(enabled ? tint : Theme.Color.appTextMuted)
                .frame(minHeight: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityIdentifier(identifier)
    }

    private func metaRow(_ question: GigQuestionDTO) -> some View {
        HStack(spacing: 6) {
            Text(askerDisplayName(question.asker))
                .font(.system(size: 11.5, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
            if let when = questionRelativeTime(question.createdAt) {
                Text("·")
                    .foregroundStyle(Theme.Color.appTextMuted)
                Text(when)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            if question.isAnswered {
                Text("·")
                    .foregroundStyle(Theme.Color.appTextMuted)
                Text("Answered")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.success)
            } else {
                Text("·")
                    .foregroundStyle(Theme.Color.appTextMuted)
                Text("Awaiting answer")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.warning)
            }
        }
    }

    private func answerBlock(_ question: GigQuestionDTO, answer: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(answererDisplayName(question)) answered:")
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.success)
            Text(answer)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.success.opacity(0.08))
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(Theme.Color.success)
                .frame(width: 2)
        }
        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
    }

    @ViewBuilder private func ownerAnswerControls(_ question: GigQuestionDTO) -> some View {
        if viewModel.answeringQuestionId == question.id {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                TextField("Write your answer...", text: $viewModel.answerDraftText, axis: .vertical)
                    .lineLimit(2...4)
                    .font(.system(size: 13.5))
                    .padding(Spacing.s2)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .accessibilityIdentifier("gigQuestionsAnswerInput")
                    .onChange(of: viewModel.answerDraftText) { _, newValue in
                        if newValue.count > maxAnswerLength {
                            viewModel.answerDraftText = String(newValue.prefix(maxAnswerLength))
                        }
                    }
                HStack {
                    Button("Cancel") { viewModel.cancelAnswering() }
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .buttonStyle(.plain)
                    Spacer()
                    Button {
                        Task {
                            if let message = await viewModel.submitAnswer(questionId: question.id) {
                                onError?(message)
                            }
                        }
                    } label: {
                        Text(viewModel.answerSubmitting ? "Posting…" : "Post Answer")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                viewModel.answerDraftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    ? Theme.Color.appSurfaceSunken
                                    : Theme.Color.success
                            )
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    }
                    .disabled(
                        viewModel.answerDraftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            || viewModel.answerSubmitting
                    )
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("gigQuestionsAnswerSubmit")
                }
            }
        } else {
            Button("Answer") { viewModel.beginAnswering(question.id) }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.primary600)
                .buttonStyle(.plain)
                .accessibilityIdentifier("gigQuestionsAnswerButton")
        }
    }
}

private func askerDisplayName(_ user: GigQuestionUser?) -> String {
    guard let user else { return "Neighbor" }
    if let name = user.name, !name.isEmpty { return name }
    let parts = [user.firstName, user.lastName].compactMap { $0 }.filter { !$0.isEmpty }
    if !parts.isEmpty { return parts.joined(separator: " ") }
    return user.username ?? "Neighbor"
}

private func answererDisplayName(_ question: GigQuestionDTO) -> String {
    if let display = question.answererDisplayName, !display.isEmpty { return display }
    if let answerer = question.answerer {
        if let name = answerer.name, !name.isEmpty { return name }
        if let username = answerer.username, !username.isEmpty { return username }
    }
    return "Poster"
}

private func questionRelativeTime(_ iso: String?) -> String? {
    guard let iso else { return nil }
    let parser = ISO8601DateFormatter()
    parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    guard let date else { return nil }
    let interval = Date().timeIntervalSince(date)
    if interval < 60 { return "now" }
    if interval < 3600 { return "\(Int(interval / 60))m ago" }
    if interval < 86400 { return "\(Int(interval / 3600))h ago" }
    if interval < 604_800 { return "\(Int(interval / 86400))d ago" }
    return "\(Int(interval / 604_800))w ago"
}
