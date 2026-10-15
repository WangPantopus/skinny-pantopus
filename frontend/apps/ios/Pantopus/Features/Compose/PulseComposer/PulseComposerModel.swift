//
//  PulseComposerModel.swift
//  Pantopus
//
//  The one-box composer (Pulse S8; build spec §5, wireframe 2, contract
//  §2.5): one text, then Type, About and Topic, each one tap to change, and
//  the two promises, who can read it and who it's shown to. Posts in Pulse
//  mode; the server decides where the post sits and who may start what.
//  PS's composer check is read fail-open: its suggestions fill in Type and
//  Topic until the person picks them, and nothing waits on it.
//

import Foundation
import Observation

@Observable
@MainActor
final class PulseComposerModel {
    /// One of the reader's own areas, or a town chosen by search.
    struct Area: Identifiable, Equatable {
        let id: String
        let name: String
        /// `town`, `neighborhood` or `street`.
        let kind: String
    }

    enum Phase: Equatable {
        case editing
        case posting
        case posted(postId: String)
    }

    var draft = PulseComposerDraft() {
        didSet { draftChanged(from: oldValue) }
    }

    private(set) var photos: [PulseComposePhoto] = []
    /// The reader's own town, neighborhood and street, as `/areas/mine` names them.
    private(set) var areas: [Area] = []
    /// A town chosen from search: posting there needs only an Ask from a Visitor.
    private(set) var otherTown: Area?
    private(set) var areasState: AreasState = .loading
    private(set) var phase: Phase = .editing
    /// The plain sentence under the box after a refusal or a failure.
    var message: String?
    /// "I'm 18 or older" is asked before the post can go.
    var asksAdultConfirmation = false
    var adultSentence = "Confirm you are 18 or older to post in Pulse."
    /// What PS's check said last; nil while it isn't there.
    private(set) var check: PulseComposerCheckResponse?
    /// The label the reader's posts wore here, once a post has shown it.
    private(set) var postingLabel: PulseAuthorLabel?
    let firstName: String
    let userId: String
    /// The person picked these; a suggestion no longer changes them.
    private var kindChosen = false
    private var topicChosen = false

    enum AreasState: Equatable {
        case loading
        case loaded
        case failed
    }

    let api: APIClient
    let uploader: MultipartUploader
    private let store: PulseComposerDraftStore
    private let defaults: UserDefaults
    private var saveTask: Task<Void, Never>?
    private var checkTask: Task<Void, Never>?

    init(api: APIClient = .shared, uploader: MultipartUploader = .shared, defaults: UserDefaults = .standard) {
        self.api = api
        self.uploader = uploader
        self.defaults = defaults
        var id = ""
        var name = ""
        if case let .signedIn(user) = AuthManager.shared.state {
            id = user.id
            name = (user.displayName ?? user.username).split(separator: " ").first.map(String.init) ?? ""
        }
        userId = id
        firstName = name
        store = PulseComposerDraftStore(userId: id)
        if let saved = store.load() {
            draft = saved.draft
            photos = saved.photos
            kindChosen = true
            topicChosen = saved.draft.topic != nil
        }
        postingLabel = defaults.string(forKey: labelKey).flatMap(PulseAuthorLabel.init(rawValue:))
    }

    // MARK: - What the screen shows

    var town: Area? {
        areas.first { $0.kind == "town" }
    }

    /// Where the post goes: the chosen area, else the home town.
    var area: Area? {
        if let otherTown, draft.areaId == otherTown.id { return otherTown }
        return draft.areaId.flatMap { id in areas.first { $0.id == id } } ?? town
    }

    /// The reader has no verified home anywhere: Asks only (build spec §10).
    var asksOnly: Bool {
        areasState == .loaded && town == nil
    }

    var kinds: [PulsePostKind] {
        asksOnly ? [.ask] : PulsePostKind.allCases
    }

    /// `public` or `verified_town` for a town, `verified_area` for a street
    /// or neighborhood (contract §2.5).
    var readScope: String {
        guard let area, area.kind != "town" else { return draft.townVerifiedOnly ? "verified_town" : "public" }
        return "verified_area"
    }

    /// "Crown Park" when the person named a place, else the area's name.
    var aboutWords: String {
        let place = draft.placeName.trimmingCharacters(in: .whitespacesAndNewlines)
        return place.isEmpty ? (area?.name ?? "Choose a town") : place
    }

    var topic: PulseTopic? {
        PulseTopic(stored: draft.topic)
    }

    /// The first post on this device shows "Your first post: here's who can
    /// read it."; PS's check says so for every device once it exists.
    var showsAudienceReview: Bool {
        check?.needs?.audienceReview ?? !defaults.bool(forKey: postedKey)
    }

    var trimmedText: String {
        draft.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var canPost: Bool {
        phase == .editing && !trimmedText.isEmpty && draft.text.count <= 5000 && area != nil
    }

    // MARK: - Areas

    func loadAreas() async {
        areasState = .loading
        do {
            let response: PulseMyAreasResponse = try await api.request(PulseEndpoints.myAreas())
            areas = [response.street, response.neighborhood, response.town].compactMap { area in
                guard let area, let id = area.id, let kind = area.kind else { return nil }
                return Area(id: id, name: area.name ?? area.title ?? "", kind: kind)
            }
            areasState = .loaded
            if asksOnly { draft.kind = .ask }
        } catch {
            areasState = .failed
        }
    }

    /// A town from search ("Another place"): only towns, never a street.
    func choose(otherTown choice: Area) {
        otherTown = choice
        draft.areaId = choice.id
    }

    func choose(area: Area?) {
        draft.areaId = area?.id
        if area?.kind != "town" { draft.townVerifiedOnly = false }
    }

    func choose(kind: PulsePostKind) {
        kindChosen = true
        draft.kind = kind
    }

    func choose(topic: PulseTopic?) {
        topicChosen = true
        draft.topic = topic?.rawValue
    }

    // MARK: - Photos

    func add(photos picked: [PulseComposePhoto]) {
        photos = Array((photos + picked).prefix(9))
        scheduleSave()
    }

    func remove(photo: PulseComposePhoto) {
        photos.removeAll { $0.id == photo.id }
        scheduleSave()
    }

    // MARK: - Drafts

    /// Cancel: the draft is thrown away (the screen asks first).
    func discard() {
        draft = PulseComposerDraft()
        photos = []
        saveTask?.cancel()
        checkTask?.cancel()
        store.clear()
    }

    func saveNow() {
        saveTask?.cancel()
        guard phase == .editing else { return }
        store.save(draft, photos: photos)
    }

    func finishPosting(postId: String, label: String?) {
        saveTask?.cancel()
        checkTask?.cancel()
        store.clear()
        defaults.set(true, forKey: postedKey)
        if let label, let known = PulseAuthorLabel(rawValue: label) {
            postingLabel = known
            defaults.set(label, forKey: labelKey)
        }
        phase = .posted(postId: postId)
    }

    func setPhase(_ next: Phase) {
        phase = next
    }

    private var postedKey: String {
        "pulse.composer.posted.\(userId)"
    }

    private var labelKey: String {
        "pulse.composer.label.\(userId)"
    }

    /// The check reads the words and the place; a pick of type or topic
    /// doesn't ask again.
    private func draftChanged(from old: PulseComposerDraft) {
        if old.text != draft.text || old.areaId != draft.areaId { scheduleCheck() }
        // A refusal was about the draft as it was; any change makes it stale.
        if old != draft { message = nil }
        scheduleSave()
    }

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            self?.saveNow()
        }
    }

    /// PS's check, read a moment after typing stops. Fail-open: any error,
    /// a missing route or an unreadable answer leaves the composer as it is.
    private func scheduleCheck() {
        checkTask?.cancel()
        let text = trimmedText
        guard !text.isEmpty else { return }
        let body = PulseComposerCheckRequest(
            text: text, mediaCount: photos.count, areaId: area?.id, postType: draft.kind.rawValue, topic: draft.topic
        )
        checkTask = Task { [weak self, api] in
            try? await Task.sleep(for: .milliseconds(700))
            guard !Task.isCancelled else { return }
            let response: PulseComposerCheckResponse? = try? await api.request(PulseEndpoints.composerCheck(body))
            guard !Task.isCancelled, let self, let response else { return }
            apply(response)
        }
    }

    private func apply(_ response: PulseComposerCheckResponse) {
        check = response
        if !kindChosen, let type = response.suggest?.type, let kind = PulsePostKind(rawValue: type), kinds.contains(kind) {
            draft.kind = kind
        }
        if !topicChosen, let suggested = response.suggest?.topic, PulseTopic(stored: suggested) != nil {
            draft.topic = suggested
        }
    }
}
