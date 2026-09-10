import XCTest
@testable import Pantopus

@MainActor
final class HomeTaskMediaClientTests: XCTestCase {
    private let f = HomeTaskMediaFixture()
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private var requests: [URLRequest] {
        SequencedURLProtocol.capturedRequests
    }

    func testReadOnlyListAndExactBytesUseCurrentTaskSessionWithoutMutation() async throws {
        f.routes(canUpload: false)
        let client = f.client()
        let list = try await client.list()
        XCTAssertFalse(list.canUpload)
        let bytes = try await client.download(f.decoded())
        XCTAssertEqual(bytes, f.file.data)
        XCTAssertFalse(requests.contains { $0.httpMethod != "GET" })
        for request in requests.filter({ $0.url?.path.contains("home-task-media") == true }) {
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), f.scope)
            XCTAssertEqual(request.cachePolicy, .reloadIgnoringLocalAndRemoteCacheData)
        }
    }

    func testForeignDuplicateOrMalformedMetadataCannotBindAList() async throws {
        for records in [[f.record(["task_id": f.actor])], [f.record(), f.record()], [f.record(["available": true, "state": "legacy"])]] {
            SequencedURLProtocol.reset()
            f.routes(records: records)
            do { _ = try await f.client().list()
                XCTFail("Untrusted metadata accepted")
            } catch {}
        }
    }

    func testReplacementLocalSessionPreventsAllNewRequests() async throws {
        var identity: String? = "opening"
        f.routes()
        let client = f.client { identity }
        _ = try await client.list()
        let count = requests.count
        identity = "replacement"
        do { _ = try await client.download(f.decoded())
            XCTFail("Old session read bytes")
        } catch {}
        do { _ = try await client.remove(f.decoded())
            XCTFail("Old session removed bytes")
        } catch {}
        XCTAssertEqual(requests.count, count)
    }

    func testReplacementServerSessionDeniesBeforeUploading() async throws {
        f.routes()
        let client = f.client()
        _ = try await client.list()
        SequencedURLProtocol.routeResponses[f.taskPath] = [.status(200, body: f.taskResponse(session: String(repeating: "b", count: 64)))]
        do { _ = try await client.upload(f.pending)
            XCTFail("Replacement session uploaded")
        } catch {}
        XCTAssertFalse(client.isCurrent)
        XCTAssertFalse(requests.contains { $0.httpMethod == "POST" })
    }

    func testReadOnlyOrMissingTaskUploadCapabilityPreventsPostAndDelete() async throws {
        for listAllowed in [false, true] {
            SequencedURLProtocol.reset()
            f.routes(canUpload: false)
            SequencedURLProtocol.routeResponses[f.path] = Array(repeating: .status(200, body: f.list(canUpload: listAllowed)), count: 4)
            let client = f.client()
            do { _ = try await client.upload(f.pending)
                XCTFail("Read-only upload accepted")
            } catch {}
            do { _ = try await client.remove(f.decoded())
                XCTFail("Read-only removal accepted")
            } catch {}
            XCTAssertFalse(requests.contains { $0.httpMethod != "GET" })
        }
    }

    func testLegacyPublicAttachmentCannotDownloadOrRemove() async throws {
        let legacy = ["state": "legacy", "available": false] as [String: Any]
        f.routes(records: [f.record(legacy)])
        let client = f.client()
        do { _ = try await client.download(f.decoded(legacy))
            XCTFail("Legacy bytes read")
        } catch {}
        do { _ = try await client.remove(f.decoded(legacy))
            XCTFail("Legacy reference removed")
        } catch {}
        XCTAssertFalse(requests.contains { $0.httpMethod == "DELETE" || $0.url?.path.hasSuffix("/download") == true })
    }

    func testChangedCurrentRecordPreventsDownload() async throws {
        f.routes(records: [f.record(["file_size": f.file.data.count + 1])])
        do { _ = try await f.client().download(f.decoded())
            XCTFail("Changed record downloaded")
        } catch {}
        XCTAssertFalse(requests.contains { $0.url?.path.hasSuffix("/download") == true })
    }

    func testAccessRevokedAfterBytesDoesNotReturnDownloadedData() async throws {
        f.routes()
        SequencedURLProtocol.routeResponses[f.taskPath] = [
            .status(200, body: f.taskResponse()), .status(200, body: f.taskResponse()), .status(403, body: "{}")
        ]
        do { _ = try await f.client().download(f.decoded())
            XCTFail("Revoked bytes returned")
        } catch {}
        XCTAssertEqual(requests.filter { $0.url?.path.hasSuffix("/download") == true }.count, 1)
    }

    func testWrongMimeOrSizeCannotReturnBytes() async throws {
        for (body, mime) in [("short", f.file.mimeType), (f.fileText, "image/png")] {
            SequencedURLProtocol.reset()
            f.routes()
            SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)/download"] = [
                .status(200, body: body, headers: ["Content-Type": mime])
            ]
            do { _ = try await f.client().download(f.decoded())
                XCTFail("Wrong bytes accepted")
            } catch {}
        }
    }

    func testRecordRetiredOrMetadataChangedDuringDownloadCannotReturnBytes() async throws {
        let changes: [[String: Any]] = [
            ["state": "retired", "available": false],
            ["file_name": "different-current-file.txt"],
            ["file_size": f.file.data.count + 1]
        ]
        for changed in changes {
            SequencedURLProtocol.reset()
            f.routes()
            SequencedURLProtocol.routeResponses[f.path] = [
                .status(200, body: f.list()), .status(200, body: f.list(records: [f.record(changed)]))
            ]
            do { _ = try await f.client().download(f.decoded())
                XCTFail("Old bytes returned after record changed")
            } catch {}
            XCTAssertEqual(requests.filter { $0.url?.path.hasSuffix("/download") == true }.count, 1)
        }
    }

    func testUploadBindsOriginalUuidSafeNameBytesAndCurrentReceipt() async throws {
        f.routes()
        SequencedURLProtocol.routeResponses[f.path] = [
            .status(200, body: f.list()), .status(200, body: f.json(["media": [f.record()]])), .status(200, body: f.list())
        ]
        let record = try await f.client().upload(f.pending)
        XCTAssertEqual(record.id, f.upload)
        let request = try XCTUnwrap(requests.first { $0.httpMethod == "POST" })
        XCTAssertEqual(request.url?.path, f.path)
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), f.scope)
        let body = try f.body(request)
        XCTAssertTrue(body.contains(f.upload))
        XCTAssertTrue(body.contains(f.pending.serverFilename))
        XCTAssertTrue(body.contains(f.fileText))
        XCTAssertFalse(body.contains(f.file.filename))
    }

    func testForeignUploadReceiptCannotSignalSuccess() async throws {
        f.routes()
        SequencedURLProtocol.routeResponses[f.path] = [
            .status(200, body: f.list()), .status(200, body: f.json(["media": [f.record(["id": f.actor])]]))
        ]
        do { _ = try await f.client().upload(f.pending)
            XCTFail("Foreign upload receipt accepted")
        } catch {}
        XCTAssertEqual(requests.filter { $0.httpMethod == "POST" }.count, 1)
    }

    func testRemovalRequiresExactRetiredAndCleanupCompleteReceipt() async throws {
        for change in [["id": f.actor], ["state": "ready"], ["cleanup_pending": true]] as [[String: Any]] {
            SequencedURLProtocol.reset()
            f.routes()
            let retired = f.record(["state": "retired", "available": false, "cleanup_pending": false].merging(change) { _, value in value })
            SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)"] = [.status(200, body: f.json(["media": retired]))]
            do { _ = try await f.client().remove(f.decoded())
                XCTFail("Unconfirmed removal accepted")
            } catch {}
        }
    }

    func testRemovalOfAnotherUploaderAllowsAbsentFinalListAfterExactReceipt() async throws {
        let other = f.record(["uploaded_by": f.task])
        f.routes(records: [other])
        let retired = f.record(["uploaded_by": f.task, "state": "retired", "available": false, "cleanup_pending": false])
        SequencedURLProtocol.routeResponses[f.path] = [
            .status(200, body: f.list(records: [other])),
            .status(200, body: f.list(records: []))
        ]
        SequencedURLProtocol.routeResponses["\(f.path)/\(f.upload)"] = [.status(200, body: f.json(["media": retired]))]
        let result = try await f.client().remove(f.decoded(["uploaded_by": f.task]))
        XCTAssertEqual(result.state, "retired")
        XCTAssertEqual(requests.filter { $0.httpMethod == "DELETE" }.count, 1)
    }
}
