//
//  CardTablePassOn.swift
//  Pantopus
//
//  Pass it on (server switch `card_travel`, travelling card plan Part 4): the reply's sheet with two fields more, over
//  the card's own cloth. The card lies at the top, picture side up, and the sheet's top lies at 86% of its height, over
//  only its printed strip, so the whole picture shows (the founder's rule of November 17). On the open Duo the card
//  is on the left page and the sheet on the right; nothing crosses the hinge. "Send it on" runs the server's checks,
//  then the card is sealed by hand as any card is.
//

import SwiftUI

struct CardTablePassOnPage: View {
    @State private var model: CardTablePassOnModel
    /// Back to the card; `sent` true once it went (the card's page reads its places again).
    let onClose: (_ sent: Bool) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Where the sheet's top lies, as a share of the card's height (as the joined card's reply).
    private static let sheetTop: CGFloat = 0.86

    init(cardId: String, content: CardTableContent, place: Int, onClose: @escaping (_ sent: Bool) -> Void) {
        _model = State(initialValue: CardTablePassOnModel(cardId: cardId, content: content, place: place))
        self.onClose = onClose
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                HolidayCardTableCloth(table: model.content.table)
                if case let .sideways(hingeX, true) = CardTableFoldReader.fold(geo, insets: EdgeInsets()) {
                    book(hingeX: hingeX, size: geo.size)
                } else {
                    phone(width: geo.size.width)
                }
                HStack {
                    CardTableRoundButton(icon: .x, label: "Back to the card", identifier: "cardPassOnClose") { onClose(false) }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)
            }
        }
        .environment(\.colorScheme, .dark)
        .task { await model.load() }
        .onAppear { model.done = { onClose(true) } }
        .sheet(isPresented: $model.asksTown) {
            CardTravelTownSheet(onChosen: model.townChosen) { model.asksTown = false }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(item: Binding(
            get: { model.sealing.map(SealingItem.init) },
            set: { if $0 == nil { model.sealing = nil } }
        )) { item in
            CardPassOnSealPage(model: model, table: item.table, onClose: onClose)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("cardPassOn")
    }

    /// The card at the top, the sheet over its printed strip and on down; the whole scrolls, keyboard and all, under
    /// the ✕'s strip. While a name or address is typed, "Who gets it next" rises to the top so the matches show above
    /// the keyboard.
    private func phone(width: CGFloat) -> some View {
        let cardWidth = max(140, min(width - 120, 260))
        return VStack(spacing: 0) {
            Color.clear.frame(height: 56)
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 0) {
                        card(width: cardWidth)
                        CardPassOnSheet(model: model)
                            .padding(.top, -cardWidth * 1.2 * (1 - Self.sheetTop))
                            .frame(maxWidth: 520)
                    }
                    .frame(maxWidth: .infinity)
                }
                .scrollDismissesKeyboard(.interactively)
                .scrollBounceBehavior(.basedOnSize)
                .clipped()
                .onChange(of: model.searching) { _, searching in
                    guard searching else { return }
                    withAnimation(reduceMotion ? nil : .easeOut(duration: 0.3)) {
                        proxy.scrollTo(CardPassOnSheet.whoAnchor, anchor: .top)
                    }
                }
            }
        }
    }

    /// The open Duo: the card on the left page, the sheet on the right.
    private func book(hingeX: CGFloat, size: CGSize) -> some View {
        let page = max(0, min(hingeX, size.width - hingeX))
        let cardWidth = max(140, min(page - 48, (size.height - 80) / 1.2, 360))
        return HStack(spacing: 0) {
            card(width: cardWidth)
                .frame(width: hingeX, height: size.height)
            ScrollView {
                CardPassOnSheet(model: model)
                    .padding(.top, 56)
            }
            .scrollDismissesKeyboard(.interactively)
            .frame(width: size.width - hingeX)
        }
    }

    private func card(width: CGFloat) -> some View {
        let content = model.content
        return CardTableFrontPage(design: content.design, caption: content.caption, paper: content.paper, year: content.year, mailedOn: nil)
            .frame(width: width, height: width * 1.2)
            .shadow(color: .black.opacity(0.42), radius: 8, x: 2, y: 6)
            .rotationEffect(.degrees(-1))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("The card that goes on: \(HolidayCardWords.captionSentence(content.caption))")
            .accessibilityIdentifier("cardPassOnCard")
    }

    private struct SealingItem: Identifiable {
        let table: CardTableModel
        var id: ObjectIdentifier {
            ObjectIdentifier(table)
        }
    }
}

/// The cream sheet: who gets it next, the note, the town line, and "Send it on".
private struct CardPassOnSheet: View {
    @Bindable var model: CardTablePassOnModel
    @FocusState private var searching: Bool
    @ScaledMetric(relativeTo: .title3) private var titleSize: CGFloat = 22
    @ScaledMetric(relativeTo: .footnote) private var lineSize: CGFloat = 13.5

    /// Where the page scrolls to while a name or address is typed.
    static let whoAnchor = "cardPassOnWhoAnchor"

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Pass it on")
                .font(.system(size: titleSize, design: .serif))
                .foregroundStyle(MailPaper.cardText)
                .accessibilityAddTraits(.isHeader)
            Text("The same card goes on, with a note from you.")
                .font(.system(size: lineSize))
                .foregroundStyle(MailPaper.cardTextMuted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
            label("Who gets it next")
                .id(Self.whoAnchor)
            CardPassOnPicker(model: model, searching: $searching)
            label(model.noteLabel)
            note
            if let town = model.townLine {
                Text(town)
                    .font(.system(size: lineSize))
                    .foregroundStyle(MailPaper.cardTextSoft)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, Spacing.s3)
                    .accessibilityIdentifier("cardPassOnTown")
            }
            if let refusal = model.refusal {
                Text(refusal)
                    .font(.system(size: lineSize + 1, weight: .medium))
                    .foregroundStyle(MailPaper.warningInk)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, Spacing.s3)
                    .accessibilityIdentifier("cardPassOnRefusal")
            }
            HolidayCardWaxButton(title: "Send it on", isLoading: model.checking, isEnabled: model.canSend) {
                Task { await model.sendItOn() }
            }
            .padding(.top, Spacing.s4)
            .accessibilityIdentifier("cardPassOnSend")
            Text(model.freeLine)
                .font(.system(size: lineSize))
                .foregroundStyle(MailPaper.cardTextMuted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)
                .padding(.top, Spacing.s2)
                .accessibilityIdentifier("cardPassOnFree")
        }
        .padding(.horizontal, 18)
        .padding(.top, 20)
        .padding(.bottom, Spacing.s8)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24, style: .continuous)
                .fill(MailPaper.tableSlip)
                .shadow(color: .black.opacity(0.4), radius: 14, x: 0, y: -4)
                .ignoresSafeArea(edges: .bottom)
        }
        .environment(\.colorScheme, .light)
        .onChange(of: searching) { _, typing in model.searching = typing }
    }

    private func label(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(2)
            .foregroundStyle(MailPaper.cardLabel)
            .padding(.top, Spacing.s4)
            .padding(.bottom, 6)
            .accessibilityAddTraits(.isHeader)
    }

    /// The pen and the saved signature, as a reply.
    private var note: some View {
        HolidayCardBack(
            paper: model.content.paper,
            fromName: model.content.toName,
            year: model.content.year,
            signature: model.signature,
            noteText: model.message
        ) { width in
            HolidayCardNoteText(
                text: $model.message,
                cardWidth: width,
                placeholder: model.pick?.firstName.map { "Dear \($0)," } ?? "",
                isEditable: true,
                limit: model.messageLimit
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
        .shadow(color: .black.opacity(0.2), radius: 6, x: 0, y: 4)
        .accessibilityIdentifier("cardPassOnNote")
    }
}

/// "Who gets it next": the picker of "Who it's for" (a name, an email address, or a link); once chosen, one row with
/// "Change".
private struct CardPassOnPicker: View {
    @Bindable var model: CardTablePassOnModel
    var searching: FocusState<Bool>.Binding

    var body: some View {
        if let pick = model.pick {
            chosen(pick)
        } else if model.byEmail {
            byEmail
        } else {
            byName
        }
    }

    private func chosen(_ pick: CardPassOnPick) -> some View {
        let name: String = switch pick {
        case let .person(_, name): name
        case let .email(address): address
        case .link: "By link"
        }
        return HStack(spacing: Spacing.s3) {
            Group {
                if pick == .link {
                    Icon(.link, size: 14, color: MailPaper.cardSeal)
                } else {
                    Text(String(name.prefix(1)).uppercased())
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(MailPaper.cardSeal)
                }
            }
            .frame(width: 30, height: 30)
            .background(MailPaper.wax, in: Circle())
            .accessibilityHidden(true)
            Text(name)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(MailPaper.cardText)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button("Change") { model.changePick() }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(MailPaper.cardLink)
                .frame(minHeight: 44)
                .accessibilityLabel("Change who gets it next")
                .accessibilityIdentifier("cardPassOnChange")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
        .background(MailPaper.cardField.opacity(0.8), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(MailPaper.cardRowEdge, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("cardPassOnWho")
    }

    private var byName: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: 10) {
                Icon(.search, size: 18, color: MailPaper.cardTextMuted)
                    .allowsHitTesting(false)
                TextField("", text: $model.query, prompt: Text("Search by name").foregroundStyle(MailPaper.cardTextMuted))
                    .font(.system(size: 16))
                    .foregroundStyle(MailPaper.cardText)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .focused(searching)
                    .accessibilityLabel("Search by name")
                    .accessibilityIdentifier("cardPassOnSearch")
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 48)
            .typesInFieldOnTap(searching)
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(searching.wrappedValue ? MailPaper.wax : MailPaper.cardFieldEdge, lineWidth: 1)
            )
            results
            linkButton(icon: .mail, title: "Not on Pantopus? Send it to their email", identifier: "cardPassOnByEmail") {
                searching.wrappedValue = false
                model.byEmail = true
            }
            linkButton(icon: .link, title: "Send it by link.", identifier: "cardPassOnByLink") {
                searching.wrappedValue = false
                model.pick = .link
            }
        }
    }

    @ViewBuilder
    private var results: some View {
        switch model.search {
        case .idle:
            EmptyView()
        case .looking:
            HStack(spacing: Spacing.s2) {
                ProgressView().controlSize(.small)
                Text("Looking…")
            }
            .font(.system(size: 14))
            .foregroundStyle(MailPaper.cardTextMuted)
            .accessibilityElement(children: .combine)
        case let .failed(message):
            hint(message)
        case let .found(people) where people.isEmpty:
            hint("No one by that name. Check the spelling, or send it to their email.")
        case let .found(people):
            VStack(spacing: Spacing.s0) {
                ForEach(Array(people.prefix(6).enumerated()), id: \.element.id) { index, person in
                    if index > 0 { Rectangle().fill(MailPaper.cardRowLine).frame(height: 1) }
                    personRow(person)
                }
            }
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardRowEdge, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
    }

    private func personRow(_ person: MailRecipientDTO) -> some View {
        let name = MailPieceModel.firstText(person.name, MadeUpUsername.handle(person.username)) ?? "Pantopus member"
        return Button {
            searching.wrappedValue = false
            model.pick = .person(userId: person.userId, name: name)
        } label: {
            HStack(spacing: Spacing.s3) {
                Text(String(name.prefix(1)).uppercased())
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MailPaper.cardAvatarInk)
                    .frame(width: 36, height: 36)
                    .background(MailPaper.cardAvatar, in: Circle())
                    .accessibilityHidden(true)
                Text(name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MailPaper.cardText)
                    .lineLimit(1)
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 52)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("cardPassOnPerson.\(person.userId)")
    }

    private var byEmail: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            TextField("", text: $model.email, prompt: Text(verbatim: "name@example.com").foregroundStyle(MailPaper.cardTextMuted))
                .font(.system(size: 16))
                .foregroundStyle(MailPaper.cardText)
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.done)
                .onSubmit { model.chooseEmail() }
                .focused(searching)
                .padding(.horizontal, Spacing.s4)
                .frame(minHeight: 48)
                .typesInFieldOnTap(searching)
                .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .strokeBorder(searching.wrappedValue ? MailPaper.wax : MailPaper.cardFieldEdge, lineWidth: 1)
                )
                .accessibilityLabel("Their email address")
                .accessibilityIdentifier("cardPassOnEmail")
            HStack(spacing: Spacing.s2) {
                HolidayCardWaxButton(title: "Continue", isEnabled: model.emailIsValid) { model.chooseEmail() }
                    .accessibilityIdentifier("cardPassOnEmailContinue")
                HolidayCardPaperButton(title: "Search instead") { model.byEmail = false }
                    .accessibilityIdentifier("cardPassOnSearchInstead")
            }
        }
        .task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            searching.wrappedValue = true
        }
    }

    private func hint(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14))
            .foregroundStyle(MailPaper.cardTextMuted)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func linkButton(icon: PantopusIcon, title: String, identifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(icon, size: 17, color: MailPaper.wax)
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MailPaper.wax)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}

/// The table while the passed-on card is sealed by hand, and Take it back's question over it.
private struct CardPassOnSealPage: View {
    let model: CardTablePassOnModel
    let table: CardTableModel
    let onClose: (_ sent: Bool) -> Void

    var body: some View {
        CardTableScreen(model: table, menuItems: [], isSender: true, closeLabel: closeLabel, canShare: false, onClose: close)
            .sheet(isPresented: Binding(get: { table.linkShareText != nil }, set: { if !$0 { table.linkShareText = nil } })) {
                SystemShareSheet(items: [table.linkShareText ?? ""])
            }
            .confirmationDialog(
                "Take it back?",
                isPresented: Binding(get: { table.asksTakeBack }, set: { table.asksTakeBack = $0 }),
                titleVisibility: .visible
            ) {
                Button("Take it back", role: .destructive) {
                    Task {
                        if let refusal = await model.takeBack() {
                            table.showToast(refusal)
                        } else {
                            onClose(true)
                        }
                    }
                }
                .accessibilityIdentifier("cardPassOnTakeBackConfirm")
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(takeBackMessage)
            }
    }

    /// As a card's take-back says it.
    private var takeBackMessage: String {
        switch model.pick {
        case .link: "Your link will say you took it back."
        case .email: "The link in their email will say you took it back."
        default: "It won’t go out with the morning mail."
        }
    }

    private var closeLabel: String {
        switch table.sending {
        case .addressing, .gone: "Done"
        default: "Back to Pass it on"
        }
    }

    /// ✕: before the seal, back to the sheet with nothing sent; once it's sent, the same as Done.
    private func close() {
        switch table.sending {
        case .sealing:
            break
        case .addressing, .gone:
            onClose(true)
        default:
            model.sealing = nil
        }
    }
}
