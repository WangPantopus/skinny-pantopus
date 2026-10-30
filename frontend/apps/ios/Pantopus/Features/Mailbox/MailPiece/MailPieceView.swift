//
//  MailPieceView.swift
//  Pantopus
//
//  A piece of mail drawn as the object it is (Mail tab drawings, boards
//  "MailPiece" and "Parts"): a cream envelope for a letter, a window envelope
//  for a bill or notice, a picture postcard, a booklet, a kraft parcel, a
//  bundle; special deliveries inside the striped border. Each carries a stamp
//  (people) or printed postage (verified senders and Pantopus), a postmark,
//  the return address and the address it came to. Sealed until opened; an
//  opened envelope shows its torn top and the letter peeking out. A Christmas
//  card comes in a red envelope (`HolidayCardEnvelopePiece`). The drawing
//  is an illustration with fixed type, like a photo of the piece; VoiceOver
//  reads it as one sentence.
//

import SwiftUI

struct MailPieceView: View {
    let model: MailPieceModel

    var body: some View {
        VStack(spacing: Spacing.s0) {
            if model.isOpened, model.kind.isEnvelope {
                Group {
                    if let card = model.card {
                        // An opened Christmas card: its picture peeks out.
                        HolidayCardPeek(design: card.design)
                    } else {
                        MailPeekSheet(line: model.peekLine)
                    }
                }
                .padding(.horizontal, Spacing.s5)
                .frame(height: 30)
                .padding(.bottom, -16)
                .zIndex(0)
            }
            object
                .zIndex(1)
        }
        .opacity(model.isFaded ? 0.6 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(model.accessibilityLabel)
    }

    @ViewBuilder
    private var object: some View {
        if model.card != nil {
            HolidayCardEnvelopePiece(model: model)
        } else if model.isSpecialDelivery, model.kind.isEnvelope {
            SpecialDeliveryPiece(model: model)
        } else {
            switch model.kind {
            case .letter: LetterPiece(model: model)
            case .bill, .notice: WindowEnvelopePiece(model: model)
            case .postcard: PostcardPiece(model: model)
            case .booklet: BookletPiece(model: model)
            case .parcel: ParcelPiece(model: model)
            case .bundle: BundlePiece(model: model)
            }
        }
    }
}

// MARK: - Letter

private struct LetterPiece: View {
    let model: MailPieceModel

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    // A long name takes a second line rather than losing its end.
                    Text(model.from).lineLimit(2)
                    if let line = model.fromLine { Text(line).lineLimit(1) }
                }
                .font(.system(size: 13, design: .serif).italic())
                .foregroundStyle(MailPaper.handInkSoft)
                .frame(maxWidth: geo.size.width * 0.48, alignment: .leading)
                .padding(.leading, Spacing.s4)
                .padding(.top, Spacing.s4)

                MailPostage(model: model)
                    .frame(maxWidth: .infinity, alignment: .topTrailing)
                    .padding(.trailing, 14)
                    .padding(.top, Spacing.s3)

                VStack(alignment: .leading, spacing: Spacing.s0) {
                    Text(model.to).lineLimit(1)
                    if let line = model.toLine { Text(line).lineLimit(1) }
                }
                .font(.system(size: 16, design: .serif).italic())
                .foregroundStyle(MailPaper.handInk)
                .minimumScaleFactor(0.8)
                .frame(width: geo.size.width * 0.58, alignment: .leading)
                .offset(x: geo.size.width * 0.38, y: 72)

                MailTrustLine(trust: model.trust)
                    .frame(maxHeight: .infinity, alignment: .bottomLeading)
                    .padding(.leading, Spacing.s4)
                    .padding(.bottom, Spacing.s3)
            }
        }
        .frame(height: 150)
        .mailPaper(MailPaper.letter, edge: MailPaper.letterEdge, radius: 6, torn: model.isOpened)
    }
}

// MARK: - Window envelope (bill, notice)

private struct WindowEnvelopePiece: View {
    let model: MailPieceModel

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                // Clear of the postmark and postage on a narrow piece (the
                // Counter on an iPhone SE).
                MailSenderBlock(model: model)
                    .frame(maxWidth: min(geo.size.width * 0.55, geo.size.width - 150), alignment: .leading)
                    .padding(.leading, Spacing.s4)
                    .padding(.top, 15)

                HStack(alignment: .top, spacing: Spacing.s2) {
                    MailPostmarkView(town: model.postmarkTown, date: model.postmarkDate, year: model.postmarkYear, waves: false)
                        .frame(width: 40, height: 40)
                        .opacity(0.6)
                    MailPostage(model: model)
                }
                .frame(maxWidth: .infinity, alignment: .topTrailing)
                .padding(.trailing, 14)
                .padding(.top, 14)

                VStack(alignment: .leading, spacing: Spacing.s0) {
                    Text(model.to).lineLimit(1)
                    if let line = model.toLine { Text(line).lineLimit(1).truncationMode(.tail) }
                }
                .font(.system(size: 10.5, design: .monospaced))
                .foregroundStyle(MailPaper.postalInk)
                .padding(.horizontal, 10)
                .frame(width: geo.size.width * 0.56, height: 50, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                        .fill(MailPaper.window)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                                .strokeBorder(MailPaper.windowEdge, lineWidth: 1)
                        )
                )
                .offset(x: Spacing.s4, y: 76)

                if let note = model.note {
                    Text(note)
                        .font(.system(size: 9.5, design: .monospaced))
                        .tracking(0.6)
                        .textCase(.uppercase)
                        .foregroundStyle(MailPaper.printSoft)
                        .multilineTextAlignment(.trailing)
                        .lineLimit(2)
                        .frame(maxWidth: geo.size.width * 0.34, alignment: .trailing)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                        .padding(.trailing, 14)
                        .padding(.bottom, 13)
                }
            }
        }
        .frame(height: 150)
        .mailPaper(MailPaper.envelope, edge: MailPaper.envelopeEdge, radius: 4, torn: model.isOpened)
    }
}

// MARK: - Special delivery

private struct SpecialDeliveryPiece: View {
    let model: MailPieceModel

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                Text("SPECIAL DELIVERY")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .tracking(1.2)
                    .foregroundStyle(MailPaper.warningInk)
                    .padding(.leading, Spacing.s3)
                    .padding(.top, 10)

                // One line for the name: two would run into the address on
                // a narrow piece (the Counter).
                MailSenderBlock(model: model, nameLines: 1)
                    .frame(maxWidth: geo.size.width * 0.58, alignment: .leading)
                    .padding(.leading, Spacing.s3)
                    .padding(.top, 28)

                MailPostage(model: model)
                    .frame(maxWidth: .infinity, alignment: .topTrailing)
                    .padding(.trailing, 10)
                    .padding(.top, 10)

                VStack(alignment: .leading, spacing: Spacing.s0) {
                    Text(model.to).lineLimit(1)
                    if let line = model.toLine { Text(line).lineLimit(1) }
                }
                .font(.system(size: 10.5, design: .monospaced))
                .foregroundStyle(MailPaper.postalInk)
                .frame(width: geo.size.width * 0.5, alignment: .leading)
                .offset(x: geo.size.width * 0.47, y: 84)
            }
        }
        .frame(height: 140)
        .background(MailPaper.special, in: RoundedRectangle(cornerRadius: 3, style: .continuous))
        .padding(5)
        .background(SpecialDeliveryStripes().clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)))
        .clipShape(TornTopEdge(torn: model.isOpened, radius: 6))
        .shadow(color: .black.opacity(0.08), radius: 9, x: 0, y: 6)
    }
}

// MARK: - Postcard

private struct PostcardPiece: View {
    let model: MailPieceModel

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(model.from)
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(0.6)
                        .textCase(.uppercase)
                        .foregroundStyle(MailPaper.pantopusInk)
                        .lineLimit(1)
                    if let note = model.note {
                        Text(note)
                            .font(.system(size: 13, design: .serif).italic())
                            .foregroundStyle(MailPaper.handInk)
                            .lineLimit(5)
                    }
                    Spacer(minLength: Spacing.s0)
                    MailTrustLine(trust: model.trust)
                }
                .frame(width: geo.size.width * 0.48, alignment: .leading)
                .padding(.leading, 14)
                .padding(.vertical, 13)

                Rectangle()
                    .fill(MailPaper.cardRule)
                    .frame(width: 1)
                    .padding(.vertical, 14)
                    .offset(x: geo.size.width * 0.55)

                MailPostage(model: model)
                    .frame(maxWidth: .infinity, alignment: .topTrailing)
                    .padding(.trailing, Spacing.s3)
                    .padding(.top, 10)

                VStack(alignment: .leading, spacing: Spacing.s0) {
                    ruledLine(model.to)
                    if let line = model.toLine { ruledLine(line) }
                }
                .frame(width: geo.size.width * 0.45 - 24, alignment: .leading)
                .offset(x: geo.size.width * 0.55 + 12, y: 78)
            }
        }
        .frame(height: 150)
        .mailPaper(MailPaper.card, edge: MailPaper.cardRule, radius: 4, torn: false)
    }

    private func ruledLine(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10, design: .monospaced))
            .foregroundStyle(MailPaper.postalInk)
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, 2)
            .overlay(alignment: .bottom) { Rectangle().fill(MailPaper.cardRule).frame(height: 1) }
    }
}

// MARK: - Booklet

private struct BookletPiece: View {
    let model: MailPieceModel

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                    .fill(MailPaper.bookletPageUnder)
                    .padding(.leading, 6)
                    .padding(.top, 6)
                RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                    .fill(MailPaper.bookletPage)
                    .padding(3)
                cover(width: geo.size.width - 6)
                    .padding(.trailing, 6)
                    .padding(.bottom, 6)
            }
        }
        .frame(height: 172)
        .shadow(color: .black.opacity(0.1), radius: 9, x: 0, y: 6)
    }

    private func cover(width: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            MailPaper.bookletCover
            HStack(spacing: Spacing.s2) {
                if model.trust == .pantopus {
                    PantopusMark(size: 22, variant: .reverse)
                }
                Text(model.from)
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.6)
                    .textCase(.uppercase)
                    .lineLimit(1)
            }
            .foregroundStyle(MailPaper.bookletSubtitle)
            .padding(.leading, 22)
            .padding(.top, Spacing.s4)

            if let note = model.note {
                Text(note)
                    .font(.system(size: 20, design: .serif))
                    .foregroundStyle(MailPaper.bookletTitle)
                    .lineLimit(3)
                    .minimumScaleFactor(0.8)
                    .frame(width: width * 0.52, alignment: .leading)
                    .padding(.leading, 22)
                    .padding(.top, 50)
            }

            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(model.to).lineLimit(1)
                if let line = model.toLine { Text(line).lineLimit(1) }
            }
            .font(.system(size: 9.5, design: .monospaced))
            .foregroundStyle(MailPaper.postalInk)
            .padding(.horizontal, 9)
            .padding(.vertical, 7)
            .frame(width: min(150, width * 0.42), alignment: .leading)
            .background(MailPaper.envelope, in: RoundedRectangle(cornerRadius: 3, style: .continuous))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            .padding(Spacing.s3)
        }
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
    }
}

// MARK: - Parcel

private struct ParcelPiece: View {
    let model: MailPieceModel

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                MailPaper.kraft
                MailPaper.tape
                    .frame(height: 26)
                    .offset(y: 66)
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    Text("FROM").foregroundStyle(MailPaper.printSoft)
                    Text(model.from).fontWeight(.bold).lineLimit(1)
                    Text("TO").foregroundStyle(MailPaper.printSoft).padding(.top, 5)
                    Text(model.to).fontWeight(.bold).lineLimit(1)
                    if let line = model.toLine { Text(line).lineLimit(1) }
                    MailBarcode()
                        .frame(height: 14)
                        .padding(.top, 6)
                }
                .font(.system(size: 9.5, design: .monospaced))
                .foregroundStyle(MailPaper.postalInk)
                .padding(.horizontal, 10)
                .padding(.vertical, Spacing.s2)
                .frame(width: geo.size.width * 0.58, height: geo.size.height - 28, alignment: .topLeading)
                .background(MailPaper.envelope, in: RoundedRectangle(cornerRadius: 3, style: .continuous))
                .padding(14)

                MailPostage(model: model)
                    .frame(maxWidth: .infinity, alignment: .topTrailing)
                    .padding(14)

                if let note = model.note {
                    Text(note)
                        .font(.system(size: 9.5, design: .monospaced))
                        .tracking(0.6)
                        .textCase(.uppercase)
                        .foregroundStyle(MailPaper.kraftInk)
                        .multilineTextAlignment(.trailing)
                        .lineLimit(3)
                        .frame(maxWidth: geo.size.width * 0.3, alignment: .trailing)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                        .padding(14)
                }
            }
        }
        .frame(height: 160)
        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
        .shadow(color: .black.opacity(0.14), radius: 11, x: 0, y: 8)
    }
}

// MARK: - Bundle

/// A bundle: envelopes banded together, with its label.
private struct BundlePiece: View {
    let model: MailPieceModel

    var body: some View {
        ZStack {
            // The pieces under the top one.
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(MailPaper.envelope)
                .overlay(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous).strokeBorder(MailPaper.envelopeEdge, lineWidth: 1))
                .rotationEffect(.degrees(-2.5))
                .padding(.horizontal, 10)
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(MailPaper.letter)
                .overlay(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous).strokeBorder(MailPaper.letterEdge, lineWidth: 1))
                .rotationEffect(.degrees(1.8))
                .padding(.horizontal, 6)
            VStack(alignment: .leading, spacing: Spacing.s0) {
                HStack(alignment: .top, spacing: Spacing.s2) {
                    MailSenderBlock(model: model)
                    Spacer(minLength: Spacing.s2)
                    MailPostage(model: model)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s4)
                Spacer(minLength: Spacing.s2)
                // The paper band holding the pieces together says what's inside.
                Text(model.note ?? "Bundle")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(MailPaper.kraftInk)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .padding(.horizontal, Spacing.s3)
                    .frame(maxWidth: .infinity)
                    .frame(height: 28)
                    .background(MailPaper.kraft)
                    .padding(.bottom, 22)
            }
            .frame(height: 150)
            .mailPaper(MailPaper.envelope, edge: MailPaper.envelopeEdge, radius: Radii.sm, torn: model.isOpened)
        }
        .frame(height: 150)
    }
}
