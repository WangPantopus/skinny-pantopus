//
//  HelpCenterView.swift
//  Pantopus
//
//  P8 / T6.2c — Settings → Help sub-route. Static FAQ + contact CTA.
//  Per Q7: "Static FAQ + contact CTA. No backend." Content lives in
//  this file so it ships with the binary; future work can lift it
//  into the backend if it grows.
//

import SwiftUI

public struct HelpCenterView: View {
    private let onBack: @MainActor () -> Void

    public init(onBack: @escaping @MainActor () -> Void) {
        self.onBack = onBack
    }

    public var body: some View {
        ContentDetailShell(
            title: "Help",
            onBack: onBack,
            header: { headerView },
            body: { contentBody },
            cta: { ctaBar }
        )
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("helpCenter")
    }

    private var headerView: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("How can we help?")
                .pantopusTextStyle(.h2)
                .foregroundStyle(Theme.Color.appText)
            Text(
                "Most questions about messages, mail, and gigs have answers below. " +
                    "If you don't see yours, reach out — we read every message."
            )
            .pantopusTextStyle(.small)
            .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
    }

    private var contentBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            ForEach(Self.sections, id: \.heading) { section in
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    Text(section.heading)
                        .pantopusTextStyle(.h3)
                        .foregroundStyle(Theme.Color.appText)
                    ForEach(section.items, id: \.question) { item in
                        VStack(alignment: .leading, spacing: Spacing.s1) {
                            Text(item.question)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                            Text(item.answer)
                                .pantopusTextStyle(.small)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(Spacing.s4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    }
                }
                .padding(.horizontal, Spacing.s4)
            }
        }
        .padding(.vertical, Spacing.s4)
    }

    private var ctaBar: some View {
        VStack(spacing: Spacing.s2) {
            Text("Still stuck?")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            PrimaryButton(title: "Email support") {
                if let url = URL(string: "mailto:support@pantopus.app?subject=Help") {
                    await openURL(url)
                }
            }
            .accessibilityIdentifier("helpCenterContactCTA")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
    }

    @MainActor
    private func openURL(_ url: URL) async {
        _ = await UIApplication.shared.open(url, options: [:])
    }

    private struct Section {
        let heading: String
        let items: [Item]
    }

    private struct Item {
        let question: String
        let answer: String
    }

    private static let sections: [Section] = [
        Section(heading: "Getting started", items: [
            Item(
                question: "Why do I need to verify my email?",
                answer: "Verifying your email unlocks posting, messaging, and trust signals other neighbors look for. " +
                    "It also lets us send you a Magic Link if you forget your password."
            ),
            Item(
                question: "Who can see my address?",
                answer: "Only verified connections — and only at the precision you set under Settings → Privacy → Address sharing. " +
                    "The default is street-level."
            )
        ]),
        Section(heading: "Mail & messages", items: [
            Item(
                question: "What's the difference between mail and a chat?",
                answer: "Mail is asynchronous and ceremonial — it lands in your mailbox, can carry attachments and trust signals, " +
                    "and you reply when you're ready. Chats are real-time and live in the inbox tab."
            ),
            Item(
                question: "Why didn't my message send?",
                answer: "If the other person has blocked you, or if their privacy settings prevent unsolicited messages, the send fails. " +
                    "We surface this with a clear error in the chat thread."
            )
        ]),
        Section(heading: "Account & safety", items: [
            Item(
                question: "How do I block someone?",
                answer: "Open their profile, tap the kebab menu (•••), and choose Block. " +
                    "You can unblock them later from Settings → Blocked users."
            ),
            Item(
                question: "How do I delete my account?",
                answer: "Go to Settings → Privacy → Delete account. " +
                    "You'll confirm in the app and verify your identity, then your account and its data are removed. " +
                    "Finish or cancel any gigs in progress and resolve pending payments first — those block deletion."
            )
        ])
    ]
}

#Preview {
    NavigationStack {
        HelpCenterView {}
    }
}
