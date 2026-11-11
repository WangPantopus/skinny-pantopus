//
//  MailStampBooksView.swift
//  Pantopus
//
//  Digital stamps (server `MAIL_STAMPS_ENABLED`), mirroring the web's
//  `StampBooks.tsx`: the stamp count in the card composer's header, the
//  postage line by Seal and send, and the stamp books sheet that opens from
//  either (or when a card needs a stamp and none are left). The server owns
//  the balance; StoreKit transactions are finished only after it credits them.
//

import StoreKit
import SwiftUI
import UIKit

/// `GET /api/mailbox/stamp-books` — route `backend/routes/mailStamps.js`.
struct StampBalance: Decodable {
    let available: Int
    let freeRemaining: Int
    let paidRemaining: Int
    let accountToken: UUID
    /// False once books stop selling for the season; sending goes on until December 31.
    let salesOpen: Bool?
    /// Whether cards cost stamps for this person now (the Stamps wallet shows only then).
    let enabled: Bool?
    let books: [Book]
    /// The latest stamp moves, newest first, and the stamps used on cards that went (asked for with `history=1`).
    let history: [Move]?
    let usedTotal: Int?

    struct Book: Decodable {
        let id: String
        let credits: Int
    }

    struct Move: Decodable, Hashable {
        /// welcome, purchase, send, return or revoke.
        let kind: String
        let delta: Int
        let at: String
    }

    enum CodingKeys: String, CodingKey {
        case available, books, enabled, history
        case freeRemaining = "free_remaining"
        case paidRemaining = "paid_remaining"
        case accountToken = "account_token"
        case salesOpen = "sales_open"
        case usedTotal = "used_total"
    }
}

private struct StampConfirmation: Encodable {
    let provider = "apple"
    let reference: String
}

private struct StampConfirmed: Decodable { let available: Int }

/// The balance, the App Store's books and buying them; shared by the composer and the Stamps wallet.
@MainActor @Observable
final class MailStampStore {
    var balance: StampBalance?
    var products: [Product] = []
    var busy = false
    var message: String?
    private(set) var purchases: [StoreKit.Transaction] = []
    private(set) var loadingPurchases = false
    private let api = APIClient.shared
    private let path = "/api/mailbox/stamp-books"

    var isOut: Bool {
        balance?.available == 0
    }

    func refresh(history: Bool = false) async {
        do {
            balance = try await api.request(Endpoint(method: .get, path: path, query: history ? ["history": "1"] : [:]))
            products = try await Product.products(for: balance?.books.map(\.id) ?? [])
                .sorted { $0.price < $1.price }
        } catch { message = "Could not load your stamps. Try again in a moment." }
    }

    func finish(_ result: VerificationResult<StoreKit.Transaction>) async {
        guard case let .verified(transaction) = result,
              balance?.books.contains(where: { $0.id == transaction.productID }) == true,
              transaction.appAccountToken == balance?.accountToken else { return }
        do {
            let _: StampConfirmed = try await api.request(Endpoint(
                method: .post,
                path: path + "/confirm",
                body: StampConfirmation(reference: String(transaction.id))
            ))
            await transaction.finish()
            await refresh()
            message = transaction.revocationDate == nil ? "Your stamps are ready." : "Your stamp balance was updated."
        } catch {
            message = transaction.revocationDate == nil
                ? "Your purchase is saved. Tap Check for your stamps to finish; you don’t need to pay again."
                : "Could not update your stamp balance. Tap Check for your stamps to try again."
        }
    }

    /// Finished consumables are included for purchase help only, never replayed as new credits.
    /// An Apple Account can be shared across Pantopus logins, so keep the account binding check.
    func loadPurchases() async {
        guard !loadingPurchases, let account = balance?.accountToken else { return }
        loadingPurchases = true
        purchases = []
        defer { loadingPurchases = false }
        var found: [StoreKit.Transaction] = []
        for await result in StoreKit.Transaction.all {
            if Task.isCancelled { return }
            guard case let .verified(transaction) = result,
                  transaction.appAccountToken == account,
                  balance?.books.contains(where: { $0.id == transaction.productID }) == true,
                  transaction.revocationDate == nil else { continue }
            found.append(transaction)
        }
        guard balance?.accountToken == account else { return }
        purchases = found.sorted { $0.purchaseDate > $1.purchaseDate }
    }

    func recover(history: Bool = false) async {
        await refresh(history: history)
        for await result in StoreKit.Transaction.unfinished {
            await finish(result)
        }
    }

    func watch() async {
        for await result in StoreKit.Transaction.updates {
            if Task.isCancelled { return }
            await finish(result)
        }
    }

    func buy(_ product: Product) async {
        guard !busy, balance?.salesOpen != false, let account = balance?.accountToken else { return }
        busy = true
        message = nil
        defer { busy = false }
        do {
            switch try await product.purchase(options: [.appAccountToken(account)]) {
            case let .success(result):
                if case .unverified = result {
                    message = "This purchase could not be verified. Please contact Apple support."
                } else {
                    await finish(result)
                }
            case .pending: message = "Your purchase is waiting for approval. Your stamps arrive once it’s approved."
            case .userCancelled: break
            @unknown default: message = "Check for your stamps in a moment."
            }
        } catch { message = "The purchase couldn’t finish. Please try again." }
    }
}

/// The painted Pantopus Post stamps the card table uses.
enum StampArt {
    static let names = ["stamp-fir", "stamp-peak", "stamp-river"]
    private static let images: [String: UIImage] = Dictionary(uniqueKeysWithValues: names.compactMap { name in
        Bundle.main.path(forResource: name, ofType: "webp", inDirectory: "HolidayCardTable")
            .flatMap { UIImage(contentsOfFile: $0) }
            .map { (name, $0) }
    })

    static func image(_ index: Int) -> UIImage? {
        images[names[index % names.count]]
    }

    /// The stamp a card carries, by its picture's number: the same in every app.
    static func image(forDesign design: String) -> UIImage? {
        let number = Int(design.split(separator: "-").last ?? "") ?? 1
        return image(max(number, 1) - 1)
    }
}

private func plural(_ count: Int, _ one: String, _ many: String? = nil) -> String {
    "\(count) \(count == 1 ? one : many ?? one + "s")"
}

/// What this card costs, beside Seal and send, in the card's own stamp.
struct StampPostageLine: View {
    let store: MailStampStore
    let design: String
    /// The cards on a list, one stamp each.
    var count = 1
    /// The card carries a photo or greeting: it goes only with a bought stamp, even while free cards are left.
    var media = false

    var body: some View {
        if let balance = store.balance {
            HStack(spacing: Spacing.s3) {
                if let art = StampArt.image(forDesign: design) {
                    Image(uiImage: art)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 30, height: 38)
                        .rotationEffect(.degrees(3))
                        .shadow(color: MailPaper.cardShadow.opacity(0.3), radius: 1.5, y: 1)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(count > 1 ? "POSTAGE · \(count) PEOPLE · \(plural(count, "STAMP", "STAMPS"))" : "POSTAGE")
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(1.3)
                        .foregroundStyle(MailPaper.cardFooter)
                    Text(count > 1 ? listLine(balance) : line(balance))
                        .font(.system(size: 14))
                        .foregroundStyle(isShort(balance) ? MailPaper.wax : MailPaper.cardText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(MailPaper.cardFieldEdge, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("postageLine")
        }
    }

    private func isShort(_ balance: StampBalance) -> Bool {
        balance.available < count || (media && balance.paidRemaining < 1)
    }

    private func line(_ balance: StampBalance) -> String {
        if media {
            let paid = max(0, balance.paidRemaining)
            if paid == 0 { return HolidayCardMediaRow.needsStampLine }
            return "1 bought stamp, for the photo or greeting (\(plural(paid - 1, "bought stamp")) left after this)."
        }
        if balance.available == 0 { return "No stamps left. Get a stamp book to send this card." }
        if balance.freeRemaining > 1 { return "Free: uses 1 of your free cards (\(balance.freeRemaining - 1) left after this)." }
        if balance.freeRemaining == 1 { return "Free: this is your last free card." }
        return "1 stamp (\(plural(balance.available - 1, "stamp")) left after this)."
    }

    /// What the list's cards cost: free cards first, then stamps; or how many they need.
    private func listLine(_ balance: StampBalance) -> String {
        if balance.available < count { return "\(count) cards need \(plural(count, "stamp")). You have \(have(balance))." }
        let free = min(balance.freeRemaining, count)
        let paid = count - free
        let left = balance.available - count
        if free > 0,
           paid >
           0 { return "\(plural(free, "free card")) first, then \(plural(paid, "stamp")). \(plural(left, "stamp")) left after this." }
        if free > 0 { return "Free: uses \(free) of your free cards (\(balance.freeRemaining - free) left after this)." }
        return "\(plural(paid, "stamp")) (\(plural(left, "stamp")) left after this)."
    }

    /// What's left, in words: "1 free card and 2 stamps".
    private func have(_ balance: StampBalance) -> String {
        let paid = max(0, balance.paidRemaining)
        let free = balance.freeRemaining
        if balance.available == 0 { return "none left" }
        if paid > 0, free > 0 { return "\(plural(free, "free card")) and \(plural(paid, "stamp"))" }
        return paid > 0 ? plural(paid, "stamp") : plural(free, "free card")
    }
}

/// A fanned book of stamps; bigger books fan more stamps.
private struct StampBooklet: View {
    let credits: Int

    var body: some View {
        let shown = credits >= 50 ? 4 : credits >= 20 ? 3 : 2
        ZStack {
            ForEach(0..<shown, id: \.self) { index in
                let turn = (Double(index) - Double(shown - 1) / 2) * 9
                if let art = StampArt.image(index) {
                    Image(uiImage: art)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 38, height: 47)
                        .shadow(color: MailPaper.cardShadow.opacity(0.28), radius: 1.5, y: 2)
                        .rotationEffect(.degrees(turn), anchor: .bottom)
                        .offset(x: turn * 0.9)
                }
            }
        }
        .frame(width: 60, height: 58)
        .accessibilityHidden(true)
    }
}

/// The stamp books: what's left, the three books, and what a stamp does.
struct StampBooksSheet: View {
    let store: MailStampStore
    /// Opened for a list whose cards need more stamps than are left.
    var short: StampShort?
    /// Opened for a card's photo or greeting, which go only with a bought stamp.
    var forMedia = false
    @Environment(\.dismiss) private var dismiss

    private static let finePrint = "Digital delivery only. Christmas cards can be sent until December 31; "
        + "unused stamps stay in your account. Receiving cards and replying are always free."

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        Text("Christmas stamp books")
                            .font(.system(size: 28, design: .serif))
                            .foregroundStyle(MailPaper.cardText)
                            .accessibilityAddTraits(.isHeader)
                        Text("Send a little Christmas joy to everyone on your list. One stamp sends one digital card to one person.")
                            .font(.system(size: 15))
                            .foregroundStyle(MailPaper.cardTextMuted)
                    }
                    Spacer(minLength: Spacing.s2)
                    Button { dismiss() } label: {
                        Icon(.x, size: 20, color: MailPaper.cardTextMuted)
                            .frame(width: 40, height: 40)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close")
                }
                if let short, short.missing > 0 {
                    Text("These \(short.cards) cards need \(plural(short.missing, "more stamp", "more stamps")).")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(MailPaper.wax)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("stampBooksShort")
                }
                if forMedia {
                    Text(HolidayCardMediaRow.needsStampLine)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(MailPaper.wax)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("stampBooksForMedia")
                }
                if let have = haveLine {
                    Text(have)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(store.isOut ? MailPaper.wax : MailPaper.cardTextSoft)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, 5)
                        .background(MailPaper.cardAvatar, in: Capsule())
                }
                if store.balance?.salesOpen == false {
                    note("Stamp books aren’t on sale any more this year. You can use your stamps until December 31.")
                } else if store.products.isEmpty {
                    note("Stamp books are unavailable in the App Store right now.")
                } else {
                    VStack(spacing: 10) {
                        ForEach(store.products) { product in
                            if let book = store.balance?.books.first(where: { $0.id == product.id }) {
                                row(book, product)
                            }
                        }
                    }
                }
                Text("One-time purchase · No subscription. Your free cards are used first.")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(MailPaper.cardTextSoft)
                    .fixedSize(horizontal: false, vertical: true)
                Text(Self.finePrint)
                    .font(.system(size: 12.5))
                    .foregroundStyle(MailPaper.cardFooter)
                    .fixedSize(horizontal: false, vertical: true)
                if let message = store.message {
                    Text(message)
                        .font(.system(size: 13.5, weight: .medium))
                        .foregroundStyle(MailPaper.cardTextSoft)
                        .accessibilityAddTraits(.updatesFrequently)
                }
                Button("Already paid? Check for your stamps") { Task { await store.recover() } }
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(MailPaper.wax)
                    .disabled(store.busy)
                    .accessibilityIdentifier("stampBooksCheck")
                StampPurchaseHelp(store: store)
            }
            .padding(Spacing.s5)
        }
        .background(MailPaper.cardDesk.ignoresSafeArea())
        .accessibilityIdentifier("stampBooks")
    }

    private var haveLine: String? {
        guard let balance = store.balance else { return nil }
        let paid = max(0, balance.paidRemaining)
        let free = balance.freeRemaining
        if balance.available == 0 { return "You’re out of stamps." }
        if paid > 0, free > 0 { return "You have \(plural(paid, "stamp")) and \(plural(free, "free card"))." }
        if paid > 0 { return "You have \(plural(paid, "stamp"))." }
        return "You have \(plural(free, "free card")) left."
    }

    private func note(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14))
            .foregroundStyle(MailPaper.cardTextSoft)
            .fixedSize(horizontal: false, vertical: true)
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
    }

    private func row(_ book: StampBalance.Book, _ product: Product) -> some View {
        Button { Task { await store.buy(product) } } label: {
            HStack(spacing: Spacing.s3) {
                StampBooklet(credits: book.credits)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(book.credits) stamps")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(MailPaper.cardText)
                    Text(["Send \(book.credits) digital cards", perCard(product, book)].compactMap(\.self)
                        .joined(separator: " · "))
                        .font(.system(size: 13))
                        .foregroundStyle(MailPaper.cardTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text("Buy \(product.displayPrice)")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MailPaper.waxText)
                    .padding(.horizontal, 14)
                    .padding(.vertical, Spacing.s2)
                    .background(MailPaper.wax, in: Capsule())
            }
            .padding(.vertical, 10)
            .padding(.leading, Spacing.s2)
            .padding(.trailing, Spacing.s3)
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(book.credits == 20 ? MailPaper.wax.opacity(0.45) : MailPaper.cardRowLine, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(store.busy)
        .accessibilityIdentifier("stampBook.\(book.credits)")
    }

    /// The store's price for one card, in its own currency.
    private func perCard(_ product: Product, _ book: StampBalance.Book) -> String? {
        guard book.credits > 0 else { return nil }
        return (product.price / Decimal(book.credits)).formatted(product.priceFormatStyle) + " a card"
    }
}
