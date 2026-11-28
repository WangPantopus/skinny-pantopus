//
//  GuidanceCenter.swift
//  Pantopus
//
//  Decides which guidance card shows, when (GUIDE spec §2). Nothing shows
//  unless the server's switch is on. New accounts (under 14 days) get the cards;
//  business accounts get none. A card never covers something else: the daily
//  briefings sheet, a phone's question, Face ID, a link that is opening, a
//  sheet, the keyboard or the side menu. It appears half a second after its
//  screen finished loading, never while the page scrolls; if the person leaves
//  first, it waits for the next visit. One card at a time: a tab's own card
//  the first time the tab opens, any other card at most once per app open
//  (a cold start, or back after 30 minutes away), and pointers only from the
//  account's second app open on this phone.
//

import Logging
import SwiftUI
import UIKit

@Observable
@MainActor
final class GuidanceCenter {
    static let shared = GuidanceCenter()

    /// The card or pointer on screen.
    private(set) var presentation: GuidancePresentation?
    /// The server's switch is on for this account: Help's "Tips for each screen" shows.
    private(set) var tipsAvailable = false

    @ObservationIgnored private(set) var record = GuidanceRecord()
    @ObservationIgnored private var account: String?
    @ObservationIgnored private var isBusinessAccount = false
    /// A card other than a tab's own showed during this app open.
    @ObservationIgnored private var otherCardThisOpen = false
    /// What the card on screen changed when it showed, put back if it steps aside for a link.
    @ObservationIgnored private var beforeShown = BeforeShown()
    private struct BeforeShown { var other = false, centreDay: String?, introVersion: String? }
    /// The screen last counted as a visit (a new app open counts again).
    @ObservationIgnored private var lastVisited: GuidanceScreen?
    @ObservationIgnored private var screens: [(token: UUID, entry: GuidanceScreenEntry)] = []
    private let anchors = NSHashTable<GuidanceAnchorView>.weakObjects()
    @ObservationIgnored private var evaluation: Task<Void, Never>?
    @ObservationIgnored private var sending = false
    @ObservationIgnored private var backgroundedAt: Date?
    @ObservationIgnored private var keyboardUp = false
    @ObservationIgnored private var linkQuietUntil: Date?
    @ObservationIgnored private var observers: [NSObjectProtocol] = []
    /// The cards that follow what the person does (16 to 28) and the screens' buttons for them.
    @ObservationIgnored private let steps = GuidanceSteps()
    private let logger = Logger(label: "app.pantopus.ios.Guidance")
    /// The daily briefings sheet is loading or up (`BriefingNoticeView`).
    @ObservationIgnored var briefingNoticeBusy = false {
        didSet { if !briefingNoticeBusy, oldValue { scheduleEvaluation() } }
    }

    /// A new account's waiting Christmas card may still open (`WaitingCardLanding`).
    @ObservationIgnored var waitingCardCheck = false {
        didSet { if !waitingCardCheck, oldValue { scheduleEvaluation() } }
    }

    /// A Christmas card the reader joined Pantopus for is on screen (cards-next 4.1, `card.joined_for`): no guidance card
    /// and no daily briefings notice until they're out of it. Observed, so the briefings notice waits too.
    var joinedForCardOnScreen = false {
        didSet { if !joinedForCardOnScreen, oldValue { scheduleEvaluation() } }
    }

    /// The side menu is open (`RootTabView`).
    @ObservationIgnored var sideMenuOpen = false {
        didSet { if !sideMenuOpen, oldValue { scheduleEvaluation() } }
    }

    /// `SIMCTL_CHILD_PANTOPUS_DEBUG_GUIDANCE=<card id>`: that card shows on its screen once per launch,
    /// whatever the server says (GUIDE spec §8). Always nil in a release build.
    @ObservationIgnored private var forced = GuidanceCenter.debugForcedCard()

    private static func debugForcedCard() -> GuidanceCardID? {
        #if DEBUG
        let id = ProcessInfo.processInfo.environment["PANTOPUS_DEBUG_GUIDANCE"]
        return id.flatMap(GuidanceCardID.init(rawValue:))
        #else
        return nil
        #endif
    }

    /// Away this long, coming back is a new app open.
    static let newOpenAfter: TimeInterval = 30 * 60

    private init() {
        observe()
        steps.onAnswer = { GuidanceCenter.shared.scheduleEvaluation() }
    }

    // MARK: - The account

    /// The signed-in account (nil when signed out). Called at launch and on every sign-in.
    func start(account newAccount: String?) async {
        guard newAccount != account else { return }
        evaluation?.cancel()
        dismissPresentation()
        account = newAccount
        isBusinessAccount = false
        TodayHouseSwitch.shared.restore(account: newAccount)
        steps.reset()
        guard let newAccount else {
            record = GuidanceRecord()
            tipsAvailable = false
            return
        }
        record = GuidanceRecordStore.load(account: newAccount)
        tipsAvailable = record.enabled
        beginAppOpen()
        await refresh()
    }

    /// Reads the profile's `guidance` and merges it: the server's record wins. Straight from the server (a sign-in
    /// resets the screen store under it); a failed read tries again quietly, then waits for the next app open.
    func refresh() async {
        guard let account else { return }
        for wait in Self.readRetries {
            do {
                let response: ProfileResponse = try await APIClient.shared.request(UsersEndpoints.profile())
                guard account == self.account else { return }
                isBusinessAccount = response.user.accountType == AccountType.business.backendValue
                TodayHouseSwitch.shared.set(response.todayHouse, account: account)
                record.createdAt = response.user.createdAt
                if let guidance = response.guidance {
                    record.merge(guidance)
                } else {
                    // An older server: no cards.
                    record.enabled = false
                    record.known = true
                }
                save()
                break
            } catch {
                guard account == self.account, !Task.isCancelled else { return }
                logger.debug("Guidance state not read: \(error)")
                try? await Task.sleep(for: wait)
            }
        }
        await flush()
        scheduleEvaluation()
    }

    /// Waits after a failed read before the next try (the last one is never used).
    private static let readRetries: [Duration] = [.seconds(2), .seconds(5), .seconds(15), .zero]

    /// A cold start or back after 30 minutes: the screen showing counts as a visit again.
    private func beginAppOpen() {
        record.opens += 1
        otherCardThisOpen = false
        lastVisited = nil
        if let entry = currentScreen { countVisit(entry) }
        save()
    }

    private func save() {
        guard let account else { return }
        GuidanceRecordStore.save(record, account: account)
        if tipsAvailable != record.enabled { tipsAvailable = record.enabled }
    }

    /// Sends the closes the server hasn't heard yet, oldest first; quietly tries again later on a failure.
    private func flush() async {
        guard !sending, let account else { return }
        sending = true
        defer { sending = false }
        while let id = record.unsent.first, account == self.account {
            do {
                let answer: GuidanceEnvelope = try await APIClient.shared.request(UsersEndpoints.guidanceShown(card: id))
                guard account == self.account else { return }
                record.acknowledge(id)
                record.merge(answer.guidance)
                save()
            } catch let error as APIError {
                guard account == self.account else { return }
                switch error {
                case .notFound:
                    // The server's switch is off: nothing to record, nothing to show.
                    record.unsent.removeAll()
                    record.enabled = false
                    save()
                    return
                case let .clientError(status, _) where status == 400:
                    // An id this server doesn't know: drop it, keep the rest.
                    record.acknowledge(id)
                    save()
                default:
                    return
                }
            } catch {
                return
            }
        }
    }

    // MARK: - Facts from the screens

    /// Something the person did that some pointers wait for.
    func note(_ fact: GuidanceFact) {
        guard account != nil, !record.has(fact) else { return }
        record.facts.insert(fact.rawValue)
        save()
    }

    /// An after-action card's action just succeeded here (a post, a Moment, a plan, a letter, an accepted request):
    /// the card shows on its screen, right away when that screen is showing, else on the next visit.
    func pend(_ id: GuidanceCardID) {
        guard account != nil, !record.hasSeen(id), !record.pending.contains(id.rawValue) else { return }
        record.pending.insert(id.rawValue)
        save()
        scheduleEvaluation()
    }

    /// What a card's button does on the screen showing (`guidanceAction`); nil takes it away.
    func setAction(_ token: UUID, id: GuidanceCardID, run: (() -> Void)?) {
        if let run { steps.setAction(token, id: id, run: run) } else { steps.removeAction(token) }
    }

    /// A link or notification is opening: no card for a moment, whatever screen it lands on. A card already on
    /// screen would cover what opens under it (an invitation's plan), so it steps aside, not counted as seen, and
    /// shows again on its own screen. A replay stays.
    func noteLinkOpening() {
        linkQuietUntil = Date().addingTimeInterval(2)
        guard let shown = presentation, !shown.isReplay else { return }
        dismissPresentation()
        (otherCardThisOpen, record.lastCentreDay) = (beforeShown.other, beforeShown.centreDay)
        record.lastIntroVersion = beforeShown.introVersion
        scheduleEvaluation()
    }

    /// Something the person just asked to see is showing for a moment (the pickup entry lit after
    /// "See it in Today"): no card covers it for this long. Zero ends the wait.
    func holdCards(for seconds: TimeInterval) {
        linkQuietUntil = Date().addingTimeInterval(seconds)
        if seconds <= 0 { scheduleEvaluation() }
    }

    // MARK: - Screens

    func screenAppeared(_ token: UUID, screen: GuidanceScreen, ready: Bool, variants: GuidanceVariants) {
        screens.removeAll { $0.token == token }
        let entry = GuidanceScreenEntry(screen: screen, ready: ready, variants: variants)
        screens.append((token, entry))
        if account != nil { countVisit(entry) }
        scheduleEvaluation()
    }

    /// A visit: the screen shows after another one, or first in this app open.
    private func countVisit(_ entry: GuidanceScreenEntry) {
        if lastVisited != entry.screen {
            lastVisited = entry.screen
            record.visits[entry.screen.rawValue, default: 0] += 1
            save()
        }
        noteScreenFacts(entry.screen, variants: entry.variants, ready: entry.ready)
    }

    func screenChanged(_ token: UUID, ready: Bool, variants: GuidanceVariants) {
        guard let index = screens.firstIndex(where: { $0.token == token }) else { return }
        screens[index].entry.ready = ready
        screens[index].entry.variants = variants
        noteScreenFacts(screens[index].entry.screen, variants: variants, ready: ready)
        scheduleEvaluation()
    }

    func screenDisappeared(_ token: UUID) {
        screens.removeAll { $0.token == token }
    }

    private func noteScreenFacts(_ screen: GuidanceScreen, variants: GuidanceVariants, ready: Bool) {
        guard ready else { return }
        if screen == .place, variants.placeHasAddress { note(.placeHasAddress) }
        if screen == .today, variants.aroundYouSwitch { note(.todayAroundYou) }
    }

    /// The screen on top: the last one to appear that is still showing.
    private var currentScreen: GuidanceScreenEntry? {
        screens.last?.entry
    }

    // MARK: - Anchors

    func anchorMoved(_ view: GuidanceAnchorView) {
        if view.window != nil { anchors.add(view) } else { anchors.remove(view) }
        anchorsChanged()
    }

    func anchorsChanged() {
        guard presentation == nil else { return }
        scheduleEvaluation()
    }

    /// Where a pointer's control is now: one frame around every eligible control with its id that is on screen.
    func anchorFrame(for id: GuidanceCardID) -> (frame: CGRect, cornerRadius: CGFloat?)? {
        var frame: CGRect?
        var radius: CGFloat?
        for view in anchors.allObjects where view.id == id && view.eligible {
            guard let visible = view.visibleFrame else { continue }
            frame = frame.map { $0.union(visible) } ?? visible
            radius = radius ?? view.cornerRadius
        }
        return frame.map { ($0, radius) }
    }

    // MARK: - Choosing

    /// Half a second from now (the screen has settled), and again every half second while something is in the way.
    func scheduleEvaluation(after delay: Duration = .milliseconds(500)) {
        guard account != nil else { return }
        evaluation?.cancel()
        evaluation = Task { @MainActor [weak self] in
            try? await Task.sleep(for: delay)
            await self?.evaluate()
        }
    }

    private func evaluate() async {
        // About five minutes of waiting at most; the next visit tries again.
        for _ in 0..<600 {
            guard !Task.isCancelled, presentation == nil, let entry = currentScreen, entry.ready, isSignedIn else { return }
            if let reason = GuidanceBlockers.reason(center: self) {
                logger.trace("Guidance waits: \(reason)")
                try? await Task.sleep(for: .milliseconds(500))
                continue
            }
            if let next = nextCard(on: entry) { present(next) }
            return
        }
    }

    /// Still the account the cards were read for (a sign-out replaces the tabs).
    private var isSignedIn: Bool {
        if case let .signedIn(user) = AuthManager.shared.state { return user.id == account }
        return false
    }

    var waitsForKeyboard: Bool {
        keyboardUp
    }

    var waitsForLink: Bool {
        if let until = linkQuietUntil, until > Date() { return true }
        return false
    }

    private func nextCard(on entry: GuidanceScreenEntry) -> GuidancePresentation? {
        if let forced, let card = card(forced, on: entry, ignoringRules: true) {
            self.forced = nil
            return card
        }
        guard record.enabled, !isBusinessAccount, let account else { return nil }
        if record.newAccount, let tab = tabCard(on: entry) { return tab }
        // Everything else: one per app open.
        guard !otherCardThisOpen else { return nil }
        switch steps.next(on: entry, record: record, account: account) {
        case let .card(id): return card(id, on: entry, ignoringRules: false)
        case .wait: return nil
        case .nothing: break
        }
        // Pointers from the account's second open on this phone (none on Messages).
        guard record.newAccount, record.opens >= 2, entry.screen != .messages else { return nil }
        for id in GuidanceCardID.pointers where !record.hasSeen(id) {
            if let card = card(id, on: entry, ignoringRules: false) { return card }
        }
        return nil
    }

    /// A tab's own card: the first time its tab opens.
    private func tabCard(on entry: GuidanceScreenEntry) -> GuidancePresentation? {
        // Today's own card is not shown while the house is on Today (JOURNEYS section 3).
        let houseOn = TodayHouseSwitch.shared.isOn
        var tabCards = [GuidanceCatalog.tabCard(for: entry.screen)].compactMap(\.self).filter { $0 != .tabToday || !houseOn }
        if entry.screen == .place, entry.variants.savedAddress { tabCards.append(.placeSaved) }
        for id in tabCards where !record.hasSeen(id) {
            if let card = card(id, on: entry, ignoringRules: false) { return card }
        }
        return nil
    }

    /// The card, if it can show on this screen now.
    private func card(_ id: GuidanceCardID, on entry: GuidanceScreenEntry, ignoringRules: Bool) -> GuidancePresentation? {
        if id.isTabCard {
            let onScreen = id == .placeSaved ? entry.screen == .place : GuidanceCatalog.tabCard(for: entry.screen) == id
            guard onScreen, let card = GuidanceCatalog.centre(id, variants: entry.variants) else { return nil }
            return .centre(card, replay: false)
        }
        if id.isCentre {
            // After-action cards and reminders on their own screen; an introduction on any.
            if let screen = id.centreScreen, screen != entry.screen { return nil }
            return GuidanceCatalog.centre(id, variants: entry.variants).map { .centre($0, replay: false) }
        }
        guard let pointer = GuidanceCatalog.pointer(id), anchorFrame(for: id) != nil else { return nil }
        return ignoringRules || pointerMayShow(id, on: entry) ? .pointer(pointer) : nil
    }

    /// A pointer's own visit count and condition.
    private func pointerMayShow(_ id: GuidanceCardID, on entry: GuidanceScreenEntry) -> Bool {
        if let visit = id.pointerVisit {
            guard visit.screen == entry.screen, record.visits[visit.screen.rawValue, default: 0] >= visit.from else { return false }
        }
        switch id {
        case .tipPlaceRow: return !record.has(.placeRowOpened)
        case .tipPulsePost: return !record.has(.posted) && !steps.hasPosted
        default: return true
        }
    }
}

// MARK: - Showing and closing

extension GuidanceCenter {
    private func present(_ next: GuidancePresentation) {
        beforeShown = BeforeShown(other: otherCardThisOpen, centreDay: record.lastCentreDay, introVersion: record.lastIntroVersion)
        presentation = next
        if !next.id.isTabCard { otherCardThisOpen = true }
        if case let .centre(card, _) = next {
            record.lastCentreDay = GuidanceRecord.day(Date())
            if card.id.isIntroduction { record.lastIntroVersion = GuidanceSteps.appVersion }
            if card.id == .welcome,
               !card.rows.contains(where: { $0.icon == .lock }) { record.facts.insert(GuidanceFact.joinedByInvite.rawValue) }
            save()
        }
        GuidanceWindowPresenter.shared.show(next)
    }

    /// The tips list: a tab card again, as it is for this account. Not counted.
    func replay(_ id: GuidanceCardID) {
        guard presentation == nil else { return }
        let variants = GuidanceVariants(
            joinedByInvite: record.has(.joinedByInvite),
            aroundYouSwitch: record.has(.todayAroundYou)
        )
        guard let card = GuidanceCatalog.centre(id, variants: variants) else { return }
        presentation = .centre(card, replay: true)
        GuidanceWindowPresenter.shared.show(.centre(card, replay: true))
    }

    /// The card closed (its button, X, a tap outside, a tap anywhere for a pointer): seen, at once. `primary`: by
    /// its button, which for a reminder also opens the next step on the screen showing (cards 24 to 27).
    func close(_ closed: GuidancePresentation, primary: Bool = false) {
        guard presentation == closed else { return }
        presentation = nil
        GuidanceWindowPresenter.shared.hide()
        guard !closed.isReplay, account != nil else { return }
        record.markSeen(closed.id, at: Date())
        record.pending.remove(closed.id.rawValue)
        save()
        if primary, let action = steps.action(for: closed.id) {
            // Once the card has faded, so a sheet or the keyboard comes up over the plain screen.
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(250))
                action()
            }
        }
        Task { await flush() }
        scheduleEvaluation()
    }

    private func dismissPresentation() {
        guard presentation != nil else { return }
        presentation = nil
        GuidanceWindowPresenter.shared.hide()
    }

    // MARK: App lifecycle and the keyboard

    private func observe() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated { GuidanceCenter.shared.backgroundedAt = Date() }
        })
        observers.append(center.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated { GuidanceCenter.shared.cameBack() }
        })
        observers.append(center.addObserver(forName: UIResponder.keyboardWillShowNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated { GuidanceCenter.shared.keyboardUp = true }
        })
        observers.append(center.addObserver(forName: UIResponder.keyboardDidHideNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated {
                GuidanceCenter.shared.keyboardUp = false
                GuidanceCenter.shared.scheduleEvaluation()
            }
        })
    }

    private func cameBack() {
        defer { backgroundedAt = nil }
        guard account != nil else { return }
        if let since = backgroundedAt, Date().timeIntervalSince(since) >= Self.newOpenAfter {
            beginAppOpen()
            Task { await refresh() }
        } else if !record.known {
            Task { await refresh() }
        } else {
            Task { await flush() }
            scheduleEvaluation()
        }
    }
}
