//
//  HolidayCardAttachments.swift
//  Pantopus
//
//  What a card being written carries beside its note (memories plan step 4, `holiday_card_memories`; wave 4
//  drawings 1 and 2): its own photo, uploaded as soon as it's chosen with its own progress, and the photo's optional
//  description. Seal it waits until the photo is uploaded; a failed upload keeps the note and the chosen photo and
//  offers Try again or Remove, so a card never goes silently without it. The upload is a JPEG made here (upright, no
//  location or other metadata); the server keeps its own copy at most 1600 px on its long side.
//

import ImageIO
import SwiftUI
import UIKit

@MainActor @Observable
final class HolidayCardAttachments {
    enum PhotoStatus: Equatable {
        case uploading
        case ready
        case failed(String)
    }

    struct Photo {
        var status: PhotoStatus
        /// The bytes sent (kept to try again); the picture drawn until the stored copy is read.
        var upload: Data
        var mimeType: String
        var preview: UIImage?
        /// 0 to 1 while it uploads.
        var progress: Double = 0
        /// The stored photo once uploaded.
        var stored: CardPhoto?
        /// Which upload this is, so an older one's answer never lands on a newer photo.
        var token = UUID()
    }

    /// The card's own voice greeting (memories plan step 7): uploaded as soon as the recording stops.
    struct Voice {
        var status: PhotoStatus
        /// This phone's recording: sent (and kept to try again) and played by Listen, never written to disk.
        var upload: Data
        var stored: CardVoice?
        var token = UUID()
    }

    private(set) var photo: Photo?
    private(set) var voice: Voice?
    /// Records the greeting; what it records goes up at once.
    let recorder = HolidayCardVoiceRecorder()
    /// "Describe the photo (optional, for screen readers)", up to 200 letters.
    var photoAlt = "" {
        didSet {
            if photoAlt.count > Self.altLimit { photoAlt = String(photoAlt.prefix(Self.altLimit)) }
        }
    }

    static let altLimit = 200

    @ObservationIgnored private var uploadTask: Task<Void, Never>?
    @ObservationIgnored private let uploader: MultipartUploader

    @ObservationIgnored private var voiceTask: Task<Void, Never>?

    init(uploader: MultipartUploader = .shared) {
        self.uploader = uploader
        recorder.onRecorded = { [weak self] data in self?.addVoice(data) }
    }

    // MARK: What a send carries

    /// The uploaded photo and its description, for Look it over and the send.
    var pick: HolidayCardMediaPick {
        var pick = HolidayCardMediaPick()
        if let stored = photo?.stored, photo?.status == .ready {
            let alt = photoAlt.trimmingCharacters(in: .whitespacesAndNewlines)
            pick.photo = stored.fileId
            pick.photoAlt = alt.isEmpty ? nil : alt
        }
        if let stored = voice?.stored, voice?.status == .ready { pick.voice = stored.fileId }
        return pick
    }

    /// Why Seal it waits, or nil when it can go.
    var wait: String? {
        switch photo?.status {
        case .uploading: return "Waiting for the photo to finish uploading."
        case .failed: return "The photo didn’t upload. Try again, or remove it."
        case .ready, nil: break
        }
        if recorder.recording { return "Stop the recording first." }
        switch voice?.status {
        case .uploading: return "Waiting for the greeting to finish uploading."
        case .failed: return "The greeting didn’t upload. Try again, or remove it."
        case .ready, nil: return nil
        }
    }

    // MARK: The greeting

    /// A recording that just stopped: uploaded at once, as AAC in MP4.
    func addVoice(_ data: Data) {
        voiceTask?.cancel()
        voice = Voice(status: .uploading, upload: data)
        uploadVoice()
    }

    func retryVoice() {
        guard voice != nil else { return }
        voice?.status = .uploading
        uploadVoice()
    }

    func removeVoice() {
        if recorder.recording { recorder.stop() }
        voiceTask?.cancel()
        voiceTask = nil
        voice = nil
    }

    private func uploadVoice() {
        guard var voice else { return }
        voice.token = UUID()
        self.voice = voice
        let token = voice.token
        let file = MultipartFile(fieldName: "file", filename: "greeting.m4a", mimeType: "audio/mp4", data: voice.upload)
        let uploader = uploader
        voiceTask = Task { [weak self] in
            do {
                let answer = try await uploader.uploadHolidayCardMedia(kind: "voice", file: file)
                guard !Task.isCancelled, let self, self.voice?.token == token else { return }
                self.voice?.stored = CardVoice(fileId: answer.media.fileId, durationMs: answer.media.durationMs)
                self.voice?.status = .ready
                HolidayCardMediaStore.shared.keep(voice.upload, for: answer.media.fileId)
            } catch {
                guard !Task.isCancelled, let self, self.voice?.token == token else { return }
                self.voice?.status = .failed(
                    HolidayCardFlowViewModel.refusal(error, fallback: "The greeting didn’t upload. Check your connection.")
                )
            }
        }
    }

    // MARK: Adding, trying again, removing

    /// A photo chosen in the system picker: made into an upright JPEG with no metadata here, then uploaded at once.
    /// What can't be read as a still picture goes as it is, so the server says why it can't take it.
    func add(_ data: Data) {
        uploadTask?.cancel()
        let token = UUID()
        photo = Photo(status: .uploading, upload: data, mimeType: "application/octet-stream", preview: nil, token: token)
        uploadTask = Task { [weak self] in
            // Drawing a 12-megapixel photo takes a moment: off the main thread.
            let made = await Task.detached(priority: .userInitiated) { Self.jpeg(from: data) }.value
            guard !Task.isCancelled, let self, photo?.token == token else { return }
            if let made {
                photo?.upload = made.data
                photo?.mimeType = "image/jpeg"
                photo?.preview = made.image
            } else {
                // A moving picture's first frame, while the server says why it can't go.
                photo?.preview = UIImage(data: data)
            }
            upload()
        }
    }

    func retry() {
        guard photo != nil else { return }
        photo?.status = .uploading
        photo?.progress = 0
        upload()
    }

    func remove() {
        uploadTask?.cancel()
        uploadTask = nil
        photo = nil
        photoAlt = ""
    }

    /// A draft brought back after the app was closed: its stored photo and greeting, by reference only. Nothing of their
    /// bytes is on this phone any more, so the print and Listen read them from the uploader's own route.
    func restore(photo stored: CardPhoto?, alt: String, voice storedVoice: CardVoice?) {
        uploadTask?.cancel()
        voiceTask?.cancel()
        photo = stored.map { Photo(status: .ready, upload: Data(), mimeType: "image/jpeg", progress: 1, stored: $0) }
        photoAlt = stored == nil ? "" : alt
        voice = storedVoice.map { Voice(status: .ready, upload: Data(), stored: $0) }
    }

    /// The card went or was started over: everything goes.
    func reset() {
        remove()
        removeVoice()
        recorder.clearRefused()
    }

    private func upload() {
        guard var photo else { return }
        photo.token = UUID()
        self.photo = photo
        let token = photo.token
        let file = MultipartFile(
            fieldName: "file",
            filename: photo.mimeType == "image/jpeg" ? "photo.jpg" : "photo",
            mimeType: photo.mimeType,
            data: photo.upload
        )
        let uploader = uploader
        uploadTask = Task { [weak self] in
            do {
                let answer = try await uploader.uploadHolidayCardMedia(kind: "photo", file: file) { fraction in
                    Task { @MainActor [weak self] in self?.progressed(fraction, token: token) }
                }
                guard !Task.isCancelled else { return }
                self?.uploaded(answer, token: token)
            } catch {
                guard !Task.isCancelled else { return }
                self?.failed(error, token: token)
            }
        }
    }

    private func progressed(_ fraction: Double, token: UUID) {
        guard photo?.token == token, photo?.status == .uploading else { return }
        photo?.progress = fraction
    }

    private func uploaded(_ answer: HolidayCardMediaUpload, token: UUID) {
        guard photo?.token == token else { return }
        let media = answer.media
        photo?.stored = CardPhoto(fileId: media.fileId, width: media.width, height: media.height, alt: nil)
        photo?.status = .ready
        photo?.progress = 1
        if let bytes = photo?.upload, photo?.mimeType == "image/jpeg" {
            HolidayCardMediaStore.shared.keep(bytes, for: media.fileId)
        }
    }

    private func failed(_ error: any Error, token: UUID) {
        guard photo?.token == token else { return }
        photo?.status = .failed(
            HolidayCardFlowViewModel.refusal(error, fallback: "The photo didn’t upload. Check your connection.")
        )
    }

    // MARK: Making the JPEG

    /// The picked picture drawn upright at most 2400 px on its long side, as a JPEG with no metadata (the drawing
    /// leaves EXIF and location behind). Nil for what isn't one still picture: a moving GIF or bytes that aren't a
    /// picture go as they are, for the server to refuse in its own words.
    nonisolated static func jpeg(from data: Data) -> (data: Data, image: UIImage)? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil), CGImageSourceGetCount(source) == 1,
              let image = UIImage(data: data) else { return nil }
        let longest = max(image.size.width, image.size.height)
        guard longest > 0 else { return nil }
        let scale = min(1, 2400 / longest)
        let size = CGSize(width: (image.size.width * scale).rounded(), height: (image.size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let drawn = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        guard let jpeg = drawn.jpegData(compressionQuality: 0.86) else { return nil }
        return (jpeg, drawn)
    }
}
