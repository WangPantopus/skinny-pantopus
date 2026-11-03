//
//  EditProfileViewModel+Neighbors.swift
//  Pantopus
//
//  The editor's "Neighbors see this" side (the 11-01 redesign, `Edit.dc.html`):
//  the name and photo neighbors see (moved here from Privacy's card), the live
//  preview card's facts, and "Who sees your city" (`show_neighborhood`, saved
//  at once through `PATCH /api/privacy/settings`, with web's labels).
//

import Foundation

extension EditProfileViewModel {
    /// The preview card's trust line and avatar color, from your profile read:
    /// "Verified neighbor" for a verified home, its city (else your profile's),
    /// and when you joined.
    func setPreviewFacts(from profile: UserProfile) {
        var verified = false
        var homeCity: String?
        if case let .object(map) = profile.residency ?? .null {
            if case let .bool(value) = map["verified"] ?? .null { verified = value }
            if case let .string(city) = map["city"] ?? .null { homeCity = city }
        }
        let city = (verified ? homeCity ?? profile.city : profile.city)?.trimmingCharacters(in: .whitespacesAndNewlines)
        previewFacts = ProfileTrustFacts(
            isVerifiedNeighbor: verified,
            city: city?.isEmpty == false ? city : nil,
            joined: PublicProfileViewModel.joinedLabel(profile.createdAt)
        )
        accountId = profile.id
    }

    /// The name and photo neighbors see, and who sees your city, read beside the profile.
    func loadNeighborsAndCity() async {
        await neighbors.load()
        do {
            let response = try await api.request(PrivacyEndpoints.settings, as: PrivacySettingsResponse.self)
            cityAudience = response.settings.showNeighborhood ?? "followers"
        } catch {
            // The row keeps its last value; tapping it still offers the choices.
        }
    }

    /// Saves "Who sees your city" at once.
    func setCityAudience(_ value: String) async {
        guard value != cityAudience else { return }
        let previous = cityAudience
        cityAudience = value
        do {
            _ = try await api.request(
                PrivacyEndpoints.updateSettings(PrivacySettingsUpdate(showNeighborhood: value)),
                as: PrivacySettingsResponse.self
            )
            store.markStale(topics: [ScreenTopic.profileMe])
            toast = ToastMessage(text: "Who sees your city: \(Self.cityAudienceLabel(value)).", kind: .success)
        } catch {
            cityAudience = previous
            toast = ToastMessage(text: (error as? APIError)?.errorDescription ?? "Couldn't change who sees your city.", kind: .error)
        }
    }

    /// Web's words for `show_neighborhood`.
    static func cityAudienceLabel(_ value: String?) -> String {
        switch value {
        case "public": "Everyone"
        case "private": "Only me"
        default: "Connections and household"
        }
    }

    static let cityAudienceChoices = ["public", "followers", "private"]
}
