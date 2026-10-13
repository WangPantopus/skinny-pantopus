//
//  PlansFlags.swift
//  Pantopus
//
//  Nearby Plans sits behind two server flags (Plans build brief, section 3),
//  both off by default: `plans` (everything) and `plans_playdates`
//  (playdates, on top of `plans`). The app reads them at launch and on
//  foreground through `GET /api/feature-flags/:flagName`, which honors
//  `enabled_for_internal_team` and `beta_user_ids`, so pilot testers can have
//  Plans before everyone else.
//
//  Off: Nearby is exactly today's screen, and no Plans entry point, card,
//  notification or deep link shows. The last answer is remembered per
//  account, so the right Nearby is there on the first frame after a
//  relaunch; a failed check keeps the last answer. A new account starts
//  from its own answer, never the previous account's.
//

import Foundation
import Observation

@Observable
@MainActor
final class PlansFlags {
    static let shared = PlansFlags()

    /// Nearby Plans is on for the signed-in account.
    private(set) var plans = false
    /// Playdates are on too (never without `plans`).
    private(set) var playdates = false

    /// Checks closer together than this reuse the last answer.
    static let recheckAfter: TimeInterval = 30

    @ObservationIgnored private var account: String?
    @ObservationIgnored private var lastChecked: Date?
    @ObservationIgnored private var inFlight: Task<Void, Never>?
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let injectedAPI: APIClient?

    init(api: APIClient? = nil, defaults: UserDefaults = .standard) {
        injectedAPI = api
        self.defaults = defaults
    }

    /// Re-reads both flags for `account` (the signed-in user id); nil turns
    /// Plans off. `force` skips the 30-second reuse.
    func refresh(account newAccount: String?, force: Bool = false) async {
        guard let newAccount else {
            account = nil
            lastChecked = nil
            apply(plans: false, playdates: false)
            return
        }
        if newAccount != account {
            account = newAccount
            lastChecked = nil
            restore(for: newAccount)
        }
        if !force, let lastChecked, Date().timeIntervalSince(lastChecked) < Self.recheckAfter { return }
        if let inFlight {
            await inFlight.value
            return
        }
        let task = Task { await check(account: newAccount) }
        inFlight = task
        await task.value
        inFlight = nil
    }

    /// The remembered answer for `account`, at once (a link or a push
    /// arriving before the launch check has run).
    func prime(account newAccount: String?) {
        guard let newAccount, newAccount != account else { return }
        account = newAccount
        lastChecked = nil
        restore(for: newAccount)
    }

    private func check(account checked: String) async {
        let api = injectedAPI ?? APIClient.shared
        async let plansAnswer = Self.read("plans", api: api)
        async let playdatesAnswer = Self.read("plans_playdates", api: api)
        let answers = await (plans: plansAnswer, playdates: playdatesAnswer)
        // An account switch while the check ran: its answers aren't this account's.
        guard account == checked else { return }
        let plansOn = answers.plans ?? plans
        let playdatesOn = answers.playdates ?? playdates
        if answers.plans != nil || answers.playdates != nil { lastChecked = Date() }
        apply(plans: plansOn, playdates: plansOn && playdatesOn)
        defaults.set([plans, playdates], forKey: Self.key(checked))
    }

    private func restore(for account: String) {
        let saved = defaults.array(forKey: Self.key(account)) as? [Bool] ?? []
        let plansOn = saved.first ?? false
        apply(plans: plansOn, playdates: plansOn && saved.dropFirst().first == true)
    }

    private func apply(plans plansOn: Bool, playdates playdatesOn: Bool) {
        if plans != plansOn { plans = plansOn }
        if playdates != playdatesOn { playdates = playdatesOn }
    }

    /// The flag's answer, or nil when it couldn't be read (offline, 5xx).
    private static func read(_ name: String, api: APIClient) async -> Bool? {
        do {
            let flag: FeatureFlagDTO = try await api.request(PlansEndpoints.flag(name))
            return flag.enabled
        } catch {
            return nil
        }
    }

    private static func key(_ account: String) -> String {
        "pantopus.plans.flags.\(account)"
    }
}
