//
//  CardTableLinkViews.swift
//  Pantopus
//
//  A card's link and its full-screen preview for its sender (launch key
//  `card_table`): the link to send, Copy link, the phone's share sheet with its
//  few words, Share from Sent, and the moment as the other person has it.
//

import SwiftUI
import UIKit

/// A card's link, for its sender: the link itself just after sending, Copy link and the phone's share sheet. Copied
/// again later it's read from the server, which says in its own words what happened if the link has stopped working.
struct CardTableLinkActions: View {
    let cardId: String
    /// Known just after sending: it's shown and copied as it is.
    let link: String?
    let fromName: String

    @State private var said: String?
    @State private var isLoading = false
    @State private var shareWords: ShareWords?

    private struct ShareWords: Identifiable {
        let id = UUID()
        let text: String
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if let link {
                Text(link)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(MailPaper.cardTextSoft)
                    .lineLimit(2)
                    .truncationMode(.middle)
                    .padding(Spacing.s3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    .textSelection(.enabled)
                    .accessibilityIdentifier("sendCardLink")
            }
            HStack(spacing: Spacing.s2) {
                if link == nil {
                    HolidayCardPaperButton(title: "Copy link again", isLoading: isLoading, fullWidth: true) {
                        Task { await copy() }
                    }
                    .accessibilityIdentifier("mailSentCopyLink")
                } else {
                    HolidayCardWaxButton(title: "Copy link") { Task { await copy() } }
                        .accessibilityIdentifier("sendCardCopyLink")
                }
                HolidayCardPaperButton(title: "Share", fullWidth: true) {
                    Task { await share() }
                }
                .accessibilityIdentifier("sendCardShareLink")
            }
            if let said {
                Text(said)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("mailSentCopyLinkSaid")
            }
        }
        .sheet(item: $shareWords) { words in
            SystemShareSheet(items: [words.text])
        }
    }

    /// The link, read from the server each time when this page doesn't have it, so a refusal says what's happened since.
    private func theLink() async -> String? {
        if let link { return link }
        isLoading = true
        defer { isLoading = false }
        do {
            let response: HolidayCardLinkResponse = try await APIClient.shared.request(HolidayCardEndpoints.link(cardId: cardId))
            return response.link
        } catch {
            said = HolidayCardFlowViewModel.refusal(
                error,
                fallback: "We couldn’t get your link just now. Check your connection and try again."
            )
            return nil
        }
    }

    private func copy() async {
        said = nil
        guard let link = await theLink() else { return }
        UIPasteboard.general.string = link
        said = "Link copied."
    }

    private func share() async {
        said = nil
        guard let link = await theLink() else { return }
        shareWords = ShareWords(text: "A Christmas card for you from \(HolidayCardWords.firstName(fromName)): \(link)")
    }
}

/// Share on a card's page in Sent: the same sheet as on the table, with the words about your own note.
struct CardTableSentShareButton: View {
    let content: CardTableContent
    /// Still sealed for them: the surprise is theirs, so it shares as the sealed envelope.
    let sharesSealed: Bool

    @State private var ready: Ready?
    @State private var isLoading = false

    private struct Ready: Identifiable {
        let id = UUID()
        let art: CardTableArt
        let picture: UIImage?
    }

    var body: some View {
        HolidayCardPaperButton(title: "Share", isLoading: isLoading, fullWidth: true) {
            Task {
                isLoading = true
                let art = await CardTableArt.load()
                let picture = await CardTablePicture.load(content.design)
                isLoading = false
                ready = Ready(art: art, picture: picture)
            }
        }
        .accessibilityIdentifier("mailSentShare")
        .sheet(item: $ready) { ready in
            CardTableShareSheet(content: shared, art: ready.art, picture: ready.picture, isSender: true)
        }
    }

    private var shared: CardTableContent {
        var shared = content
        shared.sealed = sharesSealed
        return shared
    }
}

/// The page a card's link opens, as Look it over draws it: the table in its default colour, the shut envelope and the
/// words, doing nothing. It never shows the picture or the note.
struct CardTableLinkPagePicture: View {
    let page: HolidayCardPreview.LinkPage

    @State private var art: CardTableArt?

    var body: some View {
        VStack(spacing: 20) {
            envelope
            words
            actions
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity, minHeight: 480)
        .background { table.accessibilityHidden(true) }
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("sendCardLookLinkPage")
        .task { art = await CardTableArt.load() }
    }

    private var table: some View {
        CardTableClothBackdrop(art: art, table: nil)
    }

    private var envelope: some View {
        let width: CGFloat = 170
        let height = width * 1392 / 1200
        return ZStack(alignment: .topLeading) {
            if let art {
                Image(uiImage: art.pocket).resizable().frame(width: width, height: height)
                Image(uiImage: art.flapShadow).resizable().frame(width: width, height: height)
                Image(uiImage: art.flapOut).resizable().frame(width: width, height: width * 512 / 1200)
                Image(uiImage: art.wax)
                    .resizable()
                    .frame(width: width * 0.296, height: width * 0.296 * 546 / 540)
                    .offset(x: width * 0.352, y: height * 0.263)
            }
        }
        .frame(width: width, height: height, alignment: .topLeading)
        .compositingGroup()
        .shadow(color: .black.opacity(0.5), radius: 6, x: 3, y: 8)
        .rotationEffect(.degrees(-2.4))
    }

    private var words: some View {
        VStack(spacing: Spacing.s1) {
            Text("A Christmas card for you")
                .font(.system(size: 28, design: .serif))
                .foregroundStyle(MailPaper.tableCream)
            Text(verbatim: "From \(page.senderName)")
                .font(.system(size: 18, design: .serif).italic())
                .foregroundStyle(MailPaper.tableCreamSoft)
            if page.senderVerified {
                Text("Verified neighbor")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(MailPaper.tableCream)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 3)
                    .background(MailPaper.tableGlass, in: Capsule())
                    .padding(.top, Spacing.s1)
            }
            if page.sealed {
                Text("It’s sealed until Christmas morning.")
                    .font(.system(size: 14))
                    .foregroundStyle(MailPaper.tableCreamSoft)
                    .padding(.top, Spacing.s2)
            }
        }
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
    }

    private var actions: some View {
        VStack(spacing: 10) {
            Text("Open your card")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(MailPaper.tableCream)
            Text("You’ll need a free Pantopus account to open it and keep it.")
                .font(.system(size: 14))
                .foregroundStyle(MailPaper.tableCreamSoft)
            Text("Sign in")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(MailPaper.tableNight)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(MailPaper.tableCream, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            Text("Create a free account")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(MailPaper.tableCream)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(MailPaper.tableGlass, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(MailPaper.tableGlassLine, lineWidth: 1))
            if !page.sentTo.isEmpty {
                Text(verbatim: "Use \(page.sentTo), the address this card was sent to.")
                    .font(.system(size: 12))
                    .foregroundStyle(MailPaper.tableCreamSoft)
            }
        }
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// The full-screen moment as the other person sees it, from Look it over and Sent. It touches nothing on the server,
/// and closing it comes back here.
struct CardTablePreviewCover: ViewModifier {
    @Binding var content: CardTableContent?
    /// The model of the screen showing it: from the tab's root, the table goes when that screen does.
    let owner: AnyObject
    /// What ✕ says it does.
    let closeLabel: String
    /// On a card already sent, Share is there too.
    var isSender = false
    /// A card you sent, still sealed for them, shares as the sealed envelope.
    var sharesSealed = false

    @Environment(\.cardTableCoverSlot) private var slot
    @State private var item: Item?

    private struct Item: Identifiable {
        let id = UUID()
        let model: CardTableModel
    }

    func body(content view: Content) -> some View {
        view
            .onChange(of: content) { _, new in
                present(new.map { Item(model: CardTableModel(content: $0, startsOnTable: false)) })
            }
            .fullScreenCover(item: $item, onDismiss: { content = nil }, content: { item in
                table(item)
            })
    }

    /// From the tab's root when it has a place for it (`CardTableCoverSlot`), else from here.
    private func present(_ next: Item?) {
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            guard let slot else {
                item = next
                return
            }
            let page = next.map { next in
                CardTableCoverSlot.Page(
                    id: next.id.uuidString,
                    owner: owner,
                    content: { AnyView(table(next)) },
                    onDismiss: { content = nil }
                )
            }
            slot.show(page, owner: owner)
        }
    }

    private func table(_ item: Item) -> CardTableScreen {
        CardTableScreen(
            model: item.model,
            menuItems: [
                CardTableMenuItem(title: "Open it again", identifier: "cardTableMenuAgain") {
                    item.model.restart(animated: true)
                }
            ],
            isSender: isSender,
            sharesSealed: sharesSealed,
            closeLabel: closeLabel,
            canShare: isSender
        ) {
            present(nil)
        }
    }
}
