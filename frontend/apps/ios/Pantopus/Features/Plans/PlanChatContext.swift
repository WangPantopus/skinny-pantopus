//
//  PlanChatContext.swift
//  Pantopus
//
//  Board A4: a plan's chat is the existing chat screen with the plan above
//  the messages ("Sun 1:25 PM · Sam's place", tap to open the plan) and,
//  once the chat has closed, a line instead of the composer. The chat
//  screen reads this from the environment; other chats never set it.
//

import SwiftUI

struct ChatPlanContext {
    let kind: PlanKind
    /// "Sun 1:25 PM".
    let when: String
    /// "Sam's place", or the area for a plan not at a home.
    let place: String
    /// Set once the chat is read-only (24 hours after the end, or cancelled).
    let closedNote: String?
    let onOpenPlan: @MainActor () -> Void
}

private struct ChatPlanContextKey: EnvironmentKey {
    static var defaultValue: ChatPlanContext? {
        nil
    }
}

extension EnvironmentValues {
    var chatPlanContext: ChatPlanContext? {
        get { self[ChatPlanContextKey.self] }
        set { self[ChatPlanContextKey.self] = newValue }
    }
}

/// The plan above its chat.
struct PlanChatStrip: View {
    let context: ChatPlanContext

    var body: some View {
        Button(action: context.onOpenPlan) {
            HStack(spacing: 10) {
                PlanSwatch(kind: context.kind)
                (Text(context.when).fontWeight(.semibold) + Text(" · \(context.place)"))
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(context.kind.tint))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, 10)
        .accessibilityLabel("\(context.kind.spokenTitle), \(context.when), \(context.place)")
        .accessibilityHint("Opens the plan")
        .accessibilityIdentifier("planChatStrip")
    }
}

/// In place of the composer once a plan's chat has closed.
struct PlanChatClosedLine: View {
    let text: String

    var body: some View {
        Text(text)
            .planFont(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 6)
            .background(Capsule().fill(Theme.Color.appSurfaceSunken))
            .frame(maxWidth: .infinity)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .top) { Divider().overlay(Theme.Color.appBorder) }
            .accessibilityIdentifier("planChatClosed")
    }
}

/// When a plan's chat stops taking messages: when the plan is cancelled, or
/// 24 hours after it ends (brief section 7). The server says so with
/// `chat_open: false`; the end time covers an older reply without it.
enum PlanChatRules {
    static func closedNote(_ plan: PlanDetailDTO, now: Date = Date()) -> String? {
        let card = plan.card
        let closedByTime = card.endsAtDate.map { now > $0.addingTimeInterval(24 * 3600) } ?? false
        guard plan.chatOpen == false || card.state == .cancelled || closedByTime else { return nil }
        return card.state == .cancelled
            ? "This plan was cancelled. The chat is closed."
            : "This chat closed 24 hours after the plan ended"
    }
}
