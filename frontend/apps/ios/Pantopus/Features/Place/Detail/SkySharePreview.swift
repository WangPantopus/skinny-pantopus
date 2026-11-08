//
//  SkySharePreview.swift
//  Pantopus
//
//  Share under the sun card, and "Share today's sky": the picture as it
//  will go, the rain or snow falling in it, and the ways to send it
//  (`SkyShareCard`, `SkySharePantopus`). Parity twin of the share UI in
//  Android's `SkyShareCard.kt`.
//

import SwiftUI

/// Share, under the sun card: opens the preview of today's sky.
struct SkyShareButton: View {
    let card: SkyShareCard

    @Environment(\.colorScheme) private var colorScheme
    @State private var previewing = false
    /// Post to Pulse or Send in a chat, opened once the preview has gone.
    @State private var picked: SkySharePantopusRoute?
    @State private var pantopus: SkySharePantopusRoute?

    var body: some View {
        Button {
            // A pick that finished after the preview was closed doesn't open later.
            picked = nil
            previewing = true
        } label: {
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
        .sheet(isPresented: $previewing, onDismiss: openPicked) {
            SkySharePreview(card: shown) { picked = $0 }
        }
        .fullScreenCover(item: $pantopus) { route in
            switch route {
            case let .pulse(attachment):
                // A Local Update with the picture, both audiences offered, the words left to them.
                PulseComposeFlowView(
                    prefillDraft: PulseComposeDraft(postType: PulseComposePurpose.localUpdate.postType, body: ""),
                    prefillPhotos: [attachment.photo],
                    onCancel: { pantopus = nil },
                    onPosted: { _ in pantopus = nil }
                )
            case let .chat(attachment):
                SkyShareChatFlow(attachment: attachment) { pantopus = nil }
            }
        }
    }

    private func openPicked() {
        pantopus = picked
        picked = nil
    }

    /// The card in the screen's own light or dark look.
    private var shown: SkyShareCard {
        var shown = card
        shown.colorScheme = colorScheme
        return shown
    }
}

/// "Share today's sky": the picture as it will go, the rain or snow falling
/// in it, and the ways to send it: the share sheet, or Pulse or a chat in
/// Pantopus. What's sent is drawn when it's tapped.
struct SkySharePreview: View {
    let card: SkyShareCard
    /// Post to Pulse or Send in a chat, with the picture drawn: the preview closes and Today opens it.
    var onPantopus: (SkySharePantopusRoute) -> Void = { _ in }

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var making = false
    /// Post to Pulse or Send in a chat, while its picture (and clip) is drawn.
    @State private var makingInPantopus: SkySharePantopusKind?
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
                    PrimaryButton(title: "Share video", isLoading: making, isEnabled: !busy) { await shareClip() }
                        .accessibilityIdentifier("todaySkyShareVideo")
                    GhostButton(title: "Share photo", isEnabled: !busy) { await sharePicture() }
                        .accessibilityIdentifier("todaySkySharePhoto")
                } else {
                    PrimaryButton(title: "Share photo", isEnabled: !busy) { await sharePicture() }
                        .accessibilityIdentifier("todaySkySharePhoto")
                }
                SkyShareInPantopus(making: makingInPantopus, isEnabled: !making) { await shareInPantopus($0) }
                    .padding(.top, Spacing.s1)
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
        // What's being drawn finishes before the preview can be swiped away.
        .interactiveDismissDisabled(busy)
        .sheet(item: $file) { file in
            SystemShareSheet(items: [file.url])
        }
    }

    /// A video or a picture for Pantopus is being drawn.
    private var busy: Bool {
        making || makingInPantopus != nil
    }

    /// The page fitted to the room there is; the rain or snow falls in it
    /// unless motion is reduced or a clip is being made.
    private var picture: some View {
        GeometryReader { proxy in
            let fit = min(proxy.size.width / SkyShareCard.width, proxy.size.height / SkyShareCard.height)
            Group {
                if card.falls, !reduceMotion, !busy {
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

    /// Post to Pulse or Send in a chat: the picture (and clip) drawn now; Today opens the way picked.
    private func shareInPantopus(_ kind: SkySharePantopusKind) async {
        failed = false
        makingInPantopus = kind
        defer { makingInPantopus = nil }
        do {
            let attachment = try await card.at(.now).attachment()
            onPantopus(kind == .pulse ? .pulse(attachment) : .chat(attachment))
            dismiss()
        } catch {
            failed = true
        }
    }
}
