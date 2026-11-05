//
//  CrewDayQRCode.swift
//  Pantopus
//
//  The invitation link as a QR code (the crew's "Bring in more homes" and
//  the household's share kit), drawn crisp at any size.
//

import CoreImage.CIFilterBuiltins
import SwiftUI

struct CrewDayQRCode: View {
    let link: String
    var size: CGFloat = 200

    var body: some View {
        Group {
            if let image = Self.image(link) {
                Image(decorative: image, scale: 1)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
            } else {
                RoundedRectangle(cornerRadius: Radii.md).fill(Theme.Color.appSurfaceSunken)
            }
        }
        .frame(width: size, height: size)
        .padding(Spacing.s3)
        .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
        .accessibilityLabel("QR code for the invitation link")
        .accessibilityIdentifier("crewDayQRCode")
    }

    private nonisolated(unsafe) static let context = CIContext()

    private static func image(_ link: String) -> CGImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(link.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage, output.extent.width > 0 else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        return context.createCGImage(scaled, from: scaled.extent)
    }
}

/// The QR code full screen, for a neighbor's phone to scan.
struct CrewDayQRSheet: View {
    let link: String
    let title: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: Spacing.s5) {
            PlanNavBar(title: "QR code", leading: .close) { dismiss() }
            Spacer()
            Text(title)
                .planFont(.h3)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            CrewDayQRCode(link: link, size: 240)
            Text("Neighbors scan this to see their own price.")
                .planFont(.body)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appBg)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayQRSheet")
    }
}
