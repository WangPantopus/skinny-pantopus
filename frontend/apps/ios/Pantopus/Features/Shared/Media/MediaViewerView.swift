//
//  MediaViewerView.swift
//  Pantopus
//
//  Full-screen paged media viewer for Pulse posts — images, videos
//  (native AVKit controls), and Live Photos (LIVE replay pill +
//  long-press, same gesture as the grid tile). Mirrors the RN app's
//  `ImageViewerModal`.
//

import AVKit
import PDFKit
import SwiftUI

/// Full-screen, horizontally paged gallery over a post's media.
public struct MediaViewerView: View {
    private let items: [PostMediaItem]
    @State private var selection: Int
    /// How far the media has been pulled down: past a short pull the viewer
    /// closes (founder request 2026-10-29). 0 at rest.
    @State private var pullDown: CGFloat = 0
    /// A drag's direction, settled by its first few points: across pages, or
    /// down to close.
    @State private var pullAxis: PullAxis = .undecided
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum PullAxis {
        case undecided
        case vertical
        case horizontal
    }

    public init(items: [PostMediaItem], startIndex: Int = 0) {
        self.items = items
        _selection = State(initialValue: min(max(0, startIndex), max(0, items.count - 1)))
    }

    public var body: some View {
        ZStack(alignment: .top) {
            // Fades as the media is pulled down, so the screen behind shows.
            Color.black
                .opacity(Double(1 - pullProgress * 0.7))
                .ignoresSafeArea()

            TabView(selection: $selection) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    slide(item, isActive: index == selection)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea(edges: .bottom)
            .offset(y: pullDown)
            .scaleEffect(reduceMotion ? 1 : 1 - pullProgress * 0.15)
            .simultaneousGesture(pullToClose)

            topBar
                .opacity(Double(1 - pullProgress))
        }
        .presentationBackground(.clear)
        .statusBarHidden()
        .accessibilityAction(.escape) { dismiss() }
        .accessibilityIdentifier("mediaViewer")
        .onReceive(NotificationCenter.default.publisher(for: ChatLocalStore.historyRetired)) { _ in
            if items.contains(where: { ChatMediaURL.isChatFile($0.url) }) { dismiss() }
        }
    }

    private var topBar: some View {
        HStack {
            if items.count > 1 {
                Text("\(selection + 1) / \(items.count)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 10)
                    .frame(height: 28)
                    .background(Color.black.opacity(0.45))
                    .clipShape(Capsule())
                    .accessibilityLabel("Item \(selection + 1) of \(items.count)")
            }
            Spacer()
            Button {
                dismiss()
            } label: {
                Icon(.x, size: 18, strokeWidth: 2.4, color: Color.white)
                    .frame(width: 36, height: 36)
                    .background(Color.black.opacity(0.45))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("mediaViewerClose")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
    }

    // MARK: - Pull down to close

    /// 0 at rest, 1 once the media is pulled well down.
    private var pullProgress: CGFloat {
        min(1, pullDown / 400)
    }

    /// A document scrolls its own pages, so a drag down there scrolls it.
    private var closesOnPull: Bool {
        items.indices.contains(selection) && items[selection].kind != .document
    }

    /// Drag the media down to close the viewer; sideways still pages. Let go
    /// early and it settles back.
    private var pullToClose: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                if pullAxis == .undecided {
                    pullAxis = value.translation.height > abs(value.translation.width) ? .vertical : .horizontal
                }
                guard pullAxis == .vertical, closesOnPull else { return }
                pullDown = max(0, value.translation.height)
            }
            .onEnded { value in
                defer { pullAxis = .undecided }
                guard pullAxis == .vertical, closesOnPull else { return }
                if value.translation.height > 120 || value.predictedEndTranslation.height > 260 {
                    dismiss()
                } else {
                    withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) { pullDown = 0 }
                }
            }
    }

    @ViewBuilder
    private func slide(_ item: PostMediaItem, isActive: Bool) -> some View {
        switch item.kind {
        case .image:
            viewerImage(item.url)
        case .document:
            PostPDFSlide(url: item.url)
        case .video:
            VideoSlideView(url: item.url, isActive: isActive)
        case .livePhoto:
            LivePhotoTileView(
                stillURL: item.url,
                thumbnailURL: nil,
                videoURL: item.liveVideoURL ?? item.url,
                contentMode: .fit,
                isActive: isActive,
                showsDot: false,
                showsReplayButton: true
            )
        }
    }

    private func viewerImage(_ url: URL) -> some View {
        CachedAsyncImage(url: url, keepsOnDisk: false) { phase in
            switch phase {
            case let .success(image):
                image.resizable().scaledToFit()
            case .failure:
                Icon(.alertCircle, size: 32, color: Theme.Color.appTextMuted)
            case .empty:
                ProgressView().tint(Color.white)
            @unknown default:
                Color.black
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityLabel("Photo")
    }
}

// MARK: - Video slide

/// One video page — AVKit player with native controls. Playback starts
/// when the page becomes the selection and pauses when swiped away.
private struct VideoSlideView: View {
    let url: URL
    let isActive: Bool

    @State private var player: AVPlayer?
    @State private var localFile: URL?
    @State private var failed = false

    var body: some View {
        ZStack {
            if let player {
                VideoPlayer(player: player)
            } else if failed {
                Text("Couldn't open this video.").foregroundStyle(.white)
            } else {
                ProgressView().tint(Color.white)
            }
        }
        .task(id: url) {
            if player == nil {
                do {
                    let source: URL
                    if ChatMediaURL.isChatFile(url) {
                        let file = try await ChatMediaURL.download(raw: url.absoluteString, filename: "video.mp4", mimeType: "video/mp4")
                        if Task.isCancelled {
                            try? FileManager.default.removeItem(at: file.deletingLastPathComponent())
                            return
                        }
                        localFile = file
                        source = file
                    } else {
                        source = url
                    }
                    player = AVPlayer(url: source)
                } catch is CancellationError {
                    return
                } catch {
                    failed = true
                }
            }
            if isActive { player?.play() }
        }
        .onChange(of: isActive) { _, nowActive in
            if nowActive {
                player?.play()
            } else {
                player?.pause()
            }
        }
        .onDisappear {
            player?.pause()
            player = nil
            if let localFile { try? FileManager.default.removeItem(at: localFile.deletingLastPathComponent()) }
            localFile = nil
        }
        .accessibilityLabel("Video player")
    }
}

#Preview("Viewer — mixed media") {
    MediaViewerView(
        items: [
            PostMediaItem(
                id: "0",
                kind: .image,
                url: URL(string: "https://picsum.photos/900/1200")!
            ),
            PostMediaItem(
                id: "1",
                kind: .livePhoto,
                url: URL(string: "https://picsum.photos/901/1200")!,
                liveVideoURL: URL(string: "https://example.com/clip.mov")
            )
        ],
        startIndex: 0
    )
}

/// PDFKit renders every page with scrolling and pinch-to-zoom inside the gallery.
private struct PostPDFSlide: View {
    let url: URL
    @State private var document: PDFDocument?
    @State private var failed = false
    @State private var attempt = 0

    var body: some View {
        Group {
            if let document {
                PostPDFView(document: document)
            } else if failed {
                VStack(spacing: 16) {
                    Text("Couldn't open this PDF.").foregroundStyle(.white)
                    Button("Try again") { attempt += 1 }
                }
            } else {
                ProgressView().tint(.white)
            }
        }
        .padding(.top, 52)
        .task(id: "\(url)-\(attempt)") {
            failed = false
            do {
                let data = try await loadPDF()
                try Task.checkCancellation()
                guard let pdf = PDFDocument(data: data), !pdf.isLocked, pdf.pageCount > 0 else { throw URLError(.cannotDecodeContentData) }
                document = pdf
            } catch is CancellationError {
                return
            } catch {
                failed = true
            }
        }
    }

    private func loadPDF() async throws -> Data {
        if ChatMediaURL.isChatFile(url) { return try await ChatMediaURL.openedData(url, limit: 25 * 1024 * 1024) }
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        let (bytes, response) = try await URLSession.shared.bytes(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              response.expectedContentLength <= 25 * 1024 * 1024 else { throw URLError(.badServerResponse) }
        var data = Data()
        for try await byte in bytes {
            guard data.count < 25 * 1024 * 1024 else { throw URLError(.dataLengthExceedsMaximum) }
            data.append(byte)
        }
        return data
    }
}

private struct PostPDFView: UIViewRepresentable {
    let document: PDFDocument

    func makeUIView(context _: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.document = document
        return view
    }

    func updateUIView(_ view: PDFView, context _: Context) {
        if view.document !== document { view.document = document }
    }
}
