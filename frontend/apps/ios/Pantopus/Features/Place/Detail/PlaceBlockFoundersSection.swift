//
//  PlaceBlockFoundersSection.swift
//  Pantopus
//
//  Wave 3 — Block Founders on the Your-block detail. The growth
//  surface, three moves deep:
//
//    RANK    a permanent, scarce founding position in this geohash-6
//            block, assigned first-come and never reassigned.
//    METERS  what each locked block surface is still waiting for. Two
//            different readings by design: "Real rents" counts RENT
//            REPORTS — the only meter a resident moves by asking a
//            neighbor — while the others count VERIFIED HOMES.
//    INVITES real postcards. Pantopus writes and mails a fixed card;
//            the sender chooses the address and nothing else.
//
//  Hard T4 server-side, so below verification this is a locked card.
//  Parity: Android PlaceBlockFoundersContent.
//

import SwiftUI

// swiftlint:disable line_length

// MARK: - VM

@Observable
@MainActor
final class PlaceBlockFoundersViewModel {
    enum State {
        case loading
        case loaded(BlockStatus)
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var isSending = false
    /// Send failures stay INLINE — the typed address survives so a bad
    /// ZIP is a one-character fix, not a re-entry of the whole form.
    private(set) var inviteError: String?
    private(set) var inviteSent: String?
    var recipientLine1 = ""
    var recipientCity = ""
    var recipientState = ""
    var recipientZip = ""
    let homeId: String
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    func load() async {
        do {
            let response: BlockStatusResponse = try await api.request(
                BlockFoundersEndpoints.status(homeId: homeId)
            )
            state = .loaded(response.block)
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't load your block.")
        } catch {
            state = .error(message: "Couldn't load your block.")
        }
    }

    var canSend: Bool {
        recipient != nil && !isSending
    }

    private var recipient: BlockInviteRecipient? {
        let line1 = recipientLine1.trimmingCharacters(in: .whitespacesAndNewlines)
        let city = recipientCity.trimmingCharacters(in: .whitespacesAndNewlines)
        let state = recipientState.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let zip = recipientZip.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !line1.isEmpty, !city.isEmpty,
              state.count == 2, state.allSatisfy(\.isLetter),
              Self.isZip(zip) else { return nil }
        return BlockInviteRecipient(line1: line1, city: city, state: state, zip: zip)
    }

    static func isZip(_ raw: String) -> Bool {
        let parts = raw.split(separator: "-", omittingEmptySubsequences: false)
        guard let first = parts.first, first.count == 5, first.allSatisfy(\.isNumber) else { return false }
        if parts.count == 1 { return true }
        return parts.count == 2 && parts[1].count == 4 && parts[1].allSatisfy(\.isNumber)
    }

    func sendInvite() async {
        guard let recipient else {
            inviteError = "Enter the neighbor's street address, city, two-letter state, and ZIP."
            return
        }
        isSending = true
        inviteError = nil
        inviteSent = nil
        defer { isSending = false }
        do {
            let result: BlockInviteResult = try await api.request(
                BlockFoundersEndpoints.sendInvite(homeId: homeId, recipient: recipient)
            )
            recipientLine1 = ""
            recipientCity = ""
            recipientState = ""
            recipientZip = ""
            inviteSent = "Card on its way — it should land in about a week."
            if case let .loaded(status) = state {
                state = .loaded(status.withInvitesRemaining(result.invitesRemaining))
            }
        } catch let error as APIError {
            inviteError = Self.inviteFailureMessage(error)
        } catch {
            inviteError = "The invitation couldn't be sent. Try again."
        }
    }

    /// The backend's own codes, surfaced in the sender's terms. 429 is
    /// the weekly budget; 502 is the mail vendor, which is a "try
    /// again", never the sender's mistake.
    static func inviteFailureMessage(_ error: APIError) -> String {
        switch error {
        case let .clientError(status, body):
            if status == 429 || APIError.code(in: body) == "WEEKLY_CAP" {
                return "You've used this week's invitations. Three a week is the cap, so a block grows by neighbors rather than by blasts — your budget resets in a week."
            }
            return error.errorDescription ?? "The invitation couldn't be sent."
        case let .server(status, body):
            if status == 502 || APIError.code(in: body) == "SEND_FAILED" {
                return "The postcard couldn't be sent just now — nothing was charged and nothing was mailed. Try again shortly."
            }
            return "The invitation couldn't be sent. Try again."
        case .forbidden:
            return "Verify your address to send invitations."
        default:
            return error.errorDescription ?? "The invitation couldn't be sent. Try again."
        }
    }
}

// MARK: - Section

struct PlaceBlockFoundersSection: View {
    let vm: PlaceBlockFoundersViewModel

    var body: some View {
        switch vm.state {
        case .loading:
            PlaceDetailCard {
                PlaceSkeleton(widthFraction: 1, height: 64, radius: Radii.lg)
            }
        case let .error(message):
            PlaceDetailCard {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text(message)
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                    Button {
                        Task { await vm.load() }
                    } label: {
                        Text("Try again")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Theme.Color.primary600)
                }
            }
            .accessibilityIdentifier("place.blockFounders.error")
        case let .loaded(status):
            if status.available {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    BlockFounderRankCard(status: status)
                    BlockFounderMetersCard(meters: status.meters ?? [])
                    BlockInviteForm(vm: vm, status: status)
                }
            } else {
                BlockFoundersUnavailableCard()
            }
        }
    }
}

// MARK: - The permanent founding rank

private struct BlockFounderRankCard: View {
    let status: BlockStatus

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 11) {
                HStack(spacing: 11) {
                    PlaceIconTile(icon: .crown, tone: .home, size: 34)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(rankTitle)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        if let established {
                            Text("Established \(established)")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Theme.Color.appTextMuted)
                        }
                    }
                    Spacer(minLength: 0)
                    if status.rank != nil {
                        PlaceChip(model: PlaceChipModel(tone: .success, text: "Permanent", icon: .badgeCheck))
                    }
                }
                Text(status.rank == nil
                    ? "Your founding position on this block is still being assigned."
                    : "Founding order is first-come and never reassigned — it stays yours for as long as this home is verified.")
                    .font(.system(size: 12.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                HStack(spacing: Spacing.s3) {
                    stat(icon: .users, value: status.verifiedCount.map(PlacePresentation.grouped) ?? "—", label: "Verified homes")
                    stat(icon: .handCoins, value: status.rentReports.map(PlacePresentation.grouped) ?? "—", label: "Rents shared")
                }
            }
        }
        .accessibilityIdentifier("place.blockFounders.rank")
    }

    private var rankTitle: String {
        guard let rank = status.rank else { return "Your block" }
        return "Founder #\(rank) of this block"
    }

    private var established: String? {
        PlacePresentation.fmtMonthYear(status.establishedAt)
    }

    private func stat(icon: PantopusIcon, value: String, label: String) -> some View {
        HStack(spacing: 9) {
            PlaceIconTile(icon: icon, tone: .muted, size: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text(value)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(label)
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - What each locked surface is still waiting for

private struct BlockFounderMetersCard: View {
    let meters: [BlockMeter]

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 13) {
                Text("What your block unlocks next")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                if meters.isEmpty {
                    Text("Unlock progress isn't available for this block yet.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                } else {
                    ForEach(meters) { meter in
                        row(meter)
                    }
                }
                Text("“Real rents” counts rents your neighbors have shared; the others count verified homes. That difference is deliberate — a block of twenty-five verified owner-occupiers has no rents to pool.")
                    .font(.system(size: 11.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .accessibilityIdentifier("place.blockFounders.meters")
    }

    private func row(_ meter: BlockMeter) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: Spacing.s2) {
                Text(meter.label)
                    .font(.system(size: 13.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: 0)
                if meter.unlocked {
                    PlaceChip(model: PlaceChipModel(tone: .success, text: "Unlocked", icon: .check))
                } else {
                    Text("\(meter.current) of \(meter.needed)")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            PlaceProgressBar(
                current: meter.current,
                needed: meter.needed,
                tone: meter.unlocked ? Theme.Color.home : Theme.Color.primary600
            )
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("place.blockFounders.meter.\(meter.id)")
    }
}

// MARK: - No cell for this home

private struct BlockFoundersUnavailableCard: View {
    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Block founders")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("We can't place this home on a block yet, so there's no founding order or unlock progress to show.")
                    .font(.system(size: 13))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .accessibilityIdentifier("place.blockFounders.unavailable")
    }
}
