//
//  MomentsStudioMotion.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 5, piece C on the iPhone (CONTRACT 10b): a Live Photo picked in the Studio keeps its
//  motion. The Studio finds the picked photo in Photos by its own time and copies its clip (`studioFindMotion`, run by
//  the Studio composer whenever its picture changes). The rail shows the moving-photo mark with "Motion on" (on by
//  default; never the word "Live", which means "taken here just now"). Once the Moment's photo is up, the clip goes up
//  beside it (`uploadStudioMotion`, one line in today's posting). Nothing happens unless the Studio is open and the
//  switch is on; today's composer and Post sheet never see any of it, and after a switch-off today's sheet posts the
//  still as today.
//

import AVFoundation
import Photos
import UIKit

/// A Live Photo's clip, copied from Photos while the Studio holds its still.
struct MomentsStudioMotionClip: Equatable {
    /// The photo it belongs to (Photos' own id).
    let asset: String
    let file: URL
    let seconds: Double

    /// The server's limits (CONTRACT 10b).
    static let longestSeconds = 4.0
    static let largestBytes = 15 * 1024 * 1024

    /// The clip paired with a Live Photo, in a file of its own; nil for any other photo, or one too long or too large.
    static func copy(of asset: PHAsset) async -> MomentsStudioMotionClip? {
        let resources = PHAssetResource.assetResources(for: asset)
        guard let resource = resources.first(where: { $0.type == .pairedVideo })
            ?? resources.first(where: { $0.type == .fullSizePairedVideo }) else { return nil }
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("motion-\(UUID().uuidString).mov")
        let options = PHAssetResourceRequestOptions()
        options.isNetworkAccessAllowed = true
        do {
            try await PHAssetResourceManager.default().writeData(for: resource, toFile: file, options: options)
        } catch {
            return nil
        }
        let size = ((try? FileManager.default.attributesOfItem(atPath: file.path))?[.size] as? Int) ?? 0
        let seconds = await (try? AVURLAsset(url: file).load(.duration).seconds) ?? 0
        guard size > 0, size <= largestBytes, seconds > 0, seconds <= longestSeconds + 0.05 else {
            try? FileManager.default.removeItem(at: file)
            return nil
        }
        return MomentsStudioMotionClip(asset: asset.localIdentifier, file: file, seconds: seconds)
    }

    /// One or two JPEG frames from the clip, for the server's picture check: its first and its middle.
    func frames() async -> [Data] {
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: file))
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 1080, height: 1080)
        var frames: [Data] = []
        for second in [0, seconds / 2] {
            guard let made = try? await generator.image(at: CMTime(seconds: second, preferredTimescale: 600)),
                  let data = UIImage(cgImage: made.image).jpegData(compressionQuality: 0.8) else { continue }
            frames.append(data)
        }
        return frames
    }
}

extension MomentsComposerModel {
    /// The clip of the Live Photo in the Studio, while its still is the picture as picked: not a before-and-after, not
    /// moved onto a canvas, drawn on, given a look, blurred or cut into, so the clip lines up with it and never shows
    /// again what was blurred.
    var studioMotionClip: MomentsStudioMotionClip? {
        guard case .photo = draft, studioPair == nil, let tools = marking.studio, let clip = tools.motion else { return nil }
        let untouched = marking.placement == nil && marking.marks.isEmpty && tools.look == .original
            && tools.blur?.blurred == nil && tools.cutouts.isEmpty
        return untouched ? clip : nil
    }

    /// "Motion on" for a Live Photo: its clip goes up with it.
    var studioKeepsMotion: Bool {
        studioMotionClip != nil && marking.studio?.keepsMotion != false
    }

    /// What the Studio finds a Live Photo by: the picked photo's own time, which the album gives (the camera gives none),
    /// while the Studio holds a photo and the switch is on.
    var studioMotionKey: Date? {
        guard marking.studio != nil, case .photo = draft, studioPair == nil, PulseReinventedFlags.shared.isOn else { return nil }
        return takenAt
    }

    /// The picture changed: the Live Photo taken at that moment, if there's exactly one, gives its clip; else none.
    func studioFindMotion() {
        guard let taken = studioMotionKey else { return }
        let options = PHFetchOptions()
        options.predicate = NSPredicate(format: "creationDate == %@", taken as NSDate)
        options.fetchLimit = 2
        let found = PHAsset.fetchAssets(with: .image, options: options)
        guard found.count == 1, let asset = found.firstObject else { return }
        studioKeepMotion(of: asset)
    }

    /// The photo picked: a Live Photo's clip is copied for the Studio, in the background; any other photo lets the last
    /// one's go.
    func studioKeepMotion(of asset: PHAsset) {
        guard marking.studio != nil else { return }
        let id = asset.localIdentifier
        if let old = marking.studio?.motion { try? FileManager.default.removeItem(at: old.file) }
        marking.studio?.motion = nil
        marking.studio?.motionFor = id
        marking.studio?.keepsMotion = true
        guard PulseReinventedFlags.shared.isOn, asset.mediaSubtypes.contains(.photoLive) else { return }
        Task { @MainActor [weak self] in
            let clip = await MomentsStudioMotionClip.copy(of: asset)
            // Another picture took the Studio meanwhile: this one's clip isn't wanted.
            guard let self, marking.studio?.motionFor == id else {
                if let clip { try? FileManager.default.removeItem(at: clip.file) }
                return
            }
            marking.studio?.motion = clip
        }
    }

    /// The moving-photo mark on the rail: on, the clip goes up; off, the still alone.
    func toggleStudioMotion() {
        guard studioMotionClip != nil else { return }
        marking.studio?.keepsMotion = !studioKeepsMotion
    }

    /// After Post (today's posting, beside the Studio's sound): the clip goes up once the Moment's photo is up. Nothing
    /// for a Moment that isn't a photo, with "Motion on" off, or with the switch off at this moment.
    func uploadStudioMotion(to moment: MomentDTO?) {
        guard let moment, moment.kind == .photo, studioKeepsMotion, PulseReinventedFlags.shared.isOn,
              let clip = studioMotionClip else { return }
        // Sent once; the Studio lets it go now, the send removes the file.
        marking.studio?.motion = nil
        Task { @MainActor in
            if let why = await MomentsStudioMotionSend(clip: clip).upload(momentId: moment.id) {
                await MomentsSoundRefusalAlert.show("The motion wasn't added", why)
            }
        }
    }
}

/// A Moment's motion going up (CONTRACT 10b): after its photo is up, the clip and its frames.
struct MomentsStudioMotionSend {
    let clip: MomentsStudioMotionClip

    /// Sends it; nil when it went on, else what to tell its author: the server's own sentence where it gave one.
    @MainActor
    func upload(momentId: String) async -> String? {
        defer { try? FileManager.default.removeItem(at: clip.file) }
        guard await photoIsUp(momentId) else { return "Its photo didn't finish going up, so it stays a still." }
        guard let data = try? Data(contentsOf: clip.file) else { return "It couldn't be read on your iPhone." }
        let frames = await clip.frames()
        guard !frames.isEmpty else { return "It couldn't be read on your iPhone." }
        let file = MultipartFile(fieldName: "file", filename: "motion.mov", mimeType: "video/quicktime", data: data)
        let stills = frames.enumerated().map { index, frame in
            MultipartFile(fieldName: "frames", filename: "frame\(index).jpg", mimeType: "image/jpeg", data: frame)
        }
        var failure = StudioPlayFailure(status: 0, code: nil, words: nil)
        for attempt in 0..<3 {
            if attempt > 0 { try? await Task.sleep(for: .seconds(3)) }
            guard let answer = try? await MultipartUploader.shared.uploadMomentMotion(momentId: momentId, clip: file, frames: stills) else {
                continue // A lost connection: once more.
            }
            if (200..<300).contains(answer.status) { return nil }
            let json = (try? JSONSerialization.jsonObject(with: answer.body)) as? [String: Any]
            failure = StudioPlayFailure(status: answer.status, code: json?["code"] as? String, words: json?["error"] as? String)
            if failure.code == "PULSE_REINVENTED_OFF" { await PulseReinventedFlags.shared.recheck() }
            // Storage down: again; any other answer stands.
            guard answer.status == 503 else { break }
        }
        return failure.message("It couldn't be sent.")
    }

    /// Today's uploader sends the photo in the background: wait for it (the server takes the clip only after it).
    @MainActor
    private func photoIsUp(_ momentId: String) async -> Bool {
        for attempt in 0..<60 {
            if attempt > 0 { try? await Task.sleep(for: .seconds(3)) }
            guard let moment = try? await MomentsAPI.send(MomentsEndpoints.moment(id: momentId), as: MomentEnvelope.self).moment else {
                continue
            }
            if moment.mediaURL != nil { return true }
            if moment.state == .ended { return false }
        }
        return false
    }
}
