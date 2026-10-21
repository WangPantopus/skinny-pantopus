import Foundation

/// Private export copies (Home documents, the emergency card, residency letters) belong to one app
/// process and one account. Launch and sign-out cleanup only touch this dedicated directory and the
/// exact names earlier builds wrote next to it; backgrounding for an external share keeps it valid.
enum HomeDocumentTemporaryFiles {
    /// Earlier builds wrote the emergency card and residency letters at the top of tmp.
    private static let legacyPrefixes = ["emergency-card-", "pantopus-residency-letter-"]

    static func root(in temporaryDirectory: URL) -> URL {
        temporaryDirectory.appendingPathComponent("home-document-exports", isDirectory: true)
    }

    static func clearPreviousLaunch(in temporaryDirectory: URL = FileManager.default.temporaryDirectory) throws {
        let directory = root(in: temporaryDirectory)
        if FileManager.default.fileExists(atPath: directory.path) {
            try FileManager.default.removeItem(at: directory)
        }
        let names = (try? FileManager.default.contentsOfDirectory(atPath: temporaryDirectory.path)) ?? []
        for name in names where name.hasSuffix(".pdf") && legacyPrefixes.contains(where: name.hasPrefix) {
            try? FileManager.default.removeItem(at: temporaryDirectory.appendingPathComponent(name))
        }
    }

    static func makeDirectory(in temporaryDirectory: URL = FileManager.default.temporaryDirectory) throws -> URL {
        let directory = root(in: temporaryDirectory).appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
}
