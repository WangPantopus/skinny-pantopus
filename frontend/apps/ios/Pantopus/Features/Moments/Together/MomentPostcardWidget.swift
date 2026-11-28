//
//  MomentPostcardWidget.swift
//  Pantopus
//
//  The app's side of the postcard widget ("Pulse, reinvented" phase 3, PHASE-3 piece 9; CONTRACT 8j;
//  `PantopusWidgets/PostcardWidget.swift`). It reads what the Mail tab reads (`GET /api/mailbox`), finds the newest
//  postcard (a letter "A postcard from …": a morning postcard or a Mail it letter), and writes its sender's name, its day
//  and a small copy of its enclosed picture into the app group for the widget to draw. Only while `pulse_reinvented` is
//  on and the Mailbox is: otherwise the flag that puts the widget in the gallery and the snapshot are cleared
//  (`PulseReinventedFlags` calls `clear()` when the switch reads off), so a switched-off phone draws today's gallery.
//

import Foundation
import UIKit
import WidgetKit

/// What the widget draws (`PostcardWidgetEntryData` there; the same keys).
struct PostcardWidgetSnapshot: Codable, Equatable {
    let mailId: String
    let from: String
    let deliveredAt: Date
    let hasPicture: Bool
    /// Whose postcard it is: another account signed in on this phone never sees it.
    let account: String
    /// The app's own lock is on for this person: the widget says only that a postcard is waiting (no name, no picture).
    let locked: Bool
}

@MainActor
enum PostcardWidgetStore {
    static let kind = "PantopusPostcard"
    static let snapshotKey = "pantopus.widget.postcard.v1"
    static let onKey = "pantopus.widget.postcard.on"
    static let pictureName = "postcard-widget.jpg"
    static let subjectStart = "A postcard from "
    /// Reads closer together than this reuse the last one.
    private static let every: TimeInterval = 300
    private static var lastRead: Date?
    /// No read in the app's first five seconds, so none runs beside its first screen (LEAD-4, the seventh condition),
    /// however many times the switch is applied while the app opens; and one read at a time.
    private static let firstReadAfter: TimeInterval = 5
    private static let started = Date()
    private static var reading = false

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: GigWidgetSnapshotContract.appGroupId)
    }

    private static var pictureURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: GigWidgetSnapshotContract.appGroupId)?
            .appendingPathComponent(pictureName)
    }

    /// The newest postcard read again (at most every five minutes unless `force`), written for the widget. The Mail is
    /// read only for a person who has placed the widget on a screen (the system says which are placed), and never
    /// beside the app's first screen: anyone else costs no request, and the app opens as fast as today.
    static func refresh(force: Bool = false) async {
        guard PulseReinventedFlags.shared.isOn, LaunchFeatures.mailbox, let account = MomentsComposerModel.account else {
            clear()
            return
        }
        // Another account's postcard never stays on the widget, not even until the next read.
        if let current = stored(), current.account != account { clear() }
        // In the gallery while the switch is on: a flag in the app group, no request.
        let wasOn = defaults?.bool(forKey: onKey) ?? false
        if !wasOn {
            defaults?.set(true, forKey: onKey)
            WidgetCenter.shared.reloadTimelines(ofKind: kind)
        }
        if !force, let lastRead, Date().timeIntervalSince(lastRead) < every { return }
        guard !reading else { return }
        reading = true
        defer { reading = false }
        let early = firstReadAfter - Date().timeIntervalSince(started)
        if early > 0 {
            try? await Task.sleep(for: .seconds(early))
            guard PulseReinventedFlags.shared.isOn, MomentsComposerModel.account == account else { return }
        }
        guard await isPlaced() else { return }
        lastRead = Date()
        guard let page: PostcardListPage = try? await APIClient.shared.request(MailboxEndpoints.list(limit: 30)) else { return }
        guard let newest = page.mail.first(where: { $0.subject?.hasPrefix(subjectStart) == true }) else {
            write(nil)
            return
        }
        let locked = AppLockManager.shared.isEnabled(forUserID: account)
        if let current = stored(), current.mailId == newest.id, current.locked == locked { return }
        // Behind the app's own lock, nothing of the letter leaves the Mail tab: no name and no picture.
        let picture = locked ? false : await picture(of: newest.id)
        let from = locked ? "" : String(newest.subject?.dropFirst(subjectStart.count) ?? "")
        write(PostcardWidgetSnapshot(
            mailId: newest.id,
            from: from.isEmpty && !locked ? "someone close" : from,
            deliveredAt: MomentTime.parse(newest.deliveredAt) ?? Date(),
            hasPicture: picture,
            account: account,
            locked: locked
        ))
    }

    /// The switch went off, the person signed out or another account signed in: the widget leaves the gallery (or
    /// draws a plain "Open Pantopus" where it was placed) and keeps nothing of theirs.
    static func clear() {
        guard let defaults, defaults.object(forKey: onKey) != nil || defaults.data(forKey: snapshotKey) != nil else { return }
        defaults.removeObject(forKey: onKey)
        defaults.removeObject(forKey: snapshotKey)
        if let pictureURL { try? FileManager.default.removeItem(at: pictureURL) }
        lastRead = nil
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
    }

    /// A postcard widget is on one of the person's screens.
    private static func isPlaced() async -> Bool {
        // The completion form: the async one needs iOS 18, the app runs from iOS 17.
        let wanted = kind
        return await withCheckedContinuation { done in
            WidgetCenter.shared.getCurrentConfigurations { result in
                let placed = (try? result.get())?.contains { $0.kind == wanted } ?? false
                done.resume(returning: placed)
            }
        }
    }

    private static func stored() -> PostcardWidgetSnapshot? {
        guard let data = defaults?.data(forKey: snapshotKey) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(PostcardWidgetSnapshot.self, from: data)
    }

    private static func write(_ snapshot: PostcardWidgetSnapshot?) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let snapshot, let data = try? encoder.encode(snapshot) {
            defaults?.set(data, forKey: snapshotKey)
        } else {
            defaults?.removeObject(forKey: snapshotKey)
        }
        if snapshot?.hasPicture != true, let pictureURL { try? FileManager.default.removeItem(at: pictureURL) }
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
    }

    /// The letter's first enclosed picture, a small copy saved for the widget. True when it was saved.
    private static func picture(of mailId: String) async -> Bool {
        guard let pictureURL,
              let detail: MailDetailResponse = try? await APIClient.shared.request(MailboxEndpoints.detail(mailId: mailId)),
              let enclosure = detail.mail.item.enclosures.first(where: { ($0.mimeType ?? "").hasPrefix("image/") }),
              let link: MailEnclosureLink = try? await APIClient.shared.request(
                  MailboxEndpoints.enclosureLink(mailId: mailId, enclosureId: enclosure.id)
              ),
              let url = URL(string: link.url),
              let fetched = try? await URLSession.shared.data(from: url),
              let image = UIImage(data: fetched.0),
              let small = smaller(image).jpegData(compressionQuality: 0.8)
        else { return false }
        return (try? small.write(to: pictureURL, options: .atomic)) != nil
    }

    /// A widget draws in little memory: at most 700 points on the longest side.
    private static func smaller(_ image: UIImage) -> UIImage {
        let side = max(image.size.width, image.size.height)
        guard side > 700 else { return image }
        let scale = 700 / side
        let size = CGSize(width: (image.size.width * scale).rounded(), height: (image.size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    }
}

/// Only what the widget needs of `GET /api/mailbox`.
private struct PostcardListPage: Decodable {
    struct Item: Decodable {
        let id: String
        let subject: String?
        let deliveredAt: String?

        private enum CodingKeys: String, CodingKey {
            case id, subject
            case deliveredAt = "delivered_at"
        }
    }

    let mail: [Item]
}
