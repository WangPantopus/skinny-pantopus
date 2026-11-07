import StoreKit
import SwiftUI

private struct StampBalance: Decodable {
    let available: Int
    let accountToken: UUID
    let books: [Book]
    struct Book: Decodable { let id: String
        let credits: Int
    }

    enum CodingKeys: String, CodingKey {
        case available, books
        case accountToken = "account_token"
    }
}

private struct StampConfirmation: Encodable {
    let provider = "apple"
    let reference: String
}

private struct StampConfirmed: Decodable { let available: Int }

/// The server owns the balance; StoreKit transactions are finished only after durable crediting.
@MainActor @Observable
private final class MailStampStore {
    var balance: StampBalance?
    var products: [Product] = []
    var busy = false
    var message: String?
    private let api = APIClient.shared
    private let path = "/api/mailbox/stamp-books"

    func refresh() async {
        do {
            balance = try await api.request(Endpoint(method: .get, path: path))
            products = try await Product.products(for: balance?.books.map(\.id) ?? [])
                .sorted { $0.price < $1.price }
        } catch { message = "Could not load your stamps. Please try again." }
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
            message = "Your stamps are ready."
        } catch {
            message = "Your purchase is saved. Tap Refresh to finish checking it; you do not need to pay again."
        }
    }

    func recover() async {
        await refresh()
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
        guard !busy, let account = balance?.accountToken else { return }
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
            case .pending: message = "Your purchase is pending approval. Your stamps will arrive after approval."
            case .userCancelled: break
            @unknown default: message = "Please refresh to check your purchase."
            }
        } catch { message = "The purchase could not finish. Please try again." }
    }
}

struct MailStampBooksView: View {
    let refreshKey: String
    @State private var store = MailStampStore()
    @State private var expanded = false
    @Environment(\.scenePhase) private var phase

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(store.balance.map { "\($0.available) digital stamp\($0.available == 1 ? "" : "s") available" } ?? "Your digital stamps")
                .font(.headline)
            Text("One stamp sends one Christmas card to one recipient. Your first 3 are free. Receiving and replies are always free.")
            DisclosureGroup("Buy a stamp book", isExpanded: $expanded) {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text("Digital delivery only. Purchased stamps never expire.")
                    ForEach(store.products) { product in
                        if let book = store.balance?.books.first(where: { $0.id == product.id }) {
                            Button("\(book.credits) stamps · \(product.displayPrice)") { Task { await store.buy(product) } }
                                .disabled(store.busy)
                        }
                    }
                    if store.products.isEmpty { Text("Stamp books are unavailable in the App Store right now.") }
                }.padding(.top, Spacing.s2)
            }
            Button("Refresh balance and purchases") { Task { await store.recover() } }.disabled(store.busy)
            if let message = store.message { Text(message).accessibilityAddTraits(.updatesFrequently) }
        }
        .font(.subheadline)
        .padding(Spacing.s3)
        .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.lg))
        .foregroundStyle(MailPaper.cardTextSoft)
        .tint(MailPaper.wax)
        .task { await store.recover()
            await store.watch()
        }
        .task(id: refreshKey) { await store.refresh() }
        .onChange(of: phase) { if phase == .active { Task { await store.recover() } } }
        .onChange(of: store.balance?.available) { if store.balance?.available == 0 { expanded = true } }
    }
}
