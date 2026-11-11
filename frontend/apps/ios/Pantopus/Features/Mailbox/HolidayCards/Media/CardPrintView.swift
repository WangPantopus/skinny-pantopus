//
//  CardPrintView.swift
//  Pantopus
//
//  A card's own photo as a print (memories plan step 4, `holiday_card_memories`; wave 4 drawings 2, 3, 4, 5): a
//  white-bordered print lying a little askew, its bytes loaded only through the card's reader-checked routes. A
//  nostalgia card's print has the 1990s orange date (the card's own day, never the photo's); a covered one (a photo
//  from someone who isn't the reader's connection) says "Photo from {name}. Tap to show." and loads nothing until the
//  tap. Web's `CardPrint.tsx` draws the same print.
//

import SwiftUI
import UIKit

extension MailPaper {
    /// The print's white border, its grey while the photo loads, and the cover over a stranger's photo.
    static let printBorder = rgb(0xFB, 0xFA, 0xF6)
    static let printEmpty = rgb(0xD9, 0xD4, 0xC8)
    static let printCover = rgb(0xE7, 0xDF, 0xCD)
    static let printCoverInk = rgb(0x3A, 0x2F, 0x22)
    static let printEmptyInk = rgb(0x5B, 0x53, 0x46)
    /// The date a 1990s camera printed on the photo.
    static let printDate = rgb(0xFF, 0x8A, 0x1F)
    static let printDateGlow = rgb(255, 120, 20).opacity(0.75)
    static let printShadow = rgb(4, 3, 2)
}

struct CardPrintView: View {
    /// Where its bytes come from; nil while it uploads (`localImage` shows meanwhile).
    let source: CardMediaSource?
    var localImage: UIImage?
    /// The photo's shape, width over height.
    var aspect: CGFloat = 4 / 3
    /// The sender's description, read by screen readers.
    var alt: String?
    /// A nostalgia card: the day printed in orange (`'26 11 08`).
    var datedOn: String?
    var covered = false
    /// The sender's name, for the cover and the spoken label.
    var fromName = ""
    var onUncover: () -> Void = {}
    /// Uploading: a red bar runs along the print's foot until it's stored.
    var uploading = false
    var tilt: Double = -3

    @State private var image: UIImage?
    @State private var failed = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let side = width * 0.06
            VStack(spacing: 0) {
                if covered {
                    cover(width: width)
                } else {
                    photo(width: width)
                }
            }
            .padding(.horizontal, side)
            .padding(.top, side)
            .padding(.bottom, width * 0.14)
            .background(MailPaper.printBorder)
            .overlay(alignment: .bottom) {
                if uploading { uploadBar }
            }
            .compositingGroup()
            .shadow(color: MailPaper.printShadow.opacity(0.45), radius: 13, x: 0, y: 14)
            .shadow(color: MailPaper.printShadow.opacity(0.25), radius: 2, x: 0, y: 2)
            .rotationEffect(.degrees(tilt))
        }
        .aspectRatio(printAspect, contentMode: .fit)
        .task(id: covered ? nil : source) { await load() }
        .accessibilityIdentifier(covered ? "cardPrintCover" : "cardPrint")
    }

    /// The whole print's shape: the photo plus its border (6% each side, 14% under it).
    private var printAspect: CGFloat {
        let photoHeight = 0.88 / max(aspect, 0.2)
        return 1 / (photoHeight + 0.06 + 0.14)
    }

    private var first: String {
        let name = HolidayCardWords.firstName(fromName)
        return name.isEmpty ? "them" : name
    }

    private func cover(width: CGFloat) -> some View {
        Button(action: onUncover) {
            Text(verbatim: "Photo from \(first). Tap to show.")
                .font(Font(CardTableSerif.font(size: min(18, max(13, width * 0.07)))))
                .foregroundStyle(MailPaper.printCoverInk)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .padding(.horizontal, Spacing.s3)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(MailPaper.printCover)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .aspectRatio(aspect, contentMode: .fit)
        .accessibilityLabel("Photo from \(first). Tap to show.")
        .accessibilityIdentifier("cardPrintShow")
    }

    private func photo(width: CGFloat) -> some View {
        let shown = image ?? localImage
        return ZStack(alignment: .bottomTrailing) {
            MailPaper.printEmpty
            if let shown {
                Image(uiImage: shown)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            } else if failed {
                Text("This photo couldn’t be loaded.")
                    .font(.system(size: 12))
                    .foregroundStyle(MailPaper.printEmptyInk)
                    .multilineTextAlignment(.center)
                    .padding(Spacing.s2)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            // A soft gloss across the print.
            LinearGradient(
                stops: [.init(color: .white.opacity(0.22), location: 0), .init(color: .white.opacity(0), location: 0.4)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .allowsHitTesting(false)
            if shown != nil, let date = Self.printedDate(datedOn) {
                Text(verbatim: date)
                    .font(.system(size: min(15, max(10, width * 0.04)), weight: .bold, design: .monospaced))
                    .tracking(1)
                    .foregroundStyle(MailPaper.printDate)
                    .shadow(color: MailPaper.printDateGlow, radius: 3)
                    .padding(.trailing, width * 0.05)
                    .padding(.bottom, width * 0.05)
                    .accessibilityHidden(true)
            }
        }
        .aspectRatio(aspect, contentMode: .fit)
        .clipped()
        .animation(reduceMotion ? nil : .easeOut(duration: 0.25), value: shown != nil)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(alt.map { "Photo: \($0)" } ?? (fromName.isEmpty ? "Your photo" : "Photo from \(first)"))
        .accessibilityAddTraits(.isImage)
    }

    private var uploadBar: some View {
        UploadPulse(reduceMotion: reduceMotion)
            .frame(height: 5)
            .accessibilityHidden(true)
    }

    private func load() async {
        guard !covered, let source else { return }
        failed = false
        if let kept = HolidayCardMediaStore.shared.cached(source.fileId), let made = UIImage(data: kept) {
            image = made
            return
        }
        do {
            let data = try await HolidayCardMediaStore.shared.data(for: source)
            guard !Task.isCancelled else { return }
            if let made = UIImage(data: data) {
                image = made
            } else {
                failed = true
            }
        } catch {
            guard !Task.isCancelled else { return }
            failed = localImage == nil
        }
    }

    /// "'26 11 08": the day, as a 1990s camera printed it; nil without one.
    static func printedDate(_ at: String?) -> String? {
        guard let at, let day = MailDates.parse(at) ?? MailDates.parseDay(at) else { return nil }
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: day)
        guard let year = parts.year, let month = parts.month, let date = parts.day else { return nil }
        return String(format: "'%02d %02d %02d", year % 100, month, date)
    }
}

/// The red bar along an uploading print's foot: pulsing, or still with Reduce Motion.
private struct UploadPulse: View {
    let reduceMotion: Bool
    @State private var dim = false

    var body: some View {
        MailPaper.tableWax
            .opacity(dim ? 0.45 : 1)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) { dim = true }
            }
    }
}
