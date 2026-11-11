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
    /// The library button's picture: the newest of the last 24 hours, when the library is open to Pantopus.
    private(set) var newest: UIImage?
    /// Board O7's row: the newest four of the last 24 hours; nil until read.
    private(set) var recents: [MomentsRecentItem]?
    /// The library is open to Pantopus (all of it, or the photos picked).
    private(set) var libraryAllowed = false
    /// On a table (board T3): Video, where the shutter starts and stops a video, or Photo.
    var tripodVideo = false
    /// On a table: 0 (off), 3 or 10 seconds before the photo or the video starts.
    var timer = 0
    /// The seconds left before the timer takes the photo or starts the video; nil when it isn't counting down.
    private(set) var countdown: Int?

    @ObservationIgnored let controller = MomentsCameraController()
    @ObservationIgnored private var clock: Task<Void, Never>?
    @ObservationIgnored private var countdownTask: Task<Void, Never>?
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
        cancelCountdown()
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

    /// Board O7: the newest four of the last 24 hours, only where the library is already open to Pantopus (See all
    /// opens the library, which asks).
    func loadRecents() async {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        libraryAllowed = status == .authorized || status == .limited
        guard libraryAllowed else {
            recents = []
            return
        }
        var items: [MomentsRecentItem] = []
        for asset in MomentsLibraryLoader.recentAssets().prefix(4) {
            await items.append(MomentsRecentItem(asset: asset, thumbnail: MomentsLibraryLoader.thumbnail(for: asset, side: 300)))
        }
        recents = items
    }
}

// MARK: - On a table (board T3)

extension MomentsCameraModel {
    /// The tripod's shutter: a photo, or a video started or stopped (tap to start, tap again to stop, 30 seconds at
    /// most); with a timer, once it has counted down. A tap while it counts down stops the countdown.
    func tripodShutter() {
        if recording { return stopVideo() }
        if countdown != nil { return cancelCountdown() }
        guard ready == true, !capturing else { return }
        guard timer > 0 else { return shoot() }
        let seconds = timer
        countdownTask = Task { [weak self] in
            for left in stride(from: seconds, to: 0, by: -1) {
                self?.countdown = left
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }
            }
            self?.countdown = nil
            self?.shoot()
        }
    }

    /// Stops a countdown before it takes anything: the camera stopped, or the Duo left the table.
    func cancelCountdown() {
        countdownTask?.cancel()
        countdownTask = nil
        countdown = nil
    }

    private func shoot() {
        if tripodVideo { startVideo() } else { takePhoto() }
    }
}
