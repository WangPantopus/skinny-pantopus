//
//  EditBusinessMapPreview.swift
//  Pantopus
//
//  P4.2 — A13.10 Edit Business Page. Stylized map preview tile —
//  hand-rolled SwiftUI shapes (no MapKit yet) showing a city block
//  grid, park, and a violet pin centered on the address. The pin
//  carries an amber rim when `pinDirty == true`; the bottom-left
//  status chip flips between `Verified` (green) and `Verify address`
//  (warning amber) based on `verified`.
//

import SwiftUI

private struct MapBlock {
    let x: CGFloat
    let y: CGFloat
    let width: CGFloat
    let height: CGFloat
}

@MainActor
public struct EditBusinessMapPreview: View {
    private let verified: Bool
    private let pinDirty: Bool

    public init(verified: Bool, pinDirty: Bool = false) {
        self.verified = verified
        self.pinDirty = pinDirty
    }

    public var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let h = w * 9 / 16
            ZStack {
                MapBackground()
                streets(width: w, height: h)
                park(width: w, height: h)
                cityBlocks(width: w, height: h)
                pin(width: w, height: h)
                verificationChip(width: w, height: h)
                zoomControls(width: w, height: h)
            }
            .frame(width: w, height: h)
        }
        .aspectRatio(16 / 9, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(verified ? "Map preview, address verified" : "Map preview, address unverified")
        .accessibilityIdentifier("editBusinessPage.mapPreview")
    }

    @ViewBuilder private func streets(width w: CGFloat, height h: CGFloat) -> some View {
        // Horizontal streets
        Rectangle()
            .fill(Theme.Color.appSurface)
            .frame(width: w, height: h * 0.08)
            .position(x: w * 0.5, y: h * 0.38)
        Rectangle()
            .fill(Theme.Color.appSurface)
            .frame(width: w, height: h * 0.055)
            .position(x: w * 0.5, y: h * 0.72)
        // Vertical streets
        Rectangle()
            .fill(Theme.Color.appSurface)
            .frame(width: w * 0.045, height: h)
            .position(x: w * 0.27, y: h * 0.5)
        Rectangle()
            .fill(Theme.Color.appSurface)
            .frame(width: w * 0.032, height: h)
            .position(x: w * 0.69, y: h * 0.5)
    }

    @ViewBuilder private func park(width w: CGFloat, height h: CGFloat) -> some View {
        Rectangle()
            .fill(Theme.Color.successBg)
            .frame(width: w * 0.33, height: h * 0.20)
            .position(x: w * 0.48, y: h * 0.55)
        ForEach(0..<3) { idx in
            let positions: [CGFloat] = [0.38, 0.48, 0.58]
            if positions.indices.contains(idx) {
                Circle()
                    .fill(Theme.Color.success.opacity(0.65))
                    .frame(width: w * 0.035)
                    .position(x: w * positions[idx], y: h * 0.53)
            }
        }
    }

    private func cityBlocks(width w: CGFloat, height h: CGFloat) -> some View {
        ForEach(0..<4) { idx in
            let blocks: [MapBlock] = [
                MapBlock(x: 0.10, y: 0.10, width: 0.18, height: 0.18),
                MapBlock(x: 0.85, y: 0.12, width: 0.18, height: 0.16),
                MapBlock(x: 0.10, y: 0.88, width: 0.18, height: 0.14),
                MapBlock(x: 0.85, y: 0.88, width: 0.18, height: 0.16)
            ]
            if blocks.indices.contains(idx) {
                let block = blocks[idx]
                Rectangle()
                    .fill(Theme.Color.warningLight.opacity(0.5))
                    .frame(width: w * block.width, height: h * block.height)
                    .position(x: w * block.x, y: h * block.y)
            }
        }
    }

    private func pin(width w: CGFloat, height h: CGFloat) -> some View {
        ZStack(alignment: .bottom) {
            Ellipse()
                .fill(Theme.Color.appText.opacity(0.25))
                .frame(width: 14, height: 5)
                .offset(y: 0)
            PinShape()
                .fill(Theme.Color.business)
                .frame(width: 32, height: 38)
                .overlay(
                    PinShape()
                        .stroke(pinDirty ? Theme.Color.warning : Color.clear, lineWidth: 2)
                )
                .overlay(
                    Icon(.building2, size: 13, color: Theme.Color.appTextInverse)
                        .offset(y: -6)
                )
                .pantopusShadow(.md)
                .offset(y: -5)
        }
        .position(x: w * 0.5, y: h * 0.48)
    }

    private func verificationChip(width w: CGFloat, height h: CGFloat) -> some View {
        HStack(spacing: 4) {
            Icon(
                verified ? .shieldCheck : .shieldAlert,
                size: 10,
                color: verified ? Theme.Color.success : Theme.Color.warmAmber
            )
            Text(verified ? "VERIFIED" : "VERIFY ADDRESS")
                .font(.system(size: 10, weight: .bold))
                .tracking(0.1)
                .foregroundStyle(verified ? Theme.Color.success : Theme.Color.warmAmber)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(verified ? Theme.Color.successBg : Theme.Color.warningBg)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(
                    verified ? Theme.Color.successLight : Theme.Color.warningLight,
                    lineWidth: 1
                )
        )
        .position(x: w * 0.5, y: h - 16)
        .frame(maxWidth: w, alignment: .leading)
        .offset(x: -w * 0.5 + 50, y: 0)
    }

    private func zoomControls(width w: CGFloat, height _: CGFloat) -> some View {
        VStack(spacing: 0) {
            Text("+")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
                .frame(width: 26, height: 24)
            Divider()
            Text("−")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
                .frame(width: 26, height: 24)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
        .pantopusShadow(.sm)
        .position(x: w - 22, y: 22)
        .accessibilityHidden(true)
    }
}

/// Solid pin shape — rounded teardrop with the point at the bottom.
private struct PinShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height
        // Circle head + triangle tail.
        path.addEllipse(in: CGRect(x: 0, y: 0, width: w, height: w))
        path.move(to: CGPoint(x: w * 0.5, y: h))
        path.addLine(to: CGPoint(x: w * 0.25, y: w * 0.78))
        path.addLine(to: CGPoint(x: w * 0.75, y: w * 0.78))
        path.closeSubpath()
        return path
    }
}

private struct MapBackground: View {
    var body: some View {
        // Pale sky-blue underlay matches the design's map base. The
        // `personalBg` token is exactly that value (Tailwind sky-200).
        Theme.Color.personalBg
    }
}

#Preview("Verified") {
    EditBusinessMapPreview(verified: true)
        .padding()
        .background(Theme.Color.appBg)
}

#Preview("Unverified, dirty pin") {
    EditBusinessMapPreview(verified: false, pinDirty: true)
        .padding()
        .background(Theme.Color.appBg)
}
