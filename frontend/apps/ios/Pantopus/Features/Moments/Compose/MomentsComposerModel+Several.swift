//
//  MomentsComposerModel+Several.swift
//  Pantopus
//
//  Several photos and videos picked together in the library (founder,
//  2026-11-11): each is its own Moment. The first takes the Post sheet; when
//  it has posted, the next takes it, pinned where it was taken and with its
//  own caption, under the same "How long" and "Who sees it". Retake drops the
//  ones still waiting. Also here: what the camera's chip reads and the last
//  choices (kept and read back), moved out of the model's main file for room.
//

import Foundation
import Photos

extension MomentsComposerModel {
    /// As many as can be picked together.
    static let pickLimit = 10

    /// Several picked together: the first takes the sheet now, the rest wait their turn (`moveOn`).
    func use(assets: [PHAsset]) async {
        guard let first = assets.first else { return }
        waiting = Array(assets.dropFirst())
        pickedTogether = assets.count
        await use(asset: first)
        // The first couldn't be opened: nothing waits behind a sheet that never came.
        if draft == nil { (waiting, pickedTogether) = ([], 0) }
    }

    /// "2 of 3" while the ones picked together are being posted; nil for one on its own.
    var pickedPosition: String? {
        pickedTogether > 1 ? "\(pickedTogether - waiting.count) of \(pickedTogether)" : nil
    }

    /// The camera is what's showing: the capture session runs only then.
    var wantsCamera: Bool {
        gate == .open && mode == .camera && draft == nil
    }

    /// The place chip: "Esther Short Park", "Your home" at home (as the Post sheet says; others read the
    /// town), or why there's no pin yet.
    var placeChip: String {
        switch locating {
        case .locating: "Finding where you are…"
        case .unavailable: choseNoLocation ? "No location" : "Location is off"
        case .located:
            if place?.atHome == true { "Your home" } else { place?.placeLabel.isEmpty == false ? place?.placeLabel ?? "" : "Near you" }
        }
    }

    static var account: String? {
        guard case let .signedIn(user) = AuthManager.shared.state else { return nil }
        return user.id
    }

    static func hoursKey(_ account: String) -> String {
        "pantopus.moments.lastHours.\(account)"
    }

    static func audienceKey(_ account: String) -> String {
        "pantopus.moments.lastAudience.\(account)"
    }

    static func showHeightKey(_ account: String) -> String {
        "pantopus.moments.lastShowHeight.\(account)"
    }

    /// The sheet opens with the last "How long", "Who sees it" and "Show elevation" (kept on the phone, per account).
    /// "Show the area instead" always starts off.
    func restoreChoices() {
        guard let account = Self.account else { return }
        let savedHours = defaults.integer(forKey: Self.hoursKey(account))
        if [1, 6, 24, 48].contains(savedHours) { hours = savedHours }
        if let saved = defaults.string(forKey: Self.audienceKey(account)).flatMap(MomentAudience.init(rawValue:)) { audience = saved }
        showHeight = defaults.bool(forKey: Self.showHeightKey(account))
    }

    func saveChoices() {
        guard let account = Self.account else { return }
        defaults.set(hours, forKey: Self.hoursKey(account))
        defaults.set(audience.rawValue, forKey: Self.audienceKey(account))
        // Only a sheet that offered the switch says what the person wants: one that hid it keeps the last answer.
        if offersHeight { defaults.set(showHeight, forKey: Self.showHeightKey(account)) }
    }
}
