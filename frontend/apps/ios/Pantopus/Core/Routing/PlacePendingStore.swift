import Foundation

/// A device-local draft, never a Home or a membership. Reads do not consume it.
/// Expired/legacy drafts and drafts belonging to another account are discarded.
enum PlacePendingStore {
    static let key = "pantopus_pending_place"
    static let lifetime: TimeInterval = 24 * 60 * 60

    struct Pending: Codable, Equatable, Identifiable {
        let id: String
        let label: String
        let latitude: Double
        let longitude: Double
        let expiresAt: Date
        var userId: String?
    }

    @discardableResult
    static func stash(_ suggestion: GeoSuggestion, defaults: UserDefaults = .standard, now: Date = Date()) -> Bool {
        clear(defaults: defaults)
        guard let latitude = suggestion.latitude, let longitude = suggestion.longitude,
              latitude.isFinite, longitude.isFinite,
              (-90...90).contains(latitude), (-180...180).contains(longitude),
              !suggestion.label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        let draft = Pending(
            id: UUID().uuidString,
            label: suggestion.label,
            latitude: latitude,
            longitude: longitude,
            expiresAt: now.addingTimeInterval(lifetime)
        )
        return write(draft, defaults: defaults)
    }

    static func read(defaults: UserDefaults = .standard, now: Date = Date()) -> Pending? {
        guard let data = defaults.data(forKey: key),
              let draft = try? JSONDecoder().decode(Pending.self, from: data),
              draft.expiresAt > now, draft.expiresAt.timeIntervalSince(now) <= lifetime,
              !draft.id.isEmpty, !draft.label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              draft.latitude.isFinite, draft.longitude.isFinite,
              (-90...90).contains(draft.latitude), (-180...180).contains(draft.longitude) else {
            clear(defaults: defaults)
            return nil
        }
        return draft
    }

    @discardableResult
    static func bind(to userId: String, defaults: UserDefaults = .standard, now: Date = Date()) -> Pending? {
        guard !userId.isEmpty, var draft = read(defaults: defaults, now: now) else { return nil }
        guard draft.userId == nil || draft.userId == userId else {
            clear(defaults: defaults)
            return nil
        }
        draft.userId = userId
        return write(draft, defaults: defaults) ? draft : nil
    }

    static func clear(id: String? = nil, defaults: UserDefaults = .standard) {
        if let id {
            guard let data = defaults.data(forKey: key),
                  let draft = try? JSONDecoder().decode(Pending.self, from: data), draft.id == id else { return }
        }
        defaults.removeObject(forKey: key)
    }

    private static func write(_ draft: Pending, defaults: UserDefaults) -> Bool {
        guard let data = try? JSONEncoder().encode(draft) else { return false }
        defaults.set(data, forKey: key)
        return defaults.data(forKey: key) == data
    }
}
