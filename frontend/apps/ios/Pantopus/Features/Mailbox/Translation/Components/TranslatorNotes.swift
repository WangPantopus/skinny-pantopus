//
//  TranslatorNotes.swift
//  Pantopus
//
//  A17.13 — the translator-notes glossary plus the small card primitives the
//  Translation screen shares: the white card shell, the "From Pantopus"
//  glossary, the confirmed banner, the sender card, and the inline action
//  bars (machine + confirmed). Grouped here so the screen file stays a thin
//  assembly of cards.
//

import SwiftUI

// MARK: - Shared card chrome

/// White rounded card with the standard mailbox border + soft shadow. `noPad`
/// drops the inner padding for cards that own their own row insets
/// (glossary, side-by-side).
struct TranslationCard<Content: View>: View {
    var noPad: Bool = false
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .padding(noPad ? Spacing.s0 : Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }
}

/// Uppercase card label with an optional trailing accessory.
struct TranslationCardLabel<Accessory: View>: View {
    let title: String
    @ViewBuilder var accessory: () -> Accessory

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.s2) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
            accessory()
        }
    }
}

extension TranslationCardLabel where Accessory == EmptyView {
    init(_ title: String) {
        self.init(title: title) { EmptyView() }
    }
}

// MARK: - Translator-notes glossary

struct TranslatorNotes: View {
    let notes: [TranslationGlossaryNote]

    var body: some View {
        TranslationCard(noPad: true) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                TranslationCardLabel(title: "Translator notes") {
                    HStack(spacing: Spacing.s1) {
                        Icon(.sparkles, size: 11, color: Theme.Color.appTextSecondary)
                        Text("From Pantopus")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.top, Spacing.s3)
                .padding(.bottom, Spacing.s2)

                // Each note sits under a hairline (design renders a
                // border-top on every glossary row, including the first).
                ForEach(notes) { note in
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                    noteRow(note)
                }
            }
        }
        .accessibilityIdentifier("translation_glossary")
    }

    private func noteRow(_ note: TranslationGlossaryNote) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(alignment: .center, spacing: Spacing.s2) {
                Text(note.term)
                    .font(.system(size: 14, weight: .bold, design: .serif))
                    .italic()
                    .foregroundStyle(Theme.Color.appText)
                Text(note.kind.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(Theme.Color.categoryTranslationInk)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 2)
                    .background(Theme.Color.categoryTranslationBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                Spacer(minLength: Spacing.s0)
            }
            Text(note.note)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
    }
}

// MARK: - Confirmed banner

struct TranslationConfirmBanner: View {
    let stamp: String

    private let badgeSize: CGFloat = 36

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.check, size: 19, color: Theme.Color.appTextInverse)
                .frame(width: badgeSize, height: badgeSize)
                .background(Theme.Color.success)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .pantopusShadow(.sm)
            VStack(alignment: .leading, spacing: 1) {
                Text("Translation confirmed")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
                Text(stamp)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.success)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Translation confirmed. \(stamp)")
        .accessibilityIdentifier("translation_confirmBanner")
    }
}

// MARK: - Sender card

struct TranslationSenderCard: View {
    let sender: TranslationSender

    private let avatarSize: CGFloat = 44
    private let checkSize: CGFloat = 16

    var body: some View {
        TranslationCard {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                TranslationCardLabel("From")
                HStack(spacing: Spacing.s3) {
                    avatar
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        Text(sender.name)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        Text(sender.meta)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        HStack(spacing: Spacing.s1) {
                            kindPill
                            proofPill
                        }
                    }
                    Spacer(minLength: Spacing.s0)
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
            }
        }
        .accessibilityIdentifier("translation_senderCard")
    }

    private var avatar: some View {
        Text(sender.initials)
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(width: avatarSize, height: avatarSize)
            .background(Theme.Color.categoryTranslation)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(alignment: .bottomTrailing) {
                Icon(.check, size: 9, color: Theme.Color.appTextInverse)
                    .frame(width: checkSize, height: checkSize)
                    .background(Theme.Color.success)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .offset(x: 3, y: 3)
            }
            .accessibilityHidden(true)
    }

    private var kindPill: some View {
        HStack(spacing: 3) {
            Icon(.userCheck, size: 9, color: Theme.Color.personal)
            Text(sender.kind)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.personal)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 2)
        .background(Theme.Color.personalBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }

    private var proofPill: some View {
        Text(sender.proof)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(Theme.Color.success)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 2)
            .background(Theme.Color.successBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }
}

// MARK: - Inline action bars

/// One labelled icon chip in the 4-up secondary row.
struct TranslationChip: View {
    let icon: PantopusIcon
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Spacing.s1) {
                Icon(icon, size: 17, color: Theme.Color.appTextStrong)
                Text(label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier("translation_chip_\(label.lowercased())")
    }
}

/// The machine-state action bar: "Confirm translation" + Edit/Language/Listen/Archive.
struct TranslationMachineActions: View {
    let confirmInFlight: Bool
    let onConfirm: () -> Void
    let onEdit: () -> Void
    let onLanguage: () -> Void
    let onListen: () -> Void
    let onArchive: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            Button(action: onConfirm) {
                HStack(spacing: Spacing.s2) {
                    Icon(.checkCheck, size: 17, color: Theme.Color.appTextInverse)
                    Text("Confirm translation")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .pantopusShadow(.primary)
                .opacity(confirmInFlight ? 0.6 : 1)
            }
            .buttonStyle(.plain)
            .disabled(confirmInFlight)
            .accessibilityIdentifier("translation_confirm")

            HStack(spacing: Spacing.s2) {
                TranslationChip(icon: .pencil, label: "Edit", action: onEdit)
                TranslationChip(icon: .globe, label: "Language", action: onLanguage)
                TranslationChip(icon: .play, label: "Listen", action: onListen)
                TranslationChip(icon: .archive, label: "Archive", action: onArchive)
            }
        }
    }
}

/// The confirmed-state action bar: "Reply to {name}" + Re-translate/Original/Share/Archive.
struct TranslationConfirmedActions: View {
    let replyName: String
    let onReply: () -> Void
    let onRetranslate: () -> Void
    let onShowOriginal: () -> Void
    let onShare: () -> Void
    let onArchive: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            Button(action: onReply) {
                HStack(spacing: Spacing.s2) {
                    Icon(.reply, size: 17, color: Theme.Color.appTextInverse)
                    Text("Reply to \(replyName)")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .pantopusShadow(.primary)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("translation_reply")

            HStack(spacing: Spacing.s2) {
                TranslationChip(icon: .arrowsRepeat, label: "Re-translate", action: onRetranslate)
                TranslationChip(icon: .fileText, label: "Original", action: onShowOriginal)
                TranslationChip(icon: .share, label: "Share", action: onShare)
                TranslationChip(icon: .archive, label: "Archive", action: onArchive)
            }
        }
    }
}

#if DEBUG
#Preview("Translator notes + cards") {
    ScrollView {
        VStack(spacing: Spacing.s4) {
            TranslationConfirmBanner(stamp: "Marked trusted by you · May 28 · 2:40 PM")
            TranslatorNotes(notes: MailTranslationSampleData.letter().glossary)
            TranslationSenderCard(sender: MailTranslationSampleData.letter().sender)
            TranslationMachineActions(
                confirmInFlight: false,
                onConfirm: {},
                onEdit: {},
                onLanguage: {},
                onListen: {},
                onArchive: {}
            )
            TranslationConfirmedActions(
                replyName: "Lucía",
                onReply: {},
                onRetranslate: {},
                onShowOriginal: {},
                onShare: {},
                onArchive: {}
            )
        }
        .padding(Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
#endif
