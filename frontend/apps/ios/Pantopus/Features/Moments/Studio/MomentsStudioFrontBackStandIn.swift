//
//  MomentsStudioFrontBackStandIn.swift
//  Pantopus
//
//  Front and back together's stand-in pictures, for simulator builds only (`MomentsStudioFrontBack.swift`).
//

import UIKit

/// Simulator builds only: two drawn pictures in place of the cameras, so the mode's own code runs where there is no
/// camera. Never in a build for a phone.
enum MomentsFrontBackStandIn {
    static var isOn: Bool {
        #if targetEnvironment(simulator)
        true
        #else
        false
        #endif
    }

    @MainActor private static var made: [Bool: UIImage] = [:]

    @MainActor
    static func picture(front: Bool) -> UIImage {
        if let image = made[front] { return image }
        // A camera's 3:4 shape, as a phone takes it; the screen shows its middle.
        let size = CGSize(width: 1200, height: 1600)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
            let colors = front
                ? [UIColor(red: 0.98, green: 0.62, blue: 0.45, alpha: 1), UIColor(red: 0.62, green: 0.27, blue: 0.55, alpha: 1)]
                : [UIColor(red: 0.36, green: 0.66, blue: 0.86, alpha: 1), UIColor(red: 0.16, green: 0.42, blue: 0.30, alpha: 1)]
            let gradient = CGGradient(
                colorsSpace: CGColorSpaceCreateDeviceRGB(),
                colors: colors.map(\.cgColor) as CFArray,
                locations: [0, 1]
            )
            if let gradient {
                context.cgContext.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
            }
            let words = front ? "Front camera\n(stand-in)" : "Back camera\n(stand-in)"
            let style = NSMutableParagraphStyle()
            style.alignment = .center
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 64, weight: .bold),
                .foregroundColor: UIColor.white,
                .paragraphStyle: style
            ]
            let text = NSAttributedString(string: words, attributes: attributes)
            let box = text.boundingRect(
                with: CGSize(width: size.width - 480, height: size.height),
                options: .usesLineFragmentOrigin,
                context: nil
            )
            text.draw(in: CGRect(x: 240, y: (size.height - box.height) / 2, width: size.width - 480, height: box.height))
        }
        made[front] = image
        return image
    }
}
