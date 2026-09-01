//
//  MailTranslationView.swift
//  Pantopus
//
//  A17.13 — Translation. A mail item auto-translated by Pantopus, reached
//  from a mail item's "Translate" overflow action (and the
//  `pantopus://mailbox/translation?id=` deep link).
//
//  Two designed frames driven by `confirmed`:
//   · machine    — LanguageBadge + ViewToggle(side) + SideBySide + glossary
//                  + elf + "Confirm translation".
//   · confirmed  — ConfirmBanner + ViewToggle(translated) + clean reading
//                  view on paper + elf + "Reply to Lucía".
//
//  The screen is sample-data driven (real MT / TTS is out of scope, B2.3);
//  "Listen" stubs to a toast, "Confirm" posts to the real translate endpoint
//  and rolls the optimistic flip back on failure.
//

import SwiftUI

public struct MailTranslationView: View {
    @State private var viewModel: MailTranslationViewModel
    private let onBack: () -> Void
    private let onReply: (@MainActor (String) -> Void)?

    public init(
        mailId: String,
        seedConfirmed: Bool = false,
        onBack: @escaping () -> Void,
        onReply: (@MainActor (String) -> Void)? = nil
    ) {
        _viewModel = State(initialValue: MailTranslationViewModel(mailId: mailId, seedConfirmed: seedConfirmed))
        self.onBack = onBack
        self.onReply = onReply
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            TranslationNav(onBack: onBack) { viewModel.toast = "Sharing translation…" }
            Group {
                switch viewModel.state {
                case .loading:
                    TranslationLoadingBody()
                case let .loaded(content):
                    loaded(content)
                case let .error(message):
                    TranslationErrorBody(message: message) {
                        Task { await viewModel.refresh() }
                    }
                }
            }
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("mailTranslation")
        .task { await viewModel.load() }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastBanner(message: toast)
                    .padding(.bottom, Spacing.s16)
                    .task {
                        try? await Task.sleep(nanoseconds: 1_800_000_000)
                        viewModel.toast = nil
                    }
                    .transition(.opacity)
            }
        }
        .pantopusAnimation(.componentState, value: viewModel.toast)
    }

    private func loaded(_ content: MailTranslationContent) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                TranslationHeaderRow(categoryLabel: content.categoryLabel, time: content.timeLabel)

                if content.confirmed {
                    TranslationConfirmBanner(stamp: content.confirmedStamp)
                }

                LanguageBadge(languages: content.languages, confirmed: content.confirmed)

                TranslationViewToggle(active: content.viewMode) { viewModel.selectViewMode($0) }

                body(for: content)

                AIElfStripView(content: elfContent(content.elf))
                    .accessibilityIdentifier("translation_elf")

                // The translate route carries no glossary; the card only
                // appears when the payload actually has notes.
                if !content.glossary.isEmpty {
                    TranslatorNotes(notes: content.glossary)
                }

                TranslationSenderCard(sender: content.sender)

                actions(for: content)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.Color.appBg)
    }

    @ViewBuilder
    private func body(for content: MailTranslationContent) -> some View {
        switch content.viewMode {
        case .side:
            SideBySideView(content: content) { viewModel.listen($0) }
        case .translated:
            TranslationReadingView(
                content: content,
                showing: .translated,
                onSelect: { viewModel.selectViewMode($0) },
                onListen: { viewModel.listen($0) }
            )
        case .original:
            TranslationReadingView(
                content: content,
                showing: .original,
                onSelect: { viewModel.selectViewMode($0) },
                onListen: { viewModel.listen($0) }
            )
        }
    }

    @ViewBuilder
    private func actions(for content: MailTranslationContent) -> some View {
        if content.confirmed {
            TranslationConfirmedActions(
                replyName: content.sender.replyName,
                onReply: { handleReply(content.mailId) },
                onRetranslate: {
                    viewModel.toast = "Re-translating…"
                    Task { await viewModel.refresh() }
                },
                onShowOriginal: { viewModel.selectViewMode(.original) },
                onShare: { viewModel.toast = "Sharing translation…" },
                onArchive: { viewModel.toast = "Archived" }
            )
        } else {
            TranslationMachineActions(
                confirmInFlight: viewModel.confirmInFlight,
                onConfirm: { Task { await viewModel.confirmTranslation() } },
                onEdit: { viewModel.toast = "Edit translation…" },
                onLanguage: { viewModel.toast = "Change language…" },
                onListen: { viewModel.listen(.translated) },
                onArchive: { viewModel.toast = "Archived" }
            )
        }
    }

    /// Route to the reply composer when the host wired `onReply`; otherwise
    /// surface the design's "Reply in English" stub toast.
    private func handleReply(_ mailId: String) {
        if let onReply {
            onReply(mailId)
        } else {
            viewModel.toast = "Reply in English…"
        }
    }

    /// Map the content-layer elf payload onto the shared `AIElfStripView`
    /// vocabulary (sky-gradient + sparkles disc + bullets).
    private func elfContent(_ elf: TranslationElf) -> AIElfStripContent {
        AIElfStripContent(
            headline: elf.headline,
            summary: elf.summary,
            bullets: elf.bullets.map { bullet in
                AIElfBullet(
                    id: "elf-\(bullet.id)",
                    icon: bullet.icon.pantopusIcon,
                    label: bullet.label,
                    text: bullet.text
                )
            }
        )
    }
}

// MARK: - Top nav

private struct TranslationNav: View {
    let onBack: () -> Void
    let onShare: () -> Void

    private let iconButtonSize: CGFloat = 34

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Button(action: onBack) {
                HStack(spacing: Spacing.s0) {
                    Icon(.chevronLeft, size: 22, color: Theme.Color.primary600)
                    Text("Mailbox")
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(Theme.Color.primary600)
                }
                .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back to Mailbox")
            .accessibilityIdentifier("translation_back")

            Spacer(minLength: Spacing.s0)

            HStack(spacing: Spacing.s1) {
                Circle()
                    .fill(Theme.Color.categoryTranslation)
                    .frame(width: 8, height: 8)
                Text("Translation".uppercased())
                    .font(.system(size: 12, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("translation_nav_eyebrow")

            Spacer(minLength: Spacing.s0)

            HStack(spacing: 2) {
                navIconButton(.share, label: "Share", action: onShare)
                Menu {
                    Button("Re-translate") { onShare() }
                    Button("Report a problem") { onShare() }
                } label: {
                    Icon(.moreHorizontal, size: 18, color: Theme.Color.appTextStrong)
                        .frame(width: iconButtonSize, height: iconButtonSize)
                        .background(Circle().fill(Theme.Color.appSurfaceSunken))
                }
                .accessibilityLabel("More actions")
                .accessibilityIdentifier("translation_nav_more")
            }
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    private func navIconButton(_ icon: PantopusIcon, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(icon, size: 18, color: Theme.Color.appTextStrong)
                .frame(width: iconButtonSize, height: iconButtonSize)
                .background(Circle().fill(Theme.Color.appSurfaceSunken))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier("translation_nav_\(label.lowercased())")
    }
}

// MARK: - Header chip row

private struct TranslationHeaderRow: View {
    let categoryLabel: String
    let time: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            trustChip
            categoryChip
            Spacer(minLength: Spacing.s0)
            Text(time)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .accessibilityIdentifier("translation_headerRow")
    }

    private var trustChip: some View {
        HStack(spacing: 3) {
            Icon(.shieldCheck, size: 11, color: Theme.Color.success)
            Text("Verified")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .accessibilityLabel("Verified sender")
    }

    private var categoryChip: some View {
        HStack(spacing: Spacing.s1) {
            Circle()
                .fill(Theme.Color.categoryTranslation)
                .frame(width: 6, height: 6)
            Text(categoryLabel)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.categoryTranslationInk)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.categoryTranslationBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }
}

// MARK: - Loading / error bodies

private struct TranslationLoadingBody: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Shimmer(width: 180, height: 20, cornerRadius: Radii.sm)
                Shimmer(height: 64, cornerRadius: Radii.xl)
                Shimmer(height: 44, cornerRadius: Radii.lg)
                Shimmer(height: 200, cornerRadius: Radii.xl)
                Shimmer(height: 120, cornerRadius: Radii.xl)
                Shimmer(height: 96, cornerRadius: Radii.xl)
                Shimmer(height: 56, cornerRadius: Radii.lg)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("translation_loading")
    }
}

private struct TranslationErrorBody: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        EmptyState(
            icon: .globe,
            headline: "Couldn't translate this",
            subcopy: message,
            cta: .init(title: "Try again") { onRetry() },
            tint: Theme.Color.categoryTranslationBg,
            accent: Theme.Color.categoryTranslation
        )
        .accessibilityIdentifier("translation_error")
    }
}

// MARK: - Elf icon mapping

private extension TranslationElfIcon {
    var pantopusIcon: PantopusIcon {
        switch self {
        case .languages: .globe
        case .notes: .fileText
        case .listen: .play
        case .confirmed: .badgeCheck
        case .archive: .archive
        case .reply: .reply
        }
    }
}

// MARK: - Sender reply name

private extension TranslationSender {
    /// First name for the "Reply to {name}" CTA, e.g. "Lucía".
    var replyName: String {
        name.split(separator: " ").first.map(String.init) ?? name
    }
}

// MARK: - Toast

private struct ToastBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appText.opacity(0.9))
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            .accessibilityLabel(message)
    }
}

#if DEBUG
#Preview("A17.13 · machine") {
    MailTranslationView(mailId: "preview", seedConfirmed: false) {}
}

#Preview("A17.13 · confirmed") {
    MailTranslationView(mailId: "preview", seedConfirmed: true) {}
}
#endif
