import Foundation
import Observation

@Observable
@MainActor
final class PendingPlaceViewModel {
    private(set) var draft: PlacePendingStore.Pending?
    private(set) var isSaving = false
    private(set) var saved: SavedPlaceDTO?
    private(set) var errorMessage: String?
    private(set) var preview: PlacePreview?
    private(set) var previewError = false
    private let userId: String
    private let defaults: UserDefaults
    private let currentUser: () -> String?
    private let savePlace: (SavePlaceBody) async throws -> SavedPlaceDTO

    init(
        userId: String,
        defaults: UserDefaults = .standard,
        currentUser: @escaping () -> String? = {
            if case let .signedIn(user) = AuthManager.shared.state { return user.id }
            return nil
        },
        savePlace: @escaping (SavePlaceBody) async throws -> SavedPlaceDTO = { body in
            let response: SavedPlaceResponse = try await APIClient.shared.request(SavedPlacesEndpoints.save(body))
            return response.savedPlace
        }
    ) {
        self.userId = userId
        self.defaults = defaults
        self.currentUser = currentUser
        self.savePlace = savePlace
        draft = PlacePendingStore.bind(to: userId, defaults: defaults)
    }

    func loadPreview() async {
        guard let draft else { return }
        previewError = false
        do {
            preview = try await APIClient.shared.request(PlaceEndpoints.publicPreview(address: draft.label))
        } catch {
            guard !Task.isCancelled else { return }
            previewError = true
        }
    }

    func save() async {
        guard !isSaving, saved == nil, let draft else { return }
        guard currentUser() == userId,
              let stored = PlacePendingStore.read(defaults: defaults),
              stored.id == draft.id, stored.userId == userId else {
            errorMessage = "This preview expired or belongs to another session. Look up the address again."
            return
        }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            let result = try await savePlace(SavePlaceBody(
                label: draft.label,
                placeType: "searched",
                latitude: draft.latitude,
                longitude: draft.longitude,
                expectedUserId: userId
            ))
            guard currentUser() == userId, result.userId == userId, !result.id.isEmpty else {
                errorMessage = "We couldn’t confirm the save for this account. Please try again."
                return
            }
            saved = result
            PlacePendingStore.clear(id: draft.id, defaults: defaults)
        } catch {
            errorMessage = "We couldn’t save this address. Your preview is still here — please try again."
        }
    }

    func discard() {
        guard !isSaving else { return }
        if let draft { PlacePendingStore.clear(id: draft.id, defaults: defaults) }
    }
}
