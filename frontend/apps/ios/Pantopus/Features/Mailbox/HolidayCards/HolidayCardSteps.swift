//
//  HolidayCardSteps.swift
//  Pantopus
//
//  The first three steps of sending a Christmas card (the web's
//  `SendCardFlow`): who it's for (a person by name, or an email address for
//  someone not on Pantopus), pick one of the season's pictures from its
//  collection, and write a note on the back of it.
//

// swiftlint:disable file_length

import SwiftUI
import UIKit

/// The desk the card flow sits on: cream by day, the app's own background in
/// dark mode, with words to match. The cream fields, rows and cards keep
/// their dark ink either way.
enum HolidayCardDesk {
    static func background(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Theme.Color.appBg : MailPaper.cardDesk
    }

    static func text(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Theme.Color.appText : MailPaper.cardText
    }

    static func muted(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Theme.Color.appTextSecondary : MailPaper.cardTextMuted
    }

    /// Body words a shade darker than `muted`.
    static func soft(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Theme.Color.appTextSecondary : MailPaper.cardTextSoft
    }

    /// The small section headings and the soft links.
    static func label(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Theme.Color.appTextSecondary : MailPaper.cardLabel
    }

    static func link(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Theme.Color.appText : MailPaper.cardLink
    }

    /// Why something didn't go: the wax-red warning ink, lighter in dark mode.
    static func error(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Theme.Color.error : MailPaper.warningInk
    }

    /// Words in wax red on the desk (the card shelves' "All 15 ›"): lighter in dark mode, like `error`.
    static func wax(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Theme.Color.error : MailPaper.wax
    }
}

// MARK: - Step 1: who it's for

struct HolidayCardToStep: View {
    @Bindable var viewModel: HolidayCardFlowViewModel
    @Environment(\.colorScheme) private var scheme
    @FocusState private var focused: Bool
    /// The system contact picker is up (plan 11.7).
    @State private var pickingContact = false

    var body: some View {
        Group {
            if viewModel.byLink, viewModel.improved {
                byLink
            } else if viewModel.byEmail {
                byEmail
            } else {
                byName
            }
        }
        .sheet(isPresented: $pickingContact) {
            ContactPickerSheet(
                onPicked: { contact in
                    if let email = contact.email { viewModel.email = email }
                    pickingContact = false
                },
                onCancel: { pickingContact = false }
            )
            .ignoresSafeArea()
        }
    }

    /// Under the search: with `improved` they can read it before joining (Wave 1).
    private var joinLine: String {
        viewModel.improved
            ? "They don’t need Pantopus. They can open and read it right away."
            : "They don’t need Pantopus yet. They join to open it."
    }

    /// One card can go to a list (digital stamps on): people and addresses are added, then "Continue".
    private var many: Bool {
        viewModel.maxRecipients > 1
    }

    private var byName: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if viewModel.improved, let design = viewModel.design {
                chosenCard(design)
            }
            if many {
                HolidayCardListChips(viewModel: viewModel)
            }
            HStack(spacing: 10) {
                Icon(.search, size: 20, color: MailPaper.cardTextMuted)
                    .allowsHitTesting(false)
                TextField("", text: $viewModel.query, prompt: Text("Search by name").foregroundStyle(MailPaper.cardTextMuted))
                    .font(.system(size: 16))
                    .foregroundStyle(MailPaper.cardText)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .focused($focused)
                    .accessibilityLabel("Search by name")
                    .accessibilityIdentifier("sendCardSearch")
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 48)
            .typesInFieldOnTap($focused)
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(focused ? MailPaper.wax : MailPaper.cardFieldEdge, lineWidth: 1)
            )
            results
            if LaunchFeatures.cardTable {
                // Plan 11.6: the invitation is already here. With `improved` they can read it before joining (Wave 1).
                Text(joinLine)
                    .font(.system(size: 14))
                    .foregroundStyle(HolidayCardDesk.muted(scheme))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity)
                    .padding(.top, Spacing.s3)
                    .accessibilityIdentifier("sendCardJoinToOpen")
            }
            Button {
                focused = false
                viewModel.byEmail = true
            } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.mail, size: 18, color: MailPaper.wax)
                    Text(many ? "Not on Pantopus? Add their email" : "Not on Pantopus? Send it to their email")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(MailPaper.wax)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(many && viewModel.listIsFull)
            .padding(.top, Spacing.s2)
            .accessibilityIdentifier("sendCardByEmail")
            // A link is one card for whoever opens it: not with a list.
            if LaunchFeatures.cardTable, viewModel.listed.isEmpty {
                Button {
                    focused = false
                    // With `improved`, the name on its envelope is asked first (cards-next 3.2).
                    if viewModel.improved { viewModel.byLink = true } else { viewModel.choose(.link) }
                } label: {
                    VStack(spacing: 2) {
                        HStack(spacing: Spacing.s2) {
                            Icon(.link, size: 18, color: MailPaper.wax)
                            Text("Send it by link.")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(MailPaper.wax)
                        }
                        Text("Text it, or paste it anywhere. The first person to open it keeps the card.")
                            .font(.system(size: 13))
                            .foregroundStyle(HolidayCardDesk.muted(scheme))
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isButton)
                .accessibilityIdentifier("sendCardByLink")
            }
        }
        .task {
            // Ready to type, as on the web.
            try? await Task.sleep(nanoseconds: 350_000_000)
            focused = true
        }
    }

    @ViewBuilder
    private var results: some View {
        switch viewModel.search {
        case .idle:
            hint("Type two letters or more of their name.")
        case .looking:
            HStack(spacing: Spacing.s2) {
                ProgressView().controlSize(.small)
                Text("Looking…")
            }
            .font(.system(size: 14))
            .foregroundStyle(HolidayCardDesk.muted(scheme))
            .padding(.horizontal, Spacing.s1)
            .accessibilityElement(children: .combine)
        case let .failed(message):
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(MailPaper.warningInk)
                .padding(.horizontal, Spacing.s1)
                .fixedSize(horizontal: false, vertical: true)
        case let .found(people) where people.isEmpty:
            hint("No one by that name. Check the spelling, or send it to their email.")
        case let .found(people):
            VStack(spacing: Spacing.s0) {
                ForEach(Array(people.enumerated()), id: \.element.id) { index, person in
                    if index > 0 { Rectangle().fill(MailPaper.cardRowLine).frame(height: 1) }
                    personRow(person)
                }
            }
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardRowEdge, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
    }

    private func hint(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14))
            .foregroundStyle(HolidayCardDesk.muted(scheme))
            .padding(.horizontal, Spacing.s1)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func personRow(_ person: MailRecipientDTO) -> some View {
        let name = MailPieceModel.firstText(person.name, MadeUpUsername.handle(person.username)) ?? "Pantopus member"
        let line = [MadeUpUsername.handle(person.username), MailPieceModel.firstText(person.homeAddress)]
            .compactMap(\.self)
            .joined(separator: " · ")
        let entry = HolidayCardRecipient.person(userId: person.userId, name: name)
        let listed = many && viewModel.isListed(entry)
        return Button {
            guard many else {
                focused = false
                viewModel.choose(entry)
                return
            }
            viewModel.toggle(entry)
        } label: {
            HStack(spacing: Spacing.s3) {
                Text(String(name.prefix(1)).uppercased())
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MailPaper.cardAvatarInk)
                    .frame(width: 36, height: 36)
                    .background(MailPaper.cardAvatar, in: Circle())
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text(name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(MailPaper.cardText)
                    if !line.isEmpty {
                        Text(line)
                            .font(.system(size: 13))
                            .foregroundStyle(MailPaper.cardTextMuted)
                    }
                }
                .lineLimit(1)
                Spacer(minLength: Spacing.s0)
                if listed {
                    Icon(.check, size: 13, strokeWidth: 3, color: MailPaper.waxText)
                        .frame(width: 24, height: 24)
                        .background(MailPaper.wax, in: Circle())
                        .accessibilityHidden(true)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(many && viewModel.listIsFull && !listed)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(listed ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("sendCardPerson.\(person.userId)")
    }

    private var byEmail: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if viewModel.improved, let design = viewModel.design {
                chosenCard(design)
                    .padding(.bottom, Spacing.s2)
            }
            if many {
                HolidayCardListChips(viewModel: viewModel)
                    .padding(.bottom, Spacing.s2)
            }
            HStack(alignment: .firstTextBaseline) {
                Text("Their email address")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(HolidayCardDesk.text(scheme))
                Spacer(minLength: Spacing.s2)
                if LaunchFeatures.cardTable {
                    // Plan 11.7: the phone's own contact picker; the app never reads the address book, asks for no
                    // permission and keeps nothing of the contact.
                    Button {
                        focused = false
                        pickingContact = true
                    } label: {
                        Text("Choose from contacts")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(MailPaper.wax)
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("sendCardChooseContact")
                }
            }
            TextField("", text: $viewModel.email, prompt: Text(verbatim: "name@example.com").foregroundStyle(MailPaper.cardTextMuted))
                .font(.system(size: 16))
                .foregroundStyle(MailPaper.cardText)
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focused)
                .padding(.horizontal, Spacing.s4)
                .frame(minHeight: 48)
                .typesInFieldOnTap($focused)
                .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .strokeBorder(focused ? MailPaper.wax : MailPaper.cardFieldEdge, lineWidth: 1)
                )
                .accessibilityLabel("Their email address")
                .accessibilityIdentifier("sendCardEmail")
            Text(
                "They get an email saying you sent them a Christmas card. They join Pantopus with this address to open it. "
                    + "The email never shows your note."
            )
            .font(.system(size: 14))
            .foregroundStyle(HolidayCardDesk.muted(scheme))
            .fixedSize(horizontal: false, vertical: true)
            HolidayCardWaxButton(
                title: many ? "Add to the list" : "Continue",
                isEnabled: viewModel.emailIsValid && !(many && viewModel.listIsFull)
            ) {
                focused = false
                if many { viewModel.addEmail() } else { viewModel.chooseEmail() }
            }
            .padding(.top, Spacing.s3)
            .accessibilityIdentifier("sendCardEmailContinue")
            HolidayCardPaperButton(title: many ? "Back to search" : "Search Pantopus instead", fullWidth: true) {
                viewModel.byEmail = false
            }
            .padding(.top, 2)
            .accessibilityIdentifier("sendCardSearchInstead")
        }
        .task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            focused = true
        }
    }
}

// MARK: - Who it's for with `improved` (cards-next 3.1, 3.2)

extension HolidayCardToStep {
    /// The card already picked, small, with its caption and "Change" (back to Pick a card).
    func chosenCard(_ design: HolidayCardDesign) -> some View {
        HStack(spacing: Spacing.s3) {
            HolidayCardPictureView(design: design.id, paper: design.paper, height: design.height, thumb: true)
                .frame(width: 40)
                .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))
                .shadow(color: MailPaper.cardShadow.opacity(0.22), radius: 3, x: 0, y: 2)
                .accessibilityHidden(true)
            Text(design.caption)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(HolidayCardDesk.text(scheme))
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityLabel("Your card: \(design.caption)")
            Button {
                focused = false
                viewModel.changeCard()
            } label: {
                Text("Change")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(MailPaper.wax)
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Change the card")
            .accessibilityIdentifier("sendCardChangeCard")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sendCardChosenCard")
    }

    /// "Send it by link" with `improved`: an optional name for the envelope, as the email form is laid out.
    var byLink: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if let design = viewModel.design {
                chosenCard(design)
                    .padding(.bottom, Spacing.s2)
            }
            Text("Name on the envelope (optional)")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(HolidayCardDesk.text(scheme))
            TextField(
                "",
                text: $viewModel.linkName,
                prompt: Text("e.g. Mom, Aunt Lin, The Patel family").foregroundStyle(MailPaper.cardTextMuted)
            )
            .font(.system(size: 16))
            .foregroundStyle(MailPaper.cardText)
            .textInputAutocapitalization(.words)
            .autocorrectionDisabled()
            .submitLabel(.done)
            .focused($focused)
            .onChange(of: viewModel.linkName) { _, name in
                if name.count > HolidayCardFlowViewModel.linkNameLimit {
                    viewModel.linkName = String(name.prefix(HolidayCardFlowViewModel.linkNameLimit))
                }
            }
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 48)
            .typesInFieldOnTap($focused)
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(focused ? MailPaper.wax : MailPaper.cardFieldEdge, lineWidth: 1)
            )
            .accessibilityLabel("Name on the envelope, optional")
            .accessibilityIdentifier("sendCardLinkName")
            Text("Written in ink on the front of the envelope. Leave blank if you’d rather keep it unnamed.")
                .font(.system(size: 14))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .fixedSize(horizontal: false, vertical: true)
            Text(
                "Anyone with the link can open and read your card right away — no account needed. The first person "
                    + "to save it to a mailbox keeps it."
            )
            .font(.system(size: 14))
            .foregroundStyle(HolidayCardDesk.muted(scheme))
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, Spacing.s2)
            HolidayCardWaxButton(title: "Continue") {
                focused = false
                viewModel.chooseLink()
            }
            .padding(.top, Spacing.s3)
            .accessibilityIdentifier("sendCardLinkContinue")
            HolidayCardPaperButton(title: "Search Pantopus instead", fullWidth: true) {
                viewModel.byLink = false
            }
            .padding(.top, 2)
            .accessibilityIdentifier("sendCardLinkSearchInstead")
        }
        .task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            focused = true
        }
    }
}

// MARK: - Step 2: pick a card

struct HolidayCardPickStep: View {
    @Bindable var viewModel: HolidayCardFlowViewModel
    let cards: HolidayCardsResponse
    /// The collection picked in the row; until then the one holding the card
    /// already chosen (back from step 3), else the first.
    @State private var collectionId: String?
    /// The grid's width, for how many go across on an iPad page.
    @State private var gridWidth: CGFloat = 0
    @Environment(\.colorScheme) private var scheme
    /// A page across an iPad window: the grid takes as many across as the shelves would, each in the same frame.
    @Environment(\.holidayCardWidePage) private var widePage

    /// Two across (about 177 pt each on an iPhone 17), so every caption gets two full lines. On an iPad page, as many
    /// as fit at a shelf card's width, with the page's gap.
    private var columns: [GridItem] {
        guard widePage else {
            return Array(repeating: GridItem(.flexible(), spacing: Spacing.s3, alignment: .top), count: 2)
        }
        let across = HolidayCardShelfSizes.padAcross(column: gridWidth)
        return Array(repeating: GridItem(.flexible(), spacing: HolidayCardPad.gap, alignment: .top), count: across)
    }

    var body: some View {
        if cards.showsShelves {
            // The card shelves (server switch `card_shelves`): the opening row, then a shelf per collection.
            HolidayCardShelves(viewModel: viewModel, cards: cards)
        } else {
            collectionGrid
        }
    }

    /// One collection at a time behind a row of names, as before the card shelves.
    @ViewBuilder
    private var collectionGrid: some View {
        let collections = cards.pickableCollections
        let shown = collections.first { $0.id == collectionId }
            ?? viewModel.designId.flatMap { id in collections.first { $0.designs.contains(id) } }
            ?? collections.first
        // A server without collections: one grid of every picture, as before.
        let designs = shown.map { cards.designs(in: $0) } ?? cards.designs
        // "Write on this card" and "See it larger" are pinned under the page (`HolidayCardPickBar`).
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if let shown {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    HolidayCardCollectionRow(collections: collections, shown: shown) { collectionId = $0.id }
                    if !shown.line.isEmpty {
                        Text(shown.line)
                            .font(.system(size: 14))
                            .foregroundStyle(HolidayCardDesk.muted(scheme))
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("sendCardCollectionLine")
                    }
                }
            }
            grid(designs, label: shown?.name)
        }
        // The collection's small pictures, and the chosen card's large one, before they're needed.
        .task(id: shown?.id) { HolidayCardPicture.loadAhead(designs.map(\.id), thumb: true) }
        .task(id: viewModel.designId) {
            if let chosen = viewModel.designId { HolidayCardPicture.loadAhead([chosen]) }
        }
    }

    /// The pictures two across, a caption under each. VoiceOver names the
    /// grid after its collection.
    @ViewBuilder
    private func grid(_ designs: [HolidayCardDesign], label: String?) -> some View {
        let grid = LazyVGrid(columns: columns, spacing: widePage ? Spacing.s6 : Spacing.s4) {
            ForEach(designs) { design in
                tile(design)
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { gridWidth = $0 }
        if let label {
            grid
                .accessibilityElement(children: .contain)
                .accessibilityLabel(label)
        } else {
            grid
        }
    }

    private func tile(_ design: HolidayCardDesign) -> some View {
        let selected = design.id == viewModel.designId
        // Every picture opens large first, at the card rack (plan Part 5); ✕ there chooses the last one seen.
        return Button {
            viewModel.largeDesign = design
        } label: {
            HolidayCardTile(
                design: design,
                selected: selected,
                reservesTwoLines: widePage,
                frameAspect: widePage ? HolidayCardPad.frameAspect : nil
            )
            .padding(Spacing.s1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(design.caption)
        .accessibilityHint("Shows it large.")
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("sendCardDesign.\(design.id)")
    }
}

/// A picture as Pick a card draws it: on its own paper with a soft shadow, the wax-red edge and tick when it's the one
/// chosen, and its caption under it. The grid's tile, and the card shelves' (`HolidayCardShelves`).
struct HolidayCardTile: View {
    let design: HolidayCardDesign
    let selected: Bool
    /// The opening row's large cards: the picture itself once it's at hand, over its smaller copy.
    var sharp = false
    /// The opening row's caption: darker and heavier than a tile's.
    var strongCaption = false
    /// A shelf's row keeps two lines for every caption, so it doesn't grow as its cards come in.
    var reservesTwoLines = false
    /// A shelf not near yet: its paper, of the picture's shape, until it comes near.
    var loads = true
    /// The card shelves: the card rack grows out of this picture (iOS 18 and later; `ItemZoomTransition`).
    var zoomID: String?
    /// Pick a card as a page across an iPad window: the frame (width over height) every card in its rows and grids
    /// stands in, on the card's own paper, so the cards are one size and their captions level. Nil draws the picture
    /// at its own shape, as on a phone.
    var frameAspect: CGFloat?
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(spacing: 6) {
            zoomSource(framed)
                .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
                .overlay {
                    if selected {
                        RoundedRectangle(cornerRadius: 3, style: .continuous).strokeBorder(MailPaper.wax, lineWidth: 3)
                    }
                }
                .overlay(alignment: .topTrailing) {
                    if selected {
                        Icon(.check, size: 14, strokeWidth: 3, color: MailPaper.waxText)
                            .frame(width: 24, height: 24)
                            .background(MailPaper.wax, in: Circle())
                            .padding(6)
                    }
                }
                .shadow(color: MailPaper.cardShadow.opacity(selected ? 0.25 : 0.22), radius: selected ? 7 : 5, x: 0, y: 4)
            Text(design.caption)
                .font(.system(size: 13, weight: strongCaption ? .semibold : .medium))
                .foregroundStyle(captionInk)
                .multilineTextAlignment(.center)
                .lineLimit(2, reservesSpace: reservesTwoLines)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// The picture, fitted in the page's frame on its paper where it has one.
    @ViewBuilder
    private var framed: some View {
        if let frameAspect {
            MailPaper.cardPaper(design.paper)
                .aspectRatio(frameAspect, contentMode: .fit)
                .overlay { picture.clipped() }
        } else {
            picture
        }
    }

    @ViewBuilder
    private func zoomSource(_ picture: some View) -> some View {
        if let zoomID {
            picture.itemZoomSource(.card, id: zoomID)
        } else {
            picture
        }
    }

    private var captionInk: Color {
        if strongCaption { return HolidayCardDesk.text(scheme) }
        return scheme == .dark ? Theme.Color.appTextSecondary : MailPaper.cardTextSoft
    }

    @ViewBuilder
    private var picture: some View {
        let thumb = HolidayCardPictureView(design: design.id, paper: design.paper, height: design.height, thumb: true)
        if !loads {
            MailPaper.cardPaper(design.paper)
                .aspectRatio(HolidayCardPicture.aspect(height: design.height), contentMode: .fit)
        } else if sharp, !NetworkMonitor.shared.isLowData {
            // The smaller copy first (it's what loads fastest), then the picture over it once it's here.
            thumb.overlay {
                HolidayCardPictureImage(design: design.id) { image in
                    if let image {
                        Image(uiImage: image).resizable().aspectRatio(contentMode: .fill)
                    }
                }
                .accessibilityHidden(true)
            }
        } else {
            thumb
        }
    }
}

// MARK: - Step 2's bar, pinned above the bottom edge

/// The chosen picture's thumbnail and caption, "See it larger", and "Write on
/// this card" (greyed until a picture is chosen), pinned under Pick a card so
/// the main button is never at the end of the scrolling grid.
struct HolidayCardPickBar: View {
    @Bindable var viewModel: HolidayCardFlowViewModel
    let cards: HolidayCardsResponse
    /// The bar presents the card rack; the card shelves present it themselves (the bar shows only once a card is
    /// chosen there).
    var presentsRack = true
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: Spacing.s3) {
                if let picked = viewModel.design {
                    Button { viewModel.largeDesign = picked } label: {
                        HolidayCardPictureView(design: picked.id, paper: picked.paper, height: picked.height, thumb: true)
                            .frame(width: 40)
                            .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))
                            .shadow(color: MailPaper.cardShadow.opacity(0.22), radius: 3, x: 0, y: 2)
                    }
                    .buttonStyle(.plain)
                    .accessibilityHidden(true)
                    Text(picked.caption)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(HolidayCardDesk.text(scheme))
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityLabel("Chosen: \(picked.caption)")
                        .accessibilityIdentifier("sendCardPickedCaption")
                    HolidayCardPaperButton(title: "See it larger") { viewModel.largeDesign = picked }
                        .fixedSize()
                        .accessibilityIdentifier("sendCardSeeLarger")
                } else {
                    Text("Tap a picture to choose it.")
                        .font(.system(size: 14))
                        .foregroundStyle(HolidayCardDesk.muted(scheme))
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                }
            }
            HolidayCardWaxButton(title: viewModel.pickButtonTitle, isEnabled: viewModel.design != nil) { viewModel.toWrite() }
                .accessibilityIdentifier("sendCardWriteOn")
        }
        .frame(maxWidth: 560)
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity)
        // Out into the side margins too (the closed iPhone Duo's strip): the card shelves' rows run there, and would
        // show beside the bar. The same desk either way.
        .background(HolidayCardDesk.background(scheme).ignoresSafeArea(edges: [.bottom, .horizontal]))
        .overlay(alignment: .top) {
            Rectangle().fill(MailPaper.cardRowLine).frame(height: 1)
        }
        .modifier(HolidayCardRackCover(viewModel: viewModel, cards: cards, isOn: presentsRack))
    }
}

/// The card rack over Pick a card: the pictures at full size on the table's cloth (plan Part 5).
private struct HolidayCardRackCover: ViewModifier {
    @Bindable var viewModel: HolidayCardFlowViewModel
    let cards: HolidayCardsResponse
    let isOn: Bool

    func body(content: Content) -> some View {
        if isOn {
            content.fullScreenCover(item: $viewModel.largeDesign) { design in
                HolidayCardRack(viewModel: viewModel, cards: cards, start: design)
            }
        } else {
            content
        }
    }
}

extension HolidayCardsResponse {
    /// A collection's pictures in its grid order.
    func designs(in collection: HolidayCardCollection) -> [HolidayCardDesign] {
        collection.designs.compactMap { id in designs.first { $0.id == id } }
    }
}

// MARK: - Step 3: write on the back

struct HolidayCardWriteStep: View {
    @Bindable var viewModel: HolidayCardFlowViewModel
    let cards: HolidayCardsResponse
    let design: HolidayCardDesign
    @State private var showBack = true
    /// The pad for signing beside FROM is up (plan 8.2).
    @State private var signing = false
    /// The "Help me write it" sheet is up.
    @State private var helping = false
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let count = viewModel.letterCount
        let empty = viewModel.message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        Group {
            if WideLayout.isPad {
                // On an iPad window wide enough the card is written in one column with everything done to it beside it
                // in the other; one column, in this order, in a narrower window and at the accessibility sizes. The same
                // views either way, so turning the iPad keeps what's being written.
                WideColumns {
                    VStack(spacing: Spacing.s3) { card }
                        .frame(maxWidth: .infinity)
                        .placeColumn(.leading, order: 0)
                    VStack(spacing: Spacing.s3) { controls(count: count, empty: empty) }
                        .frame(maxWidth: .infinity)
                        .padding(.top, Spacing.s3)
                        .placeColumn(.trailing, order: 1, trimsTop: Spacing.s3)
                }
            } else {
                VStack(spacing: Spacing.s3) {
                    card
                    controls(count: count, empty: empty)
                }
            }
        }
        .sheet(isPresented: $signing) {
            CardTableSignPad(
                initial: viewModel.signature,
                onDone: { viewModel.signed($0, keep: $1) },
                onTyped: { viewModel.signature = nil },
                keeping: viewModel.signatureSaves
                    ? CardTableSignPad.Keeping(saved: viewModel.savedSignature) { await viewModel.forgetSavedSignature() }
                    : nil
            )
            .presentationDetents([.medium, .large])
            .presentationBackground(MailPaper.cardPaper(nil))
        }
    }

    /// The card, its back up to write on (turned over to see the picture).
    private var card: some View {
        HolidayCardFlip(showBack: showBack) {
            HolidayCardFront(design: design.id, caption: design.caption, paper: design.paper, height: design.height, year: cards.year)
                .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
                .shadow(color: MailPaper.cardShadow.opacity(0.24), radius: 13, x: 0, y: 12)
        } back: {
            HolidayCardBack(
                paper: design.paper,
                fromName: viewModel.fromName,
                year: cards.year,
                signature: viewModel.signature,
                noteText: viewModel.message
            ) { width in
                HolidayCardNoteText(
                    text: $viewModel.message,
                    cardWidth: width,
                    placeholder: viewModel.placeholder,
                    isEditable: true,
                    limit: cards.messageLimit
                )
            }
            .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
            .shadow(color: MailPaper.cardShadow.opacity(0.24), radius: 13, x: 0, y: 12)
        }
    }

    /// Everything under the card: turning it over and the letters left, help, the photo and greeting, signing, and
    /// "Seal it".
    @ViewBuilder
    private func controls(count: Int, empty: Bool) -> some View {
        HStack {
            HolidayCardPaperButton(title: showBack ? "Turn it over" : "Back to writing", isPressed: !showBack) {
                // The keyboard goes while the picture side is up.
                UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                showBack.toggle()
            }
            .accessibilityIdentifier("sendCardTurn")
            Spacer(minLength: Spacing.s2)
            Text("\(count) of \(cards.messageLimit) letters")
                .font(.system(size: 13, weight: count >= cards.messageLimit ? .semibold : .regular))
                .foregroundStyle(count >= cards.messageLimit ? MailPaper.wax : HolidayCardDesk.muted(scheme))
                .accessibilityIdentifier("sendCardCount")
        }
        // A note the table writes over two leaves (plan Part 9).
        if LaunchFeatures.cardTable, CardTableNoteLayout.leaves(viewModel.message) != nil {
            Text("This note runs onto a second leaf.")
                .font(.system(size: 13))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("sendCardSecondLeaf")
        }
        if cards.noteHelp, let recipient = viewModel.recipient {
            noteHelpRow(recipient)
        }
        // The card's own photo and greeting (memories plan steps 4 and 7): one person's card only (a list too with
        // `improved`, cards-next Wave 2), while the server takes them.
        let takesMedia = viewModel.improved || viewModel.recipient?.entries == nil
        let needsStamp = cards.mediaStamp == .buy || viewModel.mediaNeedsAnyStamp
        let attachments = viewModel.attachments
        if attachments.photo != nil || attachments.voice != nil || attachments.recorder.recording
            || (takesMedia && (cards.takesPhoto || cards.takesVoice)) {
            HolidayCardMediaRow(
                attachments: attachments,
                takesPhoto: takesMedia && cards.takesPhoto,
                takesVoice: takesMedia && cards.takesVoice,
                takesLive: takesMedia && cards.takesLivePhoto,
                liveMaxBytes: cards.livePhotoMaxBytes,
                forName: viewModel.greetingFor,
                gift: CardTableMood(mood: design.mood, number: design.number) == .reverence,
                needsStamp: needsStamp,
                needsStampText: viewModel.mediaNeedsStampLine,
                freeHint: viewModel.freeMediaHint
            ) { viewModel.openStampsForMedia() }
                // A photo shared to Mail from another app's share sheet goes on the card here, as if picked
                // (`ShareInCardPhoto`). Where this card can't take one it waits, and the row says why.
                .onAppear {
                    if takesMedia, cards.takesPhoto, !needsStamp, attachments.photo == nil,
                       let shared = ShareInCardPhoto.shared.take() {
                        attachments.add(shared)
                    }
                }
        }
        if cards.signature != nil {
            signRow
        }
        VStack(spacing: Spacing.s2) {
            let wait = viewModel.attachments.wait
            HolidayCardWaxButton(title: "Seal it", isEnabled: !empty && wait == nil) { viewModel.toSeal() }
                .accessibilityIdentifier("sendCardSealIt")
            if empty || wait != nil {
                Text(verbatim: empty ? "Write a few words on the back first." : wait ?? "")
                    .font(.system(size: 13))
                    .foregroundStyle(HolidayCardDesk.muted(scheme))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("sendCardSealWait")
            }
        }
        .padding(.top, Spacing.s2)
    }

    /// "Help me write it": three notes from Pantopus AI to pick from; the one picked lands on the back, face up.
    private func noteHelpRow(_ recipient: HolidayCardRecipient) -> some View {
        let help = viewModel.noteHelp
        let names = recipient.noteHelpNames
        let count = recipient.noteHelpCount
        return HolidayCardNoteHelpRow(help: help, message: viewModel.message) {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            help.opened(for: HolidayCardNoteHelp.cardKey(design: design.id, names: names, count: count))
            helping = true
        } onUndo: {
            if let before = help.undo() { viewModel.message = before }
        }
        .sheet(isPresented: $helping) {
            HolidayCardNoteHelpSheet(
                help: help,
                forWhom: HolidayCardNoteHelp.forLine(names: names, count: count),
                startsFromNote: !help.ownWords(viewModel.message).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                limit: cards.messageLimit
            ) {
                Task {
                    await help.write(
                        design: design.id, names: names, count: count, message: viewModel.message, limit: cards.messageLimit
                    )
                }
            } onUse: { text in
                showBack = true
                viewModel.message = help.use(text, message: viewModel.message)
            }
            .presentationDetents([.medium, .large])
            .presentationBackground(MailPaper.cardPaper(nil))
        }
    }

    /// Sign beside FROM with a finger, or leave the first name typed (plan 8.2).
    private var signRow: some View {
        let signed = viewModel.signature != nil
        return HStack(spacing: Spacing.s3) {
            HolidayCardPaperButton(title: signed ? "Sign again" : "Sign your name", isPressed: false) {
                UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                showBack = true
                signing = true
            }
            .accessibilityIdentifier("sendCardSign")
            Text(signHint)
                .font(.system(size: 13))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("sendCardSignHint")
            Spacer(minLength: 0)
        }
    }

    private var signHint: String {
        if viewModel.keepSignatureFailed {
            return "This card is signed, but your signature couldn't be kept for next time. Sign again to try once more."
        }
        if viewModel.signedWithSaved { return "Your saved signature is beside FROM." }
        if viewModel.signature != nil { return "Signed beside FROM." }
        return "Or leave \(HolidayCardWords.firstName(viewModel.fromName)) typed."
    }
}
