//
//  CardTableVerseBookmark.swift
//  Pantopus
//
//  "Read the verse" (launch key `card_table`, plan 6.2): a cream bookmark with a red ribbon slides up over the table
//  with a Christmas with Jesus Christ card's whole verse in the serif at 19 pt and its reference under it. A tap
//  anywhere, Close, or the screen reader's escape puts it away.
//

import SwiftUI

struct CardTableVerseBookmark: View {
    let verse: String
    /// The card's caption, which for these cards is the verse's reference ("Luke 2:7 (KJV)").
    let reference: String
    /// The home indicator's room (the table draws under the safe area).
    let bottomInset: CGFloat
    let onClose: () -> Void

    @State private var shown = false
    @State private var wordsHeight: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .title3) private var verseSize: CGFloat = 19
    @ScaledMetric(relativeTo: .subheadline) private var referenceSize: CGFloat = 15
    @ScaledMetric(relativeTo: .subheadline) private var closeSize: CGFloat = 15

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                Color.black.opacity(0.4)
                    .ignoresSafeArea()
                    .onTapGesture(perform: onClose)
                    .accessibilityHidden(true)
                bookmark(maxHeight: geo.size.height * 0.78)
                    .offset(y: shown || reduceMotion ? 0 : geo.size.height * 0.6)
            }
        }
        .onAppear {
            withAnimation(reduceMotion ? nil : .spring(duration: 0.45, bounce: 0.12)) { shown = true }
        }
        .accessibilityAddTraits(.isModal)
        .accessibilityAction(.escape, onClose)
        .accessibilityIdentifier("cardTableVerse")
    }

    private func bookmark(maxHeight: CGFloat) -> some View {
        VStack(spacing: 18) {
            // As tall as the verse, up to the room there is; longer (the largest text sizes), it scrolls.
            ScrollView {
                words
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { wordsHeight = $0 }
            }
            .scrollBounceBehavior(.basedOnSize)
            .frame(height: min(max(wordsHeight, 1), max(120, maxHeight - 126 - bottomInset)))
            Button(action: onClose) {
                Text("Close")
                    .font(.system(size: closeSize, weight: .medium))
                    .foregroundStyle(MailPaper.tableSlipInk)
                    .underline(color: MailPaper.tableSlipLine.opacity(0.5))
                    .frame(minWidth: 88, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("cardTableVerseClose")
        }
        .padding(.top, 48)
        .padding(.horizontal, 28)
        .padding(.bottom, 16 + bottomInset)
        .frame(maxWidth: 560)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: 6, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 6)
                .fill(MailPaper.tableSlip)
                .shadow(color: .black.opacity(0.45), radius: 18, x: 0, y: -4)
                .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .topTrailing) {
            CardTableRibbon()
                .fill(MailPaper.tableWax)
                .frame(width: 20, height: 46)
                .shadow(color: .black.opacity(0.25), radius: 2, x: 0, y: 1)
                .offset(y: -8)
                .padding(.trailing, 30)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 12)
    }

    private var words: some View {
        VStack(spacing: 12) {
            Text(verse)
                .font(.system(size: verseSize, design: .serif))
                .lineSpacing(verseSize * 0.28)
                .foregroundStyle(MailPaper.tableSlipInk)
            Text(reference)
                .font(.system(size: referenceSize, design: .serif).italic())
                .foregroundStyle(MailPaper.tableFoot)
        }
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("cardTableVerseWords")
    }
}

/// A ribbon hanging from the bookmark's top edge, cut in a V at its end.
private struct CardTableRibbon: Shape {
    func path(in rect: CGRect) -> Path {
        Path { path in
            path.move(to: CGPoint(x: rect.minX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY - rect.width * 0.45))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.closeSubpath()
        }
    }
}
