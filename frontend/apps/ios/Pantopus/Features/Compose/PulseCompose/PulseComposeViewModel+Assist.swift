//
//  PulseComposeViewModel+Assist.swift
//  Pantopus
//
//  The composer's AI assist: the whole post suggested from the person's
//  photos, the place they picked and what they've written so far
//  (`POST /api/ai/draft/post-suggestion`). The suggestion goes into the
//  form's own fields, the person changes anything they like, and Post asks
//  them to check it before it goes out ("Post this?"). Undo puts the form
//  back as it was. Mirrors Android `PulseComposeAssist.kt`.
//

import Foundation

/// The composer's AI assist.
public enum PulseComposeAssistState: Equatable, Sendable {
    case idle
    /// A suggestion is on its way.
    case writing
    /// A suggestion is in the form; `note` is the AI's one sentence for the person.
    case suggested(note: String?)
    /// Why no suggestion came, for the person.
    case failed(String)
}

/// The form as it was before a suggestion went in.
struct PulseComposeAssistSnapshot {
    let fields: [PulseComposeField: FormFieldState]
    let lostFoundKind: PulseLostFoundKind
    let safetyAlertKind: PulseSafetyAlertKind
    let askCategory: PulseAskCategory?
    let dealExpiresAt: Date?
}

/// How many photos a suggestion reads (`postSuggestion.MAX_PHOTOS` on the server).
private let assistMaxPhotos = 4

/// The typed fields a suggestion reads, with the request's name for each.
private let assistWrittenFields: [(field: PulseComposeField, name: String)] = [
    (.title, "title"),
    (.body, "body"),
    (.recommendBusiness, "businessName"),
    (.dealBusinessName, "businessName"),
    (.eventLocation, "eventVenue"),
    (.lostLastSeenLocation, "lastSeenLocation")
]

public extension PulseComposeViewModel {
    /// True while a suggestion is on its way.
    var isSuggesting: Bool {
        assist == .writing
    }

    /// How many of the attachments a suggestion reads: pictures, not videos or PDFs.
    var assistPhotoCount: Int {
        min(photos.filter(\.isStill).count, assistMaxPhotos)
    }

    /// True when there's something to write a post from: a photo, or words in the form.
    var assistHasMaterial: Bool {
        if assistPhotoCount > 0 { return true }
        let active = fieldsActiveForCurrentIntent()
        return assistWrittenFields.contains { active.contains($0.field) && !trimmedValue($0.field).isEmpty }
    }

    /// Undo stays until the person edits the suggestion.
    var canUndoSuggestion: Bool {
        assistUndo != nil
    }

    /// Asks for a suggestion from the photos, the place and what's in the form, and puts it in the form.
    func suggestPost() async {
        guard !isEditing, !isSuggesting else { return }
        guard NetworkMonitor.shared.isOnline else {
            assist = .failed("You're offline. Try again when you're back online.")
            return
        }
        // "Try again" right after a suggestion starts over from what the person wrote, not from the suggestion.
        let written = assistUndo?.fields ?? fields
        var request = ["postType": effectivePostType, "audience": effectiveAudience == "connections" ? "connections" : "nearby"]
        let active = fieldsActiveForCurrentIntent()
        for entry in assistWrittenFields where active.contains(entry.field) {
            let value = (written[entry.field]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if !value.isEmpty { request[entry.name] = value }
        }
        if let place = assistPlace {
            request["place"] = place.name
            if let address = place.address { request["placeAddress"] = address }
        }
        let stills = photos.filter(\.isStill).prefix(assistMaxPhotos).map(\.data)
        assist = .writing
        // Each photo goes as a JPEG of at most 1600px, re-encoded without its EXIF (where and when it was taken).
        let files = await Task.detached(priority: .userInitiated) {
            stills.enumerated().compactMap { index, data in
                ListingPhotoProcessor.uploadData(from: data).map {
                    MultipartFile(fieldName: "photos", filename: "photo-\(index).jpg", mimeType: "image/jpeg", data: $0)
                }
            }
        }.value
        // Photos this phone couldn't read, and no words: there's nothing to send.
        if !stills.isEmpty, files.isEmpty, !assistWrittenFields.contains(where: { request[$0.name] != nil }) {
            assist = .failed("Couldn't read that photo. Try another one, or write a few words.")
            return
        }
        do {
            let response = try await multipartUploader.suggestPost(photos: files, fields: request)
            apply(response.suggestion)
            assist = .suggested(note: response.note)
            await runPrecheck()
        } catch {
            assist = .failed(Self.assistMessage(for: error))
        }
    }

    /// Puts the form back as it was before the suggestion.
    func undoSuggestion() {
        guard let before = assistUndo else { return }
        fields = before.fields
        lostFoundKind = before.lostFoundKind
        safetyAlertKind = before.safetyAlertKind
        askCategory = before.askCategory
        dealExpiresAt = before.dealExpiresAt
        assistUndo = nil
        hasAISuggestion = false
        assist = .idle
        precheckDone = false
        scheduleEarlierAnswers()
    }

    /// The place the post is about, for the suggestion: a tagged venue with its address, or the area
    /// it's posted to ("Camas, WA"). A tagged street address or a home's address never goes: it
    /// could be someone's home.
    private var assistPlace: (name: String, address: String?)? {
        if let tag = selectedPlaceTag, tag.kind != "address" {
            let address = tag.address?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (tag.name, address?.isEmpty == false ? address : nil)
        }
        guard let target = postingTarget, target.isPlaceTarget else { return nil }
        let label = target.displayLabel.trimmingCharacters(in: .whitespacesAndNewlines)
        return label.isEmpty || label.contains(where: \.isNumber) ? nil : (label, nil)
    }

    /// Fills the form from a suggestion. The title and the text are replaced; a venue, business,
    /// place or date the person already filled in stays; the choices (lost or found, the kind of
    /// heads-up, the category, when a deal ends) follow the suggestion. Undo puts it all back.
    private func apply(_ suggestion: AIPostSuggestionResponse.Suggestion) {
        if assistUndo == nil {
            assistUndo = PulseComposeAssistSnapshot(
                fields: fields,
                lostFoundKind: lostFoundKind,
                safetyAlertKind: safetyAlertKind,
                askCategory: askCategory,
                dealExpiresAt: dealExpiresAt
            )
        }
        isApplyingSuggestion = true
        defer { isApplyingSuggestion = false }
        let active = Set(fieldsActiveForCurrentIntent())
        func fill(_ field: PulseComposeField, _ value: String?, replacing: Bool = false) {
            guard active.contains(field),
                  let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty,
                  replacing || trimmedValue(field).isEmpty else { return }
            update(field, to: value)
        }
        fill(.title, suggestion.title, replacing: true)
        fill(.body, suggestion.body, replacing: true)
        fill(.recommendBusiness, suggestion.businessName)
        fill(.dealBusinessName, suggestion.businessName)
        fill(.eventLocation, suggestion.eventVenue)
        // The Event fields hold the picker's local wall clock, `yyyy-MM-dd HH:mm`.
        fill(.eventDate, suggestion.eventDate?.replacingOccurrences(of: "T", with: " "))
        fill(.eventEndDate, suggestion.eventEndDate?.replacingOccurrences(of: "T", with: " "))
        fill(.lostLastSeenLocation, suggestion.lastSeenLocation)
        fill(.lostLastSeenDate, suggestion.lastSeenDate)
        if activeIntent == .lost, let kind = suggestion.lostFoundType.flatMap(PulseLostFoundKind.init(rawValue:)) {
            lostFoundKind = kind
        }
        if effectivePostType == "alert", let kind = Self.alertKind(suggestion.safetyAlertKind) {
            safetyAlertKind = kind
        }
        if activeIntent == .ask, let category = suggestion.askCategory.flatMap(PulseAskCategory.init(rawValue:)) {
            askCategory = category
        }
        if effectivePostType == "deal", let end = PulseComposeDraft.lastMoment(from: suggestion.dealExpiresAt) {
            dealExpiresAt = end
        }
        hasAISuggestion = true
    }

    /// This form offers Hazard and Other; the server's other heads-up kinds fold into them.
    private static func alertKind(_ raw: String?) -> PulseSafetyAlertKind? {
        switch raw {
        case "hazard", "road_hazard", "power_outage", "weather_damage": .hazard
        case "other", "missing_pet": .other
        default: nil
        }
    }

    private static func assistMessage(for error: any Error) -> String {
        let fallback = "Couldn't write a suggestion. Try again, or write the post yourself."
        return switch error {
        case let APIError.clientError(_, body): APIError.friendlyClientMessage(body) ?? fallback
        case let APIError.server(_, body): APIError.friendlyClientMessage(body) ?? fallback
        case let apiError as APIError: apiError.errorDescription ?? fallback
        default: fallback
        }
    }
}

extension PulseComposePhoto {
    /// A picture a suggestion can read (a Live Photo's still counts); videos and PDFs don't.
    var isStill: Bool {
        mimeType.map { $0.hasPrefix("image/") } ?? true
    }
}
