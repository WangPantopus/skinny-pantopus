//
//  CardTableLinkViews.swift
//  Pantopus
//
//  A card by link, once it's sealed (launch key `card_table`): the link to send,
//  Copy link, and the phone's share sheet with its few words.
//

import SwiftUI
import UIKit

/// "Your card is ready." The link, Copy link and Share.
struct CardTableLinkReady: View {
    let link: String
    let fromName: String

    @State private var copied = false
    @State private var sharing = false
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Your card is ready.")
                .font(.system(size: 22, design: .serif))
                .foregroundStyle(HolidayCardDesk.text(scheme))
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("sendCardLinkReady")
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
            HStack(spacing: Spacing.s2) {
                HolidayCardPaperButton(title: copied ? "Link copied" : "Copy link", isPressed: copied, fullWidth: true) {
                    UIPasteboard.general.string = link
                    copied = true
                }
                .accessibilityIdentifier("sendCardCopyLink")
                HolidayCardWaxButton(title: "Share") { sharing = true }
                    .accessibilityIdentifier("sendCardShareLink")
            }
        }
        .sheet(isPresented: $sharing) {
            SystemShareSheet(items: ["A Christmas card for you from \(HolidayCardWords.firstName(fromName)): \(link)"])
        }
    }
}

/// "Copy link again", from Sent. If the card has gone on, it says what happened, in the server's words.
struct CardTableCopyLinkAgain: View {
    let cardId: String

    @State private var said: String?
    @State private var isLoading = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HolidayCardPaperButton(title: "Copy link again", isLoading: isLoading, fullWidth: true) {
                Task { await copy() }
            }
            .accessibilityIdentifier("mailSentCopyLink")
            if let said {
                Text(said)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("mailSentCopyLinkSaid")
            }
        }
    }

    private func copy() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: HolidayCardLinkResponse = try await APIClient.shared.request(HolidayCardEndpoints.link(cardId: cardId))
            UIPasteboard.general.string = response.link
            said = "Link copied."
        } catch {
            said = HolidayCardFlowViewModel.refusal(
                error,
                fallback: "We couldn’t get your link just now. Check your connection and try again."
            )
        }
    }
}

/// The full-screen moment as the other person sees it, from Look it over and Sent. It touches nothing on the server,
/// and closing it comes back here.
struct CardTablePreviewCover: ViewModifier {
    @Binding var content: CardTableContent?
    /// On a card already sent, Share is there too.
    var isSender = false

    @State private var item: Item?

    private struct Item: Identifiable {
        let id = UUID()
        let model: CardTableModel
    }

    func body(content view: Content) -> some View {
        view
            .onChange(of: content) { _, new in
                var quiet = Transaction()
                quiet.disablesAnimations = true
                withTransaction(quiet) {
                    item = new.map { Item(model: CardTableModel(content: $0, startsOnTable: false)) }
                }
            }
            .fullScreenCover(item: $item, onDismiss: { content = nil }, content: { item in
                CardTableScreen(
                    model: item.model,
                    menuItems: [
                        CardTableMenuItem(title: "Open it again", identifier: "cardTableMenuAgain") {
                            item.model.restart(animated: true)
                        }
                    ],
                    isSender: isSender
                ) {
                    var quiet = Transaction()
                    quiet.disablesAnimations = true
                    withTransaction(quiet) { self.item = nil }
                }
            })
    }
}
