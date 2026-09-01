//
//  ShareLinkItem.swift
//  Pantopus
//
//  Identifiable wrapper for a booking link so it can drive a `.sheet(item:)`
//  share sheet from the event-type list. Extracted from
//  `EventTypeListViewModel.swift` to keep that file under the line budget.
//

import Foundation

/// Identifiable wrapper so the booking link can drive a `.sheet(item:)`.
struct ShareLinkItem: Identifiable {
    let link: String
    var id: String {
        link
    }
}
