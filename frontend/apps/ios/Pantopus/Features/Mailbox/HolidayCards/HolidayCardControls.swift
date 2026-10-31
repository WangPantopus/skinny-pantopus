//
//  HolidayCardControls.swift
//  Pantopus
//
//  The Christmas card screens' own controls (`holiday_cards`): the wax-red
//  button with cream words, the cream paper button, and the way in at the
//  top of Me in the Mailbox ("Send a Christmas card", or today's card once
//  it's sent).
//

import SwiftUI

/// The card screens' main button: wax red, cream words.
struct HolidayCardWaxButton: View {
    let title: String
    var isLoading = false
    var isEnabled = true
    var fullWidth = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(title)
                    .multilineTextAlignment(.center)
                    .opacity(isLoading ? 0 : 1)
                if isLoading {
                    ProgressView().tint(MailPaper.waxText)
                }
            }
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(MailPaper.waxText)
            .padding(.horizontal, Spacing.s5)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: 48)
            .background(MailPaper.wax, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .opacity(isEnabled ? 1 : 0.5)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || isLoading)
        .accessibilityLabel(title)
    }
}

/// The card screens' second button: cream paper with a soft edge.
struct HolidayCardPaperButton: View {
    let title: String
    var isLoading = false
    var isPressed = false
    var fullWidth = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(title)
                    .multilineTextAlignment(.center)
                    .opacity(isLoading ? 0 : 1)
                if isLoading {
                    ProgressView().tint(MailPaper.cardTextSoft)
                }
            }
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(MailPaper.cardTextSoft)
            .padding(.horizontal, Spacing.s5)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: fullWidth ? 48 : 44)
            .background(
                isPressed ? MailPaper.cardPressed : MailPaper.cardField,
                in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
            )
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardFieldEdge, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .accessibilityLabel(title)
        .accessibilityAddTraits(isPressed ? [.isButton, .isSelected] : .isButton)
    }
}

/// The way in, at the top of Me in the Mailbox: a fan of three pictures and
/// "Send a Christmas card", or today's card and how it comes.
struct HolidayCardRow: View {
    let cards: HolidayCardsResponse
    let onOpen: () -> Void

    var body: some View {
        let today = HolidayCardWords.today(cards)
        Button(action: onOpen) {
            HStack(spacing: Spacing.s3) {
                thumbs(today.flatMap(\.design).map { [$0] } ?? HolidayCardPicture.fan)
                VStack(alignment: .leading, spacing: 2) {
                    Text(today.map { "Today’s card · to \(MailPieceModel.firstText($0.toName) ?? "them")" } ?? "Send a Christmas card")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(today == nil ? MailPaper.wax : MailPaper.cardText)
                        .lineLimit(1)
                    Text(HolidayCardWords.rowLine(today: today))
                        .font(.system(size: 13))
                        .foregroundStyle(MailPaper.cardTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 20, color: MailPaper.cardFooter)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(MailPieceButtonStyle())
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("mailHolidayCardRow")
    }

    /// One picture tilted, or three fanned out.
    private func thumbs(_ designs: [String]) -> some View {
        ZStack(alignment: .topLeading) {
            ForEach(Array(designs.enumerated()), id: \.element) { index, design in
                let known = cards.designs.first { $0.id == design }
                HolidayCardPictureView(design: design, paper: known?.paper, height: known?.height, thumb: true)
                    .frame(width: 40)
                    .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))
                    .shadow(color: MailPaper.cardShadow.opacity(0.28), radius: 4, x: 0, y: 3)
                    .rotationEffect(.degrees(designs.count == 1 ? -3 : Double(index - 1) * 7))
                    .offset(x: designs.count == 1 ? 11 : CGFloat(index) * 11)
            }
        }
        .frame(width: 62, height: 54, alignment: .topLeading)
        .accessibilityHidden(true)
    }
}
