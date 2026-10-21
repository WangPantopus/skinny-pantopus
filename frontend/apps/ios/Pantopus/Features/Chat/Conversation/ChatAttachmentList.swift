import SwiftUI

/// Mixed messages retain every attachment. Motion resources stay paired with
/// their still, while all requests use the existing authenticated chat proxy.
struct ChatAttachmentList: View {
    let files: [ChatAttachmentDTO]
    let onOpenFile: @MainActor (String?, String, String?) -> Void

    static func needsTypedViewer(_ files: [ChatAttachmentDTO]) -> Bool {
        files.contains { !($0.mimeType ?? "").hasPrefix("image/") || $0.liveVideoFileId != nil }
    }

    private var logicalFiles: [ChatAttachmentDTO] {
        files.filter { clip in
            !files.contains { $0.liveVideoFileId == clip.id && clip.livePhotoFileId == $0.id }
        }
    }

    private func mediaItem(_ file: ChatAttachmentDTO) -> PostMediaItem? {
        guard let url = ChatMediaURL.resolve(raw: file.fileURL) else { return nil }
        let mime = file.mimeType ?? ""
        let clip = files.first { $0.id == file.liveVideoFileId && $0.livePhotoFileId == file.id }
        let liveURL = ChatMediaURL.resolve(raw: clip?.fileURL)
        let kind: PostMediaKind
        if mime.hasPrefix("image/") {
            kind = liveURL == nil ? .image : .livePhoto
        } else if mime.hasPrefix("video/") {
            kind = .video
        } else if mime == "application/pdf" {
            kind = .document
        } else {
            return nil
        }
        var thumbnail: URL?
        if mime.hasPrefix("image/"), ChatMediaURL.isSameOrigin(url, AppEnvironment.current.apiBaseURL),
           url.path.hasPrefix("/api/chat/files/") {
            var parts = URLComponents(url: url, resolvingAgainstBaseURL: false)
            var queryItems = parts?.queryItems ?? []
            queryItems.append(URLQueryItem(name: "variant", value: "thumbnail"))
            parts?.queryItems = queryItems
            thumbnail = parts?.url
        }
        return PostMediaItem(id: file.id, kind: kind, url: url, thumbnailURL: thumbnail, liveVideoURL: liveURL)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            let items = logicalFiles.compactMap(mediaItem)
            if !items.isEmpty {
                PostMediaGridView(items: items, style: .compact, accessibilityID: "chatMediaGrid")
                    .frame(width: 240)
            }
            ForEach(logicalFiles.filter { mediaItem($0) == nil }) { file in
                Button { onOpenFile(file.fileURL, file.originalFilename ?? "Attachment", file.mimeType) } label: {
                    HStack { Icon(.fileText, size: 18)
                        Text(file.originalFilename ?? "Attachment")
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }
}
