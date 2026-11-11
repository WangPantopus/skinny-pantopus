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

    private(set) var photo: Photo?
    /// "Describe the photo (optional, for screen readers)", up to 200 letters.
    var photoAlt = "" {
        didSet {
            if photoAlt.count > Self.altLimit { photoAlt = String(photoAlt.prefix(Self.altLimit)) }
        }
    }

    static let altLimit = 200

    @ObservationIgnored private var uploadTask: Task<Void, Never>?
    @ObservationIgnored private let uploader: MultipartUploader

    init(uploader: MultipartUploader = .shared) {
        self.uploader = uploader
    }

    // MARK: What a send carries

    /// The uploaded photo and its description, for Look it over and the send.
    var pick: HolidayCardMediaPick {
        guard let stored = photo?.stored, photo?.status == .ready else { return .none }
        let alt = photoAlt.trimmingCharacters(in: .whitespacesAndNewlines)
        return HolidayCardMediaPick(photo: stored.fileId, photoAlt: alt.isEmpty ? nil : alt)
    }

    /// Why Seal it waits, or nil when it can go.
    var wait: String? {
        guard let photo else { return nil }
        switch photo.status {
        case .ready: return nil
        case .uploading: return "Waiting for the photo to finish uploading."
        case .failed: return "The photo didn’t upload. Try again, or remove it."
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

    /// The card went or was started over: everything goes.
    func reset() {
        remove()
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
