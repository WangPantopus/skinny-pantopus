//
//  MailBadgeStore.swift
//  Pantopus
//
//  The Mail tab's badge (Mail tab, 2026-10-27): the unopened mail in the
//  person's Mailbox. Read from `GET /api/mailbox/v2/drawers`: its
//  `unread_total` when the server sends one, else the Me, Home and Biz
//  drawers' unread counts added up (Earn stays hidden with mail extras). Read
//  again at launch, back in the foreground, when a letter is opened or leaves
//  the list, when the Mailbox reloads, and when a mail notice or push
//  arrives. A failed read keeps the last count.
//

import Foundation
import Logging

@Observable
@MainActor
final class MailBadgeStore {
    static let shared = MailBadgeStore()

    /// Unopened pieces across the drawers the person can read.
    private(set) var unopened = 0
    /// The Homes the person lives at, from the same answer: a letter is
    /// addressed to its Home, and a Home that waits for proof is known.
    private(set) var homes: [DrawerListResponse.MailboxHome] = []

    private let api: APIClient
    private let logger = Logger(label: "app.pantopus.ios.MailBadge")
    private var observers: [any NSObjectProtocol] = []
    private var refreshTask: Task<Void, Never>?
    /// Bumped on reset, so a read that started for the last account is dropped.
    private var generation = 0

    /// The drawers that count: Earn is hidden with mail extras.
    private static let countedDrawers: Set<String> = ["personal", "home", "business"]

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// Mail notices and pushes (`mail_delivered`, `mail_summary` …).
    nonisolated static func isMailNotice(_ type: String?) -> Bool {
        guard let type = type?.lowercased() else { return false }
        return type.hasPrefix("mail_") || type.hasPrefix("home_mail")
    }

    /// Starts listening for opened and removed letters, then reads the count.
    func start() {
        if observers.isEmpty {
            let center = NotificationCenter.default
            for name in [Notification.Name.mailboxMailViewed, .mailboxMailLeftList] {
                observers.append(center.addObserver(forName: name, object: nil, queue: .main) { _ in
                    MainActor.assumeIsolated { MailBadgeStore.shared.refresh() }
                })
            }
        }
        refresh()
    }

    /// Reads the count again; a newer read replaces one still in flight.
    func refresh() {
        guard LaunchFeatures.mailbox, case .signedIn = AuthManager.shared.state else { return }
        refreshTask?.cancel()
        let readGeneration = generation
        refreshTask = Task { [weak self, api] in
            do {
                let response: DrawerListResponse = try await api.request(MailboxV2Endpoints.drawers())
                guard !Task.isCancelled, let self, readGeneration == generation else { return }
                apply(response)
            } catch {
                guard !Task.isCancelled else { return }
                self?.logger.warning("Mail badge refresh failed: \(error)")
            }
        }
    }

    /// The Mailbox read the drawers itself: the badge follows them.
    func apply(_ response: DrawerListResponse) {
        homes = response.homes
        unopened = response.unreadTotal ?? response.drawers
            .filter { Self.countedDrawers.contains($0.drawer) }
            .reduce(0) { $0 + max($1.unreadCount, 0) }
    }

    /// Sign-out: the next account starts from nothing.
    func reset() {
        generation += 1
        refreshTask?.cancel()
        refreshTask = nil
        unopened = 0
        homes = []
    }
}
