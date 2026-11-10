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

    var isPaused: Bool {
        holding || replying || covered || away || load != .ready
    }

    /// "Vancouver Community Library", the first part of the header's second line.
    var metaPlace: String {
        guard let ring else { return "" }
        return moment?.placeLabel ?? ring.placeLabel
    }

    /// "2h ago · 22h left": always shown whole, while a long place name is cut short.
    var metaTimes: String {
        guard ring != nil else { return "" }
        let created = moment?.createdAtDate ?? brief.flatMap { MomentTime.parse($0.createdAt) }
        let ends = moment?.expiresAtDate ?? brief?.expiresAtDate
        // Once it has ended ("This Moment has ended.") there is no time left to show.
        var over = ends.map { $0 <= Date() } ?? false
        if case .gone = load { over = true }
        return [MomentTime.ago(created), over ? "" : MomentTime.left(ends)].filter { !$0.isEmpty }.joined(separator: " · ")
    }
}
