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
    @State private var stamps = MailStampStore()
    @State private var showsStampBooks = false
    @Environment(\.scenePhase) private var phase

    var body: some View {
        Group {
            if cards.postageEnabled { promotion } else { legacyRow }
        }
        .task(id: "\(cards.postageEnabled)-\(cards.stamps?.available ?? 0)") {
            if cards.postageEnabled { await stamps.refresh() }
        }
        .onChange(of: phase) {
            if phase == .active, cards.postageEnabled { Task { await stamps.refresh() } }
        }
        .sheet(isPresented: $showsStampBooks) {
            StampBooksSheet(store: stamps)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .task { await stamps.recover()
                    await stamps.watch()
                }
        }
    }

    private var promotion: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("CHRISTMAS CARDS")
                        .font(.system(size: 11, weight: .bold))
                        .tracking(1.4)
                        .foregroundStyle(MailPaper.wax)
                    Text("Make their Christmas personal.")
                        .font(.system(size: 23, weight: .semibold, design: .serif))
                        .foregroundStyle(MailPaper.cardText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                thumbs(HolidayCardPicture.fan)
            }
            Text("Pick a festive design, add your words, and send a digital card they can keep.")
                .font(.system(size: 14))
                .foregroundStyle(MailPaper.cardTextSoft)
                .fixedSize(horizontal: false, vertical: true)
            if let free = stamps.balance?.freeRemaining ?? cards.stamps?.freeRemaining,
               let paid = stamps.balance?.paidRemaining ?? cards.stamps?.paidRemaining {
                Text(stampBalanceLabel(free: free, paid: paid))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(MailPaper.cardText)
            }
            Text("Free cards first. Then 1 stamp per recipient.")
                .font(.system(size: 12.5))
                .foregroundStyle(MailPaper.cardTextMuted)
            VStack(spacing: Spacing.s2) {
                HolidayCardWaxButton(title: stamps.balance?.salesOpen == false ? "View stamp books" : "Buy stamp books") {
                    showsStampBooks = true
                }
                .accessibilityIdentifier("mailBuyStampBooks")
                HolidayCardPaperButton(title: "Create a Christmas card", fullWidth: true, action: onOpen)
                    .accessibilityIdentifier("mailHolidayCardRow")
            }
            Text(stamps.balance?.salesOpen == false ? "Use your stamps until December 31."
                : stamps.products.first.map { "Stamp books from \($0.displayPrice) · One-time purchase" }
                ?? "Books of 5, 20 or 50 stamps · No subscription")
                .font(.system(size: 12.5))
                .foregroundStyle(MailPaper.cardTextMuted)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.s4)
        .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
            .strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
    }

    private var legacyRow: some View {
        let today = HolidayCardWords.today(cards)
        return Button(action: onOpen) {
            HStack(spacing: Spacing.s3) {
                thumbs(today.flatMap(\.design).map { [$0] } ?? HolidayCardPicture.fan)
                VStack(alignment: .leading, spacing: 2) {
                    Text(today.map { "Today’s card · to \(MailPieceModel.firstText($0.toName) ?? "them")" } ?? "Send a Christmas card")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(today == nil ? MailPaper.wax : MailPaper.cardText)
                        .lineLimit(1)
                    Text(HolidayCardWords.rowLine(today: today, postageEnabled: cards.postageEnabled, stamps: cards.stamps))
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

/// Keep free cards distinct from paid credits wherever books are offered.
func stampBalanceLabel(free: Int, paid: Int) -> String {
    "\(free) free \(free == 1 ? "card" : "cards") · \(max(0, paid)) paid \(paid == 1 ? "stamp" : "stamps")"
}

/// A visible buying action below the step heading, with an explicit free/paid balance.
struct StampChip: View {
    let store: MailStampStore
    let onOpen: () -> Void

    var body: some View {
        if let balance = store.balance {
            Button(action: onOpen) {
                HStack(spacing: Spacing.s3) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("\(balance.freeRemaining) free \(balance.freeRemaining == 1 ? "card" : "cards")")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(MailPaper.cardText)
                        Text("\(max(0, balance.paidRemaining)) paid \(balance.paidRemaining == 1 ? "stamp" : "stamps") · 1 stamp = 1 card")
                            .font(.system(size: 12.5))
                            .foregroundStyle(MailPaper.cardTextMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Text(balance.salesOpen == false ? "View stamps" : "Buy stamps")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(MailPaper.waxText)
                        .padding(.horizontal, Spacing.s3)
                        .frame(minHeight: 44)
                        .background(MailPaper.wax, in: RoundedRectangle(cornerRadius: Radii.md))
                }
                .padding(Spacing.s3)
                .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.lg))
                .overlay(RoundedRectangle(cornerRadius: Radii.lg).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(stampBalanceLabel(free: balance.freeRemaining, paid: balance.paidRemaining)
                + (balance.salesOpen == false ? ". View stamp books" : ". Buy stamp books"))
            .accessibilityIdentifier("stampChip")
        }
    }
}
