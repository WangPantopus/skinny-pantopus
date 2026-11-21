//
//  CardTableControls.swift
//  Pantopus
//
//  What sits around the mail (launch key `card_table`): ✕ top left, Share and ⋯
//  top right, the words at the top, and the button and hint at the bottom. They
//  follow large text; the card itself keeps its fixed type.
//

import SwiftUI

/// One line in the ⋯ menu, or one quiet button.
struct CardTableMenuItem: Identifiable {
    let title: String
    let identifier: String
    /// A quiet button's short words, when two with their full words don't fit side by side ("Write back").
    var short: String?
    /// What VoiceOver says, when it isn't the title ("Open the next card, 2 more waiting").
    var spoken: String?
    let action: () -> Void

    var id: String {
        identifier
    }
}

struct CardTableControls: View {
    let model: CardTableModel
    let menuItems: [CardTableMenuItem]
    /// Top and sides of the safe area, and how much the words and buttons take (measured by the screen).
    let safeArea: EdgeInsets
    let contentWidth: CGFloat
    /// The room the words at the top have above the buttons; at the largest sizes longer words scroll in it.
    var wordsMaxHeight: CGFloat = .infinity
    /// What ✕ says it does.
    let closeLabel: String
    let shareLabel: String
    let onClose: () -> Void
    /// Nil where there's nothing to share yet (Look it over).
    let onShare: (() -> Void)?

    @ScaledMetric(relativeTo: .title3) private var wordsSize: CGFloat = 18
    @ScaledMetric(relativeTo: .footnote) private var smallSize: CGFloat = 13.5
    @ScaledMetric(relativeTo: .subheadline) private var primarySize: CGFloat = 15
    @ScaledMetric(relativeTo: .caption) private var hintSize: CGFloat = 15
    @ScaledMetric(relativeTo: .footnote) private var toastSize: CGFloat = 13.5
    @ScaledMetric(relativeTo: .subheadline) private var menuSize: CGFloat = 14.5
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        ZStack(alignment: .topLeading) {
            topRow
            words
            bottom
            if model.menuOpen {
                menu
            }
            toast
            if let words = bookmarkWords {
                CardTableVerseBookmark(words: words, bottomInset: safeArea.bottom) {
                    model.bookmark = nil
                }
                .transition(.opacity)
                .zIndex(40)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: model.bookmark)
        .environment(\.colorScheme, .dark)
        .onChange(of: dynamicTypeSize, initial: true) { _, size in
            model.largerText = size > .large
        }
    }

    /// What the bookmark that's up holds.
    private var bookmarkWords: CardTableVerseBookmark.Words? {
        switch model.bookmark {
        case .verse:
            model.content.verse.map { .verse($0, reference: model.content.caption) }
        case .print:
            .print(note: model.content.note, from: model.content.firstName, mailedOn: model.content.mailedOn)
        case nil:
            nil
        }
    }

    // MARK: Top

    private var topRow: some View {
        HStack(spacing: 8) {
            CardTableRoundButton(icon: .x, label: closeLabel, identifier: "cardTableClose", action: onClose)
            Spacer(minLength: 0)
            if model.showsTopRight {
                if let onShare {
                    CardTableRoundButton(icon: .share, label: shareLabel, identifier: "cardTableShare", action: onShare)
                }
                // Nothing to put in it: a letter has no menu (plan Part 10).
                if !menuItems.isEmpty {
                    CardTableRoundButton(icon: .moreHorizontal, label: "More", identifier: "cardTableMore") {
                        model.menuOpen.toggle()
                    }
                }
            }
        }
        .padding(.top, safeArea.top + 10)
        .padding(.leading, max(12, safeArea.leading))
        .padding(.trailing, max(12, safeArea.trailing))
        .opacity(model.controlsHidden ? 0 : 1)
        .allowsHitTesting(!model.controlsHidden)
        .animation(.easeInOut(duration: 0.35), value: model.controlsHidden)
        .animation(.easeInOut(duration: 0.35), value: model.showsTopRight)
    }

    private var menu: some View {
        VStack(spacing: 0) {
            ForEach(menuItems) { item in
                Button {
                    model.menuOpen = false
                    item.action()
                } label: {
                    Text(item.title)
                        .font(.system(size: menuSize))
                        .foregroundStyle(MailPaper.tableCream)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, minHeight: 42, alignment: .leading)
                        .padding(.horizontal, 12)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier(item.identifier)
            }
        }
        .padding(6)
        .frame(width: 240)
        .background(MailPaper.tableMenu, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(MailPaper.tableGlassLine, lineWidth: 0.5))
        .shadow(color: .black.opacity(0.5), radius: 17, x: 0, y: 12)
        .frame(maxWidth: .infinity, alignment: .trailing)
        .padding(.top, safeArea.top + 58)
        .padding(.trailing, max(12, safeArea.trailing))
        .accessibilityIdentifier("cardTableMenu")
    }

    // MARK: Words

    private var words: some View {
        ViewThatFits(in: .vertical) {
            wordsText
            ScrollView { wordsText }
        }
        .frame(maxHeight: max(60, wordsMaxHeight), alignment: .top)
        .padding(.leading, 24)
        .padding(.top, safeArea.top + 54)
        .opacity(model.wordsShow ? 1 : 0)
        .animation(.easeInOut(duration: 0.4), value: model.wordsShow)
        // Only scrolling needs the finger (at the largest sizes); otherwise it passes through to the mail.
        .allowsHitTesting(dynamicTypeSize.isAccessibilitySize && model.wordsShow)
        .accessibilityHidden(model.words == nil)
        .accessibilityIdentifier("cardTableWords")
    }

    private var wordsText: some View {
        VStack(spacing: 7) {
            Text(model.words ?? " ")
                .font(.system(size: wordsSize, design: .serif).italic())
                .lineSpacing(wordsSize * 0.3 * 0.5)
            // A travelling card: how far it came (travelling card plan Part 3).
            if let small = model.wordsSmall {
                Text(small)
                    .font(.system(size: smallSize))
                    .lineSpacing(smallSize * 0.2)
                    .accessibilityIdentifier("cardTableCameLine")
            }
        }
        .multilineTextAlignment(.center)
        .foregroundStyle(MailPaper.tableCreamSoft)
        .shadow(color: .black.opacity(0.35), radius: 4, x: 0, y: 1)
        // At the largest sizes it can run over the mail, so it gets its own glass, as the hint does; so does
        // sealing's, which shows over the open flap.
        .padding(.horizontal, wordsOnGlass ? 12 : 0)
        .padding(.vertical, wordsOnGlass ? 6 : 0)
        .background {
            if wordsOnGlass, model.words != nil {
                CardTableGlass(shape: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
        .frame(width: max(0, contentWidth - 48))
        .fixedSize(horizontal: false, vertical: true)
    }

    private var wordsOnGlass: Bool {
        dynamicTypeSize.isAccessibilitySize || model.sending != nil
    }

    private var toast: some View {
        Text(model.toast ?? " ")
            .font(.system(size: toastSize))
            .multilineTextAlignment(.center)
            .foregroundStyle(MailPaper.tableCream)
            .padding(.vertical, 9)
            .padding(.horizontal, 15)
            .background(MailPaper.tableToast, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .frame(maxWidth: contentWidth * 0.86)
            .frame(width: contentWidth)
            .padding(.top, safeArea.top + 62)
            .opacity(model.toast == nil ? 0 : 1)
            .animation(.easeInOut(duration: 0.28), value: model.toast)
            .allowsHitTesting(false)
            .accessibilityHidden(model.toast == nil)
            .accessibilityIdentifier("cardTableToast")
    }

    // MARK: Bottom

    private var bottom: some View {
        CardTableAct(
            title: model.primaryTitle,
            spoken: model.primarySpoken,
            hint: model.hint,
            primarySize: primarySize,
            hintSize: hintSize,
            secondaries: model.secondaries,
            reservesSecondary: model.reservesSecondary || model.reservesNext,
            // Under a card: one row, two at most (the design check, Nov 17); after sealing, all three as before.
            oneRow: model.sending == nil,
            beside: model.printIsButton
                ? CardTableMenuItem(title: CardTableBookmark.print.title, identifier: CardTableBookmark.print.identifier) {
                    model.bookmark = .print
                }
                : nil,
            hintLink: model.hintLink.map { link in (link.identifier, { model.bookmark = link }) },
            // Over an enlarged card the hint needs its glass to read.
            hintOnGlass: model.isZoomed
        ) { model.primary() }
            .frame(width: max(0, contentWidth - 32))
            .padding(.leading, 16)
            .padding(.bottom, safeArea.bottom + 8)
            .frame(maxHeight: .infinity, alignment: .bottom)
            .opacity(model.step == .pulling || model.controlsHidden ? 0 : 1)
            .allowsHitTesting(model.step != .pulling && !model.controlsHidden)
            .animation(.easeInOut(duration: 0.35), value: model.step == .pulling || model.controlsHidden)
    }
}

/// The button and the hint under it.
struct CardTableAct: View {
    let title: String?
    /// What VoiceOver says for the main button, when it says more than its words ("Read on", plan Part 9).
    var spoken: String?
    let hint: String
    let primarySize: CGFloat
    let hintSize: CGFloat
    /// The quiet buttons under the main one, in order (Open the next card; Write back; Send {first name} a card; Share
    /// this card), or after sealing Take it back · Share this card · Send this card to someone else.
    var secondaries: [CardTableMenuItem] = []
    /// Keep its room while it's hidden, so the card doesn't move when it comes.
    var reservesSecondary = false
    /// Under a card (the design check, Nov 17): ONE row of at most two, side by side, never stacked. If the two don't
    /// fit with their full words they take their short ones; if those don't fit either (the largest text), only the
    /// first shows. The rest are in the ⋯ menu.
    var oneRow = false
    /// A second full button beside the main one ("Read it in print" with larger text, plan Part 2).
    var beside: CardTableMenuItem?
    /// The hint is a link ("Read the verse", plan 6.2; "Read it in print", plan Part 2): its identifier and action.
    var hintLink: (identifier: String, action: () -> Void)?
    var hintOnGlass = false
    let action: () -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(spacing: 6) {
            if let beside {
                // Side by side, or one under the other when they don't fit.
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 10) { mainButtons(beside) }
                    VStack(spacing: 8) { mainButtons(beside) }
                }
            } else {
                primaryButton
            }
            if let hintLink {
                // The link keeps the hint's height, so nothing moves; its finger area reaches 12 pt further.
                Button(action: hintLink.action) {
                    hintText
                        .underline(color: MailPaper.tableCream.opacity(0.45))
                        .padding(.vertical, 12)
                        .contentShape(Rectangle())
                        .padding(.vertical, -12)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier(hintLink.identifier)
            } else {
                hintText
                    .accessibilityHidden(hint.isEmpty)
                    .accessibilityIdentifier("cardTableHint")
            }
            // The quiet buttons sit under the hint, so the hint stays with the main button.
            if !secondaries.isEmpty || reservesSecondary {
                quietRow
                    .frame(minHeight: 44)
                    .opacity(secondaries.isEmpty ? 0 : 1)
                    .animation(.easeInOut(duration: 0.3), value: secondaries.isEmpty)
            }
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var quietRow: some View {
        if oneRow {
            let two = Array(secondaries.prefix(2))
            let first = Array(secondaries.prefix(1))
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 4) { quietButtons(two, short: false) }
                HStack(spacing: 4) { quietButtons(two, short: true) }
                HStack(spacing: 4) { quietButtons(first, short: false) }
                // Still one line at the largest sizes: the words may get a little smaller rather than wrap.
                HStack(spacing: 4) { quietButtons(first, short: true, fit: .shrinks) }
            }
        } else {
            // Side by side, or one under the other when they don't fit (the largest text).
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 4) { quietButtons(secondaries, short: false) }
                VStack(spacing: 0) { quietButtons(secondaries, short: false, fit: .wraps) }
            }
        }
    }
}

private extension CardTableAct {
    var primaryButton: some View {
        glassButton(title ?? " ", identifier: "cardTablePrimary", action: action)
            .accessibilityLabel(spoken ?? title ?? "")
            .opacity(title == nil ? 0 : 1)
            .disabled(title == nil)
            .accessibilityHidden(title == nil)
    }

    /// The main button and the one beside it; where there's no main button (the open Duo), the other alone.
    @ViewBuilder
    func mainButtons(_ beside: CardTableMenuItem) -> some View {
        if title != nil {
            primaryButton
        }
        glassButton(beside.title, identifier: beside.identifier, action: beside.action)
    }

    func glassButton(_ text: String, identifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: primarySize, weight: .semibold))
                .multilineTextAlignment(.center)
                .foregroundStyle(MailPaper.tableCream)
                .padding(.horizontal, 24)
                .padding(.vertical, 6)
                .frame(minHeight: 44)
                .background { CardTableGlass(shape: Capsule()) }
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    var onGlass: Bool {
        dynamicTypeSize.isAccessibilitySize || hintOnGlass
    }

    var hintText: some View {
        Text(hint.isEmpty ? " " : hint)
            .font(.system(size: hintSize))
            .multilineTextAlignment(.center)
            // 15 pt in white at 85%, so it reads on every cloth (plan 1.8, experience plan 8.2); a link in cream.
            .foregroundStyle(
                dynamicTypeSize.isAccessibilitySize || hintLink != nil ? MailPaper.tableCream : Color.white.opacity(0.85)
            )
            // At the largest sizes it runs over the mail, so it gets its own glass.
            .padding(.horizontal, onGlass && !hint.isEmpty ? 12 : 0)
            .padding(.vertical, hintOnGlass && !hint.isEmpty ? 4 : 0)
            .background {
                if onGlass, !hint.isEmpty {
                    CardTableGlass(shape: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
    }

    /// How a quiet button's words take the room: one line at their size (so the row can tell when they don't fit), one
    /// line a little smaller when nothing narrower is left, or wrapping (the column after sealing).
    enum QuietFit {
        case oneLine, shrinks, wraps
    }

    /// Quiet buttons with their full or short words. VoiceOver always hears the full words.
    func quietButtons(_ items: [CardTableMenuItem], short: Bool, fit: QuietFit = .oneLine) -> some View {
        ForEach(items) { item in
            Button(action: item.action) {
                Text(short ? item.short ?? item.title : item.title)
                    .font(.system(size: primarySize, weight: .medium))
                    .multilineTextAlignment(.center)
                    .lineLimit(fit == .wraps ? nil : 1)
                    .minimumScaleFactor(fit == .shrinks ? 0.7 : 1)
                    .fixedSize(horizontal: fit == .oneLine, vertical: true)
                    .foregroundStyle(MailPaper.tableCream)
                    .underline(color: MailPaper.tableCream.opacity(0.4))
                    .padding(.horizontal, 12)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(item.spoken ?? item.title)
            .accessibilityIdentifier(item.identifier)
        }
    }
}

/// The buttons' dark glass.
struct CardTableGlass<S: InsettableShape>: View {
    let shape: S

    var body: some View {
        shape
            .fill(.ultraThinMaterial)
            .overlay(shape.fill(MailPaper.tableGlass))
            .overlay(shape.strokeBorder(MailPaper.tableGlassLine, lineWidth: 0.5))
    }
}

/// A round glass button at the top.
struct CardTableRoundButton: View {
    let icon: PantopusIcon
    let label: String
    let identifier: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Icon(icon, size: 18, strokeWidth: 1.8, color: MailPaper.tableCream)
                .frame(width: 40, height: 40)
                .background { CardTableGlass(shape: Circle()) }
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(identifier)
    }
}
