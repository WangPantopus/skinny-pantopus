//
//  MomentsCameraModel.swift
//  Pantopus
//
//  The camera's state (board P1), held by the composer's model rather than by
//  the camera screen: on the iPhone Duo a fold builds the camera screen again
//  in the new pose's layout, and a recording keeps recording through it. The
//  capture session runs while the camera is what's showing; the composer
//  starts and stops it (`MomentsComposer`), never a screen going away.
//

import Photos
import SwiftUI
import UIKit

/// One of the newest photos or videos under the camera on the open Duo (board O7).
struct MomentsRecentItem: Identifiable {
    let asset: PHAsset
    let thumbnail: UIImage?

    var id: String {
        asset.localIdentifier
    }
}

@Observable
@MainActor
final class MomentsCameraModel {
    /// nil while starting; false where there's no camera or it isn't allowed.
    private(set) var ready: Bool?
    var flash = false
    private(set) var recording = false
    private(set) var elapsed: Double = 0
    private(set) var capturing = false
    /// The library button's picture: the newest photo or video, when the library is open to Pantopus.
    private(set) var newest: UIImage?
    /// Board O7's row: the newest four photos and videos; nil until read.
    private(set) var recents: [MomentsRecentItem]?
    /// The library is open to Pantopus (all of it, or the photos picked).
    private(set) var libraryAllowed = false

    @ObservationIgnored let controller = MomentsCameraController()
    @ObservationIgnored private var clock: Task<Void, Never>?
    @ObservationIgnored private var running = false
    /// The composer closed: a recording that stops now isn't posted.
    @ObservationIgnored private var discardsVideo = false
    /// What was taken goes to the composer's model.
    @ObservationIgnored var onPhoto: (@MainActor (UIImage) -> Void)?
    @ObservationIgnored var onVideo: (@MainActor (URL) -> Void)?

    init() {
        controller.onVideo = { [weak self] url in self?.finishedVideo(url) }
    }

    /// The camera shows: start it (asking for it the first time) and read the library's newest photo.
    func start() async {
        guard !running else { return }
        running = true
        discardsVideo = false
        let started = await controller.start()
        // It was stopped while it was starting (a quick switch to Text): leave it stopped.
        guard running else {
            controller.stop()
            return
        }
        ready = started
        newest = await MomentsLibraryLoader.newestThumbnail()
    }

    /// The camera no longer shows: the mode changed, a photo or video was taken, or the composer closed
    /// (`discarding`: a recording cut short by closing isn't posted).
    func stop(discarding: Bool = false) {
        if discarding { discardsVideo = true }
        guard running else { return }
        running = false
        controller.stop()
    }

    func takePhoto() {
        guard !capturing else { return }
        capturing = true
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        Task {
            let image = await controller.takePhoto(flash: flash)
            capturing = false
            if let image { onPhoto?(image) }
        }
    }

    func startVideo() {
        // A press after a fold, while the recording that began before it goes on, doesn't start a second one.
        guard !recording else { return }
        recording = true
        elapsed = 0
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        controller.startVideo(flash: flash)
        let started = Date()
        clock = Task { [weak self] in
            while !Task.isCancelled, self?.recording == true {
                try? await Task.sleep(for: .milliseconds(100))
                self?.elapsed = Date().timeIntervalSince(started)
            }
        }
    }

    func stopVideo() {
        controller.stopVideo()
    }

    /// "0:12" while recording, up to 0:30.
    var timeLabel: String {
        String(format: "0:%02d", min(Int(elapsed), 30))
    }

    /// The video finished: by letting go, at 30 seconds, or because the camera stopped.
    private func finishedVideo(_ url: URL?) {
        if recording { UIImpactFeedbackGenerator(style: .medium).impactOccurred() }
        recording = false
        clock?.cancel()
        guard let url, !discardsVideo else { return }
        onVideo?(url)
    }

    /// Board O7: the newest four photos and videos, only where the library is already open to Pantopus (See all
    /// opens the library, which asks).
    func loadRecents() async {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        libraryAllowed = status == .authorized || status == .limited
        guard libraryAllowed else {
            recents = []
            return
        }
        var items: [MomentsRecentItem] = []
        for asset in MomentsLibraryLoader.newestAssets(4) {
            await items.append(MomentsRecentItem(asset: asset, thumbnail: MomentsLibraryLoader.thumbnail(for: asset, side: 300)))
        }
        recents = items
    }
}
