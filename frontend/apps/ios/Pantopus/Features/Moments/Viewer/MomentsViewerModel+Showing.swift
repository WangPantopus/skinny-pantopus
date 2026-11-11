//
//  MomentsViewerModel+Showing.swift
//  Pantopus
//
//  What the viewer's model says about the Moment on screen: whose ring and
//  which Moment, whether it's paused, the header's place and times, and the
//  small things it puts over the picture (a note, the reaction's pop).
//

import Foundation

extension MomentsViewerModel {
    enum Load: Equatable {
        case loading
        case ready
        /// Ended or no longer visible: a line, then the next one.
        case gone(String)
        case failed(String)
    }

    /// The emoji that pops over the Moment when a quick reaction is chosen.
    struct ReactionPop: Equatable, Identifiable {
        let id = UUID()
        let emoji: String
    }

    /// A sentence over the viewer for a moment, with one optional action ("Undo").
    struct Toast: Equatable {
        let id = UUID()
        let text: String
        var action: String?
    }

    // MARK: - What shows

    var ring: MomentRingDTO? {
        rings.indices.contains(ringIndex) ? rings[ringIndex] : nil
    }

    var brief: MomentBriefDTO? {
        guard let ring, ring.moments.indices.contains(momentIndex) else { return nil }
        return ring.moments[momentIndex]
    }

    var isMine: Bool {
        ring?.mine ?? false
    }

    /// On a table, who plays after this person (board T1): the rings after this one, in the queue's order.
    var upNext: ArraySlice<MomentRingDTO> {
        rings.indices.contains(ringIndex + 1) ? rings[(ringIndex + 1)...] : []
    }

    var isPaused: Bool {
        holding || handling || replying || covered || away || load != .ready
    }

    /// "Vancouver Community Library", the first part of the header's second line.
    var metaPlace: String {
        guard let ring else { return "" }
        return moment?.placeLabel ?? ring.placeLabel
    }

    /// "Taken Oct 3": a photo or video taken more than a day before it was posted (contract v3.3), shown under the
    /// header so an old photo never reads as now.
    var metaTaken: String? {
        guard load == .ready else { return nil }
        return MomentTime.taken(moment?.takenAt)
    }

    /// "2h ago · 22h left": always shown whole, while a long place name is cut short.
    var metaTimes: String {
        guard ring != nil else { return "" }
        let created = moment?.createdAtDate ?? brief.flatMap { MomentTime.parse($0.createdAt) }
        let ends = moment?.expiresAtDate ?? brief?.expiresAtDate
        // Once it has ended ("This Moment has ended.") there is no time left to show.
        var over = ends.map { $0 <= Date() } ?? false
        if case .gone = load { over = true }
        return Self.times(created: created, ends: over ? nil : ends)
    }

    static func times(created: Date?, ends: Date?) -> String {
        [MomentTime.ago(created), MomentTime.left(ends)].filter { !$0.isEmpty }.joined(separator: " · ")
    }
}
