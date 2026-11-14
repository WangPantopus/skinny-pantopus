//
//  MomentsMapRow.swift
//  Pantopus
//
//  When the row of faces shows at the bottom of the Moments map (founder,
//  2026-11-11: "only show this when users clicked on a cluster"). One person
//  is tapped on the map; the row is for a crowded spot, and comes with the
//  tap on its bubble (board M2). Three things have no other home, so the row
//  also shows for them: connections' Moments with no location (they aren't
//  on the map), and your own Moment while it posts or after it didn't.
//  Play all moves to a small pill, "Play all · 13 new", there while
//  something is new.
//

import SwiftUI

extension MomentsMapViewModel {
    /// The empty card's line: the place where you are while the map shows it, else "around here".
    var emptyLine: String {
        if centerSource == .gps, let center, let herePlace, !herePlace.isEmpty, let region = lastRegion,
           abs(region.center.latitude - center.latitude) < region.span.latitudeDelta / 2,
           abs(region.center.longitude - center.longitude) < region.span.longitudeDelta / 2 {
            return "Share what's happening at \(herePlace)."
        }
        return "Share what's happening around here."
    }

    /// The faces the row lists: a crowded spot's people (M2); otherwise only the people with a Moment that has no
    /// location, since everyone else is on the map.
    var rowPeople: [MomentsStripPerson] {
        if focus != nil { return stripPeople }
        return stripPeople.filter { person in person.rings.contains(where: \.noLocation) }
    }

    /// Whether the row shows: a crowded spot is open, someone's Moment isn't on the map, or yours is posting.
    func showsRow(postings: [MomentPosting]) -> Bool {
        focus != nil || !postings.isEmpty || stripRings.contains(where: \.noLocation)
    }

    /// What Play all plays with no spot open: the new ones in view, nearest first. Empty when caught up.
    var newRingsInView: [MomentRingDTO] {
        stripRings.filter { $0.isNew && !$0.mine }
    }

    /// The row of faces is for a crowded spot (founder, 2026-11-11). Zoomed in by hand past where the tap left the
    /// map, with the bubble split into single people, the spot closes: each of them is tapped on the map.
    func closeSpotIfSplit(span: Double) {
        guard var focus else { return }
        // By hand: a finger was on the map just now, and after the tap that opened the spot had zoomed in.
        let byHand = fingerOnMapAt.map { $0.timeIntervalSince(focus.openedAt) > 0.6 && Date().timeIntervalSince($0) < 2.5 } ?? false
        guard byHand, let opened = focus.openedSpan else {
            // The tap's own zoom (or another move the map made): the closest it went is where the spot opened.
            let closest = min(focus.openedSpan ?? span, span)
            if focus.openedSpan != closest {
                focus.openedSpan = closest
                self.focus = focus
            }
            return
        }
        guard span < opened * 0.75 else { return }
        let stillBubble = markers.contains { marker in
            guard case let .cluster(cluster) = marker else { return false }
            return cluster.rings.contains { focus.ringIds.contains($0.id) }
        }
        if !stillBubble { self.focus = nil }
    }
}

extension MomentsMapView {
    /// How much of the bottom of the map is covered, with its margin: the row of faces when it shows, else + and
    /// the Play all pill. The map keeps what it centers on above it.
    var coveredBottom: CGFloat {
        viewModel.phase == .ready && viewModel.showsRow(postings: uploads.postings) ? 148 : 84
    }
}

/// "▶ Play all · 13 new": on the map while something in view is new, and in the row's header when the row shows
/// without a crowded spot.
struct MomentsPlayAllButton: View {
    let rings: [MomentRingDTO]
    let actions: MomentsMapActions
    /// On the map by itself: a glass pill. In the row's header: just the words.
    var floats = true

    var body: some View {
        if floats {
            button.momentsGlass(Capsule())
        } else {
            button
        }
    }

    private var button: some View {
        let people = MomentsMapViewModel.newPeople(in: rings)
        return Button {
            actions.watch(rings, 0, true)
        } label: {
            HStack(spacing: 6) {
                Icon(.play, size: 12, color: Theme.Color.primaryTint)
                Text("Play all · \(people) new").font(.system(size: 15, weight: .semibold))
            }
            .foregroundStyle(Theme.Color.primaryTint)
            .lineLimit(1)
            .padding(.horizontal, floats ? Spacing.s4 : 10)
            .frame(height: floats ? 48 : 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Play all, \(people) new")
        .accessibilityIdentifier("moments.playAll")
    }
}
