//
//  StorageDataViewModel.swift
//  Pantopus
//
//  Settings → This iPhone → Storage & data (Instant Screens contract
//  section 7): what Pantopus keeps on this iPhone (photos, saved pages,
//  drafts and uploads in progress), Clear cache, and the one limit for
//  photos and saved pages. Clear cache never touches drafts, uploads in
//  progress, unfinished actions (refund and stop records), the sign-in or
//  settings.
//

import Foundation
import Observation

@Observable
@MainActor
final class StorageDataViewModel {
    struct Sizes: Equatable {
        let photos: Int
        let savedPages: Int
        let drafts: Int

        var total: Int {
            photos + savedPages + drafts
        }

        /// What Clear cache frees.
        var clearable: Int {
            photos + savedPages
        }
    }

    private(set) var sizes: Sizes?
    private(set) var limitMegabytes = StorageLimit.megabytes
    private(set) var isClearing = false
    var confirmsClear = false
    var toastMessage: String?

    func load() async {
        sizes = await Self.measure()
    }

    func setLimit(_ megabytes: Int) async {
        StorageLimit.megabytes = megabytes
        limitMegabytes = StorageLimit.megabytes
        // A lower limit takes effect now: the oldest photos go first.
        await Task.detached(priority: .utility) { PantopusImagePipeline.shared.trim() }.value
        sizes = await Self.measure()
    }

    /// Photos and saved pages go (the store's wipe, which also drops what
    /// screens hold in memory); drafts, uploads, unfinished actions, the
    /// sign-in and settings stay.
    func clearCache() async {
        guard !isClearing else { return }
        isClearing = true
        defer { isClearing = false }
        let freed = sizes?.clearable ?? 0
        ScreenStore.shared.wipe()
        sizes = await Self.measure()
        toastMessage = "Cleared \(Self.format(freed))"
    }

    /// "62 MB", "512 KB", "Zero KB".
    nonisolated static func format(_ bytes: Int) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
    }

    nonisolated static func measure() async -> Sizes {
        await Task.detached(priority: .userInitiated) {
            Sizes(
                photos: PantopusImagePipeline.shared.totalBytes(),
                savedPages: ScreenStoreDisk.shared.totalBytes(),
                drafts: draftBytes()
            )
        }.value
    }

    /// Unfinished actions kept until they finish (refund and stop records).
    /// Drafts in progress live in the app's settings and are a few bytes.
    private nonisolated static func draftBytes() -> Int {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return ["PendingRefunds", "PendingTaskActions"].reduce(0) { total, name in
            let folder = support.appendingPathComponent(name, isDirectory: true)
            let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.fileSizeKey])) ?? []
            return total + files.reduce(0) { $0 + ((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
        }
    }
}
