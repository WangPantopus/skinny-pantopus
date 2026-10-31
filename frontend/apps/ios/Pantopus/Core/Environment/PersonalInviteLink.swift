//
//  PersonalInviteLink.swift
//  Pantopus
//
//  The signed-in person's own invite link (`GET /api/users/me/invite-code`,
//  pantopus.com/join/<code>). A friend who opens it sees who invited them over
//  the address lookup, and signing up there credits the person who sent it.
//  Every "invite" share reads `url`; until the link has loaded (or when it
//  can't), it is the address lookup at /start, which works for everyone.
//

import Foundation
import Observation

@Observable
@MainActor
final class PersonalInviteLink {
    static let shared = PersonalInviteLink()

    /// The address lookup, shared while the person's own link isn't known.
    nonisolated static let fallback = URL(string: InviteLinks.publicPageURLString(path: "/start")) ?? URL(fileURLWithPath: "/")

    /// The link an invite shares right now.
    private(set) var url: URL = PersonalInviteLink.fallback

    @ObservationIgnored private var account: String?
    @ObservationIgnored private var loaded = false
    @ObservationIgnored private var inFlight: Task<Void, Never>?

    /// Reads the link once per account (nil, signed out, goes back to /start).
    /// Cheap to call again: a loaded link is kept and a read in flight is shared.
    func load(account newAccount: String?) async {
        guard let newAccount else {
            account = nil
            loaded = false
            url = Self.fallback
            return
        }
        if newAccount != account {
            account = newAccount
            loaded = false
            url = Self.fallback
        }
        if loaded { return }
        if let inFlight {
            await inFlight.value
            return
        }
        let task = Task { await fetch(account: newAccount) }
        inFlight = task
        await task.value
        inFlight = nil
    }

    private func fetch(account checked: String) async {
        let dto: InviteCodeDTO? = try? await APIClient.shared.request(ProfileInsightsEndpoints.inviteCode())
        // An account switch while the read ran: the answer isn't this account's.
        guard account == checked, let dto, !dto.inviteCode.isEmpty else { return }
        let path = "/join/" + (dto.inviteCode.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? dto.inviteCode)
        guard let link = dto.inviteUrl.flatMap(URL.init(string:)) ?? URL(string: InviteLinks.publicPageURLString(path: path))
        else { return }
        url = link
        loaded = true
    }
}
