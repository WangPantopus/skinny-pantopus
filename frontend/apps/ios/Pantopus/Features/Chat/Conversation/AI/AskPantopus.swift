//
//  AskPantopus.swift
//  Pantopus
//
//  "Ask Pantopus" on a screen (contract
//  `docs/product/ai-assistant-phase1-contract-2026-10-20.md`, sections 6
//  and 7): Today, Place and its section pages, the Nearby feed, the Plans
//  tab, a plan and a post. Each opens the existing assistant thread over the
//  screen, about that screen: it sends the screen's `context`, shows
//  "About: …" above the conversation and offers the screen's starter
//  prompts. Nothing is sent until the person asks; closing it returns to
//  the screen.
//

import SwiftUI

/// What an Ask button opens the assistant about.
public struct AIAskTopic: Identifiable, Hashable, Sendable {
    public let id = UUID()
    public let context: AIChatContext
    /// Shown as "About: Pickup game".
    public let about: String
    /// The surface's starter prompts. One ending in "…" goes into the
    /// composer for the person to finish; the others ask at once.
    public let starters: [String]

    var starterChips: [ChatPromptChip] {
        starters.enumerated().map { ChatPromptChip(id: "starter_\($0.offset)", label: $0.element, icon: .sparkles) }
    }

    /// The box at the top of Today, about the home Today shows (none for a saved place).
    static func today(homeId: String?) -> AIAskTopic {
        AIAskTopic(
            context: AIChatContext(surface: "today", homeId: homeId),
            about: "Today",
            starters: ["What do I need to know today?", "Is it a good day to\u{2026}", "Set my pickup days"]
        )
    }

    /// Place, or one of its section pages.
    static func place(homeId: String, section: PlaceDetailGroup? = nil) -> AIAskTopic {
        AIAskTopic(
            context: AIChatContext(surface: "place", homeId: homeId, section: section?.rawValue),
            about: section?.title ?? "Your Place",
            starters: ["What does this mean for us?", "What should we do this season?", "Remind us\u{2026}"]
        )
    }

    static func nearby() -> AIAskTopic {
        AIAskTopic(
            context: AIChatContext(surface: "nearby"),
            about: "Nearby",
            starters: ["What did I miss this week?", "Help me post something", "Who do neighbors recommend\u{2026}"]
        )
    }

    static func plans() -> AIAskTopic {
        AIAskTopic(
            context: AIChatContext(surface: "plans"),
            about: "Plans",
            starters: ["Find something this weekend", "Host a plan", "What's coming up for me?"]
        )
    }

    static func plan(id: String, title: String, isHost: Bool) -> AIAskTopic {
        AIAskTopic(
            context: AIChatContext(surface: "plan", id: id),
            about: title,
            starters: isHost
                ? ["Who wants to join?", "Message everyone", "Move it"]
                : ["Ask to join", "What should I bring?"]
        )
    }

    static func post(id: String, title: String) -> AIAskTopic {
        AIAskTopic(
            context: AIChatContext(surface: "post", id: id),
            about: title,
            starters: ["Draft a reply", "Sum up the replies"]
        )
    }
}

// MARK: - Opening app links from the thread

/// How the assistant thread opens a screen in the app (a link button, a
/// card's Open): through the deep-link router, after closing the Ask sheet
/// when the thread is in one.
struct PantopusLinkOpener {
    let open: @MainActor (URL) -> Void

    @MainActor
    func callAsFunction(_ url: URL) {
        open(url)
    }

    /// Only links the router can open: an unknown link gets no button.
    @MainActor
    static func url(_ raw: String) -> URL? {
        guard DeepLinkRouter.shared.canResolve(path: raw) else { return nil }
        return URL(string: DeepLinkRouter.normalizeIncoming(raw))
    }
}

private struct PantopusLinkOpenerKey: EnvironmentKey {
    static var defaultValue: PantopusLinkOpener {
        PantopusLinkOpener { url in DeepLinkRouter.shared.handle(url: url) }
    }
}

extension EnvironmentValues {
    var openPantopusLink: PantopusLinkOpener {
        get { self[PantopusLinkOpenerKey.self] }
        set { self[PantopusLinkOpenerKey.self] = newValue }
    }
}

// MARK: - The thread over a screen

extension View {
    /// Presents the assistant thread about `topic` while it is set.
    func askPantopus(_ topic: Binding<AIAskTopic?>) -> some View {
        sheet(item: topic) { topic in
            AskPantopusThread(topic: topic)
        }
    }
}

private enum AskPantopusRoute: Hashable {
    case post(PulseComposeDraft)
    case supportTrain(story: String)
}

/// The existing assistant thread in a sheet, with its own stack for the
/// composers a draft card opens.
private struct AskPantopusThread: View {
    let topic: AIAskTopic
    @Environment(\.dismiss) private var dismiss
    @State private var path: [AskPantopusRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            ChatConversationView(
                viewModel: ChatConversationViewModel(
                    mode: .ai,
                    counterparty: .ai(name: "Pantopus AI"),
                    currentUserId: currentUserId,
                    aiTopic: topic
                ),
                mode: .aiAssistant,
                onUseAIDraft: { draft in
                    if let route = Self.route(for: draft) { path.append(route) }
                },
                onBack: { dismiss() }
            )
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: AskPantopusRoute.self) { route in
                destination(route)
                    .toolbar(.hidden, for: .navigationBar)
            }
        }
        // A screen opens where it lives in the app, with the sheet out of the way.
        .environment(\.openPantopusLink, PantopusLinkOpener { url in
            dismiss()
            DeepLinkRouter.shared.handle(url: url)
        })
        .accessibilityIdentifier("askPantopusThread")
    }

    private var currentUserId: String {
        if case let .signedIn(user) = AuthManager.shared.state { return user.id }
        return ""
    }

    @ViewBuilder
    private func destination(_ route: AskPantopusRoute) -> some View {
        switch route {
        case let .post(draft):
            PulseComposeFlowView(
                prefillFeedIntent: PulseIntent.from(postType: draft.postType),
                prefillDraft: draft,
                onCancel: { if !path.isEmpty { path.removeLast() } },
                onPosted: { _ in if !path.isEmpty { path.removeLast() } }
            )
        case let .supportTrain(story):
            StartSupportTrainWizardView(
                viewModel: StartSupportTrainWizardViewModel(prefillReason: story),
                onDismiss: { if !path.isEmpty { path.removeLast() } },
                onOpenTrain: { trainId in
                    dismiss()
                    DeepLinkRouter.shared.handle(path: "/support-trains/\(trainId)")
                }
            )
        }
    }

    /// Posts and Support Trains open their composers with the draft; other
    /// drafts (tasks and listings are launch cuts) open nothing here.
    private static func route(for draft: ChatAIDraftCard) -> AskPantopusRoute? {
        switch draft.type {
        case "post": .post(draft.prefill?.postDraft ?? PulseComposeDraft(postType: "ask_local", body: ""))
        case "support_train": .supportTrain(story: draft.prefill?.body ?? "")
        default: nil
        }
    }
}

// MARK: - Ask controls

/// The icon button for a screen's header: sparkles, "Ask Pantopus" to VoiceOver.
struct AskPantopusButton<Label: View>: View {
    let accessibilityIdentifier: String
    let action: @MainActor () -> Void
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: action, label: label)
            .buttonStyle(.plain)
            .accessibilityLabel("Ask Pantopus")
            .accessibilityIdentifier(accessibilityIdentifier)
    }
}

/// The sparkles glyph every Ask button shows, in the assistant's colour.
struct AskPantopusGlyph: View {
    var size: CGFloat = 20

    var body: some View {
        Icon(.sparkles, size: size, color: Theme.Color.magic)
    }
}

/// Today's box at the top: "Ask Pantopus" about the day.
struct AskPantopusBox: View {
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                AskPantopusGlyph(size: 16)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(Theme.Color.magicBg))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Ask Pantopus")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("About today at your place")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Ask Pantopus about your day")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("todayAskPantopus")
    }
}

/// A post page's Ask, under its reactions.
struct AskPantopusRow: View {
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                AskPantopusGlyph(size: 15)
                Text("Ask Pantopus")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Draft a reply or sum up the replies")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
                    .accessibilityHidden(true)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Ask Pantopus about this post")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("postAskPantopus")
    }
}

/// "About: Pickup game", above a thread opened from a screen.
struct AIAboutStrip: View {
    let about: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            AskPantopusGlyph(size: 13)
            (Text("About: ").foregroundColor(Theme.Color.appTextSecondary) + Text(about).foregroundColor(Theme.Color.appText))
                .font(.system(size: 12.5, weight: .medium))
                .lineLimit(1)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.magicBgSoft)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("chatAIAbout")
    }
}
