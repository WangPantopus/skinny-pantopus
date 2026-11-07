//
//  CardTableSmallArt.swift
//  Pantopus
//
//  The card table's art where a card appears outside the table (launch key
//  `card_table`): the Mailbox row's red paper, stamps, postmark and wax, and the
//  paper grain on the card's faces while it's being sent. Loaded once, away from
//  the main thread, and shown as soon as it's there.
//

import SwiftUI
import UIKit

@MainActor
@Observable
final class CardTableSmallArt {
    static let shared = CardTableSmallArt()

    private(set) var envelopePaper: UIImage?
    private(set) var wax: UIImage?
    private(set) var postmark: UIImage?
    private(set) var paperGrain: UIImage?
    private(set) var stampFir: UIImage?
    private(set) var stampPeak: UIImage?
    private(set) var stampRiver: UIImage?
    @ObservationIgnored private var isLoaded = false

    private init() {}

    func load() async {
        guard !isLoaded else { return }
        isLoaded = true
        let loaded = await Task.detached(priority: .utility) {
            ["env-front", "wax-gold", "postmark-blank", "paper", "stamp-fir", "stamp-peak", "stamp-river"].map { name in
                CardTableArt.file(name).flatMap { $0.preparingForDisplay() ?? $0 }
            }
        }.value
        envelopePaper = loaded[0]
        wax = loaded[1]
        postmark = loaded[2]
        paperGrain = loaded[3]
        stampFir = loaded[4]
        stampPeak = loaded[5]
        stampRiver = loaded[6]
    }

    /// The card's stamp, from its number, as on the envelope.
    func stamp(number: Int?) -> UIImage? {
        switch ((number ?? 1) - 1 + 3) % 3 {
        case 0: stampFir
        case 1: stampPeak
        default: stampRiver
        }
    }
}

/// The card's picture on the table.
enum CardTablePicture {
    /// The trimmed picture from the website, trying again if it fails on a weak connection; the older copy if it
    /// doesn't come. Nil leaves plain paper.
    static func load(_ design: String) async -> UIImage? {
        if let url = HolidayCardPicture.trimmedURL(design) {
            for attempt in 0..<3 {
                if let image = await PantopusImagePipeline.shared.image(for: url) { return image }
                try? await Task.sleep(nanoseconds: UInt64(400_000_000 * (attempt + 1)))
                if Task.isCancelled { return nil }
            }
        }
        return await HolidayCardPicture.load(design)
    }

    /// Loads it before it shows, so it's there when the envelope arrives. Never in Low Data Mode or offline.
    @MainActor
    static func loadAhead(_ design: String, network: NetworkMonitor = .shared) {
        guard network.isOnline, !network.isLowData, let url = HolidayCardPicture.trimmedURL(design) else { return }
        Task(priority: .utility) { _ = await PantopusImagePipeline.shared.image(for: url) }
    }
}

/// The card's picture side while it's being sent, read over, or looked back on, in the shape it'll arrive in.
struct CardTableFrontPage: View {
    let design: String
    let caption: String?
    let paper: String?
    let year: Int
    let mailedOn: String?

    @State private var picture: UIImage?

    var body: some View {
        CardTableFront(
            picture: picture,
            paperGrain: CardTableSmallArt.shared.paperGrain,
            paper: paper,
            caption: caption ?? "",
            year: year,
            mailedOn: mailedOn
        )
        .equatable()
        .aspectRatio(CardTableShape.aspect, contentMode: .fit)
        .accessibilityHidden(true)
        .task(id: design) {
            await CardTableSmallArt.shared.load()
            if picture == nil { picture = HolidayCardPicture.image(design) }
            if let trimmed = await CardTablePicture.load(design), !Task.isCancelled {
                picture = trimmed
            }
        }
    }
}

/// The stamp and inked postmark on the Mailbox row: same place and size as the drawn ones, in the real art.
struct CardTableRowPostage: View {
    let model: MailPieceModel

    var body: some View {
        let art = CardTableSmallArt.shared
        ZStack(alignment: .topTrailing) {
            if let stamp = art.stamp(number: model.card?.number) {
                Image(uiImage: stamp)
                    .resizable()
                    .scaledToFit()
                    .frame(height: 58)
            }
            if model.isPostmarked, let postmark = art.postmark {
                Canvas(rendersAsynchronously: false) { context, size in
                    CardTableInkedPostmark.draw(
                        postmark,
                        in: context,
                        box: CGRect(origin: .zero, size: size),
                        day: model.postmarkDate,
                        year: model.card?.year ?? 2026
                    )
                }
                .frame(width: 92, height: 92 * 365 / 622)
                .offset(x: -36)
                .allowsHitTesting(false)
            }
        }
        .frame(width: 92, height: 58, alignment: .topTrailing)
        .accessibilityHidden(true)
    }
}
