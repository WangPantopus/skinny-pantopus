//
//  MomentsViewerCache.swift
//  Pantopus
//
//  What a viewer has read: each Moment (its signed media link lasts 15
//  minutes, so a copy older than 12 is read again) and the photos it has
//  loaded, in memory only and never on disk. The next Moment is read ahead
//  so the next tap shows it at once.
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
        images[moment.id] = image
        order.append(moment.id)
        // A handful of photos in memory is plenty.
        while order.count > 8 {
            images.removeValue(forKey: order.removeFirst())
        }
        return image
    }

    /// A video's first picture, shown at once under the player until its first frame.
    func poster(for moment: MomentDTO) async -> UIImage? {
        let key = "poster.\(moment.id)"
        if let image = images[key] { return image }
        guard let url = moment.poster, let (data, response) = try? await session.data(from: url),
              (response as? HTTPURLResponse)?.statusCode ?? 200 < 400, let image = UIImage(data: data) else { return nil }
        images[key] = image
        order.append(key)
        return image
    }

    /// Reads a Moment ahead (and its photo, or its video's poster).
    func prefetch(_ id: String) {
        guard details[id] == nil else { return }
        Task { [weak self] in
            guard let self, let moment = try? await detail(id) else { return }
            switch moment.kind {
            case .photo: _ = try? await picture(for: moment)
            case .video: _ = await poster(for: moment)
            case .text: break
            }
        }
    }

    func forget(_ id: String) {
        details.removeValue(forKey: id)
        images.removeValue(forKey: id)
        images.removeValue(forKey: "poster.\(id)")
    }
}
