//
//  MailSenderSheet.swift
//  Pantopus
//
//  The envelope, turned over (Mail tab drawings, board "R6-Envelope"): who
//  sent it and how Pantopus checked them, by trust level, and its trail from
//  the postmark to where it stands now.
//

import SwiftUI

struct MailSenderSheet: View {
    let letter: MailLetter
    /// "See their business page" / "See their profile", when there's one.
    let senderLink: (title: String, open: () -> Void)?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("The envelope")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Spacer()
                    Button { dismiss() } label: {
                        Icon(.x, size: 20, color: Theme.Color.appTextStrong)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close")
                    .accessibilityIdentifier("mailSenderSheetClose")
                }
                MailPieceView(model: letter.piece)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(letter.piece.accessibilityLabel)
                whoSentIt
                trail
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s6)
        }
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("mailSenderSheet")
    }

    private var whoSentIt: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionTitle("Who sent it")
            HStack(spacing: 10) {
                Text(String(letter.senderName.prefix(1)).uppercased())
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(MailPaper.envelope)
                    .frame(width: 36, height: 36)
                    .background(MailPaper.postalInk, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(letter.senderName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    MailTrustChip(trust: letter.trust)
                }
            }
            Text(Self.checkedSentence(letter.trust))
                .font(.system(size: 14))
                .foregroundStyle(letter.trust == .unknown ? Theme.Color.error : Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("mailSenderSheetChecked")
            if let senderLink {
                Button(senderLink.title) {
                    dismiss()
                    senderLink.open()
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.primaryInk)
                .frame(minHeight: 44)
                .accessibilityIdentifier("mailSenderSheetLink")
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var trail: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Its trail")
            VStack(alignment: .leading, spacing: Spacing.s0) {
                ForEach(Array(letter.trail.enumerated()), id: \.element.id) { index, step in
                    MailTrailRow(step: step, isLast: index == letter.trail.count - 1)
                }
            }
        }
        .accessibilityIdentifier("mailSenderSheetTrail")
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.7)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .accessibilityAddTraits(.isHeader)
    }

    /// How Pantopus checked the sender, by trust level.
    static func checkedSentence(_ trust: MailPieceTrust) -> String {
        switch trust {
        case .business: "Pantopus verified this business before it could send mail."
        case .government: "Pantopus verified this government office before it could send mail."
        case .utility: "Pantopus verified this utility before it could send mail."
        case .pantopus: "Pantopus sent this itself."
        case .pantopusBusiness: "A business with a Pantopus account sent this. Pantopus hasn't verified the business yet."
        case .neighbor: "A person with a Pantopus account sent this from it."
        case .unknown:
            "Pantopus couldn't check who sent this. Be careful with its links and with any request for money or personal details."
        }
    }
}

/// "Verified business", with the icon for that kind of sender; "Unverified
/// sender" in red.
struct MailTrustChip: View {
    let trust: MailPieceTrust

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon, size: 12, strokeWidth: 2.25, color: ink)
            Text(trust.label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(ink)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(fill, in: Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("mailTrustChip")
    }

    /// The government icon only for a verified government sender.
    private var icon: PantopusIcon {
        switch trust {
        case .business: .store
        case .government: .landmark
        case .utility: .zap
        case .pantopus: .badgeCheck
        case .pantopusBusiness: .store
        case .neighbor: .user
        case .unknown: .alertTriangle
        }
    }

    private var ink: Color {
        switch trust {
        case .business, .government, .utility: Theme.Color.success
        case .pantopus, .pantopusBusiness, .neighbor: Theme.Color.info
        case .unknown: Theme.Color.error
        }
    }

    private var fill: Color {
        switch trust {
        case .business, .government, .utility: Theme.Color.successBg
        case .pantopus, .pantopusBusiness, .neighbor: Theme.Color.infoBg
        case .unknown: Theme.Color.errorBg
        }
    }
}

/// One step of the trail: a dot on the line, what happened and when.
private struct MailTrailRow: View {
    let step: MailTrailStep
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack(alignment: .top) {
                if !isLast {
                    Rectangle()
                        .fill(Theme.Color.appBorder)
                        .frame(width: 2)
                        .padding(.top, 6)
                }
                Circle()
                    .fill(step.isDone ? (step.isReaders ? Theme.Color.primarySolid : MailPaper.postalInk) : Theme.Color.appSurface)
                    .overlay(Circle().strokeBorder(step.isDone ? .clear : Theme.Color.appTextMuted, lineWidth: 2))
                    .frame(width: 12, height: 12)
                    .padding(.top, Spacing.s1)
            }
            .frame(width: 12)
            .frame(maxHeight: .infinity, alignment: .top)
            VStack(alignment: .leading, spacing: 1) {
                Text(step.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(step.isDone ? Theme.Color.appText : Theme.Color.appTextSecondary)
                if let detail = step.detail, !detail.isEmpty {
                    Text(detail)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .padding(.bottom, isLast ? 0 : 12)
        }
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: .combine)
    }
}
