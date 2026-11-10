//
//  MomentsBackgroundUpload.swift
//  Pantopus
//
//  A Moment's file goes up through a background URLSession, so the upload
//  carries on while the app is in the background and still finishes after
//  the system closes the app. (Swiping the app away in the app switcher
//  stops it, as iOS does for every app; the outbox picks it up at the next
//  launch.) The system hands the result back the next time the app runs:
//  `MomentsUploader` takes it from here.
//

import Foundation
import Logging

/// How one upload ended.
struct MomentUploadOutcome {
    /// The HTTP status, or 0 when there was no answer.
    let status: Int
    let body: Data
    /// Stopped on purpose (Discard, sign-out, a newer try).
    var cancelled = false

    var succeeded: Bool {
        (200..<300).contains(status)
    }
}

final class MomentsBackgroundUpload: NSObject, @unchecked Sendable {
    static let shared = MomentsBackgroundUpload()
    static let identifier = "app.pantopus.ios.moments.upload"

    /// One upload someone in this run of the app is waiting for.
    private struct Waiting {
        let id: String
        let task: URLSessionTask
        let continuation: CheckedContinuation<MomentUploadOutcome, Never>
        let progress: @Sendable (Double) -> Void
    }

    /// The system's "you're done handling events" callback, called once on the main queue.
    private struct SystemHandler: @unchecked Sendable {
        let call: () -> Void
    }

    private let lock = NSLock()
    private var waiting: [Int: Waiting] = [:]
    private var bodies: [Int: Data] = [:]
    /// Uploads that ended with nobody waiting (started before the app was closed), by outbox folder.
    private var unheard: [String: MomentUploadOutcome] = [:]
    private var systemHandler: SystemHandler?
    private let logger = Logger(label: "app.pantopus.ios.MomentsBackgroundUpload")

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: Self.identifier)
        config.sessionSendsLaunchEvents = true
        config.isDiscretionary = false
        config.allowsCellularAccess = true
        config.timeoutIntervalForRequest = 90
        // A Moment lasts an hour at the least; a file that isn't up after two won't be wanted.
        config.timeoutIntervalForResource = 7200
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    /// Opens the session, so the system hands over what finished while the app was closed.
    func start() {
        _ = session
    }

    /// The app was woken for this session's events (`AppDelegate`).
    func handleEvents(completion: @escaping () -> Void) {
        lock.withLock { systemHandler = SystemHandler(call: completion) }
        start()
    }

    /// An upload for this outbox folder that ended while nobody was waiting, once.
    func takeFinished(_ id: String) -> MomentUploadOutcome? {
        lock.withLock { unheard.removeValue(forKey: id) }
    }

    /// Sends `bodyFile` (a multipart body on disk, which must stay until this returns) and waits for the answer.
    func send(id: String, request: URLRequest, bodyFile: URL, progress: @escaping @Sendable (Double) -> Void) async -> MomentUploadOutcome {
        let task = session.uploadTask(with: request, fromFile: bodyFile)
        task.taskDescription = id
        return await wait(for: task, id: id, progress: progress, resume: true)
    }

    /// Waits for an upload of this folder that an earlier run of the app started and the system is still
    /// carrying; nil when there is none.
    func join(id: String, progress: @escaping @Sendable (Double) -> Void) async -> MomentUploadOutcome? {
        guard let task = await session.allTasks.first(where: { $0.taskDescription == id && $0.state == .running }) else { return nil }
        return await wait(for: task, id: id, progress: progress, resume: false)
    }

    private func wait(
        for task: URLSessionTask, id: String, progress: @escaping @Sendable (Double) -> Void, resume: Bool
    ) async -> MomentUploadOutcome {
        await withTaskCancellationHandler {
            await withCheckedContinuation { (continuation: CheckedContinuation<MomentUploadOutcome, Never>) in
                // It may have ended between the look and here: the result is waiting then.
                let early: MomentUploadOutcome? = lock.withLock {
                    if !resume, let outcome = unheard.removeValue(forKey: id) { return outcome }
                    waiting[task.taskIdentifier] = Waiting(id: id, task: task, continuation: continuation, progress: progress)
                    return nil
                }
                if let early {
                    continuation.resume(returning: early)
                } else if resume {
                    task.resume()
                }
            }
        } onCancel: {
            task.cancel()
        }
    }

    /// Stops whatever is going up for this folder (Discard).
    func cancel(_ id: String) {
        lock.withLock { _ = unheard.removeValue(forKey: id) }
        session.getAllTasks { tasks in
            for task in tasks where task.taskDescription == id {
                task.cancel()
            }
        }
    }

    /// Sign-out: nothing of the last account's keeps going.
    func cancelAll() {
        lock.withLock { unheard = [:] }
        session.getAllTasks { tasks in
            for task in tasks {
                task.cancel()
            }
        }
    }
}

extension MomentsBackgroundUpload: URLSessionDataDelegate {
    func urlSession(_: URLSession, task: URLSessionTask, didSendBodyData _: Int64, totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
        guard totalBytesExpectedToSend > 0 else { return }
        let report = lock.withLock { waiting[task.taskIdentifier]?.progress }
        report?(Double(totalBytesSent) / Double(totalBytesExpectedToSend))
    }

    func urlSession(_: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        lock.withLock {
            // The answer is one small JSON object; a megabyte is far more than it needs.
            guard (bodies[dataTask.taskIdentifier]?.count ?? 0) < 1 << 20 else { return }
            bodies[dataTask.taskIdentifier, default: Data()].append(data)
        }
    }

    func urlSession(_: URLSession, task: URLSessionTask, didCompleteWithError error: (any Error)?) {
        let status = (task.response as? HTTPURLResponse)?.statusCode ?? 0
        let cancelled = (error as? URLError)?.code == .cancelled
        let id = task.taskDescription
        let (waiter, outcome): (Waiting?, MomentUploadOutcome) = lock.withLock {
            let body = bodies.removeValue(forKey: task.taskIdentifier) ?? Data()
            // An error after the answer's status (the connection dropped while the body came) is still no answer.
            let outcome = MomentUploadOutcome(status: error == nil ? status : 0, body: body, cancelled: cancelled)
            let waiter = waiting.removeValue(forKey: task.taskIdentifier)
            if waiter == nil, let id, !cancelled { unheard[id] = outcome }
            return (waiter, outcome)
        }
        if let waiter {
            waiter.continuation.resume(returning: outcome)
        } else if let id, !cancelled {
            // Nobody in this run started it: it went up with the app closed.
            logger.info("A Moment's upload ended with the app closed", metadata: ["status": .stringConvertible(outcome.status)])
            Task { @MainActor in MomentsUploader.shared.endedInBackground(id, succeeded: outcome.succeeded) }
        }
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession _: URLSession) {
        guard let handler = lock.withLock({ () -> SystemHandler? in
            defer { systemHandler = nil }
            return systemHandler
        }) else { return }
        DispatchQueue.main.async { handler.call() }
    }
}

extension MomentsBackgroundUpload {
    /// The request for `POST /api/moments/:id/media` (Moments contract): `file`, and for a video its `poster`
    /// and up to two `frames[]`, with the headers every upload carries. The token is renewed first when it's
    /// about to run out (or `renewing`, after a 401), since the background session can't do that on the way.
    @MainActor
    static func request(momentId: String, boundary: String, renewing: Bool) async throws -> URLRequest {
        let auth = AuthManager.shared
        let generation = auth.requestSessionGeneration
        if renewing || auth.isAccessTokenExpiringSoon {
            switch await auth.refreshIfPossible() {
            case .rotated:
                break
            case .authRejected:
                await auth.handleUnauthorized()
                throw CancellationError()
            case .transient:
                // A blip keeps the old token; after a 401 that token is no use.
                if renewing { throw MomentsFailure.offline }
            }
        }
        try auth.requireRequestSession(generation)
        let url = AppEnvironment.current.apiBaseURL.appendingPathComponent("/api/moments/\(momentId)/media")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = auth.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let deviceId = auth.deviceId {
            request.setValue(deviceId, forHTTPHeaderField: APIClient.deviceIdHeader)
        }
        return request
    }
}
