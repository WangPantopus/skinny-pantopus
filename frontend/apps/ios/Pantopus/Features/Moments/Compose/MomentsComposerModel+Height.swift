//
//  MomentsComposerModel+Height.swift
//  Pantopus
//
//  "Show elevation" on the Post sheet (board H1): the Moment says how high above
//  sea level it was made, rounded to 10 ft. The height goes with the pin: the
//  album photo's own where the Moment pins where the photo was taken, else the
//  fix's. The switch is offered only where the server allows it (heights are
//  on for you and the spot isn't your home), for an exact pin, and for a
//  reading the server will keep; once turned on it stays on for your next
//  Moments on this phone.
//

import Foundation

extension MomentsComposerModel {
    /// The reading that goes with the pin.
    private var heightReading: HeightReading? {
        capture != nil ? captureHeight : fixHeight
    }

    /// The feet the row shows and everyone will read; nil with no reading, or one the server would leave out.
    var heightFeet: Int? {
        heightReading.flatMap { MomentHeight.feet(meters: $0.meters, accuracyM: $0.accuracyMeters, speedMps: $0.speedMps) }
    }

    /// The "Show elevation" row is on the sheet: never at home, for an area or with no location.
    var offersHeight: Bool {
        place?.canShowHeight == true && !showArea && !noLocationOn && heightFeet != nil
    }

    /// What goes with the post: the reading, only while the row is on the sheet and switched on.
    var shownHeight: MomentAltitudeBody? {
        guard offersHeight, showHeight, let reading = heightReading else { return nil }
        return MomentAltitudeBody(meters: reading.meters, accuracyM: reading.accuracyMeters, speedMps: reading.speedMps)
    }
}
