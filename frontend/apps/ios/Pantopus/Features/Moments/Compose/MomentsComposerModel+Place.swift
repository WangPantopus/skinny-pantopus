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
    /// What the place row says: the place (the venue or the name picked, when one was), the town for an area, or
    /// "Your home".
    var placeLine: String {
        if showArea { return place?.areaLabel ?? place?.placeLabel ?? "This area" }
        if let pickedVenue { return pickedVenue.name }
        if place?.atHome == true { return "Your home" }
        if let picked = pickedPlace { return picked.label }
        return place?.placeLabel.isEmpty == false ? place?.placeLabel ?? "" : "Near you"
    }

    /// The names to pick from: more than one fits the exact pin, and neither the area nor the home hides it.
    var placeChoices: [MomentPlaceChoiceDTO] {
        guard let place, place.places.count > 1, !showArea, !place.atHome else { return [] }
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
        place?.atHome == true && !showArea && pickedVenue == nil
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
        !showArea && basePin != nil && draft != nil
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
        !isPosting && pin != nil && draft != nil && !asksAdult
    }

    var postLabel: String {
        "Post · shows for \(hours == 1 ? "1 hour" : "\(hours) hours")"
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
