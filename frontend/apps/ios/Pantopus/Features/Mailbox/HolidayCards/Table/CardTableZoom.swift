//
//  CardTableZoom.swift
//  Pantopus
//
//  Enlarging the card on the table (launch key `card_table`, plan 6.1): pinch or double-tap the card for up to three
//  times its size, drag to move around it, double-tap again to put it back. The light keeps moving. This is how small
//  details and the verse printed on a picture get read.
//

import SwiftUI

extension CardTableModel {
    nonisolated static let maxZoom: CGFloat = 3
    /// What a double-tap enlarges it to.
    nonisolated static let tapZoom: CGFloat = 2.2

    /// The card can be enlarged: out of its envelope and lying alone (not the open Duo's two pages), not being sealed.
    var canZoom: Bool {
        step == .out && sending == nil && !fold.isSpread
    }

    var isZoomed: Bool {
        zoom > 1.01
    }

    /// One tap on the card turns it, a moment later; a second tap in that moment is a double-tap, which enlarges it
    /// about the place tapped, or puts it back. One tap on an enlarged card does nothing, so reading isn't upset.
    func tapCard(at point: CGPoint, layout: CardTableLayout) {
        if let pending = pendingCardTap {
            pending.cancel()
            pendingCardTap = nil
            toggleZoom(at: point, layout: layout)
            return
        }
        pendingCardTap = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard let self, !Task.isCancelled else { return }
            pendingCardTap = nil
            if !isZoomed { turnCard() }
        }
    }

    /// To `tapZoom` about `point` (the card's middle when nil, for VoiceOver), or back to its place.
    func toggleZoom(at point: CGPoint?, layout: CardTableLayout) {
        if isZoomed {
            setZoom(1, offset: .zero)
        } else {
            guard canZoom else { return }
            let scale = Self.tapZoom
            let center = cardCenter(layout)
            // The point tapped stays under the finger.
            let offset = point.map { CGSize(width: ($0.x - center.x) * (1 - scale), height: ($0.y - center.y) * (1 - scale)) }
            setZoom(scale, offset: clampedOffset(offset ?? .zero, zoom: scale, layout: layout))
        }
        haptics.tap(.soft)
    }

    /// Two fingers apart or together.
    func pinchChanged(_ magnification: CGFloat, layout: CardTableLayout) {
        guard canZoom else { return }
        if pinchStartZoom == nil {
            pinchStartZoom = zoom
            pendingCardTap?.cancel()
            pendingCardTap = nil
            // Whatever the first finger started stops where it began.
            if let finger = drag {
                finger.holdTimer?.cancel()
                if finger.mode == .turn {
                    springs.card.x = finger.cardAtStart
                    springs.card.t = finger.cardAtStart
                    springs.card.v = 0
                }
                drag?.mode = .pinch
            }
        }
        let scale = min(Self.maxZoom, max(1, (pinchStartZoom ?? 1) * magnification))
        zoom = scale
        zoomOffset = clampedOffset(zoomOffset, zoom: scale, layout: layout)
    }

    func pinchEnded() {
        pinchStartZoom = nil
        if zoom < 1.12 { setZoom(1, offset: .zero) }
    }

    /// One finger on the enlarged card moves around it.
    func pan(from start: CGSize, by moved: CGSize, layout: CardTableLayout) {
        let offset = CGSize(width: start.width + moved.width, height: start.height + moved.height)
        zoomOffset = clampedOffset(offset, zoom: zoom, layout: layout)
    }

    func resetZoom() {
        pinchStartZoom = nil
        pendingCardTap?.cancel()
        pendingCardTap = nil
        zoom = 1
        zoomOffset = .zero
    }

    /// The laid-down card's middle, which it grows from.
    func cardCenter(_ layout: CardTableLayout) -> CGPoint {
        CGPoint(x: layout.cardX + layout.cardWidth / 2, y: layout.cardTop + layout.cardHeight / 2)
    }

    /// Where the enlarged card lies, to tell a tap on it from one on the cloth.
    func zoomedCardFrame(_ card: CGRect) -> CGRect {
        guard isZoomed else { return card }
        let width = card.width * zoom
        let height = card.height * zoom
        return CGRect(
            x: card.midX - width / 2 + zoomOffset.width,
            y: card.midY - height / 2 + zoomOffset.height,
            width: width,
            height: height
        )
    }

    private func setZoom(_ scale: CGFloat, offset: CGSize) {
        if reduceMotion {
            zoom = scale
            zoomOffset = offset
        } else {
            withAnimation(.spring(duration: 0.38, bounce: 0.1)) {
                zoom = scale
                zoomOffset = offset
            }
        }
    }

    /// Far enough to bring any edge of the enlarged card to where its middle was, and no further.
    private func clampedOffset(_ offset: CGSize, zoom scale: CGFloat, layout: CardTableLayout) -> CGSize {
        let maxX = layout.cardWidth * (scale - 1) / 2
        let maxY = layout.cardHeight * (scale - 1) / 2
        return CGSize(width: min(maxX, max(-maxX, offset.width)), height: min(maxY, max(-maxY, offset.height)))
    }
}
