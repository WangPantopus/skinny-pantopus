//
//  MomentsViewer+Paging.swift
//  Pantopus
//
//  Moving between people with the finger (founder, 2026-11-11: "swipe to
//  previous or next users' posts really smooth"): a sideways drag turns the
//  page as it goes, the person after or before coming in beside the one
//  showing like the next face of a box; letting go early springs it back.
//  The page that comes in is drawn from what was read ahead, and the model
//  shows the same Moment the frame the turn ends, so nothing blinks. On a
//  phone only: the iPhone Duo's layouts change person when the finger lifts,
//  as before. A pinch makes a photo bigger while it's held.
//

import SwiftUI

/// The person on one side of the one showing: who, and the Moment their ring opens on when it was read ahead.
struct MomentsPeek {
    let ring: MomentRingDTO
    let index: Int
    let brief: MomentBriefDTO
    let moment: MomentDTO?
    /// Their photo, or their video's first picture.
    let picture: UIImage?
}

/// One page of the turn: `position` is how far its leading edge is from where it fills the screen.
struct MomentsPageTurn: ViewModifier {
    let position: CGFloat
    let width: CGFloat
    /// Reduce Motion: the pages slide flat.
    let flat: Bool

    func body(content: Content) -> some View {
        content
            .rotation3DEffect(
                .degrees(flat || width <= 0 ? 0 : Double(position / width) * 45),
                axis: (x: 0, y: 1, z: 0),
                anchor: position > 0 ? .leading : .trailing,
                perspective: 2.5
            )
            .offset(x: position)
    }
}

extension MomentsViewer {
    /// A sideways drag turns the page with the finger on a phone, when nothing is being typed.
    var pagesWithFinger: Bool {
        !isCard && duo.pose == .phone
    }

    /// The person the drag is bringing in, and where their page is.
    var incoming: (peek: MomentsPeek, position: CGFloat)? {
        guard pageOffset != 0, pageWidth > 0 else { return nil }
        let step = pageOffset < 0 ? 1 : -1
        guard let peek = model.peek(step) else { return nil }
        return (peek, pageOffset + CGFloat(step) * pageWidth)
    }

    /// How far the page follows a drag of `distance`: all the way toward a person, a third of it where there is none.
    func pull(_ distance: CGFloat) -> CGFloat {
        model.peek(distance < 0 ? 1 : -1) == nil ? distance / 3 : distance
    }

    /// The finger lifted from a sideways drag: far or fast enough turns the page, anything less springs back.
    func turnPage(_ value: DragGesture.Value) {
        let moved = value.translation.width
        let thrown = value.predictedEndTranslation.width
        let far = abs(moved) > pageWidth * 0.2 || abs(thrown) > pageWidth * 0.5
        let step = moved < 0 ? 1 : -1
        guard far, moved != 0 else { return settlePage() }
        guard model.peek(step) != nil else {
            // Past the last person the viewer closes, as it always has; before the first there is nowhere to go.
            settlePage()
            if step > 0 { model.nextRing() }
            return
        }
        turning = true
        withAnimation(.easeOut(duration: 0.24)) {
            pageOffset = CGFloat(-step) * pageWidth
        } completion: {
            var plain = Transaction()
            plain.disablesAnimations = true
            withTransaction(plain) {
                if step > 0 { model.nextRing() } else { model.previousRing() }
                pageOffset = 0
            }
            turning = false
            model.handling = false
        }
    }

    func settlePage() {
        guard pageOffset != 0 else {
            if !zooming { model.handling = false }
            return
        }
        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
            pageOffset = 0
        } completion: {
            if pressStarted == nil, !zooming, !turning { model.handling = false }
        }
    }

    // MARK: - The page that comes in

    /// The incoming person's page, laid out as the stage lays out the one showing: their picture under the bars and
    /// the header, with nothing to tap until it is the one showing.
    func peekStage(_ geo: GeometryProxy, _ peek: MomentsPeek) -> some View {
        let height = geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom
        return ZStack(alignment: .top) {
            Color.black
            peekMedia(peek)
                .frame(width: geo.size.width + geo.safeAreaInsets.leading + geo.safeAreaInsets.trailing, height: max(height - 68, 200))
                .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 18, bottomTrailingRadius: 18, style: .continuous))
                .overlay(alignment: .top) {
                    LinearGradient(colors: [Color.black.opacity(0.55), .clear], startPoint: .top, endPoint: .bottom)
                        .frame(height: 180)
                }
            VStack(spacing: 0) {
                MomentsProgressBars(count: peek.ring.moments.count, current: peek.index, progress: 0)
                    .padding(.horizontal, 10)
                    .padding(.top, geo.safeAreaInsets.top + 8)
                MomentsViewerHeader(
                    author: peek.ring.author,
                    isMine: peek.ring.mine,
                    place: peek.moment?.placeLabel ?? peek.ring.placeLabel,
                    times: MomentsViewerModel.times(
                        created: peek.moment?.createdAtDate ?? MomentTime.parse(peek.brief.createdAt),
                        ends: peek.moment?.expiresAtDate ?? peek.brief.expiresAtDate
                    ),
                    isVideo: peek.brief.kind == .video,
                    muted: model.muted,
                    compact: false,
                    onSound: {},
                    onMore: {},
                    onClose: {}
                )
                .padding(.top, 9)
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func peekMedia(_ peek: MomentsPeek) -> some View {
        if peek.brief.kind == .text, let moment = peek.moment {
            MomentsTextCard(text: moment.text ?? "", background: moment.background)
        } else if let picture = peek.picture {
            Image(uiImage: picture).resizable().scaledToFill()
        } else {
            Color(white: 0.08)
        }
    }

    // MARK: - The place

    /// The place under the name shows on the map: the viewer closes and the map comes in on the spot. Not for a
    /// Moment with no location, and only where the viewer is over a map that can show it.
    var placeAction: (() -> Void)? {
        guard let onShowPlace, let ring = model.ring, !ring.noLocation else { return nil }
        return {
            onShowPlace(ring)
            model.close()
        }
    }

    // MARK: - Pinch

    /// Two fingers make a photo bigger where they are, while they're held; it goes back when they lift.
    var zoomGesture: some Gesture {
        MagnifyGesture(minimumScaleDelta: 0.02)
            .onChanged { value in
                guard model.moment?.kind == .photo, model.load == .ready, !isReplying, !turning else { return }
                if !zooming {
                    zooming = true
                    zoomAnchor = value.startAnchor
                    holdTask?.cancel()
                    pageOffset = 0
                    dragOffset = .zero
                    model.handling = true
                }
                // The first finger's own press is part of the pinch: it neither taps nor swipes when it lifts.
                if pressStarted != nil { pressZoomed = true }
                zoom = min(max(value.magnification, 1), 4)
            }
            .onEnded { _ in
                guard zooming else { return }
                zooming = false
                withAnimation(.spring(response: 0.32, dampingFraction: 0.82)) { zoom = 1 }
                model.handling = false
            }
    }
}
