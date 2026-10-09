//
//  CachedAsyncImage.swift
//  Pantopus
//
//  `AsyncImage` with the same two call shapes, loading through
//  `PantopusImagePipeline` (Instant Screens contract section 6): an image
//  already decoded shows in the first frame (coming back to a screen never
//  re-downloads or flickers), then the phone's copy, then the network.
//  `keepsOnDisk: false` for full-size originals (the photo viewer).
//

import SwiftUI

struct CachedAsyncImage<Content: View>: View {
    private let url: URL?
    private let keepsOnDisk: Bool
    private let transaction: Transaction
    private let content: (AsyncImagePhase) -> Content
    @State private var phase: AsyncImagePhase
    @State private var loadedURL: URL?

    init(
        url: URL?,
        keepsOnDisk: Bool = true,
        transaction: Transaction = Transaction(),
        @ViewBuilder content: @escaping (AsyncImagePhase) -> Content
    ) {
        self.url = url
        self.keepsOnDisk = keepsOnDisk
        self.transaction = transaction
        self.content = content
        let cached = url.flatMap { PantopusImagePipeline.shared.cachedImage(for: $0) }
        _phase = State(initialValue: cached.map { .success(Image(uiImage: $0)) } ?? .empty)
        _loadedURL = State(initialValue: cached == nil ? nil : url)
    }

    var body: some View {
        content(phase)
            .task(id: url) { await load() }
    }

    private func load() async {
        guard let url else {
            phase = .empty
            loadedURL = nil
            return
        }
        guard loadedURL != url else { return }
        if let cached = PantopusImagePipeline.shared.cachedImage(for: url) {
            phase = .success(Image(uiImage: cached))
            loadedURL = url
            return
        }
        if loadedURL != nil { phase = .empty }
        let image = await PantopusImagePipeline.shared.image(for: url, keepsOnDisk: keepsOnDisk)
        guard !Task.isCancelled else { return }
        withTransaction(transaction) {
            phase = image.map { .success(Image(uiImage: $0)) } ?? .failure(URLError(.cannotDecodeContentData))
        }
        loadedURL = url
    }
}

extension CachedAsyncImage {
    /// The `AsyncImage(url:content:placeholder:)` shape.
    init<I: View, P: View>(
        url: URL?,
        keepsOnDisk: Bool = true,
        @ViewBuilder content: @escaping (Image) -> I,
        @ViewBuilder placeholder: @escaping () -> P
    ) where Content == _ConditionalContent<I, P> {
        self.init(url: url, keepsOnDisk: keepsOnDisk) { phase in
            if let image = phase.image {
                content(image)
            } else {
                placeholder()
            }
        }
    }
}
