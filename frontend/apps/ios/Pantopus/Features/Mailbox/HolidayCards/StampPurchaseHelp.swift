// App Store purchase history and native refund requests within the existing stamp-books sheet.
import StoreKit
import SwiftUI

struct StampPurchaseHelp: View {
    let store: MailStampStore
    @State private var purchaseHelpExpanded = false
    @State private var refundTransactionID: StoreKit.Transaction.ID = 0
    @State private var refundPresented = false

    var body: some View {
        DisclosureGroup("App Store purchase help", isExpanded: $purchaseHelpExpanded) {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text("Apple handles App Store refund requests. An approved refund removes that book’s stamps from your balance.")
                    .fixedSize(horizontal: false, vertical: true)
                if #available(iOS 18, *) {
                    if store.loadingPurchases {
                        ProgressView("Loading your purchases…")
                    } else if store.purchases.isEmpty {
                        Text("No App Store stamp purchases for this Pantopus account were found on this device.")
                            .fixedSize(horizontal: false, vertical: true)
                    } else {
                        ForEach(store.purchases) { purchase in
                            if let book = store.balance?.books.first(where: { $0.id == purchase.productID }) {
                                Button {
                                    refundTransactionID = purchase.id
                                    refundPresented = true
                                } label: {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text("Request a refund for \(book.credits) stamps")
                                            .fontWeight(.semibold)
                                        Text(purchase.purchaseDate.formatted(date: .abbreviated, time: .shortened))
                                            .foregroundStyle(MailPaper.cardTextMuted)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.vertical, Spacing.s2)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .disabled(store.busy)
                            }
                        }
                    }
                }
                Link("Apple purchase support", destination: URL(string: "https://reportaproblem.apple.com")!)
                    .fontWeight(.semibold)
            }
            .font(.system(size: 13.5))
            .foregroundStyle(MailPaper.cardTextSoft)
            .padding(.top, Spacing.s2)
        }
        .font(.system(size: 13.5, weight: .semibold))
        .tint(MailPaper.wax)
        .foregroundStyle(MailPaper.wax)
        .accessibilityIdentifier("stampBooksPurchaseHelp")
        .task(id: purchaseHelpExpanded) {
            if #available(iOS 18, *), purchaseHelpExpanded {
                await store.loadPurchases()
            }
        }
        .refundRequestSheet(for: refundTransactionID, isPresented: $refundPresented) { result in
            switch result {
            case .success(.success):
                store.message = "Your refund request was sent to Apple. If approved, that book’s stamps will be removed from your balance."
            case .success(.userCancelled): break
            case .failure:
                store.message = "Apple couldn’t open this refund request. Try again or use Apple purchase support below."
            @unknown default: break
            }
            Task { await store.loadPurchases() }
        }
    }
}
