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
}

// MARK: - Step 1: who it's for

struct HolidayCardToStep: View {
    @Bindable var viewModel: HolidayCardFlowViewModel
    @Environment(\.colorScheme) private var scheme
    @FocusState private var focused: Bool

    var body: some View {
        if viewModel.byEmail {
            byEmail
        } else {
            byName
        }
    }

    /// One card can go to a list (digital stamps on): people and addresses are added, then "Continue".
    private var many: Bool {
        viewModel.maxRecipients > 1
    }

    private var byName: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
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
                    viewModel.choose(.link)
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
            if many {
                HolidayCardListChips(viewModel: viewModel)
                    .padding(.bottom, Spacing.s2)
            }
            Text("Their email address")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(HolidayCardDesk.text(scheme))
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
                    + "The email doesn’t show the card."
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

// MARK: - Step 2: pick a card

struct HolidayCardPickStep: View {
    @Bindable var viewModel: HolidayCardFlowViewModel
    let cards: HolidayCardsResponse
    /// The collection picked in the row; until then the one holding the card
    /// already chosen (back from step 3), else the first.
    @State private var collectionId: String?
    @Environment(\.colorScheme) private var scheme

    /// Two across (about 177 pt each on an iPhone 17), so every caption gets two full lines.
    private let columns = Array(repeating: GridItem(.flexible(), spacing: Spacing.s3, alignment: .top), count: 2)

    var body: some View {
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
        let grid = LazyVGrid(columns: columns, spacing: Spacing.s4) {
            ForEach(designs) { design in
                tile(design)
            }
        }
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
            VStack(spacing: 6) {
                HolidayCardPictureView(design: design.id, paper: design.paper, height: design.height, thumb: true)
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
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(scheme == .dark ? Theme.Color.appTextSecondary : MailPaper.cardTextSoft)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
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

// MARK: - Step 2's bar, pinned above the bottom edge

/// The chosen picture's thumbnail and caption, "See it larger", and "Write on
/// this card" (greyed until a picture is chosen), pinned under Pick a card so
/// the main button is never at the end of the scrolling grid.
struct HolidayCardPickBar: View {
    @Bindable var viewModel: HolidayCardFlowViewModel
    let cards: HolidayCardsResponse
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
            HolidayCardWaxButton(title: "Write on this card", isEnabled: viewModel.design != nil) { viewModel.toWrite() }
                .accessibilityIdentifier("sendCardWriteOn")
        }
        .frame(maxWidth: 560)
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity)
        .background(HolidayCardDesk.background(scheme).ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) {
            Rectangle().fill(MailPaper.cardRowLine).frame(height: 1)
        }
        // The card rack: the pictures at full size on the table's cloth (plan Part 5).
        .fullScreenCover(item: $viewModel.largeDesign) { design in
            HolidayCardRack(viewModel: viewModel, cards: cards, start: design)
        }
    }
}

extension HolidayCardsResponse {
    /// The collections in the row, in the server's order: those with a picture.
    fileprivate var pickableCollections: [HolidayCardCollection] {
        collections.filter { !designs(in: $0).isEmpty }
    }

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
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let count = viewModel.letterCount
        let empty = viewModel.message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        VStack(spacing: Spacing.s3) {
            HolidayCardFlip(showBack: showBack) {
                HolidayCardFront(design: design.id, caption: design.caption, paper: design.paper, height: design.height, year: cards.year)
                    .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
                    .shadow(color: MailPaper.cardShadow.opacity(0.24), radius: 13, x: 0, y: 12)
            } back: {
                HolidayCardBack(
                    paper: design.paper,
                    fromName: viewModel.fromName,
                    year: cards.year,
                    signature: viewModel.signature
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
            if cards.signature != nil {
                signRow
            }
            VStack(spacing: Spacing.s2) {
                HolidayCardWaxButton(title: "Seal it", isEnabled: !empty) { viewModel.toSeal() }
                    .accessibilityIdentifier("sendCardSealIt")
                if empty {
                    Text("Write a few words on the back first.")
                        .font(.system(size: 13))
                        .foregroundStyle(HolidayCardDesk.muted(scheme))
                }
            }
            .padding(.top, Spacing.s2)
        }
        .sheet(isPresented: $signing) {
            CardTableSignPad(
                initial: viewModel.signature,
                onDone: { viewModel.signature = $0 },
                onTyped: { viewModel.signature = nil }
            )
            .presentationDetents([.medium, .large])
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
            Text(signed ? "Signed beside FROM." : "Or leave \(HolidayCardWords.firstName(viewModel.fromName)) typed.")
                .font(.system(size: 13))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("sendCardSignHint")
            Spacer(minLength: 0)
        }
    }
}
