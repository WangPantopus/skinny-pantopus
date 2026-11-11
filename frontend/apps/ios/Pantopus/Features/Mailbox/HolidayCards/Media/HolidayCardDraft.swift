//
//  HolidayCardDraft.swift
//  Pantopus
//
//  The card being written, kept when the system closes the app (memories plan section 2 "Drafts"; web's
//  `cardDraft.ts`): who it's for, the picture, the note, the signature, the arrival, the step (Look it over comes back
//  as Seal it for the day), the request ID (and a list's request ID for each person), and the uploaded photo and voice
//  greeting by reference only, never their bytes: brought back, they draw from the uploader's own route. Kept for this
//  account only, and gone once the card is sent or taken back, on start over, on sign-out
//  (`AuthManager.clearLocalSession`), and after the 72 hours an upload can be sent in.
//

import Foundation

struct HolidayCardDraft: Codable, Equatable {
    /// Who it's for, as kept: a person, an address, the link, or a list of people and addresses.
    struct Recipient: Codable, Equatable {
        struct Entry: Codable, Equatable {
            var userId: String?
            var name: String?
            var email: String?
        }

        var kind: String
        var entries: [Entry]

        init(_ recipient: HolidayCardRecipient) {
            switch recipient {
            case let .person(userId, name):
                kind = "person"
                entries = [Entry(userId: userId, name: name)]
            case let .email(address):
                kind = "email"
                entries = [Entry(email: address)]
            case .link:
                kind = "link"
                entries = []
            case let .list(list):
                kind = "list"
                entries = list.compactMap { Recipient($0).entries.first }
            }
        }

        var recipient: HolidayCardRecipient? {
            let people: [HolidayCardRecipient] = entries.compactMap { entry in
                if let userId = entry.userId { return .person(userId: userId, name: entry.name ?? "") }
                return entry.email.map { .email($0) }
            }
            switch kind {
            case "person", "email": return people.count == 1 ? people[0] : nil
            case "link": return .link
            case "list": return people.isEmpty ? nil : .list(people)
            default: return nil
            }
        }
    }

    var user: String
    /// `HolidayCardStep`, Who it's for to Seal it for the day.
    var step: Int
    var to: Recipient?
    var designId: String?
    var message: String
    var signature: CardSignature?
    var photo: CardPhoto?
    var photoAlt: String
    var voice: CardVoice?
    var arrival: String?
    var requestId: String?
    /// A list's request ID for each person or address on it (by `HolidayCardRecipient.key`).
    var listIds: [String: String]
}

/// Where the draft is kept: this device's defaults, one draft at a time, with the moment it was kept.
@MainActor
enum HolidayCardDraftStore {
    private static let key = "pantopus.holidayCardDraft.v1"
    /// An upload can be sent for 72 hours (memories contract); an older draft would only be refused.
    private static let lifetime: TimeInterval = 72 * 60 * 60

    private struct Kept: Codable {
        var savedAt: Date
        var draft: HolidayCardDraft
    }

    /// This account's draft, if one is still worth bringing back.
    static func read(user: String) -> HolidayCardDraft? {
        guard let data = UserDefaults.standard.data(forKey: key),
              let kept = try? JSONDecoder().decode(Kept.self, from: data) else { return nil }
        guard kept.draft.user == user, Date().timeIntervalSince(kept.savedAt) < lifetime else { return nil }
        return kept.draft
    }

    static func save(_ draft: HolidayCardDraft) {
        guard let data = try? JSONEncoder().encode(Kept(savedAt: Date(), draft: draft)) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    /// Sent, taken back, started over, or signed out.
    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
