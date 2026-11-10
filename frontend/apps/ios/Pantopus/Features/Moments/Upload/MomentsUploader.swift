//
//  MomentsUploader.swift
//  Pantopus
//
//  Posting a Moment keeps going after the Post sheet closes (board P5): the
//  Moment is made, its file goes up with retries on a weak connection, and
//  your ring on the map shows the progress ("Posting · 65%") until the
//  Moment is live. Each one waits in its own outbox folder, so an upload the
//  app was closed in the middle of picks up at the next launch (the server
//  takes the same file again as a no-op). The files go once it's done.
//

import Foundation
import Logging
import Observation
import UIKit

/// A Moment on its way to the map.
struct MomentPosting: Identifiable, Equatable {
    enum Phase: Equatable {
        case uploading
        /// The file is in; the picture check is running.
        case checking
        /// Stopped; Retry tries again.
        case failed(String)
    }

    let id: String
    let kind: MomentKind
    var momentId: String?
    var latitude: Double
    var longitude: Double
    var progress: Double
    var phase: Phase
}

/// What a waiting upload needs after a relaunch.
private struct MomentOutboxManifest: Codable {
    let id: String
    let account: String
    let momentId: String
    let latitude: Double
    let longitude: Double
    let media: MomentPreparedMedia
}

@Observable
@MainActor
final class MomentsUploader {
    static let shared = MomentsUploader()

    private(set) var postings: [MomentPosting] = []
    /// Bumped each time a Moment goes live or ends up held: the map reads its rings again.
    private(set) var finished = 0
    /// A sentence for the map after a Moment couldn't post or waits for review; the map clears it once shown.
    var notice: String?

    @ObservationIgnored private var tasks: [String: Task<Void, Never>] = [:]
    @ObservationIgnored private var drafts: [String: (body: MomentCreateBody, media: MomentPreparedMedia?)] = [:]
    @ObservationIgnored private var resumed = false
    private let logger = Logger(label: "app.pantopus.ios.MomentsUploader")
    /// Uploads get longer than the shared uploader's two minutes: a 50 MB video on a weak connection.
    private let uploader: MultipartUploader = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 90
        config.timeoutIntervalForResource = 900
        return MultipartUploader(session: URLSession(configuration: config))
    }()

    // MARK: - Posting

    /// A new outbox folder for a Moment's files.
    static func newFolder() throws -> (id: String, url: URL) {
        let id = UUID().uuidString
        let url = try outboxRoot().appendingPathComponent(id, isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return (id, url)
    }

    /// A folder made for a Moment that won't be posted (Retake, the composer closed).
    static func discardFolder(_ id: String) {
        guard let folder = try? outboxRoot().appendingPathComponent(id, isDirectory: true) else { return }
        try? FileManager.default.removeItem(at: folder)
    }

    /// Starts posting: `media` (made in `folder`) for a photo or video, nil for a text card.
    func post(_ body: MomentCreateBody, media: MomentPreparedMedia?, folderId: String) {
        let posting = MomentPosting(
            id: folderId,
            kind: body.kind,
            momentId: nil,
            latitude: body.location.latitude,
            longitude: body.location.longitude,
            progress: 0,
            phase: .uploading
        )
        postings.insert(posting, at: 0)
        // The outbox folder's id names this Post tap to the server, so a retry returns the same Moment.
        var body = body
        body.clientRequestId = folderId.lowercased()
        drafts[folderId] = (body, media)
        run(folderId)
    }

    /// Retry after a failure.
    func retry(_ id: String) {
        guard let index = postings.firstIndex(where: { $0.id == id }) else { return }
        postings[index].phase = .uploading
        run(id)
    }

    /// Give up on one: its files go.
    func discard(_ id: String) {
        tasks.removeValue(forKey: id)?.cancel()
        let momentId = postings.first { $0.id == id }?.momentId
        finish(id)
        // A Moment made but never uploaded would wait as "uploading" until it ends; delete it.
        if let momentId { Task { try? await MomentsAPI.send(MomentsEndpoints.delete(id: momentId)) } }
    }

    private func run(_ id: String) {
        tasks[id]?.cancel()
        tasks[id] = Task { [weak self] in
            await self?.carry(id)
        }
    }

    /// Makes the Moment (once), sends its file with retries, then waits for it to go live.
    private func carry(_ id: String) async {
        let background = UIApplication.shared.beginBackgroundTask(withName: "Moment upload")
        defer { UIApplication.shared.endBackgroundTask(background) }
        var attempt = 0
        while !Task.isCancelled {
            do {
                try await step(id)
                return
            } catch let failure as MomentsFailure where failure.isTransient && attempt < 8 {
                attempt += 1
                let delay = min(30.0, pow(2, Double(attempt)))
                try? await Task.sleep(for: .seconds(delay))
            } catch let failure as MomentsFailure {
                fail(id, failure)
                return
            } catch is CancellationError {
                return
            } catch {
                fail(id, .offline)
                return
            }
        }
    }

    private func step(_ id: String) async throws {
        guard let index = postings.firstIndex(where: { $0.id == id }) else { return }
        var momentId = postings[index].momentId
        if momentId == nil, let draft = drafts[id] {
            let created: MomentEnvelope = try await MomentsAPI.send(MomentsEndpoints.create(draft.body))
            momentId = created.moment.id
            update(id) {
                $0.momentId = created.moment.id
                // With "Show the area instead" the pin is the area's point.
                $0.latitude = created.moment.latitude
                $0.longitude = created.moment.longitude
            }
            if let media = draft.media { save(id: id, momentId: created.moment.id, media: media) }
            if created.moment.state == .live || draft.media == nil {
                await settle(id, state: created.moment.state)
                return
            }
        }
        guard let momentId else { return }
        let media = drafts[id]?.media ?? manifest(id)?.media
        guard let media else {
            finish(id)
            return
        }
        let uploaded = try await upload(id: id, momentId: momentId, media: media)
        await settle(id, state: uploaded.state, momentId: momentId)
    }

    private func upload(id: String, momentId: String, media: MomentPreparedMedia) async throws -> MomentDTO {
        let folder = try Self.outboxRoot().appendingPathComponent(id, isDirectory: true)
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        let body = try MomentsUploadBody.write(media: media, folder: folder, boundary: boundary)
        defer { try? FileManager.default.removeItem(at: body) }
        let (data, response): (Data, HTTPURLResponse)
        do {
            (data, response) = try await uploader.uploadMomentMedia(momentId: momentId, bodyFile: body, boundary: boundary) { fraction in
                Task { @MainActor [weak self] in
                    self?.update(id) { $0.progress = max($0.progress, fraction) }
                }
            }
        } catch let error as APIError {
            throw MomentsFailure(error)
        } catch is URLError {
            throw MomentsFailure.offline
        }
        guard (200..<300).contains(response.statusCode) else {
            throw MomentsFailure(status: response.statusCode, body: data)
        }
        update(id) { $0.progress = 1 }
        return try JSONDecoder().decode(MomentEnvelope.self, from: data).moment
    }

    /// Live: the ring shows on the next read. Checking: waits for the picture
    /// check (a minute at most). Held: says so.
    private func settle(_ id: String, state: MomentState, momentId: String? = nil) async {
        var state = state
        if state == .checking, let momentId {
            update(id) { $0.phase = .checking }
            for _ in 0..<30 where state == .checking && !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))
                if let reply: MomentEnvelope = try? await MomentsAPI.send(MomentsEndpoints.moment(id: momentId)) {
                    state = reply.moment.state
                }
            }
        }
        if state == .held {
            notice = "Your Moment is waiting for a quick review before it shows."
        }
        finish(id)
        finished += 1
    }

    private func fail(_ id: String, _ failure: MomentsFailure) {
        logger.warning("Moment upload stopped: \(failure.message)")
        switch failure {
        case .dailyLimit, .locationTooOld, .captureTooOld, .mediaTooLong, .mediaRejected, .unavailable, .ageNotEligible:
            // Trying again won't help: say why and let it go.
            notice = failure.message
            discard(id)
        default:
            update(id) { $0.phase = .failed(failure.message) }
        }
    }

    private func finish(_ id: String) {
        postings.removeAll { $0.id == id }
        drafts.removeValue(forKey: id)
        tasks.removeValue(forKey: id)
        if let folder = try? Self.outboxRoot().appendingPathComponent(id, isDirectory: true) {
            try? FileManager.default.removeItem(at: folder)
        }
    }

    private func update(_ id: String, _ change: (inout MomentPosting) -> Void) {
        guard let index = postings.firstIndex(where: { $0.id == id }) else { return }
        change(&postings[index])
    }

    // MARK: - After a relaunch

    /// Uploads the app was closed in the middle of, for the signed-in account, pick up again.
    func resume(account: String?) {
        guard !resumed, let account, let root = try? Self.outboxRoot() else { return }
        resumed = true
        let folders = (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? []
        for folder in folders {
            let id = folder.lastPathComponent
            let saved = manifest(id)
            guard let saved, saved.account == account else {
                // Never made on the server: nothing to finish. Another account's waits for it.
                if saved == nil { try? FileManager.default.removeItem(at: folder) }
                continue
            }
            postings.append(MomentPosting(
                id: id,
                kind: saved.media.kind,
                momentId: saved.momentId,
                latitude: saved.latitude,
                longitude: saved.longitude,
                progress: 0,
                phase: .uploading
            ))
            run(id)
        }
    }

    private func save(id: String, momentId: String, media: MomentPreparedMedia) {
        guard case let .signedIn(user) = AuthManager.shared.state,
              let posting = postings.first(where: { $0.id == id }),
              let folder = try? Self.outboxRoot().appendingPathComponent(id, isDirectory: true) else { return }
        let manifest = MomentOutboxManifest(
            id: id, account: user.id, momentId: momentId, latitude: posting.latitude, longitude: posting.longitude, media: media
        )
        guard let data = try? JSONEncoder().encode(manifest) else { return }
        try? data.write(
            to: folder.appendingPathComponent("manifest.json"),
            options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]
        )
    }

    private func manifest(_ id: String) -> MomentOutboxManifest? {
        guard let folder = try? Self.outboxRoot().appendingPathComponent(id, isDirectory: true),
              let data = try? Data(contentsOf: folder.appendingPathComponent("manifest.json")) else { return nil }
        return try? JSONDecoder().decode(MomentOutboxManifest.self, from: data)
    }

    /// Sign-out: nothing of the last account's waits.
    func reset() {
        for task in tasks.values {
            task.cancel()
        }
        tasks = [:]
        drafts = [:]
        postings = []
        resumed = false
        if let root = try? Self.outboxRoot() { try? FileManager.default.removeItem(at: root) }
    }

    private static func outboxRoot() throws -> URL {
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let root = support.appendingPathComponent("MomentsOutbox", isDirectory: true)
        if !FileManager.default.fileExists(atPath: root.path) {
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            var excluded = root
            try? excluded.setResourceValues(values)
        }
        return root
    }
}
