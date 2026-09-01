//
//  NeighborMessageComposeView.swift
//  Pantopus
//
//  D1 — the verified-neighbor composer. Template-only (no free-text field
//  exists), delivered anonymously ("from a verified neighbor nearby"),
//  scoped to a verified home on your block, rate-limited, and blockable —
//  the trust-and-safety constraints ARE the UI. Ported from the design kit
//  `place-message-compose.jsx` / web `NeighborMessageComposeView`.
//

import SwiftUI

// swiftlint:disable multiline_arguments

struct NeighborMessageComposeView: View {
    @State var viewModel: NeighborMessageComposeViewModel
    var onBack: () -> Void
    var onChangeRecipient: () -> Void
    /// Dismiss back to Place after a successful, calm confirmation.
    var onDone: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            PlaceDetailHeader(
                title: viewModel.sent ? "Message sent" : "New message",
                address: "To a verified neighbor on your block",
                onBack: onBack
            )
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.sent {
            SentConfirmation(onDone: onDone)
        } else {
            switch viewModel.state {
            case .loading:
                ComposeSkeleton()
            case let .error(message):
                ErrorState(message: message) { await viewModel.load() }
            case .loaded:
                composer
            }
        }
    }

    private var composer: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    PlaceDetailSectionLabel(text: "To")
                    if let recipient = viewModel.recipient {
                        ComposeRecipientCard(recipient: recipient, onChange: onChangeRecipient)
                    } else {
                        ChooseNeighborCard(onBack: onChangeRecipient)
                    }
                    PrivacyNote()

                    PlaceDetailSectionLabel(text: "Choose a note")
                    VStack(spacing: 8) {
                        ForEach(viewModel.templates) { template in
                            TemplateRow(
                                template: template,
                                selected: template.id == viewModel.selectedTemplateId
                            ) { viewModel.selectedTemplateId = $0 }
                        }
                    }
                    TemplateNote()

                    PlaceDetailSectionLabel(text: "How it's delivered")
                    DeliveryPreview(
                        messageBody: viewModel.selectedTemplate?.body
                            ?? "Choose a note above to preview how it arrives."
                    )

                    PlaceDetailSectionLabel(text: "Good to know")
                    SafetyCard()

                    if let sendError = viewModel.sendError {
                        NeighborErrorBanner(message: sendError)
                            .padding(.top, 16)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 132)
            }
            SendBar(
                sending: viewModel.sending,
                enabled: viewModel.canSend
            ) { Task { await viewModel.send() } }
        }
    }
}

// MARK: - Recipient

private struct ComposeRecipientCard: View {
    let recipient: ComposeRecipient
    var onChange: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            PlaceIconTile(icon: .home, tone: .home, size: 38)
            VStack(alignment: .leading, spacing: 1) {
                Text(recipient.address)
                    .font(.system(size: 15.5, weight: .semibold))
                    .kerning(-0.15)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(recipient.relativeLabel)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Button("Change", action: onChange)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.primary600)
                .buttonStyle(.plain)
        }
        .padding(14)
        .placeCard()
    }
}

private struct ChooseNeighborCard: View {
    var onBack: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            PlaceIconTile(icon: .home, tone: .muted, size: 38)
            VStack(alignment: .leading, spacing: 4) {
                Text("Choose a neighbor on your block")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Open a home on your block to send it a verified heads-up.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Back to your block", action: onBack)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                    .buttonStyle(.plain)
                    .padding(.top, 4)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .placeCard()
    }
}

// MARK: - Privacy reassurance

private struct PrivacyNote: View {
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Icon(.eyeOff, size: 18, strokeWidth: 2, color: Theme.Color.info)
            (Text("Your identity stays private. ").bold()
                + Text("It's delivered as \u{201C}from a verified neighbor nearby\u{201D} — never your name or address."))
                .font(.system(size: 13.5))
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.infoBg)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Theme.Color.infoLight, lineWidth: 1)
        )
        .padding(.top, 8)
    }
}

// MARK: - Template radio row

private struct TemplateRow: View {
    let template: NeighborMessageTemplate
    let selected: Bool
    var onSelect: (String) -> Void

    var body: some View {
        Button { onSelect(template.id) } label: {
            HStack(alignment: .top, spacing: 12) {
                radio
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 6) {
                        Icon(
                            neighborTemplateIcon(template.icon),
                            size: 14, strokeWidth: 2,
                            color: selected ? Theme.Color.home : Theme.Color.appTextMuted
                        )
                        Text(template.category.uppercased())
                            .font(.system(size: 11, weight: .bold))
                            .kerning(0.55)
                            .foregroundStyle(selected ? Theme.Color.home : Theme.Color.appTextMuted)
                    }
                    Text(template.body)
                        .font(.system(size: 13.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? Theme.Color.successBg : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .strokeBorder(
                        selected ? Theme.Color.successLight : Theme.Color.appBorder,
                        lineWidth: selected ? 1.5 : 1
                    )
            )
            .shadow(color: .black.opacity(0.04), radius: 3, x: 0, y: 1)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    private var radio: some View {
        ZStack {
            if selected {
                Circle().fill(Theme.Color.home)
                Icon(.check, size: 13, strokeWidth: 3.25, color: Theme.Color.appTextInverse)
            } else {
                Circle()
                    .fill(Theme.Color.appSurface)
                    .overlay(Circle().strokeBorder(Theme.Color.appBorderStrong, lineWidth: 2))
            }
        }
        .frame(width: 22, height: 22)
    }
}

private struct TemplateNote: View {
    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            Icon(.info, size: 14, strokeWidth: 2, color: Theme.Color.appTextMuted)
            Text("Messages are pre-written to keep them neutral. Free typing isn't available — it's how we keep this channel safe.")
                .font(.system(size: 12.5))
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 2)
        .padding(.top, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Delivery preview

private struct DeliveryPreview: View {
    let messageBody: String

    var bodyView: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Theme.Color.appSurfaceSunken)
                        .overlay(Circle().strokeBorder(Theme.Color.appBorder, lineWidth: 1))
                    Icon(.shieldCheck, size: 20, strokeWidth: 2, color: Theme.Color.home)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 1) {
                    Text("A verified neighbor nearby")
                        .font(.system(size: 15, weight: .semibold))
                        .kerning(-0.15)
                        .foregroundStyle(Theme.Color.appText)
                    Text("On your block · just now")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                Spacer(minLength: 0)
                PlaceChip(model: PlaceChipModel(tone: .success, text: "Verified", icon: .shieldCheck))
            }
            Text(messageBody)
                .pantopusTextStyle(.small)
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            Divider().overlay(Theme.Color.appBorderSubtle)
            HStack(spacing: 8) {
                pill(icon: .reply, text: "Reply with a note", tone: .neutral)
                pill(icon: .ban, text: "Block", tone: .danger)
                Spacer(minLength: 0)
            }
            Text("They can reply with a template or block you anytime.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    var body: some View {
        bodyView
            .padding(15)
            .placeCard()
    }

    private enum PillTone { case neutral, danger }

    private func pill(icon: PantopusIcon, text: String, tone: PillTone) -> some View {
        let fg = tone == .danger ? Theme.Color.error : Theme.Color.appTextSecondary
        let bg = tone == .danger ? Theme.Color.errorBg : Theme.Color.appSurfaceSunken
        let border = tone == .danger ? Theme.Color.errorLight : Theme.Color.appBorder
        return HStack(spacing: 6) {
            Icon(icon, size: 14, strokeWidth: 2, color: fg)
            Text(text)
                .font(.system(size: 13, weight: .semibold))
        }
        .foregroundStyle(fg)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(bg)
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(border, lineWidth: 1))
    }
}

// MARK: - Safety card

private struct SafetyCard: View {
    private struct Row: Identifiable {
        let id = UUID()
        let icon: PantopusIcon
        let title: String
        let sub: String
    }

    private let rows: [Row] = [
        Row(
            icon: .hand,
            title: "Keep it neighborly",
            sub: "For genuine heads-ups — not complaints, sales, or anything targeted."
        ),
        Row(
            icon: .clock,
            title: "A few messages a week",
            sub: "There's a gentle limit, so the channel stays low-volume and calm."
        ),
        Row(
            icon: .ban,
            title: "Always blockable",
            sub: "Anyone can block messages from verified neighbors at any time."
        )
    ]

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                HStack(alignment: .top, spacing: 12) {
                    Icon(row.icon, size: 18, strokeWidth: 2, color: Theme.Color.appTextMuted)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(row.title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Text(row.sub)
                            .font(.system(size: 12.5))
                            .lineSpacing(1.5)
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 12)
                if index < rows.count - 1 {
                    Divider().overlay(Theme.Color.appBorderSubtle)
                }
            }
        }
        .padding(.horizontal, 14)
        .placeCard()
    }
}

// MARK: - Pinned send bar

private struct SendBar: View {
    let sending: Bool
    let enabled: Bool
    var onSend: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Button(action: onSend) {
                HStack(spacing: 8) {
                    Icon(.send, size: 18, strokeWidth: 2.25, color: Theme.Color.appTextInverse)
                    Text(sending ? "Sending…" : "Send")
                        .font(.system(size: 16, weight: .semibold))
                        .kerning(-0.16)
                }
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(enabled ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!enabled)
            HStack(spacing: 6) {
                Icon(.eyeOff, size: 13, strokeWidth: 2, color: Theme.Color.appTextMuted)
                Text("Delivered anonymously · a few messages a week")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(.bar)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }
}

// MARK: - Sent confirmation

private struct SentConfirmation: View {
    var onDone: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                PlaceIconTile(icon: .check, tone: .home, size: 48)
                Text("Delivered anonymously")
                    .font(.system(size: 18, weight: .bold))
                    .kerning(-0.18)
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.top, 12)
                Text("Your verified neighbor received it as \u{201C}from a verified neighbor nearby\u{201D} — never your name or address.")
                    .font(.system(size: 13.5))
                    .lineSpacing(2)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.top, 6)
                    .padding(.horizontal, 8)
                Button(action: onDone) {
                    Text("Done")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .padding(.horizontal, 20)
                        .frame(height: 44)
                        .background(Theme.Color.primary600)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.top, 20)
            }
            .frame(maxWidth: .infinity)
            .padding(20)
            .placeCard()
            .padding(.horizontal, 16)
            .padding(.top, 24)
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Compose skeleton

private struct ComposeSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            PlaceSkeleton(height: 64, radius: 16)
            PlaceSkeleton(height: 48, radius: 12)
            VStack(spacing: 10) {
                ForEach(0..<4, id: \.self) { _ in
                    PlaceSkeleton(height: 64, radius: 16)
                }
            }
            .padding(.top, 12)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }
}
