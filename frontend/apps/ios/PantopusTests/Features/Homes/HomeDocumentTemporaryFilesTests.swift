import XCTest
@testable import Pantopus

final class HomeDocumentTemporaryFilesTests: XCTestCase {
    func testRestartRemovesOnlyOwnedCopiesAndAllowsFreshExport() throws {
        let temporary = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: temporary) }
        let first = try HomeDocumentTemporaryFiles.makeDirectory(in: temporary)
        let bytes = Data("private document".utf8)
        let export = first.appendingPathComponent("document.pdf")
        try bytes.write(to: export)
        let unrelated = temporary.appendingPathComponent("unrelated-cache")
        try bytes.write(to: unrelated)
        // A second export in the same process must not break an active share.
        _ = try HomeDocumentTemporaryFiles.makeDirectory(in: temporary)
        XCTAssertEqual(try Data(contentsOf: export), bytes)
        try HomeDocumentTemporaryFiles.clearPreviousLaunch(in: temporary)
        XCTAssertFalse(FileManager.default.fileExists(atPath: export.path))
        XCTAssertEqual(try Data(contentsOf: unrelated), bytes)
        try HomeDocumentTemporaryFiles.clearPreviousLaunch(in: temporary)
        let fresh = try HomeDocumentTemporaryFiles.makeDirectory(in: temporary)
        XCTAssertTrue(FileManager.default.fileExists(atPath: fresh.path))
    }
}
