//
//  MomentsMapView+Duo.swift
//  Pantopus
//
//  The Moments map on the open iPhone Duo (the founder's Duo boards,
//  approved 2026-11-11). The map fills the whole screen and never changes
//  size (a resized map stops listing its pins to VoiceOver). Held sideways,
//  flat or like a book, a tapped ring plays in a card on the right half
//  (O2): the map glides so the ring stands in the middle of the left half,
//  follows the queue from ring to ring, and goes back to where it was when
//  the card closes. A crowded spot zooms in and lists who is there in the
//  same card (O3); replying, the card ends above the keyboard and the map
//  moves up with it (O5); on your own Moment, Seen by is a card on the left
//  beside it (O6).
//

import MapKit
import SwiftUI

/// What the Moments tab does with watching that shows in the card beside the map.
struct MomentsViewerHooks {
    let onHideAuthor: @MainActor (String) -> Void
    let onShowAuthor: @MainActor (String) -> Void
    /// The person closed it (✕, swipe down, a tap on the map, or back to a crowded spot's list).
    let onClose: @MainActor () -> Void
}

extension MomentsMapView {
    /// The open Duo's top row: the phone's ☰, area and chat, 358 pt wide at the top left (boards O1, U1).
    static let openRowWidth: CGFloat = 358
    /// Under the open top row, and above the bottom row (+ is 60 tall, 12 pt off the bottom).
    static let openRowHeight: CGFloat = 48
    static let openBottomRow: CGFloat = 72

    /// Open sideways, a card shows beside the map: watching, or a crowded spot's list.
    var cardOpen: Bool {
        duo.pose.isWide && (watching != nil || viewModel.focus != nil)
    }

    /// The ring playing in the card, drawn bigger in a halo (board O2).
    var playingRingId: String? {
        duo.pose.isWide ? watching?.model.ring?.id : nil
    }

    /// Its Moments: a Moment opened from Messages or a push comes as a ring of its own, so the map's ring is found by
    /// the Moments it holds.
    var playingMomentIds: Set<String> {
        guard playingRingId != nil, let ring = watching?.model.ring else { return [] }
        return Set(ring.moments.map(\.id))
    }

    func isPlaying(_ ring: MomentRingDTO) -> Bool {
        let playing = playingMomentIds
        return !playing.isEmpty && ring.moments.contains { playing.contains($0.id) }
    }

    // MARK: - What's clear of the controls

    /// The part of the open map nothing covers: under the top row, above the bottom row and left of the side strip;
    /// with a card beside the map, the clear part of the left half.
    var openClearRect: CGRect {
        if cardOpen, clearBand.height > 0 { return clearBand }
        return openMapRect
    }

    /// The open map's clear part without a card: the map's own safe area, which never changes while the Duo is held
    /// the same way (a change would move every pin).
    var openMapRect: CGRect {
        let top = (duo.topRowTop ?? 0) + Self.openRowHeight
        let bottom = duo.size.height - duo.insets.bottom - Self.openBottomRow
        return CGRect(x: 0, y: top, width: duo.size.width - duo.insets.trailing, height: max(bottom - top, 120))
    }

    /// Where the playing ring's tip goes: the middle of the left half's clear part, low enough that the ring itself
    /// (above its tip) is the thing in the middle. With Seen by open on the left, between the list and the fold, so
    /// your ring stays in view beside it (board O6).
    private var ringSpot: CGPoint {
        let x = showsSeenByCard ? (16 + Self.openRowWidth + duo.leftHalf.maxX) / 2 : clearBand.midX
        return CGPoint(x: x, y: clearBand.midY + MomentRingPin.playingMiddleAboveTip)
    }

    /// Board O6: your own Moment's Seen by, as a card on the left.
    var showsSeenByCard: Bool {
        guard duo.pose.isWide, let watching else { return false }
        return watching.showsSeenBy && watching.model.isMine
    }

    // MARK: - The cards

    /// The card on the right half (the viewer or a crowded spot's list) and, on your own Moment, Seen by on the
    /// left. Laid out over the whole screen; typing, the screen ends at the keyboard and the viewer's card with it.
    var cardsBesideMap: some View {
        GeometryReader { geo in
            let card = duo.card
            ZStack(alignment: .topLeading) {
                Color.clear
                if let watching, let viewerHooks {
                    // Typing a reply, the card ends 8 pt above the keyboard (board O5).
                    let bottom = min(card.maxY, geo.size.height - 8)
                    ZStack {
                        MomentsViewer(
                            session: watching,
                            systemScheme: colorScheme,
                            presentation: .card,
                            onBack: viewModel.focus == nil ? nil : viewerHooks.onClose,
                            onHideAuthor: viewerHooks.onHideAuthor,
                            onShowAuthor: viewerHooks.onShowAuthor,
                            onClose: viewerHooks.onClose
                        )
                    }
                    .frame(width: card.width, height: max(bottom - card.minY, 200))
                    // The shadow is drawn by a plain card behind it, not by the playing picture.
                    .background {
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .fill(Color.black)
                            .shadow(color: .black.opacity(0.38), radius: 22, x: 0, y: 14)
                            .shadow(color: .black.opacity(0.22), radius: 4, x: 0, y: 2)
                    }
                    .accessibilityElement(children: .contain)
                    .accessibilityIdentifier("moments.card")
                    .offset(x: card.minX, y: card.minY)
                    if showsSeenByCard {
                        seenByCard(watching)
                    }
                } else if let focus = viewModel.focus {
                    MomentsSpotCard(
                        title: focus.title,
                        people: viewModel.stripPeople,
                        rings: viewModel.stripRings,
                        onPlay: { actions.watch($0, $1, $2) },
                        onPerson: { actions.watch(viewModel.watchQueue(from: $0), 0, false) },
                        onClose: backToArea
                    )
                    .frame(width: card.width, height: card.height)
                    .offset(x: card.minX, y: card.minY)
                }
            }
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                let top = (duo.topRowTop ?? 0) + Self.openRowHeight
                let bottom = min(duo.size.height - duo.insets.bottom, height)
                clearBand = CGRect(x: 0, y: top, width: duo.leftHalf.width, height: max(bottom - top, 60))
            }
        }
        .ignoresSafeArea(.container)
    }

    /// Board O6: who watched your Moment, on the left beside it, under the top row. It ends above MapKit's Legal
    /// link at the bottom left of the map, so the link stays in view and can be tapped.
    private func seenByCard(_ watching: MomentsWatchSession) -> some View {
        let top = (duo.topRowTop ?? 0) + Self.openRowHeight + 12
        let bottom = duo.size.height - openMapBottomPadding - Self.legalClearance
        let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)
        return MomentsSeenBySheet(model: watching.model, topPadding: 22) { watching.showsSeenBy = false }
            .frame(width: Self.openRowWidth, height: max(bottom - top, 240), alignment: .top)
            .background {
                shape.fill(.ultraThinMaterial)
                shape.fill(MomentsPalette.pinSurface.opacity(0.92))
            }
            .clipShape(shape)
            .overlay(shape.strokeBorder(Theme.Color.appBorderSubtle.opacity(0.6), lineWidth: 0.5))
            .shadow(color: .black.opacity(0.24), radius: 22, x: 0, y: 14)
            .shadow(color: .black.opacity(0.12), radius: 4, x: 0, y: 2)
            .offset(x: 16, y: top)
            .transition(.opacity)
    }

    /// How far above the map's safe area the left cards stop, to keep MapKit's Legal link uncovered: the link sits
    /// 10 pt above it and is 11 pt tall (measured on the Duo simulator), then 8 pt of space.
    static let legalClearance: CGFloat = 29

    /// Closed, the strip or the card at the bottom reports its height (phones don't ask).
    var closedBottomReporter: ((CGFloat) -> Void)? {
        guard duo.pose == .closed else { return nil }
        return { leftCardHeight = $0 }
    }

    /// The Duo map's safe area at the bottom: the Home indicator, then the card at the bottom left with 12 pt under
    /// it and 4 above, so MapKit's Legal link (which follows the safe area) is never under the pill, the strip or a
    /// card. Open, the card stays laid out while hidden, so the margin doesn't move when a card opens beside the map.
    var openMapBottomPadding: CGFloat {
        duo.insets.bottom + 12 + leftCardHeight + 4
    }

    // MARK: - Moving the map

    /// The playing ring changed: the card opened (remember the camera, then glide to the ring), the queue moved on
    /// (glide to the next ring), or the card closed (put the camera back).
    func cardRingChanged(from old: String?, to new: String?, proxy: MapProxy) {
        if old == nil, new != nil, cameraBeforeCard == nil {
            cameraBeforeCard = viewModel.lastCamera
        }
        if new != nil, let ring = watching?.model.ring {
            glide(to: ring, proxy: proxy)
        } else if new == nil, let before = cameraBeforeCard {
            cameraBeforeCard = nil
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.45)) { camera = .camera(before) }
        }
    }

    /// The clear part of the left half changed (the keyboard came or went): the playing ring moves with it.
    func clearBandChanged(proxy: MapProxy) {
        guard playingRingId != nil, let ring = watching?.model.ring else { return }
        glide(to: ring, proxy: proxy)
    }

    /// The camera settled: a card that opened before the map had settled once (a Moment from Messages or a push,
    /// with the tab just built) glides to its ring now.
    func glideIfPending(proxy: MapProxy) {
        guard glidePending, playingRingId != nil, let ring = watching?.model.ring else { return }
        glidePending = false
        if cameraBeforeCard == nil { cameraBeforeCard = viewModel.lastCamera }
        glide(to: ring, proxy: proxy)
    }

    /// Pans the map, at the zoom it has, so the ring's tip lands on `ringSpot` (all in the window's points, which are
    /// the screen's here).
    private func glide(to ring: MomentRingDTO, proxy: MapProxy) {
        let coordinate = CLLocationCoordinate2D(latitude: ring.latitude, longitude: ring.longitude)
        guard clearBand.height > 0,
              let anchor = cameraAnchor,
              let current = viewModel.lastCamera,
              let ringPoint = proxy.convert(coordinate, to: .global)
        else {
            glidePending = true
            return
        }
        glidePending = false
        let target = ringSpot
        let centerPoint = CGPoint(x: anchor.x + ringPoint.x - target.x, y: anchor.y + ringPoint.y - target.y)
        guard let center = proxy.convert(centerPoint, from: .global) else { return }
        var next = current
        next.centerCoordinate = center
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.5)) { camera = .camera(next) }
    }

    /// Board O3: zooms into a crowded spot with the spot in the middle of the left half, beside its list. The zoom is
    /// the phone's (`MomentsClustering.span(toOpen:)` across the clear part); the camera keeps its heading and pitch.
    func zoomBeside(_ cluster: MomentsCluster) {
        let span = MomentsClustering.span(toOpen: cluster)
        guard let anchor = cameraAnchor, let current = viewModel.lastCamera, let region = viewModel.lastRegion,
              region.span.latitudeDelta > 0
        else {
            camera = .region(MKCoordinateRegion(
                center: cluster.coordinate,
                span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)
            ))
            return
        }
        let clear = openClearRect
        // Points per degree of latitude now (the last read was this many points tall) and after the zoom.
        let pointsNow = viewModel.mapPoints / region.span.latitudeDelta
        let pointsAfter = clear.height / span
        // The spot in the middle of the left half; its people's pins stand above it.
        let target = CGPoint(x: duo.leftHalf.midX, y: clear.midY + 36)
        let longitudeScale = max(cos(cluster.coordinate.latitude * .pi / 180), 0.1)
        let center = CLLocationCoordinate2D(
            latitude: cluster.coordinate.latitude + (target.y - anchor.y) / pointsAfter,
            longitude: cluster.coordinate.longitude + (anchor.x - target.x) / (pointsAfter * longitudeScale)
        )
        let distance = current.distance * pointsNow / pointsAfter
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) {
            camera = .camera(MapCamera(centerCoordinate: center, distance: distance, heading: current.heading, pitch: current.pitch))
        }
    }

    /// A tap on the map itself (not on a ring) closes the card beside it, as ✕ does (board O2).
    func mapTapped() {
        guard duo.pose.isWide, watching != nil, let viewerHooks else { return }
        viewerHooks.onClose()
    }
}
