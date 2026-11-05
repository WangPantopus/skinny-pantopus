//
//  CrewDayRouteHomeModel.swift
//  Pantopus
//
//  17. One home (build kit 01-spec.md, board `RouteHome`): the home from the
//  route read, the day's included items, done photos (camera or library,
//  uploaded as `done` to `POST /api/crew-days/uploads`, up to 8), the note
//  for the household, Mark done, Can't get in, and On my way again.
//

import PhotosUI
import SwiftUI

@Observable
@MainActor
final class CrewDayRouteHomeModel {
    struct Photo: Identifiable {
        let id = UUID()
        let preview: UIImage
        var path: String?
        var failed = false
    }

    let crewDayId: String
    let bookingId: String
    let date: String?
    private(set) var state: CrewDayLoad<CrewDayHomeDTO> = .loading
    private(set) var route: CrewDayRouteDTO?
    private(set) var day: CrewDayCrewDayDTO?
    private(set) var photos: [Photo] = []
    var note = ""
    private(set) var working = false
    var error: String?
    var notice: String?

    static let photoLimit = 8
    static let noteLimit = 500

    init(crewDayId: String, bookingId: String, date: String?) {
        self.crewDayId = crewDayId
        self.bookingId = bookingId
        self.date = date
    }

    var home: CrewDayHomeDTO? {
        state.value
    }

    /// "3 of 6".
    var position: String? {
        guard let route, let index = route.homes.firstIndex(where: { $0.id == bookingId }) else { return nil }
        return "\(index + 1) of \(route.total)"
    }

    var uploading: Bool {
        photos.contains { $0.path == nil && !$0.failed }
    }

    var canMarkDone: Bool {
        photos.contains { $0.path != nil } && !uploading && !working
    }

    var isDone: Bool {
        guard let home else { return false }
        return ["done", "paid", "payment_failed", "refunded"].contains(home.status)
    }

    func load() async {
        do {
            let route: CrewDayRouteDTO = try await APIClient.shared.request(CrewDayEndpoints.route(crewDayId: crewDayId, date: date))
            self.route = route
            if let home = route.homes.first(where: { $0.id == bookingId }) {
                state = .loaded(home)
            } else if state.value == nil {
                state = .failed("This home isn't on the route anymore.")
            }
        } catch {
            if state.value == nil { state = .failed(CrewDayErrors.sentence(for: error)) }
        }
        if day == nil {
            day = try? await APIClient.shared.request(CrewDayEndpoints.crewDay(crewDayId: crewDayId))
        }
    }

    // MARK: - Photos

    func add(_ items: [PhotosPickerItem]) async {
        for item in items.prefix(Self.photoLimit - photos.count) {
            guard let raw = try? await item.loadTransferable(type: Data.self),
                  let jpeg = ListingPhotoProcessor.uploadData(from: raw) else {
                error = "That photo couldn't be read. Try another one."
                continue
            }
            await upload(jpeg)
        }
    }

    func add(_ image: UIImage) async {
        guard photos.count < Self.photoLimit, let jpeg = ListingPhotoProcessor.uploadData(from: image) else { return }
        await upload(jpeg)
    }

    func remove(_ id: UUID) {
        photos.removeAll { $0.id == id }
    }

    private func upload(_ jpeg: Data) async {
        guard let preview = UIImage(data: jpeg) else { return }
        let photo = Photo(preview: preview)
        photos.append(photo)
        do {
            let file = MultipartFile(fieldName: "photo", filename: "done.jpg", mimeType: "image/jpeg", data: jpeg)
            let path = try await MultipartUploader.shared.uploadCrewDayPhoto(bookingId: bookingId, purpose: "done", file: file)
            update(photo.id) { $0.path = path }
        } catch {
            update(photo.id) { $0.failed = true }
            self.error = CrewDayErrors.sentence(for: error)
        }
    }

    private func update(_ id: UUID, _ change: (inout Photo) -> Void) {
        guard let index = photos.firstIndex(where: { $0.id == id }) else { return }
        change(&photos[index])
    }

    // MARK: - Writes

    /// Mark done: the invoice is made and the household is told; the charge waits 24 hours.
    func markDone() async {
        guard canMarkDone else { return }
        let text = note.trimmingCharacters(in: .whitespacesAndNewlines)
        await write(done: "Marked done. We told \(who).") {
            CrewDayEndpoints.done(bookingId: self.bookingId, photoPaths: self.photos.compactMap(\.path), note: text.isEmpty ? nil : text)
        }
        if isDone { photos = [] }
    }

    /// "Can't get in": recorded on the booking and sent to the household, then the conversation with it opens.
    func cantGetIn(note: String) async -> Bool {
        let text = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return false }
        let sent = await write(done: "We told \(who) you can't get in.") {
            CrewDayEndpoints.cantGetIn(bookingId: self.bookingId, note: text)
        }
        if sent { await openConversation() }
        return sent
    }

    func onMyWay(start: Date, end: Date) async -> Bool {
        await write(done: "We told \(who) you're on the way.") {
            CrewDayEndpoints.onTheWay(bookingId: self.bookingId, etaStart: CrewDayFormat.iso(start), etaEnd: CrewDayFormat.iso(end))
        }
    }

    /// The direct conversation with the household (job window only).
    func openConversation() async {
        guard let userId = home?.householdUserId else { return }
        do {
            let room: CreateDirectChatResponse = try await APIClient.shared.request(ChatEndpoints.createDirectChat(otherUserId: userId))
            DeepLinkRouter.shared.handle(path: "/chat/\(room.roomId)")
        } catch {
            self.error = "Couldn't open the conversation. Try again."
        }
    }

    private var who: String {
        home.map(CrewDayRouteCopy.who) ?? "the household"
    }

    @discardableResult
    private func write(done: String, _ endpoint: () -> Endpoint) async -> Bool {
        guard !working else { return false }
        working = true
        error = nil
        defer { working = false }
        do {
            let response: CrewDayHomeWriteResponse = try await APIClient.shared.request(endpoint())
            state = .loaded(response.booking)
            notice = done
            NotificationCenter.default.post(name: .crewDayChanged, object: nil)
            await load()
            return true
        } catch {
            self.error = CrewDayErrors.sentence(for: error)
            return false
        }
    }
}
