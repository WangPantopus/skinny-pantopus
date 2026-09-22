import CryptoKit
import Foundation

@MainActor
protocol PendingRefundStoring {
    func load(scope: String) throws -> PaymentRefundAttempt?
    func save(_ attempt: PaymentRefundAttempt, scope: String) throws
    func clear(scope: String) throws
}

/// Only the original UUID, amount and reason code survive restart. Provider
/// secrets and descriptions from other clients are never persisted here.
@MainActor
struct PendingRefundStore: PendingRefundStoring {
    private let directory: URL

    init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("PendingRefunds", isDirectory: true)
    }

    func load(scope: String) throws -> PaymentRefundAttempt? {
        let data: Data
        do {
            data = try Data(contentsOf: path(scope))
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile { return nil }
        let attempt = try JSONDecoder().decode(PaymentRefundAttempt.self, from: data)
        guard attempt.isValid, attempt.description == nil else { throw APIError.invalidResponse }
        return attempt
    }

    func save(_ attempt: PaymentRefundAttempt, scope: String) throws {
        guard attempt.isValid else { throw APIError.invalidResponse }
        // Such requests already have a durable server record and can be read
        // after restart; do not copy a remotely supplied description to disk.
        guard attempt.description == nil else { return }
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        )
        var folder = directory
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try folder.setResourceValues(values)
        try JSONEncoder().encode(attempt).write(to: path(scope), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    func clear(scope: String) throws {
        do {
            try FileManager.default.removeItem(at: path(scope))
        } catch let error as CocoaError where error.code == .fileNoSuchFile { return }
    }

    private func path(_ scope: String) -> URL {
        let name = SHA256.hash(data: Data(scope.utf8)).map { String(format: "%02x", $0) }.joined()
        return directory.appendingPathComponent(name).appendingPathExtension("json")
    }
}
