//
//  AIActionCardView.swift
//  Pantopus
//
//  A Pantopus AI action card in the thread (contract
//  `docs/product/ai-assistant-phase1-contract-2026-10-20.md`, section 4.3),
//  in the draft cards' style: the title, label and value rows, warnings in
//  the caution style, rows with their own buttons, then the actions and
//  "Not now". One tap sends the card's request (`AIActionRunner`); the card
//  then says it's done, with an Open button when it links somewhere, or
//  shows the server's reason and stays usable. Link buttons under a reply
//  live here too.
//

import SwiftUI

/// What the thread does with an action card's taps.
struct ChatAIActionHandlers {
    let run: @MainActor (_ cardId: String, _ itemId: String?, _ actionId: String) -> Void
    let dismiss: @MainActor (_ cardId: String) -> Void
}

private struct ChatAIActionHandlersKey: EnvironmentKey {
    static var defaultValue: ChatAIActionHandlers {
        ChatAIActionHandlers(run: { _, _, _ in }, dismiss: { _ in })
    }
}

extension EnvironmentValues {
    var chatAIActions: ChatAIActionHandlers {
        get { self[ChatAIActionHandlersKey.self] }
        set { self[ChatAIActionHandlersKey.self] = newValue }
    }
}

extension ChatAIActionCard {
    /// Every action's key: the card's own, then each row's.
    var actionKeys: [String] {
        var keys: [String] = []
        for action in envelope.actions {
            keys.append(AIActionDoneStore.key(cardId: envelope.id, itemId: nil, actionId: action.id))
        }
        for item in envelope.items {
            for action in item.actions {
                keys.append(AIActionDoneStore.key(cardId: envelope.id, itemId: item.id, actionId: action.id))
            }
        }
        return keys
    }

    /// The card's own actions, or one row's.
    func actions(itemId: String?) -> [AIActionCardDTO.Action] {
        guard let itemId else { return envelope.actions }
        return envelope.items.first { $0.id == itemId }?.actions ?? []
    }

    /// What went through for the card's own actions, or for one row.
    func done(itemId: String?) -> ChatAIActionDone? {
        actions(itemId: itemId).lazy
            .compactMap { done[AIActionDoneStore.key(cardId: envelope.id, itemId: itemId, actionId: $0.id)] }
            .first
    }

    func isSettled(itemId: String?) -> Bool {
        done(itemId: itemId) != nil
    }

    /// Past `expires_at`, the card's actions are off.
    var isExpired: Bool {
        guard let raw = envelope.expiresAt else { return false }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = fractional.date(from: raw) ?? ISO8601DateFormatter().date(from: raw) else { return false }
        return date < Date()
    }

    /// Something is in flight on this card, or on that row.
    func isRunning(itemId: String?) -> Bool {
        guard let running else { return false }
        return actions(itemId: itemId).contains {
            AIActionDoneStore.key(cardId: envelope.id, itemId: itemId, actionId: $0.id) == running
        }
    }
}

struct AIActionCardView: View {
    let cardId: String
    let card: ChatAIActionCard
    @Environment(\.chatAIActions) private var handlers

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
            Text(card.envelope.title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            if !card.envelope.lines.isEmpty {
                AIActionLines(lines: card.envelope.lines)
            }
            ForEach(Array(card.envelope.warnings.enumerated()), id: \.offset) { _, warning in
                AIActionWarning(text: warning)
            }
            ForEach(card.envelope.items) { item in
                itemRow(item)
            }
            footer
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.magic.opacity(0.22), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("chatAIAction_\(card.envelope.card)")
    }

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            Icon(kind.icon, size: 14, strokeWidth: 2.4, color: Theme.Color.magic)
                .frame(width: 26, height: 26)
                .background(Theme.Color.magicBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            Text(kind.label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.magic)
            Spacer(minLength: Spacing.s0)
            if card.isRunning(itemId: nil) || card.envelope.items.contains(where: { card.isRunning(itemId: $0.id) }) {
                ProgressView()
                    .controlSize(.small)
                    .accessibilityLabel("Sending")
            }
        }
    }

    // MARK: - Rows with their own buttons

    private func itemRow(_ item: AIActionCardDTO.Item) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(item.title)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            if !item.lines.isEmpty {
                AIActionLines(lines: item.lines)
            }
            if let done = card.done(itemId: item.id) {
                AIActionDoneRow(done: done)
            } else {
                buttons(item.actions, itemId: item.id, size: .inlineAction)
                failure(itemId: item.id)
            }
        }
        .padding(Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("chatAIActionItem_\(item.id)")
    }

    // MARK: - The card's own actions

    @ViewBuilder private var footer: some View {
        if let done = card.done(itemId: nil) {
            AIActionDoneRow(done: done)
        } else if card.isExpired {
            Text("This card has expired. Ask again.")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityIdentifier("chatAIActionExpired")
        } else {
            if !card.envelope.actions.isEmpty {
                buttons(card.envelope.actions, itemId: nil, size: .footer)
            }
            failure(itemId: nil)
            if card.running == nil, card.done.isEmpty {
                Button("Not now") { handlers.dismiss(cardId) }
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .buttonStyle(.plain)
                    .frame(minHeight: 32)
                    .accessibilityIdentifier("chatAIActionNotNow")
            }
        }
    }

    /// Two buttons share a row; three or more (a nudge's, with "Fewer like
    /// this") stack, so none is squeezed.
    @ViewBuilder
    private func buttons(_ actions: [AIActionCardDTO.Action], itemId: String?, size: CompactButtonSize) -> some View {
        if actions.count > 2 {
            VStack(spacing: 6) { buttonRow(actions, itemId: itemId, size: size) }
        } else {
            HStack(spacing: Spacing.s2) { buttonRow(actions, itemId: itemId, size: size) }
        }
    }

    private func buttonRow(_ actions: [AIActionCardDTO.Action], itemId: String?, size: CompactButtonSize) -> some View {
        let locked = card.running != nil || card.isExpired
        return ForEach(actions) { action in
            CompactButton(title: action.label, variant: variant(action.style), size: size) {
                handlers.run(cardId, itemId, action.id)
            }
            .disabled(locked)
            .opacity(locked ? 0.5 : 1)
            .accessibilityIdentifier("chatAIActionButton_\(action.id)")
        }
    }

    @ViewBuilder
    private func failure(itemId: String?) -> some View {
        if let message = card.failures[itemId ?? ""] {
            Text(message)
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.error)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("chatAIActionError")
        }
    }

    private func variant(_ style: String?) -> CompactButtonVariant {
        switch style {
        case "secondary": .ghost
        case "destructive": .destructive
        default: .primary
        }
    }

    private var kind: (label: String, icon: PantopusIcon) {
        switch card.envelope.card {
        case "plan_create", "plan_edit", "plan_cancel", "plan_ask": ("Plan", .calendar)
        case "plan_requests": ("Requests", .users)
        case "plan_message": ("Message", .messageCircle)
        case "post_reply", "post_solve": ("Post", .messageSquare)
        case "home_task": ("Task", .checkCircle)
        case "home_task_update": ("Task update", .checkCheck)
        case "home_system": ("Home system", .wrench)
        // A nudge with nothing to do but "Fewer like this" (phase 2 §3.6).
        case "suggestion": ("Suggestion", .sparkles)
        case "notification_settings": ("Notifications", .bell)
        // An appliance, the year's plan and any later home card.
        case let other where other.hasPrefix("home_"): ("Home", .home)
        default: ("Action", .sparkles)
        }
    }
}

/// Label and value rows.
private struct AIActionLines: View {
    let lines: [AIActionCardDTO.Line]

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                    Text(line.label)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(width: 76, alignment: .leading)
                    Text(line.value)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}

/// A warning in the caution style.
private struct AIActionWarning: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.alertTriangle, size: 13, strokeWidth: 2.4, color: Theme.Color.warning)
                .padding(.top, 1)
                .accessibilityHidden(true)
            Text(text)
                .font(.system(size: 11.5, weight: .medium))
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("chatAIActionWarning")
    }
}

/// "Plan posted", its note, and Open when it links somewhere the app can go.
private struct AIActionDoneRow: View {
    let done: ChatAIActionDone
    @Environment(\.openPantopusLink) private var openLink

    /// The done link, when the app can open it.
    private var openable: URL? {
        guard let link = done.link else { return nil }
        return PantopusLinkOpener.url(link)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(spacing: Spacing.s2) {
                Icon(.checkCircle, size: 14, strokeWidth: 2.4, color: Theme.Color.success)
                    .accessibilityHidden(true)
                Text(done.label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.success)
                Spacer(minLength: Spacing.s0)
                if let url = openable {
                    Button { openLink(url) } label: {
                        HStack(spacing: 5) {
                            Text("Open")
                            Icon(.arrowRight, size: 11, strokeWidth: 2.5, color: Theme.Color.primaryInk)
                        }
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.primaryInk)
                        .frame(minHeight: 32)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("chatAIActionOpen")
                }
            }
            if let note = done.note {
                Text(note)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityIdentifier("chatAIActionDone")
    }
}

/// The link buttons under a reply. A link the app can't open gets no button.
struct AILinkButtons: View {
    let links: [ChatAILink]
    @Environment(\.openPantopusLink) private var openLink

    private struct Openable: Identifiable {
        let link: ChatAILink
        let url: URL

        var id: String {
            link.id
        }
    }

    private var openable: [Openable] {
        links.compactMap { link in
            PantopusLinkOpener.url(link.url).map { Openable(link: link, url: $0) }
        }
    }

    var body: some View {
        if !openable.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                ForEach(openable) { item in
                    Button { openLink(item.url) } label: {
                        HStack(spacing: 6) {
                            Text(item.link.label)
                                .multilineTextAlignment(.leading)
                            Icon(.arrowRight, size: 11, strokeWidth: 2.5, color: Theme.Color.primaryInk)
                        }
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.primaryInk)
                        .padding(.horizontal, Spacing.s3)
                        .frame(minHeight: 34)
                        .background(Theme.Color.primary50)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("chatAILink")
                }
            }
        }
    }
}
