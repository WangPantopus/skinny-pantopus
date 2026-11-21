//
//  CardTableShareVideo.swift
//  Pantopus
//
//  Sharing a Christmas card as a video of it arriving (the server's launch key
//  `card_share_video`): one 12-second film per picture, made ahead and kept in
//  public storage, with no note or name in it. The share sheet shows
//  Picture | Video only when the server answers with the picture's video; a
//  sealed card never asks. Video plays the film in the sheet, fetches the file
//  once, and hands it to Instagram, Facebook, Photos or the share sheet.
//

import AVFoundation
import Photos
import SwiftUI
import UIKit

/// Picture or Video at the top of the share sheet.
enum CardShareMode: String, CaseIterable, Identifiable {
    case picture
    case video

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .picture: "Picture"
        case .video: "Video"
        }
    }
}

/// The Picture | Video choice, drawn like the sheet's size choice.
struct CardShareModeChoice: View {
    @Binding var mode: CardShareMode
    @ScaledMetric(relativeTo: .footnote) private var label: CGFloat = 13.5

    var body: some View {
        HStack(spacing: 3) {
            ForEach(CardShareMode.allCases) { each in
                Button {
                    mode = each
                } label: {
                    Text(each.title)
                        .font(.system(size: label, weight: each == mode ? .semibold : .regular))
                        .foregroundStyle(each == mode ? MailPaper.tableCream : MailPaper.tableCreamSoft)
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .background(
                            each == mode ? MailPaper.tableCream.opacity(0.14) : .clear,
                            in: RoundedRectangle(cornerRadius: 9, style: .continuous)
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(each == mode ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("cardShareMode.\(each.rawValue)")
            }
        }
        .padding(3)
        .background(MailPaper.tableCream.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

/// The sheet's video part: the film playing, what is in it, and where it can go.
struct CardShareVideoSection: View {
    let content: CardTableContent
    let filmURL: URL
    let cardPage: String
    @Binding var say: String?
    @Binding var request: SystemSheetRequest?

    /// The video on this phone, once fetched for sharing.
    @State private var file: URL?
    @State private var failed = false
    @ScaledMetric(relativeTo: .caption) private var noteSize: CGFloat = 12.5
    @ScaledMetric(relativeTo: .caption2) private var tileLabel: CGFloat = 11.5
    @Environment(\.openURL) private var openURL

    /// The picture's video in public storage, or nil while the server has none. A sealed card never asks.
    static func find(_ content: CardTableContent) async -> URL? {
        guard !content.sealed else { return nil }
        let answer: HolidayCardShareVideo? = try? await APIClient.shared.request(
            HolidayCardEndpoints.shareVideo(design: content.design)
        )
        return answer.flatMap { URL(string: $0.url) }
    }

    var body: some View {
        VStack(spacing: 12) {
            CardShareFilmView(url: file ?? filmURL)
                .aspectRatio(9 / 16, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .shadow(color: .black.opacity(0.5), radius: 13, x: 0, y: 8)
                .frame(maxWidth: .infinity)
                .frame(height: min((AppWindow.height ?? .infinity) * 0.46, 430))
                .accessibilityElement()
                .accessibilityLabel("The video to share: the card arriving and opening, with no note or name in it.")
                .accessibilityIdentifier("cardShareVideoPreview")
            Text("The card arriving and opening, with the paper sounds. Nobody’s note or name is in it.")
                .font(.system(size: noteSize))
                .multilineTextAlignment(.center)
                .foregroundStyle(MailPaper.tableCreamFaint)
                .frame(maxWidth: .infinity)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 5), spacing: 6) {
                tile("Instagram", "instagram", AnyView(CardShareInstagramGlyph())) { share("instagram") }
                tile("Facebook", "facebook", AnyView(CardShareFacebookGlyph())) { share("facebook") }
                tile("Save", "save", icon(.download)) { save() }
                tile("More", "more", icon(.moreHorizontal)) { share("more") }
                tile("Copy link", "link", icon(.link)) { copyLink() }
            }
        }
        .task { await fetch() }
    }

    private func icon(_ name: PantopusIcon) -> AnyView {
        AnyView(Icon(name, size: 22, strokeWidth: 1.7, color: MailPaper.tableCream))
    }

    private func tile(_ title: String, _ identifier: String, _ glyph: AnyView, perform: @escaping () -> Void) -> some View {
        let usable = identifier == "link" || file != nil
        return Button(action: perform) {
            VStack(spacing: 6) {
                glyph
                    .frame(width: 44, height: 44)
                    .background(MailPaper.tableCream.opacity(0.1), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                Text(title)
                    .font(.system(size: tileLabel))
                    .foregroundStyle(MailPaper.tableCreamSoft)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 64, alignment: .top)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!usable)
        .opacity(usable ? 1 : 0.45)
        .accessibilityIdentifier("cardShareAction.\(identifier)")
    }

    /// The file on this phone, so a button can hand it on straight from the press; kept in Caches for next time.
    private func fetch() async {
        guard file == nil else { return }
        let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("card-share", isDirectory: true)
        let target = folder.appendingPathComponent("pantopus-christmas-card-\(content.design).mp4")
        if FileManager.default.fileExists(atPath: target.path) {
            file = target
            return
        }
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let (downloaded, response) = try await URLSession.shared.download(from: filmURL)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            try? FileManager.default.removeItem(at: target)
            try FileManager.default.moveItem(at: downloaded, to: target)
            file = target
        } catch {
            failed = true
            say = "We couldn’t load the video. Check your connection, or copy the link instead."
        }
    }

    private func share(_ kind: String) {
        guard let file else { return }
        count(kind)
        if kind != "more", let url = CardShareStories.video(file, to: kind, page: cardPage) {
            openURL(url)
            return
        }
        request = .share(items: kind == "more" ? [file, cardPage] : [file])
    }

    private func save() {
        guard let file else { return }
        count("save")
        Task { @MainActor in say = await CardShareStories.saveVideo(file) }
    }

    private func copyLink() {
        count("link")
        UIPasteboard.general.string = cardPage
        say = "Link copied."
    }

    private func count(_ kind: String) {
        let body = HolidayCardSharedBody(design: content.design, kind: kind, format: "video", withNote: false)
        Task { _ = try? await APIClient.shared.request(HolidayCardEndpoints.shared(body)) }
    }
}

extension CardShareStories {
    /// A video to a new Story in one tap, where the phone has the app and this build has a Meta app ID.
    static func video(_ file: URL, to app: String, page: String) -> URL? {
        guard let id = CardTableShareLinks.metaAppID, let data = try? Data(contentsOf: file) else { return nil }
        let scheme = app == "instagram" ? "instagram-stories" : app == "facebook" ? "facebook-stories" : nil
        guard let scheme, let url = URL(string: "\(scheme)://share?source_application=\(id)"),
              UIApplication.shared.canOpenURL(url) else { return nil }
        let item: [String: Any] = app == "instagram"
            ? ["com.instagram.sharedSticker.backgroundVideo": data, "com.instagram.sharedSticker.contentURL": page]
            : ["com.facebook.sharedSticker.backgroundVideo": data, "com.facebook.sharedSticker.appID": id]
        UIPasteboard.general.setItems([item], options: [.expirationDate: Date().addingTimeInterval(300)])
        return url
    }

    /// Saves the video to Photos, and says how it went.
    static func saveVideo(_ file: URL) async -> String {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            return "Pantopus can’t save to your photos. You can allow it in Settings, under Privacy & Security, Photos."
        }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                _ = PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: file)
            }
            return "Saved to your photos."
        } catch {
            let device = await DeviceWords.plainName
            return "We couldn’t save it to your photos. Check that there’s room on your \(device), then try again."
        }
    }
}

/// The share video playing in the sheet: muted, looping, no controls.
struct CardShareFilmView: UIViewRepresentable {
    let url: URL

    func makeUIView(context _: Context) -> FilmLayerView {
        let view = FilmLayerView()
        view.play(url)
        return view
    }

    func updateUIView(_ view: FilmLayerView, context _: Context) {
        if view.playing != url { view.play(url) }
    }

    static func dismantleUIView(_ view: FilmLayerView, coordinator _: ()) {
        view.stop()
    }

    final class FilmLayerView: UIView {
        override static var layerClass: AnyClass {
            AVPlayerLayer.self
        }

        private var looper: AVPlayerLooper?
        private var player: AVQueuePlayer?
        private(set) var playing: URL?

        func play(_ url: URL) {
            stop()
            let player = AVQueuePlayer()
            player.isMuted = true
            looper = AVPlayerLooper(player: player, templateItem: AVPlayerItem(url: url))
            (layer as? AVPlayerLayer)?.player = player
            (layer as? AVPlayerLayer)?.videoGravity = .resizeAspect
            player.play()
            self.player = player
            playing = url
        }

        func stop() {
            player?.pause()
            looper = nil
            player = nil
            playing = nil
        }
    }
}
