//
//  HolidayCardView.swift
//  Pantopus
//
//  Reading a Christmas card (launch key `holiday_cards`; the web's
//  `HolidayCardView`). Sealed until Christmas morning: the envelope with its
//  seal and how long until it opens. The first time it's opened: the
//  envelope, then "Open the envelope" and the card rises out of it picture
//  side up. Then "Turn it over" to read the note. With Reduce Motion
//  nothing slides or turns. The envelope opens the sheet with who sent it.
//

import SwiftUI

struct HolidayCardView: View {
    let letter: MailLetter
    let card: HolidayCardLetter
    /// It hadn't been opened before this visit: it opens from its envelope.
    let firstOpen: Bool
    /// Who sent it and its trail.
    let onEnvelope: () -> Void

    @State private var stage: Stage
    @State private var risen = false
    @State private var showBack = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum Stage {
        case envelope, opening, card
    }

    init(letter: MailLetter, card: HolidayCardLetter, firstOpen: Bool, onEnvelope: @escaping () -> Void) {
        self.letter = letter
        self.card = card
        self.firstOpen = firstOpen
        self.onEnvelope = onEnvelope
        _stage = State(initialValue: firstOpen ? .envelope : .card)
        _risen = State(initialValue: !firstOpen)
    }

    private var from: String {
        letter.senderName
    }

    var body: some View {
        Group {
            if card.card.sealed {
                sealed
            } else if stage == .envelope {
                envelopeStage
            } else {
                cardStage
            }
        }
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("holidayCard")
    }

    // MARK: The envelope

    /// The envelope, still shut; tapping it shows who sent it.
    private var envelope: some View {
        Button(action: onEnvelope) {
            MailPieceView(model: card.envelope)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Christmas card from \(from)\(card.card.sealed ? ", sealed until Christmas morning" : "")")
        .accessibilityHint("Shows who sent it and its trail.")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("holidayCardEnvelope")
    }

    /// "Do not open until Christmas", and when it opens.
    private var sealed: some View {
        VStack(spacing: Spacing.s5) {
            envelope
            VStack(spacing: Spacing.s2) {
                Text("Do not open until Christmas")
                    .font(.system(size: 22, design: .serif))
                    .foregroundStyle(MailPaper.wax)
                    .accessibilityAddTraits(.isHeader)
                Text(sealedSentence)
                    .font(.system(size: 15))
                    .foregroundStyle(MailPaper.cardTextSoft)
                    .lineSpacing(3)
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, Spacing.s5)
            .padding(.vertical, Spacing.s4)
            .frame(maxWidth: .infinity)
            .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("holidayCardSealed")
        }
    }

    /// "Juniper H. sealed this card. It opens on Christmas morning, Friday,
    /// December 25, in 56 days."
    private var sealedSentence: String {
        let until = card.card.sealedUntil
        let day = until.map { HolidayCardWords.longDay($0) } ?? "December 25"
        let when = until.map { ", \(HolidayCardWords.inDays($0))" } ?? ""
        return "\(from) sealed this card. It opens on Christmas morning, \(day)\(when)."
    }

    /// The first time: the envelope and "Open the envelope".
    private var envelopeStage: some View {
        VStack(spacing: Spacing.s4) {
            envelope
            Text("A Christmas card from \(HolidayCardWords.withoutPeriod(from)).")
                .font(.system(size: 15))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            HolidayCardWaxButton(title: "Open the envelope", fullWidth: false) { open() }
                .accessibilityIdentifier("holidayCardOpen")
        }
    }

    private func open() {
        guard !reduceMotion else {
            risen = true
            stage = .card
            return
        }
        risen = false
        stage = .opening
    }

    // MARK: The card

    private var cardStage: some View {
        // Shares of each one's own height: the card starts 38% down, inside
        // its envelope; the envelope falls 55% away.
        let cardDrop: CGFloat = risen ? 0 : 0.38
        let envelopeDrop: CGFloat = risen ? 0.55 : 0
        return VStack(spacing: Spacing.s4) {
            ZStack(alignment: .bottom) {
                theCard
                    .visualEffect { content, proxy in
                        content.offset(y: proxy.size.height * cardDrop)
                    }
                    .scaleEffect(risen ? 1 : 0.92)
                    .opacity(risen ? 1 : 0)
                if stage == .opening {
                    // The opened envelope it rises out of, falling away.
                    MailPieceView(model: letter.piece)
                        .visualEffect { content, proxy in
                            content.offset(y: proxy.size.height * envelopeDrop)
                        }
                        .opacity(risen ? 0 : 1)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .onAppear(perform: rise)
            HStack(spacing: Spacing.s2) {
                HolidayCardPaperButton(title: showBack ? "Turn it back" : "Turn it over", isPressed: showBack) {
                    showBack.toggle()
                }
                .accessibilityIdentifier("holidayCardTurn")
                Button("The envelope", action: onEnvelope)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s4)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                    .accessibilityHint("Shows who sent it and its trail.")
                    .accessibilityIdentifier("holidayCardEnvelopeLink")
            }
        }
    }

    /// The card rises out of its envelope in about 0.7 s.
    private func rise() {
        guard stage == .opening, !risen else { return }
        withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.72)) { risen = true }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 760_000_000)
            stage = .card
        }
    }

    private var theCard: some View {
        HolidayCardFlip(showBack: showBack) {
            HolidayCardFront(
                design: card.card.design,
                caption: card.card.caption,
                paper: card.card.paper,
                year: card.card.year,
                mailedOn: card.mailedOn
            )
            .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
            .shadow(color: MailPaper.cardShadow.opacity(0.28), radius: 15, x: 0, y: 14)
        } back: {
            HolidayCardBack(paper: card.card.paper, fromName: from, year: card.card.year) { width in
                HolidayCardNoteText(text: .constant(card.note), cardWidth: width)
            }
            .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
            .shadow(color: MailPaper.cardShadow.opacity(0.28), radius: 15, x: 0, y: 14)
        }
        // The note for VoiceOver, whichever side is up.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "Card from \(from): \(HolidayCardWords.withoutPeriod(card.card.caption ?? "a Christmas picture")). On the back: \(card.note)"
        )
        .accessibilityIdentifier("holidayCardFace")
    }
}
