//
//  MomentsFlags.swift
//  Pantopus
//
//  Moments sit behind the server flag `moments`, off until the founder turns
//  it on (Moments build brief, 2026-11-08). The app reads it at launch and on
//  foreground through `GET /api/feature-flags/moments`, which honors
//  `enabled_for_internal_team` and `beta_user_ids`, as `PlansFlags` does for
//  Plans.
//
//  Off: there is no Moments tab. The last answer is remembered per account,
//  so the right tab bar is there on the first frame after a relaunch; a
//  failed check keeps the last answer. A new account starts from its own
//  answer, never the previous account's.
//

import Foundation
import Observation

@Observable
@MainActor
final class MomentsFlags {
    static let shared = MomentsFlags()

    /// Moments are on for the signed-in account.
    private(set) var moments = false

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

    /// Re-reads the flag for `account` (the signed-in user id); nil turns
    /// Moments off. `force` skips the 30-second reuse.
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
                let flag: FeatureFlagDTO = try await api.request(PlansEndpoints.flag(MomentsEndpoints.flagName))
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

    private func apply(_ isOn: Bool) {
        if moments != isOn { moments = isOn }
    }

    private static func key(_ account: String) -> String {
        "pantopus.moments.flag.\(account)"
    }
}
