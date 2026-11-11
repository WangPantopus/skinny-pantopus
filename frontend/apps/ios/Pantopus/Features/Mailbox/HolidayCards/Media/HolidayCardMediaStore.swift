//
//  HolidayCardMediaStore.swift
//  Pantopus
//
//  A card's own photo and voice bytes (memories plan steps 4 and 7, `holiday_card_memories`), fetched only through the
//  card's reader-checked routes and kept in memory for this account only: nothing goes to disk, and sign-out empties
//  it (`AuthManager.clearLocalSession`). One fetch per file at a time; a covered photo is never asked for until its
//  tap, which is the caller's to hold back.
//

import Foundation

@MainActor
final class HolidayCardMediaStore {
    static let shared = HolidayCardMediaStore()

    private var bytes: [String: Data] = [:]
    private var running: [String: Task<Data, any Error>] = [:]
    /// Bytes that were just uploaded or recorded on this phone, by file id: drawn at once, with no fetch.
    private var local: [String: Data] = [:]
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// The file's bytes, from memory or its route. Throws when the route refuses it (404) or can't be reached.
    func data(for source: CardMediaSource) async throws -> Data {
        let id = source.fileId
        if let kept = local[id] ?? bytes[id] { return kept }
        if let task = running[id] { return try await task.value }
        let api = api
        let task = Task<Data, any Error> {
            let reply = try await api.requestDataResponse(HolidayCardEndpoints.media(source), includingNotFound: true)
            guard (200..<300).contains(reply.response.statusCode), !reply.data.isEmpty else {
                throw APIError.notFound
            }
            return reply.data
        }
        running[id] = task
        defer { running[id] = nil }
        let data = try await task.value
        bytes[id] = data
        return data
    }

    /// Keeps what this phone just uploaded under its new file id, so Write on the back and Look it over draw it at once.
    func keep(_ data: Data, for fileId: String) {
        local[fileId] = data
    }

    /// Already in memory: drawn without a fetch.
    func cached(_ fileId: String) -> Data? {
        local[fileId] ?? bytes[fileId]
    }

    /// Sign-out: everything this account fetched or made goes.
    func clear() {
        for task in running.values {
            task.cancel()
        }
        running = [:]
        bytes = [:]
        local = [:]
    }
}
