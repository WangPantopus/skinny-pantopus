//
//  HolidayCardRack.swift
//  Pantopus
//
//  Pick a card's pictures at full size, as if standing at the card rack (launch key `card_table`, plan Part 5):
//  one card at a time on its own cloth under the table's light, its caption in the pen (a verse card's whole verse
//  in the serif), swiped left and right through its collection. ✕ goes back to the grid with the last card seen
//  chosen; Write on this card goes on with it. On the open iPhone Duo the card has one page and the words the
//  other, except upright and flat, where it is one large card.
//

import SwiftUI
import UIKit

struct HolidayCardRack: View {
    let viewModel: HolidayCardFlowViewModel
    /// The collection's pictures in grid order (the one tapped, alone, when it's in none).
    let designs: [HolidayCardDesign]
    let collectionName: String?
    let year: Int

    @State private var shownId: String
    /// The cloth's colour, changed with a fade when another card shows.
    @State private var clothTable: String?
    @State private var art: CardTableArt?
    @ScaledMetric(relativeTo: .footnote) private var nameSize: CGFloat = 12.5
    /// Write on this card's height: the wax button's type doesn't scale, so neither does this.
    private let buttonRoom: CGFloat = 50

    init(viewModel: HolidayCardFlowViewModel, cards: HolidayCardsResponse, start: HolidayCardDesign) {
        self.viewModel = viewModel
        let collection = cards.collections.first { $0.designs.contains(start.id) }
        let list = collection.map { cards.designs(in: $0) } ?? cards.designs
        designs = list.contains { $0.id == start.id } ? list : [start]
        collectionName = collection?.name
        year = cards.year
        _shownId = State(initialValue: start.id)
        _clothTable = State(initialValue: start.table)
    }

    private var shown: HolidayCardDesign {
        designs.first { $0.id == shownId } ?? designs[0]
    }

    private var shownIndex: Int {
        designs.firstIndex { $0.id == shownId } ?? 0
    }

    /// Verse cards need room for the verse under the card; the rest for two lines in the pen. The same for every
    /// card in the collection, so the card stays put while they're swiped.
    private var wordsRoom: CGFloat {
        designs.contains { $0.verse?.isEmpty == false } ? 200 : 96
    }

    /// Room above (6) and below (30) the card for its shadow.
    private let shadowRoom: CGFloat = 36

    var body: some View {
        GeometryReader { geo in
            let insets = geo.safeAreaInsets
            let screen = CGSize(
                width: geo.size.width + insets.leading + insets.trailing,
                height: geo.size.height + insets.top + insets.bottom
            )
            let fold = CardTableFoldReader.fold(geo, insets: insets)
            ZStack(alignment: .topLeading) {
                CardTableClothBackdrop(art: art, table: clothTable)
                    .frame(width: screen.width, height: screen.height)
                switch fold {
                case let .sideways(hingeX, _):
                    sideways(screen: screen, insets: insets, hingeX: hingeX)
                case let .upright(hingeY, true):
                    tabletop(screen: screen, insets: insets, hingeY: hingeY)
                case .upright:
                    column(screen: screen, insets: insets, cap: 600)
                case .single:
                    column(screen: screen, insets: insets, cap: screen.width < 560 ? 470 : 560)
                }
            }
            .frame(width: screen.width, height: screen.height, alignment: .topLeading)
            .ignoresSafeArea()
        }
        .background(MailPaper.tableNight.ignoresSafeArea())
        .environment(\.colorScheme, .dark)
        .statusBarHidden(false)
        .task { art = await CardTableArt.load() }
        .task(id: shownId) { loadNeighboursAhead() }
        .onChange(of: shownId) { _, _ in
            withAnimation(.easeInOut(duration: 0.5)) { clothTable = shown.table }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sendCardLarge")
    }

    // MARK: Layouts

    /// A phone, the closed Duo and the open Duo upright and flat: the name, the card, its words, the button.
    private func column(screen: CGSize, insets: EdgeInsets, cap: CGFloat) -> some View {
        let width = screen.width - insets.leading - insets.trailing
        let top = insets.top + 10 + 40 + 6
        let bottom = buttonRoom + 12 + max(insets.bottom, 12) + 12
        // The words get what's left under the card, at least `wordsRoom`; the card stays put while it's swiped.
        let card = cardWidth(room: CGSize(width: width, height: screen.height - top - bottom - wordsRoom - shadowRoom), cap: cap)
        return VStack(spacing: 0) {
            topRow
                .padding(.top, insets.top + 10)
            pager(cardWidth: card)
                .padding(.top, 6)
            words
                .frame(maxHeight: .infinity)
            writeButton
                .padding(.top, 12)
                .padding(.bottom, max(insets.bottom, 12) + 12)
        }
        .padding(.horizontal, 16)
        .frame(width: width, height: screen.height)
        .offset(x: insets.leading)
    }

    /// Open sideways (flat or as a book): the card on the left page, its words and the button on the right.
    private func sideways(screen: CGSize, insets: EdgeInsets, hingeX: CGFloat) -> some View {
        let left = hingeX - insets.leading
        let top = insets.top + 10 + 40 + 14
        let card = cardWidth(room: CGSize(width: left, height: screen.height - top - shadowRoom - max(insets.bottom, 12)), cap: 560)
        return HStack(spacing: 0) {
            VStack(spacing: 0) {
                topRow
                    .padding(.top, insets.top + 10)
                Spacer(minLength: 10)
                pager(cardWidth: card)
                Spacer(minLength: max(insets.bottom, 12))
            }
            .padding(.horizontal, 16)
            .frame(width: left, height: screen.height)
            VStack(spacing: 20) {
                Spacer(minLength: insets.top + 10)
                words
                writeButton
                Spacer(minLength: max(insets.bottom, 12) + 12)
            }
            .padding(.horizontal, 24)
            .frame(width: screen.width - hingeX - insets.trailing, height: screen.height)
        }
        .offset(x: insets.leading)
    }

    /// Half closed and upright (tabletop): the card standing on the top page, its words and the button lying on the
    /// bottom one.
    private func tabletop(screen: CGSize, insets: EdgeInsets, hingeY: CGFloat) -> some View {
        let width = screen.width - insets.leading - insets.trailing
        let top = insets.top + 10 + 40 + 10
        let card = cardWidth(room: CGSize(width: width, height: hingeY - top - shadowRoom), cap: 560)
        return VStack(spacing: 0) {
            VStack(spacing: 0) {
                topRow
                    .padding(.top, insets.top + 10)
                Spacer(minLength: 6)
                pager(cardWidth: card)
                Spacer(minLength: 8)
            }
            .frame(height: hingeY)
            VStack(spacing: 16) {
                Spacer(minLength: 16)
                words
                writeButton
                Spacer(minLength: max(insets.bottom, 12) + 12)
            }
        }
        .padding(.horizontal, 16)
        .frame(width: width, height: screen.height)
        .offset(x: insets.leading)
    }

    /// As wide as the table's card (nearly the room's width, up to `cap`), shorter if the room is.
    private func cardWidth(room: CGSize, cap: CGFloat) -> CGFloat {
        let side: CGFloat = room.width < 560 ? 9 : 14
        return max(120, min(room.width - side * 2, cap, room.height * CardTableShape.aspect))
    }

    // MARK: Parts

    /// ✕ and the collection's name, with where this card is in it.
    private var topRow: some View {
        HStack(alignment: .center, spacing: 8) {
            CardTableRoundButton(icon: .x, label: "Back to the pictures", identifier: "sendCardLargeClose", action: close)
            VStack(spacing: 3) {
                if let collectionName {
                    // Capped, so at the largest text sizes the whole name still fits beside ✕.
                    Text(collectionName.uppercased())
                        .font(.system(size: min(nameSize, 20), weight: .medium, design: .serif))
                        .tracking(min(nameSize, 20) * 0.14)
                        .minimumScaleFactor(0.7)
                        .foregroundStyle(MailPaper.tableCreamSoft)
                        .accessibilityAddTraits(.isHeader)
                }
                if designs.count > 1 {
                    Text("\(shownIndex + 1) of \(designs.count)")
                        .font(.system(size: min(nameSize - 1, 18)))
                        .monospacedDigit()
                        .foregroundStyle(MailPaper.tableCreamFaint)
                        .accessibilityHidden(true)
                }
            }
            .multilineTextAlignment(.center)
            .lineLimit(2)
            .frame(maxWidth: .infinity)
            Color.clear.frame(width: 40, height: 40)
        }
    }

    /// The collection's cards, one at a time, swiped left and right. VoiceOver moves through them by swiping up
    /// and down on the card.
    private func pager(cardWidth: CGFloat) -> some View {
        TabView(selection: $shownId) {
            ForEach(designs) { design in
                HolidayCardRackCard(design: design, paperGrain: art?.paper, year: year, width: cardWidth)
                    .padding(.top, 6)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .tag(design.id)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .frame(height: cardWidth / CardTableShape.aspect + shadowRoom)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(shown.caption)
        .accessibilityValue(designs.count > 1 ? "\(shownIndex + 1) of \(designs.count)" : "")
        .accessibilityHint(designs.count > 1 ? "Swipe up or down for the next card." : "")
        .accessibilityAdjustableAction { direction in
            let next = direction == .increment ? shownIndex + 1 : shownIndex - 1
            guard designs.indices.contains(next) else { return }
            shownId = designs[next].id
        }
        .accessibilityIdentifier("sendCardLargeCard")
    }

    /// The caption in the pen, or a verse card's whole verse in the serif with its reference under it. Longer than
    /// the room (the largest text sizes), it scrolls.
    private var words: some View {
        ZStack {
            ViewThatFits(in: .vertical) {
                HolidayCardRackWords(design: shown)
                ScrollView { HolidayCardRackWords(design: shown) }
            }
            // At the largest sizes the pen and the verse stop growing at the first accessibility size, so more than
            // a word shows before it scrolls.
            .dynamicTypeSize(...DynamicTypeSize.accessibility1)
            .id(shownId)
            .transition(.opacity)
        }
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity)
        .animation(.easeInOut(duration: 0.3), value: shownId)
    }

    private var writeButton: some View {
        HolidayCardWaxButton(title: "Write on this card", action: write)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("sendCardLargeWrite")
    }

    // MARK: Actions

    /// Back to the grid with the last card seen chosen.
    private func close() {
        viewModel.designId = shownId
        viewModel.largeDesign = nil
    }

    private func write() {
        viewModel.designId = shownId
        viewModel.largeDesign = nil
        viewModel.toWrite()
    }

    /// The cards either side, so a swipe shows them at once.
    private func loadNeighboursAhead() {
        let near = [shownIndex - 1, shownIndex + 1].filter { designs.indices.contains($0) }.map { designs[$0].id }
        HolidayCardPicture.loadAhead([shownId] + near)
    }
}

/// One card in the rack: the table's card face, the picture large (its small copy until the large one loads).
private struct HolidayCardRackCard: View {
    let design: HolidayCardDesign
    let paperGrain: UIImage?
    let year: Int
    let width: CGFloat

    @State private var picture: UIImage?

    init(design: HolidayCardDesign, paperGrain: UIImage?, year: Int, width: CGFloat) {
        self.design = design
        self.paperGrain = paperGrain
        self.year = year
        self.width = width
        _picture = State(initialValue: HolidayCardPicture.image(design.id) ?? HolidayCardPicture.image(design.id, thumb: true))
    }

    var body: some View {
        CardTableFront(
            picture: picture,
            paperGrain: paperGrain,
            paper: design.paper,
            caption: design.caption,
            year: year,
            mailedOn: nil
        )
        .frame(width: width, height: width / CardTableShape.aspect)
        .compositingGroup()
        .shadow(color: .black.opacity(0.5), radius: 10, x: 0, y: 8)
        .task(id: design.id) {
            guard HolidayCardPicture.image(design.id) == nil else { return }
            if let large = await HolidayCardPicture.load(design.id) { picture = large }
        }
    }
}

/// Under the card: the caption in the pen; a verse's reference in the serif italic (plan 1.12); a verse card's whole
/// verse at 19 pt with its reference under it (plan 6.2).
private struct HolidayCardRackWords: View {
    let design: HolidayCardDesign

    @ScaledMetric(relativeTo: .title3) private var verseSize: CGFloat = 19
    @ScaledMetric(relativeTo: .title2) private var penSize: CGFloat = 28
    @ScaledMetric(relativeTo: .subheadline) private var referenceSize: CGFloat = 15

    var body: some View {
        VStack(spacing: 10) {
            if let verse = design.verse?.trimmingCharacters(in: .whitespacesAndNewlines), !verse.isEmpty {
                Text(verse)
                    .font(.system(size: verseSize, design: .serif))
                    .lineSpacing(verseSize * 0.22)
                    .foregroundStyle(MailPaper.tableCream)
                Text(design.caption)
                    .font(.system(size: referenceSize, design: .serif).italic())
                    .foregroundStyle(MailPaper.tableCreamSoft)
            } else if CardTableType.isVerseReference(design.caption) {
                Text(design.caption)
                    .font(.system(size: referenceSize + 4, design: .serif).italic())
                    .foregroundStyle(MailPaper.tableCream)
            } else {
                Text(design.caption)
                    .font(Font(CardTableType.pen(penSize)))
                    .foregroundStyle(MailPaper.tableCream)
            }
        }
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("sendCardLargeWords")
    }
}

/// The table's cloth in a card's colour, its window light, the vignette and the film grain, doing nothing. Used
/// where the mail isn't moving: the card rack and a link's page.
struct CardTableClothBackdrop: View {
    let art: CardTableArt?
    /// The card's table colour; nil is the default.
    let table: String?

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            ZStack(alignment: .topLeading) {
                MailPaper.tableNight
                if let art {
                    Image(uiImage: art.cloth)
                        .resizable()
                        .scaledToFill()
                        .frame(width: size.width + 28, height: size.height + 28)
                        .clipped()
                        .colorMultiply(MailPaper.tableTint(table))
                        .offset(x: -14, y: -14)
                        .id(table ?? "")
                        .transition(.opacity)
                    Image(uiImage: art.light)
                        .resizable()
                        .frame(width: size.width + 80, height: size.height + 80)
                        .offset(x: -40, y: -40)
                        .opacity(0.88)
                        .blendMode(.softLight)
                    CardTableVignette()
                        .frame(width: size.width, height: size.height)
                    Image(uiImage: art.grain)
                        .resizable(resizingMode: .tile)
                        .frame(width: size.width, height: size.height)
                        .opacity(0.36)
                        .blendMode(.overlay)
                }
            }
            .frame(width: size.width, height: size.height, alignment: .topLeading)
            .clipped()
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
