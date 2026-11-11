//
//  MomentsComposerModel+Place.swift
//  Pantopus
//
//  What the Post sheet shows about the place: the name others will read, the
//  short list of names that fit the pin, the venue picked in the place picker
//  (the Pulse composer's, around the pin; founder 2026-11-11) and the pin the
//  small map shows, plus "Taken Oct 3" for an old album photo or video.
//

import CoreLocation
import Foundation

extension MomentsComposerModel {
    /// "Post with no location" on the location card (founder 2026-11-11): the camera, the library and a text card
    /// work as usual, and the Moment goes to connections only, with no pin. Needs a connection and the 18+ answer.
    func continueWithoutLocation() async {
        error = nil
        do {
            let reply: MomentPlacePreviewDTO = try await MomentsAPI.send(MomentsEndpoints.postingPreview)
            if let has = reply.hasConnections { hasConnections = has }
            guard reply.hasConnections != false else {
                error = MomentsFailure.noConnections.message
                return
            }
            if reply.adultConfirmed == false { asksAdult = true }
            noLocation = true
            choseNoLocation = true
            previewSettled = true
        } catch let failure as MomentsFailure {
            error = failure.message
        } catch {
            self.error = MomentsFailure.offline.message
        }
    }

    /// The Post sheet's "Don't show where". It stays on when there's no pin; it needs a connection.
    func setNoLocation(_ on: Bool) {
        if !on, noLocationLocked { return }
        if on, hasConnections == false {
            error = MomentsFailure.noConnections.message
            return
        }
        error = nil
        noLocation = on
    }

    /// What the place row says: the place (the venue or the name picked, when one was), the town for an area, or
    /// "Your home".
    var placeLine: String {
        if noLocationOn { return "No location" }
        if showArea { return place?.areaLabel ?? place?.placeLabel ?? "This area" }
        if let pickedVenue { return pickedVenue.name }
        if place?.atHome == true { return "Your home" }
        if let picked = pickedPlace { return picked.label }
        return place?.placeLabel.isEmpty == false ? place?.placeLabel ?? "" : "Near you"
    }

    /// The names to pick from: more than one fits the exact pin, and neither the area nor the home hides it.
    var placeChoices: [MomentPlaceChoiceDTO] {
        guard let place, place.places.count > 1, !showArea, !noLocationOn, !place.atHome else { return [] }
        return place.places
    }

    /// The name the person picked, while it can still be picked.
    var pickedPlace: MomentPlaceChoiceDTO? {
        guard let placeKey else { return nil }
        return placeChoices.first { $0.key == placeKey }
    }

    /// The row with the check: the picked one, else the automatic one (the first); none while a venue names it.
    var selectedPlaceKey: String? {
        guard pickedVenue == nil else { return nil }
        return pickedPlace?.key ?? placeChoices.first?.key
    }

    /// A venue picked in the place picker moves the pin off the home (the server checks its point again).
    var showsHomeNotice: Bool {
        place?.atHome == true && !showArea && pickedVenue == nil && !noLocationOn
    }

    /// The pin the sheet's map shows: at the venue picked, else `basePin`.
    var pin: CLLocationCoordinate2D? {
        if let pickedVenue { return CLLocationCoordinate2D(latitude: pickedVenue.latitude, longitude: pickedVenue.longitude) }
        return basePin
    }

    /// The venue that names the Moment: for an exact pin, while the pin is still the one it was picked around.
    var pickedVenue: MomentVenue? {
        guard let venue, !showArea, let basePin, venue.around.latitude == basePin.latitude,
              venue.around.longitude == basePin.longitude else { return nil }
        return venue
    }

    /// An exact pin can name a venue from the place picker (around the photo's spot, or where you are).
    var canFindPlace: Bool {
        !showArea && basePin != nil && draft != nil && !noLocationOn
    }

    /// No location: switched on, or there's no pin at all (location off and nothing in the file).
    var noLocationOn: Bool {
        noLocation || basePin == nil
    }

    /// With no pin at all the switch stays on: there's nowhere to pin the Moment.
    var noLocationLocked: Bool {
        basePin == nil
    }

    /// How far from the pin the picker's places may be (the server's number, else 1500 m).
    var pickWithinM: Double {
        place?.pickWithinM ?? 1500
    }

    /// The place picker's anchor: the pin before any venue (only ever local; never sent as is).
    var placePickerAnchor: MediaCaptureLocation? {
        basePin.map { MediaCaptureLocation(latitude: $0.latitude, longitude: $0.longitude, capturedAt: nil) }
    }

    /// "Taken Oct 3" on the Post sheet: an album photo or video taken more than a day ago (everyone will see it).
    var takenLine: String? {
        guard let takenAt, draft != .text, draft != nil, MomentTime.takenLongAgo(takenAt) else { return nil }
        return MomentTime.taken(takenAt)
    }

    /// Both place sheets go away (the list of names and the place picker share one sheet).
    func closePlaceSheets() {
        picksPlace = false
        findsPlace = false
    }

    var canPost: Bool {
        !isPosting && (pin != nil || noLocationOn) && draft != nil && !asksAdult
    }

    var postLabel: String {
        // Several picked together: which one this is. The hours are on the sheet's own row either way.
        if let pickedPosition { return "Post \(pickedPosition)" }
        return "Post · shows for \(hours == 1 ? "1 hour" : "\(hours) hours")"
    }
}

/// A venue picked in the place picker, with the pin it was picked around (contract v3.3 `venue_id`).
struct MomentVenue: Equatable {
    let placeId: String
    let name: String
    let latitude: Double
    let longitude: Double
    let around: CLLocationCoordinate2D

    static func == (lhs: MomentVenue, rhs: MomentVenue) -> Bool {
        lhs.placeId == rhs.placeId && lhs.around.latitude == rhs.around.latitude && lhs.around.longitude == rhs.around.longitude
    }
}
