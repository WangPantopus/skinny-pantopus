import CryptoKit
import Foundation

@MainActor
protocol PendingGigStopStoring {
    func load(scope: String) throws -> GigStopRequest?
    func save(_ request: GigStopRequest, scope: String) throws
    func clear(scope: String, matching: GigStopRequest) throws
}

@MainActor
struct PendingGigStopStore: PendingGigStopStoring {
    private let directory: URL

    init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("PendingTaskActions", isDirectory: true)
    }

    func load(scope: String) throws -> GigStopRequest? {
        let data: Data
        do {
            data = try Data(contentsOf: path(scope))
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile { return nil }
        let request = try JSONDecoder().decode(GigStopRequest.self, from: data)
        guard request.isValid(gig: request.gigId) else { throw APIError.invalidResponse }
        return request
    }

    func save(_ request: GigStopRequest, scope: String) throws {
        guard request.isValid(gig: request.gigId) else { throw APIError.invalidResponse }
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        )
        var folder = directory
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try folder.setResourceValues(values)
        try JSONEncoder().encode(request).write(to: path(scope), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    func clear(scope: String, matching request: GigStopRequest) throws {
        guard try load(scope: scope) == request else { return }
        do {
            try FileManager.default.removeItem(at: path(scope))
        } catch let error as CocoaError where error.code == .fileNoSuchFile { return }
    }

    private func path(_ scope: String) -> URL {
        let name = SHA256.hash(data: Data(scope.utf8)).map { String(format: "%02x", $0) }.joined()
        return directory.appendingPathComponent(name).appendingPathExtension("json")
    }
}
