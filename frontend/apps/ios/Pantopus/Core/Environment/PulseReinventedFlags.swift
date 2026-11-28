//
//  PulseReinventedFlags.swift
//  Pantopus
//
//  "Pulse, reinvented" (founder, 2026-11-26) sits behind one server switch,
//  `pulse_reinvented`: off, on for chosen accounts, or on for everyone. It
//  turns everything of the new direction on, and turning it off puts back
//  what there was before at once: nothing of today's Moments or Pulse is
//  deleted or changed, and the new screens sit beside them, reachable only
//  while the switch is on for the person. There is no build key, so it never
//  needs a new build or a store review.
//
//  It is read the way `MomentsFlags` reads `moments`: at launch and on
//  foreground through `GET /api/feature-flags/pulse_reinvented`, which
//  honors `enabled_for_internal_team` and `beta_user_ids`. The last answer is
//  remembered per account, so the right screens are there on the first frame
//  after a relaunch; a failed check keeps the last answer. A new account
//  starts from its own answer, never the previous account's.
//

import Foundation
import Observation

@Observable
@MainActor
final class PulseReinventedFlags {
    static let shared = PulseReinventedFlags()

    /// The server switch's name (`FeatureFlag.name`).
    static let flagName = "pulse_reinvented"

    /// The new direction is on for the signed-in account.
    private(set) var isOn = false

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

    /// Re-reads the switch for `account` (the signed-in user id); nil turns it
    /// off. `force` skips the 30-second reuse.
    func refresh(account newAccount: String?, force: Bool = false) async {
        guard let newAccount else {
            account = nil
            lastChecked = nil
            apply(false)
            return
        }
        if newAccount != account {
            account = newAccount
            lastChecked = nil
            apply(defaults.bool(forKey: Self.key(newAccount)))
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

    private func check(account checked: String) async {
        let api = injectedAPI ?? APIClient.shared
        let answer: Bool? = await {
            do {
                let flag: FeatureFlagDTO = try await api.request(PlansEndpoints.flag(Self.flagName))
                return flag.enabled
            } catch {
                return nil
            }
        }()
        // An account switch while the check ran: its answer isn't this account's.
        guard account == checked, let answer else { return }
        lastChecked = Date()
        apply(answer)
        defaults.set(answer, forKey: Self.key(checked))
    }

    private func apply(_ on: Bool) {
        if isOn != on { isOn = on }
        PulseTrackSwitch.applied(on) // the Pulse track's phone-side pieces (the widget) follow the switch
    }

    private static func key(_ account: String) -> String {
        "pantopus.pulseReinvented.flag.\(account)"
    }
}
