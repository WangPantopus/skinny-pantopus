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
//  The sealed notice and the rise out of the envelope are shared with Look
//  it over, which shows the sender the same parts before sending.
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
    /// The card rises out of its envelope as it shows (opened just now).
    @State private var rises = false
    @State private var showBack = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum Stage {
        case envelope, card
    }

    init(letter: MailLetter, card: HolidayCardLetter, firstOpen: Bool, onEnvelope: @escaping () -> Void) {
        self.letter = letter
        self.card = card
        self.firstOpen = firstOpen
        self.onEnvelope = onEnvelope
        _stage = State(initialValue: firstOpen ? .envelope : .card)
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
        .accessibilityIdentifier("mailHolidayCard")
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
        .accessibilityIdentifier("mailLetterEnvelope")
    }

    /// "Do not open until Christmas", and when it opens.
    private var sealed: some View {
        VStack(spacing: Spacing.s5) {
            envelope
            HolidayCardSealedNotice(
                from: from,
                opensOn: card.card.sealedUntil,
                inDays: card.card.sealedUntil.map { HolidayCardWords.inDays($0) }
            )
            .accessibilityIdentifier("mailHolidayCardSealed")
        }
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
                .accessibilityIdentifier("mailHolidayCardOpen")
        }
    }

    private func open() {
        rises = !reduceMotion
        stage = .card
    }

    // MARK: The card

    private var cardStage: some View {
        VStack(spacing: Spacing.s4) {
            HolidayCardRiseOut(envelope: letter.piece, rises: rises) {
                theCard
            }
            HStack(spacing: Spacing.s2) {
                HolidayCardPaperButton(title: showBack ? "Turn it back" : "Turn it over", isPressed: showBack) {
                    showBack.toggle()
                }
                .accessibilityIdentifier("mailHolidayCardTurn")
                Button("The envelope", action: onEnvelope)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s4)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                    .accessibilityHint("Shows who sent it and its trail.")
                    .accessibilityIdentifier("mailHolidayCardEnvelope")
            }
        }
    }

    private var theCard: some View {
        HolidayCardFlip(showBack: showBack) {
            HolidayCardFront(
                design: card.card.design,
                caption: card.card.caption,
                paper: card.card.paper,
                height: card.card.height,
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
            "Card from \(from): \(HolidayCardWords.captionSentence(card.card.caption)) On the back: \(card.note)"
        )
        .accessibilityIdentifier("mailHolidayCardFace")
    }
}

// MARK: - Shared with Look it over

/// "Do not open until Christmas" and when it opens: the card page while a
/// card is sealed, and Look it over shows its sender the same notice.
struct HolidayCardSealedNotice: View {
    /// Who sealed it, as the card carries the name.
    let from: String
    /// When it opens: an instant, or a day (`YYYY-MM-DD`).
    let opensOn: String?
    /// "in 56 days", "tomorrow"; nil leaves it out.
    let inDays: String?

    var body: some View {
        VStack(spacing: Spacing.s2) {
            Text("Do not open until Christmas")
                .font(.system(size: 22, design: .serif))
                .foregroundStyle(MailPaper.wax)
                .accessibilityAddTraits(.isHeader)
            Text(sentence)
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
    }

    /// "Juniper H. sealed this card. It opens on Christmas morning, Friday,
    /// December 25, in 56 days."
    private var sentence: String {
        let day = opensOn.map { HolidayCardWords.longDay($0) } ?? "December 25"
        let when = inDays.map { ", \($0)" } ?? ""
        return "\(from) sealed this card. It opens on Christmas morning, \(day)\(when)."
    }
}

/// The card rising out of its opened envelope the first time it's opened,
/// in about 0.7 s: it starts 38% down inside the envelope while the
/// envelope falls 55% away (shares of each one's own height). With `rises`
/// false the card simply shows. Look it over replays it for the sender.
struct HolidayCardRiseOut<Card: View>: View {
    /// The opened envelope it rises out of.
    let envelope: MailPieceModel
    let card: Card
    @State private var risen: Bool
    @State private var showsEnvelope: Bool

    init(envelope: MailPieceModel, rises: Bool, @ViewBuilder card: () -> Card) {
        self.envelope = envelope
        self.card = card()
        _risen = State(initialValue: !rises)
        _showsEnvelope = State(initialValue: rises)
    }

    var body: some View {
        let cardDrop: CGFloat = risen ? 0 : 0.38
        let envelopeDrop: CGFloat = risen ? 0.55 : 0
        ZStack(alignment: .bottom) {
            card
                .visualEffect { content, proxy in
                    content.offset(y: proxy.size.height * cardDrop)
                }
                .scaleEffect(risen ? 1 : 0.92)
                .opacity(risen ? 1 : 0)
            if showsEnvelope {
                // The opened envelope it rises out of, falling away.
                MailPieceView(model: envelope)
                    .visualEffect { content, proxy in
                        content.offset(y: proxy.size.height * envelopeDrop)
                    }
                    .opacity(risen ? 0 : 1)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
        .onAppear(perform: rise)
    }

    private func rise() {
        guard showsEnvelope, !risen else { return }
        withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.72)) { risen = true }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 760_000_000)
            showsEnvelope = false
        }
    }
}
