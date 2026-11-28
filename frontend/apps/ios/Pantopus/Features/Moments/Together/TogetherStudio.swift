//
//  TogetherStudio.swift
//  Pantopus
//
//  What the open Studio adds to the Moment it makes for "Pulse, reinvented" phase 3 ("together and back outside",
//  CONTRACT 8): what the Studio was opened for (a frame for someone's Retake, 8e) and the person's own choices in the
//  drawer (start a Retake). Each rides the create request as one more key (`TogetherCreate`). Only while the switch is
//  on, and only for the Studio the choices were made in: today's Post sheet never shows the rows, so it never sends
//  any of this, and with nothing chosen the request is exactly today's.
//

import Foundation
import Observation

@Observable
@MainActor
final class TogetherStudio {
    static let shared = TogetherStudio()

    /// What the Studio was opened for, from a screen of this build's own.
    enum Context: Equatable {
        /// Add a frame to a Retake (8e): its first picture is a ghost to line up with.
        case retakeFrame(startId: String, title: String, ghost: URL?)
        /// Answer an Eyes-on Ask with a Live photo (8f).
        case eyesOnAnswer(askId: String, question: String)
        /// Add a piece to a pinboard (8i): a photo, one per person.
        case pinboardPiece(startId: String, prompt: String)
        /// One photo of "Your day" (8k), posted from its card: the day's date and the id the app picked for it.
        case yourDay(date: String, id: String)
    }

    /// Set before the Studio opens; cleared when it closes (`ReinventedStudioPresenter.close`).
    var context: Context?
    /// The Retake's first picture over the Studio's own while adding a frame (on by default; one tap hides it).
    var ghostOn = true
    /// "Eyes on: ask people who are there now" on an Ask about a picked place (8f).
    var asksEyesOnChosen = false
    /// "Start a Retake" and its name (1 to 60 characters).
    var startsRetake = false
    var retakeTitle = ""
    /// "Seal it" (8g): `none`, `date`, `place` or `rain`, and the date for `date`.
    var sealOpens = "none"
    var sealAt = Date().addingTimeInterval(86400)
    /// "Join tonight's sky" (8h): on by default where it is offered, one tap to leave out.
    var joinsSky = true
    /// "Start a pinboard" and its prompt (1 to 80 characters, 8i).
    var startsPinboard = false
    var pinboardPrompt = ""

    /// The Studio the choices belong to: its drawer rows claim it when they appear. A request from any other composer
    /// (today's Post sheet, another Studio) gets none of them.
    @ObservationIgnored private weak var owner: MomentsComposerModel?

    func claim(_ model: MomentsComposerModel) {
        if owner !== model { owner = model }
    }

    /// The Studio's stage is gone: its choices and what it was opened for go too.
    func release(_ model: MomentsComposerModel) {
        if owner === model { reset() }
    }

    func reset() {
        context = nil
        ghostOn = true
        startsRetake = false
        retakeTitle = ""
        asksEyesOnChosen = false
        sealOpens = "none"
        sealAt = Date().addingTimeInterval(86400)
        joinsSky = true
        startsPinboard = false
        pinboardPrompt = ""
        owner = nil
    }

    /// `studio.eyes_on` on the Studio's Ask (the "+ Ask / Kind" post), or nil (left out) unless chosen there.
    func asksEyesOn(model: MomentsComposerModel) -> Bool? {
        guard PulseReinventedFlags.shared.isOn, owner === model, asksEyesOnChosen, model.offersEyesOnAsk else { return nil }
        return true
    }

    /// The seal chosen, where it may be: a date from an hour to five years ahead; a place or rain only on an exact place.
    private func sealChoice(for model: MomentsComposerModel) -> SealChoice? {
        guard model.offersSeal else { return nil }
        switch sealOpens {
        case "date":
            // 61 minutes, not 60: the server measures "an hour from now" when the request arrives.
            let soon = Date().addingTimeInterval(61 * 60)
            return SealChoice(opens: "date", at: MomentTime.string(max(sealAt, soon)))
        case "place", "rain":
            return model.sealPlaceOK ? SealChoice(opens: sealOpens, at: nil) : nil
        default:
            return nil
        }
    }

    /// The keys this Studio adds to the Moment it makes (the first part only), or nil for today's request.
    func fields(for model: MomentsComposerModel, part: Int) -> TogetherCreateFields? {
        guard PulseReinventedFlags.shared.isOn, owner === model, part == 0 else { return nil }
        var fields = TogetherCreateFields()
        switch context {
        case let .retakeFrame(startId, _, _):
            // Only a photo joins a Retake; a text card or a video posts as an ordinary Moment.
            if case .photo = model.draft { fields.retakeOf = startId }
        case let .eyesOnAnswer(askId, _):
            // An Eyes-on answer is a Live photo (CONTRACT 8f); anything else posts as an ordinary Moment.
            if case .photo = model.draft { fields.eyesOnFor = askId }
        case let .pinboardPiece(startId, _):
            // A pinboard's piece is a photo (CONTRACT 8i); anything else posts as an ordinary Moment.
            if case .photo = model.draft { fields.pinboardOf = startId }
        case let .yourDay(date, id):
            fields.yourDay = .init(date: date, id: id)
        case nil:
            let title = String(retakeTitle.trimmingCharacters(in: .whitespacesAndNewlines).prefix(60))
            if startsRetake, !title.isEmpty, model.offersRetake { fields.retake = .init(title: title) }
            fields.seal = sealChoice(for: model)
            if joinsSky, model.offersSky { fields.joinConvergence = true }
            let prompt = String(pinboardPrompt.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
            if startsPinboard, !prompt.isEmpty, model.offersPinboard { fields.pinboard = .init(prompt: prompt) }
        }
        return fields.isEmpty ? nil : fields
    }
}

extension MomentsComposerModel {
    /// `POST /api/moments` for one part of this Post (`part` 0 is the first): exactly today's request, plus phase 3's
    /// keys where this Studio chose some (`TogetherCreate`).
    func createEndpoint(_ body: MomentCreateBody, part: Int) -> Endpoint {
        TogetherCreate.endpoint(body, part: part, from: self)
    }

    /// Eyes on may be asked (8f): an Ask under the person's own name; it needs a picked public place to post.
    var offersEyesOnAsk: Bool {
        studioPostKind == .askLocal && !postsUnderMadeUpName
    }

    /// "Seal it" may be chosen (8g): a photo, video or words under the person's own name, not a Pulse post; `place`
    /// and `rain` need an exact place on a photo or words. The server checks again (`400 SEAL_INVALID`).
    var offersSeal: Bool {
        draft != nil && !postsUnderMadeUpName && studioPostKind == nil && !studioGuess
    }

    var sealPlaceOK: Bool {
        if case .video = draft { return false }
        return !noLocationOn && pin != nil && !floats && place?.atHome != true
    }

    /// The Studio holds a photo (a Retake's frame, an Eyes-on answer and a Retake's start are photos).
    var isPhoto: Bool {
        if case .photo = draft { return true }
        return false
    }

    /// "Join tonight's sky" may be chosen (8h): a Live photo with an exact place, shared now with people nearby (a sky
    /// piece counts only those), away from home, under the person's own name, not a Pulse post. The server decides
    /// whether a window is open; a Moment taken outside one posts as usual.
    var offersSky: Bool {
        guard case .photo = draft, audience == .nearby, !noLocationOn, pin != nil, !floats, !showArea else { return false }
        return shareLaterBody == nil && !postsUnderMadeUpName && !studioGuess && studioPostKind == nil && place?.atHome != true
    }

    /// "Start a pinboard" may be chosen (8i): one photo under the person's own name, not a Pulse post. The server checks
    /// again (`400 PINBOARD_INVALID`).
    var offersPinboard: Bool {
        guard case .photo = draft else { return false }
        return !postsUnderMadeUpName && studioPostKind == nil && !studioGuess
    }

    /// "Start a Retake" may be chosen (8e): one photo with an exact place, taken now, away from home, under the person's
    /// own name, not a guess spot, not a Pulse post. The server checks again (`400 RETAKE_INVALID`).
    var offersRetake: Bool {
        guard case .photo = draft, !noLocationOn, pin != nil, !floats, shareLaterBody == nil else { return false }
        return !postsUnderMadeUpName && !studioGuess && studioPostKind == nil && place?.atHome != true
    }
}

/// The keys phase 3 adds at the top level of `POST /api/moments` (CONTRACT 8), each left out when not chosen.
struct TogetherCreateFields: Encodable, Hashable {
    struct RetakeStart: Encodable, Hashable {
        let title: String
    }

    var retake: RetakeStart?
    var retakeOf: String?
    var eyesOnFor: String?
    var seal: SealChoice?
    var joinConvergence: Bool?
    var pinboard: PinboardStart?
    var pinboardOf: String?
    var yourDay: YourDayKey?

    struct PinboardStart: Encodable, Hashable {
        let prompt: String
    }

    /// `your_day` (8k): the day a photo belongs to, and the id the app picked for that day's approval.
    struct YourDayKey: Encodable, Hashable {
        let date: String
        let id: String
    }

    var isEmpty: Bool {
        retake == nil && retakeOf == nil && eyesOnFor == nil && seal == nil && joinConvergence == nil && pinboard == nil
            && pinboardOf == nil && yourDay == nil
    }

    private enum CodingKeys: String, CodingKey {
        case retake
        case retakeOf = "retake_of"
        case eyesOnFor = "eyes_on_for"
        case seal
        case joinConvergence = "join_convergence"
        case pinboard
        case pinboardOf = "pinboard_of"
        case yourDay = "your_day"
    }

    func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(retake, forKey: .retake)
        try c.encodeIfPresent(retakeOf, forKey: .retakeOf)
        try c.encodeIfPresent(eyesOnFor, forKey: .eyesOnFor)
        try c.encodeIfPresent(seal, forKey: .seal)
        try c.encodeIfPresent(joinConvergence, forKey: .joinConvergence)
        try c.encodeIfPresent(pinboard, forKey: .pinboard)
        try c.encodeIfPresent(pinboardOf, forKey: .pinboardOf)
        try c.encodeIfPresent(yourDay, forKey: .yourDay)
    }
}

/// Today's create body with phase 3's keys beside its own, at the same level (as a subclass encodes after its super).
private struct TogetherCreateBody: Encodable {
    let base: MomentCreateBody
    let together: TogetherCreateFields

    func encode(to encoder: any Encoder) throws {
        try base.encode(to: encoder)
        try together.encode(to: encoder)
    }
}

enum TogetherCreate {
    /// `POST /api/moments` for one part of a Studio's Post. Exactly today's `MomentsEndpoints.create(body)` unless the
    /// switch is on and this Studio chose something of phase 3; then the same body plus those keys. Route
    /// `backend/routes/moments.js:371` (create).
    @MainActor
    static func endpoint(_ body: MomentCreateBody, part: Int, from model: MomentsComposerModel) -> Endpoint {
        guard let fields = TogetherStudio.shared.fields(for: model, part: part) else { return MomentsEndpoints.create(body) }
        return Endpoint(method: .post, path: "/api/moments", body: TogetherCreateBody(base: body, together: fields))
    }
}
