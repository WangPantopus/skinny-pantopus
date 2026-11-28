//
//  HolidayCardPhotoCard.swift
//  Pantopus
//
//  A photo as the card's front (cards-next 4.2, only while GET /api/mailbox/cards says `improved` and carries
//  `photo_card`): the studio crops the photo on the phone to one of the server's shapes and uploads it through the card's
//  own photo upload; the card then goes as the photo card's design with `front: { frame, caption }`. It never travels,
//  is never shared, and "Send this card again" opens the studio empty.
//

import CoreGraphics
import Foundation
import ImageIO
import UIKit

extension HolidayCardFlowViewModel {
    /// The server offers the photo card now.
    var photoCardSpec: HolidayCardPhotoCardSpec? {
        improved ? cards?.photoCard : nil
    }

    /// This card is a photo card.
    var isPhotoCard: Bool {
        guard let spec = photoCardSpec, let designId else { return false }
        return designId == spec.design
    }

    /// The front as this sender sees it while sending: their uploaded photo in its frame.
    var photoFrontSpec: CardPhotoFrontSpec? {
        guard isPhotoCard, let front = photoFront else { return nil }
        let stored = attachments.photo?.stored
        let aspect: CGFloat = if let width = stored?.width, let height = stored?.height, height > 0 {
            CGFloat(width) / CGFloat(height)
        } else {
            attachments.photo?.preview.map { $0.size.height > 0 ? $0.size.width / $0.size.height : 0.8 } ?? 0.8
        }
        return CardPhotoFrontSpec(
            frame: CardPhotoFrame(front.frame),
            caption: front.caption ?? "",
            source: stored.map { .own(fileId: $0.fileId) },
            aspect: aspect
        )
    }

    /// "Use this photo card": the cropped photo uploads as the card's photo, and the card goes on with its frame and
    /// line, to Who it's for (or Write on the back when someone is chosen already).
    func usePhotoCard(photo data: Data, frame: CardPhotoFrame, caption: String) {
        guard let spec = photoCardSpec else { return }
        // One photo per card: the front is the card's photo. A voice greeting stays.
        attachments.remove()
        attachments.add(data)
        designId = spec.design
        let line = caption.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        photoFront = CardFront(frame: frame.rawValue, caption: String(line.prefix(spec.captionLimit)))
        largeDesign = nil
        makesPhotoCard = false
        if step == .pick || step == .to { toWrite() }
    }
}

/// The studio's crop: what part of the photo shows in the frame, and the photo cut to it.
enum CardPhotoCrop {
    /// A picked photo read upright, at most 3200 on its long side (enough to crop from and still send 2400).
    nonisolated static func prepared(_ data: Data) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 3200
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        return UIImage(cgImage: cg)
    }

    /// The photo drawn upright (a picked photo can carry a turn in its data).
    nonisolated static func upright(_ image: UIImage) -> UIImage {
        guard image.imageOrientation != .up else { return image }
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = image.scale
        return UIGraphicsImageRenderer(size: image.size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: image.size))
        }
    }

    /// The photo cut to what shows in a `place`-sized window, zoomed by `zoom` (1 fills it) and moved by `offset`, at
    /// most 2400 on its long side, as a JPEG; nil when it can't be cut.
    nonisolated static func cut(_ image: UIImage, place: CGSize, zoom: CGFloat, offset: CGSize) -> Data? {
        let photo = upright(image)
        guard let cg = photo.cgImage, place.width > 0, place.height > 0 else { return nil }
        let pixels = CGSize(width: cg.width, height: cg.height)
        let scale = max(place.width / pixels.width, place.height / pixels.height) * max(1, zoom)
        let originX = (place.width - pixels.width * scale) / 2 + offset.width
        let originY = (place.height - pixels.height * scale) / 2 + offset.height
        var window = CGRect(x: -originX / scale, y: -originY / scale, width: place.width / scale, height: place.height / scale)
        window = window.intersection(CGRect(origin: .zero, size: pixels)).integral
        guard !window.isNull, let cropped = cg.cropping(to: window) else { return nil }
        let long = max(window.width, window.height)
        let shrink = min(1, 2400 / long)
        let out = CGSize(width: (window.width * shrink).rounded(), height: (window.height * shrink).rounded())
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let drawn = UIGraphicsImageRenderer(size: out, format: format).image { _ in
            UIImage(cgImage: cropped).draw(in: CGRect(origin: .zero, size: out))
        }
        return drawn.jpegData(compressionQuality: 0.9)
    }

    /// How far the photo can move each way and still fill the window.
    nonisolated static func limit(_ image: UIImage, place: CGSize, zoom: CGFloat) -> CGSize {
        let size = image.size
        guard size.width > 0, size.height > 0 else { return .zero }
        let scale = max(place.width / size.width, place.height / size.height) * max(1, zoom)
        return CGSize(
            width: max(0, (size.width * scale - place.width) / 2),
            height: max(0, (size.height * scale - place.height) / 2)
        )
    }
}
