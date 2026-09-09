import Foundation
import UniformTypeIdentifiers

enum DocumentFileReader {
    static func read(_ url: URL) throws -> PickedFile {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        let limit = 25 * 1024 * 1024
        var data = Data()
        while let chunk = try handle.read(upToCount: 256 * 1024), !chunk.isEmpty {
            guard data.count + chunk.count <= limit else {
                throw APIError.clientError(status: 413, message: "Choose a file of 25 MB or less.")
            }
            data.append(chunk)
        }
        guard !data.isEmpty else {
            throw APIError.clientError(status: 400, message: "The selected file is empty.")
        }
        let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType
        return PickedFile(filename: url.lastPathComponent, sizeBytes: Int64(data.count), mimeType: mime, data: data)
    }
}
