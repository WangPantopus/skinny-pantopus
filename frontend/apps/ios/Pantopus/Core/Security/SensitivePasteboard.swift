import UIKit
import UniformTypeIdentifiers

/// Invite links, access codes and bearer links (residency, fridge-card and
/// live-status links) go on the pasteboard for this device only, and leave it
/// after a while: Universal Clipboard would hand them to the person's other
/// devices, and the pasteboard would keep them until something else is copied.
@MainActor
enum SensitivePasteboard {
    /// Long enough to switch apps and paste.
    static let lifetime: TimeInterval = 10 * 60

    static func copy(_ value: String) {
        UIPasteboard.general.setItems(
            [[UTType.utf8PlainText.identifier: value]],
            options: [.localOnly: true, .expirationDate: Date().addingTimeInterval(lifetime)]
        )
    }
}
