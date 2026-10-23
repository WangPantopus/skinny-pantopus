//
//  NeighborsSeeYouViewModel.swift
//  Pantopus
//
//  How neighbors see you, at the top of Privacy: the name and photo other
//  people see on your posts, comments, chats, tasks and notices (your Local
//  Profile). Your account name stays private. A name or photo chosen here
//  stays when you edit your account; one that is still your account's moves
//  with it (backend `syncLocalProfileFromAccount`).
//
//  Reads and writes `GET`/`PATCH /api/local-profiles/me`; a new photo goes
//  through `POST /api/upload/local-profile-picture`. Copy and test tags are
//  mirrored word for word on Android (`NeighborsSeeYouCard.kt`).
//

import Foundation
import Observation

@Observable
@MainActor
public final class NeighborsSeeYouViewModel {
    public enum LoadState: Sendable, Equatable {
        case loading
        case loaded(OwnLocalProfileResponse)
        case failed
        /// The server keeps no Local Profiles (identity firewall off): no card.
        case unavailable
    }

    public enum Busy: Sendable, Equatable {
        case name, photo
    }

    /// The account name rules (Edit profile): at most 255 characters.
    static let nameLimit = 255

    public private(set) var state: LoadState = .loading
    /// The name field. It follows the saved name until edited.
    public var nameText = ""
    public private(set) var nameError: String?
    public private(set) var busy: Busy?

    /// Shown through the Privacy screen's toast.
    @ObservationIgnored
    var onToast: @MainActor (ToastMessage) -> Void = { _ in }

    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private let uploader: MultipartUploader

    init(api: APIClient = .shared, uploader: MultipartUploader = .shared) {
        self.api = api
        self.uploader = uploader
    }

    var loaded: OwnLocalProfileResponse? {
        if case let .loaded(view) = state { return view }
        return nil
    }

    /// The typed name as it would be saved: spaces as in an account name.
    var trimmedName: String {
        nameText.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    var isNameChanged: Bool {
        guard let loaded else { return false }
        return trimmedName != loaded.profile.displayName
    }

    var nameNote: String {
        loaded?.followsAccount.displayName == true
            ? "Same as your account name: it changes when you change your name in Edit profile."
            : "Only for neighbors: changing your account name won't change it."
    }

    var photoNote: String {
        guard let loaded else { return "" }
        if loaded.profile.avatarUrl == nil {
            return loaded.account.avatarUrl == nil
                ? "No photo: neighbors see your initials."
                : "No photo: neighbors see your initials, not your account photo."
        }
        return loaded.followsAccount.avatarUrl
            ? "Your account photo: it changes when you change it in Edit profile."
            : "A photo just for neighbors: changing your account photo won't change it."
    }

    /// First load, and again when your profile changed (an account edit can move a copy).
    func load() async {
        do {
            let view: OwnLocalProfileResponse = try await api.request(LocalProfileEndpoints.me)
            apply(view)
        } catch APIError.notFound {
            state = .unavailable
        } catch {
            // A refresh that fails keeps what is shown.
            if loaded == nil { state = .failed }
        }
    }

    func retry() async {
        state = .loading
        await load()
    }

    func editName(_ text: String) {
        nameText = text
        nameError = nil
    }

    func saveName() async {
        let name = trimmedName
        guard !name.isEmpty else {
            nameError = "Enter the name neighbors should see."
            return
        }
        guard name.count <= Self.nameLimit else {
            nameError = "Use 255 characters or fewer."
            return
        }
        await saveName(name)
    }

    func useAccountName() async {
        guard let name = loaded?.account.displayName else { return }
        await saveName(name)
    }

    func uploadPhoto(_ data: Data?, filename: String, mimeType: String) async {
        guard let data else {
            onToast(ToastMessage(text: "We couldn't read that photo. Try another one.", kind: .error))
            return
        }
        await changePhoto(success: "Neighbors now see your new photo") {
            try await self.uploader.uploadLocalProfilePicture(
                MultipartFile(fieldName: "file", filename: filename, mimeType: mimeType, data: data)
            )
        }
    }

    func useAccountPhoto() async {
        guard let url = loaded?.account.avatarUrl else { return }
        await changePhoto(success: "Neighbors now see your account photo") {
            try await self.api.request(LocalProfileEndpoints.updateMe(LocalProfileUpdateRequest(photo: .url(url))))
        }
    }

    func removePhoto() async {
        await changePhoto(success: "Neighbors now see your initials") {
            try await self.api.request(LocalProfileEndpoints.updateMe(LocalProfileUpdateRequest(photo: .none)))
        }
    }

    private func saveName(_ name: String) async {
        guard busy == nil else { return }
        busy = .name
        nameError = nil
        defer { busy = nil }
        do {
            let view: OwnLocalProfileResponse = try await api.request(
                LocalProfileEndpoints.updateMe(LocalProfileUpdateRequest(displayName: name))
            )
            nameText = view.profile.displayName
            apply(view)
            onToast(ToastMessage(text: "Neighbors now see you as \(view.profile.displayName)", kind: .success))
        } catch {
            nameError = error.localizedDescription
        }
    }

    private func changePhoto(
        success: String,
        _ change: @escaping @MainActor () async throws -> OwnLocalProfileResponse
    ) async {
        guard busy == nil else { return }
        busy = .photo
        defer { busy = nil }
        do {
            try await apply(change())
            onToast(ToastMessage(text: success, kind: .success))
        } catch {
            onToast(ToastMessage(text: error.localizedDescription, kind: .error))
        }
    }

    /// Shows a reply; the field follows the saved name unless it holds an edit.
    private func apply(_ view: OwnLocalProfileResponse) {
        if loaded == nil || nameText == loaded?.profile.displayName {
            nameText = view.profile.displayName
        }
        state = .loaded(view)
    }
}
