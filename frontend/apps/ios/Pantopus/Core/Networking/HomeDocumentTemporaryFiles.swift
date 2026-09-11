import Foundation

/// Private export copies belong to one app process. Launch cleanup only touches
/// this dedicated directory; backgrounding for an external share keeps it valid.
enum HomeDocumentTemporaryFiles {
    static func root(in temporaryDirectory: URL) -> URL {
        temporaryDirectory.appendingPathComponent("home-document-exports", isDirectory: true)
    }

    static func clearPreviousLaunch(in temporaryDirectory: URL = FileManager.default.temporaryDirectory) throws {
        let directory = root(in: temporaryDirectory)
        if FileManager.default.fileExists(atPath: directory.path) {
            try FileManager.default.removeItem(at: directory)
        }
    }

    static func makeDirectory(in temporaryDirectory: URL = FileManager.default.temporaryDirectory) throws -> URL {
        let directory = root(in: temporaryDirectory).appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
}
