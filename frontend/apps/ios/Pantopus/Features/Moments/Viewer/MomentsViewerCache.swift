//
//  MomentsViewerCache.swift
//  Pantopus
//
//  What a viewer has read: each Moment (its signed media link lasts 15
//  minutes, so a copy older than 12 is read again) and the photos it has
//  loaded, in memory only and never on disk. A person's whole ring and the
//  people on either side are read ahead in one request, with their pictures,
//  so a tap or a swipe shows the next one at once.
//

import Foundation
import UIKit

@MainActor
final class MomentsViewerCache {
    let session = URLSession(configuration: .ephemeral)
    private var details: [String: (moment: MomentDTO, readAt: Date)] = [:]
    private var images: [String: UIImage] = [:]
    private var order: [String] = []
    private static let linkLifetime: TimeInterval = 12 * 60

    func cached(_ id: String) -> MomentDTO? {
        details[id]?.moment
    }

    /// The Moment, only when what's held can play right now: it hasn't ended and its link is still good.
    func ready(_ id: String) -> MomentDTO? {
        guard let saved = details[id], Date().timeIntervalSince(saved.readAt) < Self.linkLifetime else { return nil }
        if let end = saved.moment.expiresAtDate, end <= Date() { return nil }
        return saved.moment
    }

    /// A photo, or a video's first picture, already in memory.
    func heldPicture(_ id: String) -> UIImage? {
        images[id]
    }

    func heldPoster(_ id: String) -> UIImage? {
        images["poster.\(id)"]
    }

    /// The Moment, with a fresh enough link to load its file.
    func detail(_ id: String) async throws -> MomentDTO {
        if let saved = details[id] {
            // A copy read a minute ago can be of a Moment that has ended since: it never plays.
            if let end = saved.moment.expiresAtDate, end <= Date() {
                forget(id)
                throw MomentsFailure.ended
            }
            if Date().timeIntervalSince(saved.readAt) < Self.linkLifetime { return saved.moment }
        }
        let moment = try await MomentsAPI.send(MomentsEndpoints.moment(id: id), as: MomentEnvelope.self).moment
        details[id] = (moment, Date())
        return moment
    }

    func picture(for moment: MomentDTO) async throws -> UIImage {
        if let image = images[moment.id] { return image }
        guard let url = moment.media else { throw MomentsFailure.notFound }
        let (data, response) = try await session.data(from: url)
        guard (response as? HTTPURLResponse)?.statusCode ?? 200 < 400, let image = UIImage(data: data) else {
            throw MomentsFailure.other("Couldn't load this Moment.")
        }
        hold(image, as: moment.id)
        return image
    }

    /// A video's first picture, shown at once under the player until its first frame.
    func poster(for moment: MomentDTO) async -> UIImage? {
        let key = "poster.\(moment.id)"
        if let image = images[key] { return image }
        guard let url = moment.poster, let (data, response) = try? await session.data(from: url),
              (response as? HTTPURLResponse)?.statusCode ?? 200 < 400, let image = UIImage(data: data) else { return nil }
        hold(image, as: key)
        return image
    }

    /// The Moments on either side of the one showing stay in memory; older ones go.
    private func hold(_ image: UIImage, as key: String) {
        images[key] = image
        order.removeAll { $0 == key }
        order.append(key)
        while order.count > 14 {
            images.removeValue(forKey: order.removeFirst())
        }
    }

    /// Reads these Moments ahead in one request (`ids` in the order they matter), then the pictures of the first
    /// `pictures` of them, one after another so the nearest is ready first. Answers the Moments it can play.
    @discardableResult
    func readAhead(_ ids: [String], pictures: Int) async -> [MomentDTO] {
        let missing = ids.filter { ready($0) == nil }
        if !missing.isEmpty {
            if let read = try? await MomentsAPI.send(MomentsEndpoints.batch(ids: missing), as: MomentsMineResponse.self) {
                let now = Date()
                for moment in read.moments {
                    details[moment.id] = (moment, now)
                }
            } else {
                // A server from before the batch read (or a read that failed): the two nearest, one at a time.
                for id in missing.prefix(2) where !Task.isCancelled {
                    _ = try? await detail(id)
                }
            }
        }
        let playable = ids.compactMap { ready($0) }
        for moment in playable.prefix(pictures) {
            guard !Task.isCancelled else { break }
            switch moment.kind {
            case .photo: _ = try? await picture(for: moment)
            case .video: _ = await poster(for: moment)
            case .text: break
            }
        }
        return playable
    }

    func forget(_ id: String) {
        details.removeValue(forKey: id)
        images.removeValue(forKey: id)
        images.removeValue(forKey: "poster.\(id)")
    }
}
