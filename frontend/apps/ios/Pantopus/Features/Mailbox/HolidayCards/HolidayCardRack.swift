//
//  HolidayCardRack.swift
//  Pantopus
//
//  Pick a card's pictures at full size, as if standing at the card rack (launch key `card_table`, plan Part 5):
//  one card at a time on its own cloth under the table's light, its caption in the pen (a verse card's whole verse
//  in the serif), swiped left and right through its collection. ✕ goes back to the grid with the last card seen
//  chosen; Write on this card goes on with it. On the open iPhone Duo the card has one page and the words the
//  other; upright and flat it's one large card, as on a phone (the fold reader says so).
//

// swiftlint:disable file_length

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
    /// The collection's tallest words under the card, measured at the column's width.
    @State private var wordsNeed: CGFloat?
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

    /// The room kept under the card for its words, the same for every card in the collection so the card stays put
    /// while they're swiped (card shelves E3: the card as large as the screen allows). What the collection's tallest
    /// words need at this width, never more than before (a verse 200, the pen 96). On a phone, less again where that
    /// lets the card reach 90% of the width with a line to spare, or a verse card 85% with room for its reference (the
    /// design session's answer of Nov 22: on a short screen the card wins, and the verse is read on the card).
    private func wordsRoom(height available: CGFloat, width: CGFloat) -> CGFloat {
        let verses = designs.contains { $0.verse?.isEmpty == false }
        var room = min((wordsNeed ?? .infinity) + 4, verses ? 200 : 96)
        if width < 560 {
            let share: CGFloat = verses ? 0.85 : 0.9
            let least: CGFloat = verses ? 36 : 44
            let beside = available - width * share / CardTableShape.aspect
            if beside >= least { room = min(room, beside) }
        }
        return room
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
                wordsMeasure(width: min(520, screen.width - insets.leading - insets.trailing - 32))
                switch fold {
                case let .sideways(hingeX, _):
                    sideways(screen: screen, insets: insets, hingeX: hingeX)
                case let .upright(hingeY, _):
                    tabletop(screen: screen, insets: insets, hingeY: hingeY)
                case .single:
                    if Self.liesBeside(screen) {
                        beside(screen: screen, insets: insets)
                    } else {
                        column(screen: screen, insets: insets, cap: Self.columnCap(width: screen.width))
                    }
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

    /// The collection's words, every card's at once and unseen, for the room the tallest needs.
    private func wordsMeasure(width: CGFloat) -> some View {
        ZStack {
            ForEach(designs) { HolidayCardRackWords(design: $0) }
        }
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
        .frame(width: max(1, width))
        .fixedSize(horizontal: false, vertical: true)
        .hidden()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { wordsNeed = $0 }
    }

    /// A phone, the closed Duo and the open Duo upright and flat: the name, the card, its words, the button. The card's
    /// page runs the screen's whole width, so the card can (card shelves E3).
    private func column(screen: CGSize, insets: EdgeInsets, cap: CGFloat) -> some View {
        let width = screen.width - insets.leading - insets.trailing
        let top = insets.top + 10 + 40 + 6
        let bottom = buttonRoom + 12 + max(insets.bottom, 12) + 12
        // The words get what's left under the card, at least their room; the card stays put while it's swiped.
        let available = screen.height - top - bottom - shadowRoom
        let underCard = wordsRoom(height: available, width: width)
        let card = cardWidth(room: CGSize(width: width, height: available - underCard), cap: cap)
        return VStack(spacing: 0) {
            topRow
                .padding(.horizontal, 16)
                .padding(.top, insets.top + 10)
            pager(cardWidth: card)
                .padding(.top, 6)
            words
                .padding(.horizontal, 16)
                .frame(maxHeight: .infinity)
            writeButton
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, max(insets.bottom, 12) + 12)
        }
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
                    .padding(.horizontal, 16)
                    .padding(.top, insets.top + 10)
                Spacer(minLength: 10)
                // The card's page runs the whole left page, so the card can (card shelves E3).
                pager(cardWidth: card)
                Spacer(minLength: max(insets.bottom, 12))
            }
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

    /// An iPad window held sideways (founder, 2026-11-23: "take advantage of the iPad screen"): the card as tall as the
    /// window lets it be on the left, its words and the button beside it on the right, under ✕ and the collection's
    /// name across the top. Upright, and in a narrow window, it's the phone's column.
    @MainActor
    static func liesBeside(_ screen: CGSize) -> Bool {
        WideLayout.isPad && screen.width >= 900 && screen.width >= screen.height * 1.15
    }

    /// The widest the card gets in the column: the table's (`CardTableLayout.cardCap`), and on a big upright iPad up to
    /// about three quarters of the window, 760 at most, so the card fills more of it.
    @MainActor
    static func columnCap(width: CGFloat) -> CGFloat {
        let table = CardTableLayout.cardCap(width: width)
        guard WideLayout.isPad else { return table }
        return max(table, min(760, (width * 0.74).rounded(.down)))
    }

    /// The card on the left 58% of an iPad window held sideways, the words and Write on this card on the rest.
    private func beside(screen: CGSize, insets: EdgeInsets) -> some View {
        let width = screen.width - insets.leading - insets.trailing
        let left = (width * 0.58).rounded(.down)
        let top = insets.top + 10 + 40 + 14
        let bottom = max(insets.bottom, 12) + 12
        let card = cardWidth(room: CGSize(width: left, height: screen.height - top - shadowRoom - bottom), cap: 760)
        return VStack(spacing: 0) {
            topRow
                .padding(.horizontal, 16)
                .padding(.top, insets.top + 10)
            HStack(spacing: 0) {
                // The card's page runs the whole left side, so the card can (card shelves E3).
                pager(cardWidth: card)
                    .frame(width: left)
                VStack(spacing: 20) {
                    Spacer(minLength: 0)
                    words
                    writeButton
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 32)
                .frame(width: width - left)
            }
            .padding(.top, 14)
            .frame(maxHeight: .infinity)
            .padding(.bottom, bottom)
        }
        .frame(width: width, height: screen.height)
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
            // Smaller before anything else, so the words show whole under a card that takes the screen (card shelves E3);
            // then a verse card shows only its reference (the verse is printed on the card), and nothing scrolls.
            ViewThatFits(in: .vertical) {
                HolidayCardRackWords(design: shown)
                HolidayCardRackWords(design: shown, scale: 0.82)
                HolidayCardRackWords(design: shown, scale: 0.68)
                if shown.verse?.isEmpty == false {
                    HolidayCardRackWords(design: shown, referenceOnly: true)
                } else {
                    ScrollView { HolidayCardRackWords(design: shown) }
                }
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
        HolidayCardWaxButton(title: viewModel.pickButtonTitle, action: write)
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
    @Environment(\.displayScale) private var displayScale

    init(design: HolidayCardDesign, paperGrain: UIImage?, year: Int, width: CGFloat) {
        self.design = design
        self.paperGrain = paperGrain
        self.year = year
        self.width = width
        let card = HolidayCardPicture.trimmedURL(design.id).flatMap { PantopusImagePipeline.shared.cachedImage(for: $0) }
        _picture = State(initialValue: card ?? HolidayCardPicture.image(design.id) ?? HolidayCardPicture.image(design.id, thumb: true))
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
            // Drawn wider than the 960 copy carries: the card's own picture (1214 wide), as the table has it (card
            // shelves E3); not in Low Data Mode.
            if width * displayScale > 960, !NetworkMonitor.shared.isLowData {
                if let card = await CardTablePicture.load(design.id) { picture = card }
                return
            }
            // Already at hand (the rack loads the cards either side ahead): draw it. Before, this returned without
            // drawing it, and a card swiped to quickly stayed blank paper.
            if let large = HolidayCardPicture.image(design.id) {
                picture = large
                return
            }
            if let large = await HolidayCardPicture.load(design.id) { picture = large }
        }
    }
}

/// Under the card: the caption in the pen; a verse's reference in the serif italic (plan 1.12); a verse card's whole
/// verse at 19 pt with its reference under it (plan 6.2).
private struct HolidayCardRackWords: View {
    let design: HolidayCardDesign
    /// Smaller where the room under the card is short.
    var scale: CGFloat = 1
    /// A verse card where even the smaller verse doesn't fit: its reference alone (VoiceOver still reads the verse).
    var referenceOnly = false

    @ScaledMetric(relativeTo: .title3) private var verseSize: CGFloat = 19
    @ScaledMetric(relativeTo: .title2) private var penSize: CGFloat = 28
    @ScaledMetric(relativeTo: .subheadline) private var referenceSize: CGFloat = 15

    var body: some View {
        VStack(spacing: 10) {
            if referenceOnly {
                Text(design.caption)
                    .font(.system(size: referenceSize + 4, design: .serif).italic())
                    .foregroundStyle(MailPaper.tableCream)
                    .accessibilityLabel("\(design.verse ?? "") \(design.caption)")
            } else if let verse = design.verse?.trimmingCharacters(in: .whitespacesAndNewlines), !verse.isEmpty {
                Text(verse)
                    .font(.system(size: verseSize * scale, design: .serif))
                    .lineSpacing(verseSize * scale * 0.22)
                    .foregroundStyle(MailPaper.tableCream)
                Text(design.caption)
                    .font(.system(size: referenceSize * scale, design: .serif).italic())
                    .foregroundStyle(MailPaper.tableCreamSoft)
            } else if CardTableType.isVerseReference(design.caption) {
                Text(design.caption)
                    .font(.system(size: (referenceSize + 4) * scale, design: .serif).italic())
                    .foregroundStyle(MailPaper.tableCream)
            } else {
                Text(design.caption)
                    .font(Font(CardTableType.pen(penSize * scale)))
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
