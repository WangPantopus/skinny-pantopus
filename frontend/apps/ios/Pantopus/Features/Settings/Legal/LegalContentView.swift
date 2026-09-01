//
//  LegalContentView.swift
//  Pantopus
//
//  A19.1 Privacy Policy + A19.2 Terms of Service — long-form legal viewer.
//  Reshaped from the old flat block list into the A19 archetype:
//
//    • `DocMetaStrip`   — "Last updated <date> · v<version>"
//    • `LegalTOCCard`   — collapsible "Jump to section" that scrolls to an anchor
//    • `LegalSection`   — primary-tinted numbered headings + paragraph / sub-
//                         heading / bullet body blocks
//    • `BackToTopFab`   — fades in once the reader scrolls past the TOC
//
//  Privacy + Terms share one scaffold; only the slot content (meta, TOC,
//  sections, contact footer) changes. The copy is stored as structured data
//  and mirrored word-for-word with Android (`settings/legal/LegalScreens.kt`).
//
//  The remaining bundled docs (Acceptable use / Cookies / Open-source) are not
//  part of the A19 design, so they keep the legacy flat renderer until they
//  get their own pass.
//

import SwiftUI

// MARK: - Entry point (doc routing)

public struct LegalContentView: View {
    let document: LegalDocument
    private let onBack: @MainActor () -> Void

    public init(document: LegalDocument, onBack: @escaping @MainActor () -> Void) {
        self.document = document
        self.onBack = onBack
    }

    public var body: some View {
        switch document {
        case .privacy, .terms:
            LegalLongFormView(document: document, onBack: onBack)
        case .acceptableUse, .cookies, .openSource:
            LegacyLegalContentView(document: document, onBack: onBack)
        }
    }
}

// MARK: - Long-form scaffold (stateful host)

/// Owns the two pieces of scroll state the A19 scaffold needs — whether the
/// TOC is expanded, and whether the reader has scrolled past it — and feeds
/// them into the stateless `LegalScaffold`. The scaffold publishes its live
/// scroll offset back up via `LegalScrollOffsetKey`.
struct LegalLongFormView: View {
    let document: LegalDocument
    let onBack: @MainActor () -> Void

    @State private var tocOpen = true
    @State private var showBackToTop = false

    var body: some View {
        LegalScaffold(
            model: LegalDocs.model(for: document),
            title: document.title,
            accessibilityID: "legalContent.\(document.rawValue)",
            tocOpen: tocOpen,
            showBackToTop: showBackToTop,
            onBack: onBack
        ) {
            withAnimation(Motion.screenTransition) { tocOpen.toggle() }
        }
        .onPreferenceChange(LegalScrollOffsetKey.self) { offset in
            // Mirror the design threshold: the fab appears past `scrollTop > 220`.
            showBackToTop = offset > 220
        }
    }
}

/// The stateless A19 legal scaffold — top bar + meta strip + scrollable TOC /
/// sectioned body + back-to-top fab. Scroll state (`tocOpen` / `showBackToTop`)
/// is injected so the live host can drive it and snapshot tests can pin a
/// specific frame.
struct LegalScaffold: View {
    let model: LegalDocModel
    let title: String
    let accessibilityID: String
    let tocOpen: Bool
    let showBackToTop: Bool
    let onBack: @MainActor () -> Void
    let onToggleTOC: () -> Void

    /// Anchor for the top of the document (the TOC card). Section anchors are
    /// `LegalSection`'s own `"sec-<n>"` ids.
    static let topAnchorID = "sec-0"
    private let scrollSpace = "legalScroll"

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(
                title: title,
                onBack: onBack,
                action: ContentDetailTopBarAction(icon: .share, accessibilityLabel: "Share") {}
            )
            DocMetaStrip(lastUpdated: model.lastUpdated, version: model.version)
            ScrollViewReader { proxy in
                ZStack(alignment: .bottomTrailing) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: Spacing.s0) {
                            LegalTOCCard(
                                items: model.sectionTitles,
                                isOpen: tocOpen,
                                onToggle: onToggleTOC
                            ) { index in
                                withAnimation(Motion.screenTransition) {
                                    proxy.scrollTo("sec-\(index + 1)", anchor: .top)
                                }
                            }
                            .id(Self.topAnchorID)

                            ForEach(Array(model.sections.enumerated()), id: \.offset) { index, section in
                                LegalSectionBody(number: index + 1, section: section)
                            }

                            LegalContactFooter(email: model.contactEmail, label: model.contactLabel)
                                .padding(.top, Spacing.s4)
                                .padding(.bottom, Spacing.s2)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, Spacing.s5)
                        .padding(.top, 14)
                        .padding(.bottom, Spacing.s6)
                        .background(scrollOffsetReader)
                    }
                    .coordinateSpace(name: scrollSpace)
                    .background(Theme.Color.appSurface)

                    BackToTopFab(isVisible: showBackToTop) {
                        withAnimation(Motion.screenTransition) {
                            proxy.scrollTo(Self.topAnchorID, anchor: .top)
                        }
                    }
                    .padding(Spacing.s4)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier(accessibilityID)
    }

    /// Reports the distance scrolled below the top of the content (positive =
    /// scrolled down) so the host can toggle the back-to-top fab.
    private var scrollOffsetReader: some View {
        GeometryReader { geo in
            Color.clear.preference(
                key: LegalScrollOffsetKey.self,
                value: -geo.frame(in: .named(scrollSpace)).minY
            )
        }
    }
}

private struct LegalScrollOffsetKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

// MARK: - Section body + blocks

private struct LegalSectionBody: View {
    let number: Int
    let section: LegalDocSection

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            LegalSection(number: number, title: section.title)
            ForEach(Array(section.blocks.enumerated()), id: \.offset) { _, block in
                LegalBlockView(block: block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct LegalBlockView: View {
    let block: LegalBlock

    var body: some View {
        switch block {
        case let .paragraph(text):
            Text(verbatim: text)
                .pantopusTextStyle(.small)
                .foregroundColor(Theme.Color.appText)
                .pantopusLineHeight(.small)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Spacing.s3)
        case let .rich(runs):
            paragraphText(runs)
                .pantopusLineHeight(.small)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Spacing.s3)
        case let .subheading(text):
            Text(verbatim: text)
                .pantopusTextStyle(.small)
                .fontWeight(.bold)
                .foregroundColor(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, Spacing.s2)
                .padding(.bottom, Spacing.s1)
        case let .bullets(items):
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    LegalBulletRow(text: item)
                }
            }
            .padding(.bottom, Spacing.s3)
        }
    }

    /// Builds a single `Text` from the inline runs, emphasising defined terms
    /// in bold — the native mirror of the design's `<DT>` spans.
    private func paragraphText(_ runs: [LegalRun]) -> Text {
        runs.reduce(Text(verbatim: "")) { partial, run in
            let piece = Text(verbatim: run.text).pantopusTextStyle(.small)
            return partial + (run.bold ? piece.fontWeight(.bold) : piece)
        }
        .foregroundColor(Theme.Color.appText)
    }
}

private struct LegalBulletRow: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(Theme.Color.primary600)
                .frame(width: 5, height: 5)
                .padding(.top, 7)
            Text(verbatim: text)
                .pantopusTextStyle(.small)
                .foregroundColor(Theme.Color.appText)
                .pantopusLineHeight(.small)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Contact footer

private struct LegalContactFooter: View {
    @Environment(\.openURL) private var openURL
    let email: String
    let label: String

    var body: some View {
        Button {
            if let url = URL(string: "mailto:\(email)") { openURL(url) }
        } label: {
            card
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("legalContactFooter")
        .accessibilityLabel("\(label) \(email)")
    }

    private var card: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.mail, size: 16, strokeWidth: 2, color: Theme.Color.primary600)
                .frame(width: 36, height: 36)
                .background(Circle().fill(Theme.Color.appSurface))
                .overlay(Circle().strokeBorder(Theme.Color.primary100, lineWidth: 1))
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: label)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundColor(Theme.Color.appText)
                Text(verbatim: email)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundColor(Theme.Color.primary700)
            }
            Spacer(minLength: Spacing.s2)
            Icon(.arrowUpRight, size: 16, strokeWidth: 2.2, color: Theme.Color.primary600)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.primary50)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.primary100, lineWidth: 1)
        )
    }
}

// MARK: - Legacy flat renderer (Acceptable use / Cookies / Open-source)

/// The pre-A19 flat block renderer, retained for the three bundled docs that
/// aren't part of the A19 long-form design.
private struct LegacyLegalContentView: View {
    let document: LegalDocument
    let onBack: @MainActor () -> Void

    var body: some View {
        ContentDetailShell(
            title: document.title,
            onBack: onBack,
            header: { headerView },
            body: { documentBody }
        )
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("legalContent.\(document.rawValue)")
    }

    private var headerView: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(document.title)
                .pantopusTextStyle(.h2)
                .foregroundStyle(Theme.Color.appText)
            Text("Last updated: \(Self.lastUpdated)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
    }

    private var documentBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            ForEach(Array(blocks(for: document).enumerated()), id: \.offset) { _, block in
                switch block {
                case let .heading(text):
                    Text(text)
                        .pantopusTextStyle(.h3)
                        .foregroundStyle(Theme.Color.appText)
                case let .paragraph(text):
                    Text(text)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                case let .bullet(text):
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        Text("•")
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Text(text)
                            .pantopusTextStyle(.body)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s4)
    }

    private enum Block {
        case heading(String)
        case paragraph(String)
        case bullet(String)
    }

    private static let lastUpdated = "2026-05-01"

    private func blocks(for doc: LegalDocument) -> [Block] {
        switch doc {
        case .acceptableUse: Self.acceptableUse
        case .cookies: Self.cookies
        case .openSource: Self.openSource
        default: []
        }
    }

    private static let acceptableUse: [Block] = [
        .paragraph("Pantopus is a neighborhood platform. Help keep it kind, useful, and honest."),
        .heading("Not allowed"),
        .bullet("Harassment, threats, or hate speech."),
        .bullet("Spam, including unsolicited promotion of unrelated businesses."),
        .bullet("Impersonating a neighbor or a business."),
        .bullet("Posting illegal content or coordinating illegal activity."),
        .heading("Enforcement"),
        .paragraph(
            "Violations may lead to content removal, account suspension, or permanent removal. " +
                "Repeated abuse can also be reported to the relevant authorities."
        )
    ]

    private static let cookies: [Block] = [
        .paragraph(
            "On the mobile app we use device storage for: session tokens, push-notification routing, " +
                "and a small cache of recently loaded content. We don't use third-party advertising cookies."
        ),
        .heading("Web"),
        .paragraph(
            "On the web, we use cookies to keep you signed in and to remember your light/dark mode preference. " +
                "Analytics is opt-in via Settings → Privacy."
        )
    ]

    private static let openSource: [Block] = [
        .paragraph(
            "Pantopus is built on shoulders of giants. We owe thanks to the maintainers of every library below. " +
                "Full license texts ship with each app build."
        ),
        .heading("iOS"),
        .bullet("SwiftUI — Apple"),
        .bullet("Lucide icons — Lucide contributors"),
        .heading("Android"),
        .bullet("Jetpack Compose — Google"),
        .bullet("Hilt — Google"),
        .bullet("Moshi — Square"),
        .heading("Backend"),
        .bullet("Express — OpenJS Foundation"),
        .bullet("Supabase — Supabase Inc."),
        .bullet("Stripe SDK — Stripe Inc.")
    ]
}

#Preview("Privacy — TOC expanded") {
    LegalScaffold(
        model: LegalDocs.privacy,
        title: "Privacy policy",
        accessibilityID: "legalContent.privacy",
        tocOpen: true,
        showBackToTop: false,
        onBack: {},
        onToggleTOC: {}
    )
}

#Preview("Terms — collapsed reading") {
    LegalScaffold(
        model: LegalDocs.terms,
        title: "Terms of service",
        accessibilityID: "legalContent.terms",
        tocOpen: false,
        showBackToTop: true,
        onBack: {},
        onToggleTOC: {}
    )
}
