//
//  HolidayCardSteps.swift
//  Pantopus
//
//  The first three steps of sending a Christmas card (the web's
//  `SendCardFlow`): who it's for (a person by name, or an email address for
//  someone not on Pantopus), pick one of the season's pictures from its
//  collection, and write a note on the back of it.
//

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

    private var byName: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: 10) {
                Icon(.search, size: 20, color: MailPaper.cardTextMuted)
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
                    Text("Not on Pantopus? Send it to their email")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(MailPaper.wax)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.s2)
            .accessibilityIdentifier("sendCardByEmail")
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
        return Button {
            focused = false
            viewModel.choose(.person(userId: person.userId, name: name))
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
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("sendCardPerson.\(person.userId)")
    }

    private var byEmail: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
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
            HolidayCardWaxButton(title: "Continue", isEnabled: viewModel.emailIsValid) {
                focused = false
                viewModel.chooseEmail()
            }
            .padding(.top, Spacing.s3)
            .accessibilityIdentifier("sendCardEmailContinue")
            HolidayCardPaperButton(title: "Search Pantopus instead", fullWidth: true) {
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
    @State private var large: HolidayCardDesign?
    /// The collection picked in the row; until then the one holding the card
    /// already chosen (back from step 3), else the first.
    @State private var collectionId: String?
    @Environment(\.colorScheme) private var scheme

    private let columns = Array(repeating: GridItem(.flexible(), spacing: Spacing.s3, alignment: .top), count: 3)

    var body: some View {
        let collections = cards.pickableCollections
        let shown = collections.first { $0.id == collectionId }
            ?? viewModel.designId.flatMap { id in collections.first { $0.designs.contains(id) } }
            ?? collections.first
        // A server without collections: one grid of every picture, as before.
        let designs = shown.map { cards.designs(in: $0) } ?? cards.designs
        VStack(spacing: Spacing.s6) {
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
            VStack(spacing: 10) {
                if let picked = viewModel.design {
                    HolidayCardPaperButton(title: "See it larger", fullWidth: true) { large = picked }
                        .accessibilityIdentifier("sendCardSeeLarger")
                } else {
                    Text("Tap a picture to choose it.")
                        .font(.system(size: 14))
                        .foregroundStyle(HolidayCardDesk.muted(scheme))
                }
                HolidayCardWaxButton(title: "Write on this card", isEnabled: viewModel.design != nil) { viewModel.toWrite() }
                    .accessibilityIdentifier("sendCardWriteOn")
            }
        }
        .sheet(item: $large) { design in
            largeCard(design)
        }
        // The collection's small pictures, and the chosen card's large one, before they're needed.
        .task(id: shown?.id) { HolidayCardPicture.loadAhead(designs.map(\.id), thumb: true) }
        .task(id: viewModel.designId) {
            if let chosen = viewModel.designId { HolidayCardPicture.loadAhead([chosen]) }
        }
    }

    /// The pictures three across, a caption under each. VoiceOver names the
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
        return Button {
            if selected { large = design } else { viewModel.designId = design.id }
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
                    .font(.system(size: 12, weight: .medium))
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
        .accessibilityHint(selected ? "Shows it larger." : "Chooses this card.")
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("sendCardDesign.\(design.id)")
    }

    /// The picture large, to choose it or close.
    private func largeCard(_ design: HolidayCardDesign) -> some View {
        VStack(spacing: Spacing.s4) {
            HolidayCardFront(design: design.id, caption: design.caption, paper: design.paper, height: design.height, year: cards.year)
                .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
                .shadow(color: MailPaper.cardShadow.opacity(0.3), radius: 18, x: 0, y: 12)
                .frame(maxWidth: 420)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(design.caption)
            HStack(spacing: 10) {
                HolidayCardPaperButton(title: "Close", fullWidth: true) { large = nil }
                    .accessibilityIdentifier("sendCardLargeClose")
                HolidayCardWaxButton(title: "Choose this card") {
                    viewModel.designId = design.id
                    large = nil
                }
                .accessibilityIdentifier("sendCardChooseThis")
            }
            .frame(maxWidth: 420)
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(HolidayCardDesk.background(scheme))
        .presentationDragIndicator(.visible)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sendCardLarge")
    }
}

private extension HolidayCardsResponse {
    /// The collections in the row, in the server's order: those with a picture.
    var pickableCollections: [HolidayCardCollection] {
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
                HolidayCardBack(paper: design.paper, fromName: viewModel.fromName, year: cards.year) { width in
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
    }
}
