//
//  PlaceIdentityDetailContent.swift
//  Pantopus
//
//  C9 — Identity. The verified-resident status, the server-attested
//  residency-letter generator (issue / history / revoke via the real
//  `/api/homes/:id/residency-letters` API), and the portable-ID
//  coming-soon row.
//

import SwiftUI

// swiftlint:disable line_length

// MARK: - Residency letter VM

@Observable
@MainActor
final class PlaceResidencyLetterViewModel {
    enum State {
        case loading
        case loaded([ResidencyLetter])
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var isIssuing = false
    var purpose = ""
    let homeId: String
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    func load() async {
        do {
            let response: ResidencyLettersResponse = try await api.request(
                ResidencyLettersEndpoints.list(homeId: homeId)
            )
            state = .loaded(response.letters)
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't load your letters.")
        } catch {
            state = .error(message: "Couldn't load your letters.")
        }
    }

    func issue() async {
        guard !purpose.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isIssuing = true
        defer { isIssuing = false }
        do {
            _ = try await api.request(
                ResidencyLettersEndpoints.issue(
                    homeId: homeId,
                    request: IssueResidencyLetterRequest(purpose: purpose)
                )
            ) as ResidencyLetterResponse
            purpose = ""
            await load()
        } catch {
            // Surface via a reload; the list error state will show.
            await load()
        }
    }

    func revoke(_ letterId: String) async {
        do {
            _ = try await api.request(
                ResidencyLettersEndpoints.revoke(homeId: homeId, letterId: letterId)
            ) as ResidencyLetterResponse
            await load()
        } catch {
            await load()
        }
    }
}

// MARK: - Identity content

struct PlaceIdentityDetailContent: View {
    let intel: PlaceIntelligence
    let vm: PlaceDetailViewModel
    @State private var letters: PlaceResidencyLetterViewModel

    init(intel: PlaceIntelligence, vm: PlaceDetailViewModel) {
        self.intel = intel
        self.vm = vm
        _letters = State(initialValue: PlaceResidencyLetterViewModel(homeId: vm.homeId))
    }

    private var isVerified: Bool {
        intel.tier == .t4
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PlaceDetailSectionLabel(text: "Verification")
            VerifiedStatusCard(isVerified: isVerified, address: placeDetailAddress(intel.place))

            PlaceDetailSectionLabel(text: "Residency letter")
            if isVerified {
                ResidencyLetterSection(vm: letters)
                    .task { await letters.load() }
            } else {
                PlaceLockedCard(
                    icon: .fileText,
                    title: "Verified residency letter",
                    reason: "Verify your address to issue a server-attested letter that states your verified address for a purpose you choose.",
                    cta: "Verify address",
                    onTap: nil
                )
            }

            PlaceDetailSectionLabel(text: "Portable ID")
            PlaceComingSoonRow(
                icon: .shieldCheck,
                title: "Portable ID",
                subtitle: "Carry your verified status to other apps"
            )
        }
    }
}

private struct VerifiedStatusCard: View {
    let isVerified: Bool
    let address: String

    var body: some View {
        PlaceDetailCard {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(isVerified ? Theme.Color.homeBg : Theme.Color.warningBg)
                    Icon(
                        .badgeCheck,
                        size: 24,
                        strokeWidth: 2,
                        color: isVerified ? Theme.Color.home : Theme.Color.warning
                    )
                }
                .frame(width: 48, height: 48)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        Text(isVerified ? "Verified resident" : "Claimed — not yet verified")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        PlaceChip(model: isVerified
                            ? PlaceChipModel(tone: .success, text: "Active", icon: .check)
                            : PlaceChipModel(tone: .warning, text: "Pending"))
                    }
                    Text(address)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

private struct ResidencyLetterSection: View {
    @Bindable var vm: PlaceResidencyLetterViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            PlaceDetailCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text("What is this letter for?")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    TextField("e.g. New library card application", text: $vm.purpose)
                        .font(.system(size: 15))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    PrimaryButton(
                        title: vm.isIssuing ? "Issuing…" : "Generate a residency letter",
                        isLoading: vm.isIssuing,
                        isEnabled: !vm.purpose.trimmingCharacters(in: .whitespaces).isEmpty
                    ) {
                        await vm.issue()
                    }
                }
            }
            history
        }
    }

    @ViewBuilder
    private var history: some View {
        switch vm.state {
        case .loading:
            PlaceSkeleton(widthFraction: 1, height: 64, radius: 16)
        case let .loaded(letters):
            if !letters.isEmpty {
                VStack(spacing: 8) {
                    ForEach(letters) { letter in LetterRow(letter: letter, vm: vm) }
                }
            }
        case let .error(message):
            Text(message)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }
}

private struct LetterRow: View {
    let letter: ResidencyLetter
    let vm: PlaceResidencyLetterViewModel

    var body: some View {
        PlaceDetailCard(padding: 14) {
            HStack(spacing: 11) {
                PlaceIconTile(icon: .fileText, tone: letter.status == .issued ? .home : .muted, size: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(letter.purpose)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(letter.letterCode)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                Spacer(minLength: 0)
                if letter.status == .issued {
                    Button("Revoke") { Task { await vm.revoke(letter.id) } }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.error)
                } else {
                    PlaceChip(model: PlaceChipModel(tone: .neutral, text: "Revoked"))
                }
            }
        }
    }
}
