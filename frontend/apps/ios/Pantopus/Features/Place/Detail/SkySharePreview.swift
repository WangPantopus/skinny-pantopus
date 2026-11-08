//
//  SkySharePreview.swift
//  Pantopus
//
//  Share under the sun card, and "Share today's sky": the picture as it
//  will go, the rain or snow falling in it, and the two ways to send it
//  (`SkyShareCard`). Parity twin of the share UI in Android's `SkyShareCard.kt`.
//

import SwiftUI

/// Share, under the sun card: opens the preview of today's sky.
struct SkyShareButton: View {
    let card: SkyShareCard

    @Environment(\.colorScheme) private var colorScheme
    @State private var previewing = false

    var body: some View {
        Button { previewing = true } label: {
            HStack(spacing: 4) {
                Icon(.share, size: 13, strokeWidth: 2.2, color: Theme.Color.primaryInk)
                Text("Share")
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.Color.primaryInk)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Share today's sky")
        .accessibilityIdentifier("todaySkyShare")
        .frame(maxWidth: .infinity, alignment: .trailing)
        .sheet(isPresented: $previewing) { SkySharePreview(card: shown) }
    }

    /// The card in the screen's own light or dark look.
    private var shown: SkyShareCard {
        var shown = card
        shown.colorScheme = colorScheme
        return shown
    }
}

/// "Share today's sky": the picture as it will go, the rain or snow falling
/// in it, and the two ways to send it. What's sent is drawn when it's tapped.
struct SkySharePreview: View {
    let card: SkyShareCard

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var making = false
    @State private var failed = false
    @State private var file: SharedFile?

    private struct SharedFile: Identifiable {
        let url: URL

        var id: URL {
            url
        }
    }

    var body: some View {
        VStack(spacing: Spacing.s4) {
            HStack {
                Text("Share today's sky")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                Button { dismiss() } label: {
                    Icon(.x, size: 18, strokeWidth: 2.2, color: Theme.Color.appTextMuted)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
                .accessibilityIdentifier("todaySkyShareClose")
            }
            picture
            VStack(spacing: Spacing.s3) {
                if card.falls {
                    PrimaryButton(title: "Share video", isLoading: making, isEnabled: !making) { await shareClip() }
                        .accessibilityIdentifier("todaySkyShareVideo")
                    GhostButton(title: "Share photo", isEnabled: !making) { await sharePicture() }
                        .accessibilityIdentifier("todaySkySharePhoto")
                } else {
                    PrimaryButton(title: "Share photo") { await sharePicture() }
                        .accessibilityIdentifier("todaySkySharePhoto")
                }
                Text(failed ? "We couldn't make it this time. Try again." : "Your city shows, never your street.")
                    .font(Theme.Font.caption)
                    .foregroundStyle(failed ? Theme.Color.error : Theme.Color.appTextMuted)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s4)
        .background(Theme.Color.appBg)
        .presentationDetents([.large])
        .sheet(item: $file) { file in
            SystemShareSheet(items: [file.url])
        }
    }

    /// The page fitted to the room there is; the rain or snow falls in it
    /// unless motion is reduced or a clip is being made.
    private var picture: some View {
        GeometryReader { proxy in
            let fit = min(proxy.size.width / SkyShareCard.width, proxy.size.height / SkyShareCard.height)
            Group {
                if card.falls, !reduceMotion, !making {
                    TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { frame in
                        page(at: frame.date, falling: frame.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 86400))
                    }
                } else {
                    TimelineView(.everyMinute) { frame in page(at: frame.date, falling: nil) }
                }
            }
            .scaleEffect(fit, anchor: .topLeading)
            .frame(width: SkyShareCard.width * fit, height: SkyShareCard.height * fit, alignment: .topLeading)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("The picture that will be shared: \(card.title). \(reading)")
        .accessibilityIdentifier("todaySkySharePreview")
    }

    /// The page as of that minute, so its words change once a minute, not every frame.
    private func page(at date: Date, falling: Double?) -> some View {
        let minute = Date(timeIntervalSinceReferenceDate: (date.timeIntervalSinceReferenceDate / 60).rounded(.down) * 60)
        return SkyShareCardView(card: card.at(minute), falling: falling)
    }

    private var reading: String {
        SkyReadingModel(now: card.weather, note: card.note, picked: nil, at: card.date, calendar: card.calendar).spoken
    }

    private func sharePicture() async {
        failed = false
        do {
            file = try SharedFile(url: card.at(.now).pictureFile())
        } catch {
            failed = true
        }
    }

    private func shareClip() async {
        failed = false
        making = true
        defer { making = false }
        do {
            file = try await SharedFile(url: card.at(.now).clipFile())
        } catch {
            failed = true
        }
    }
}
