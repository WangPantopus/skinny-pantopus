//
//  PlaceResidencyPassSection.swift
//  Pantopus
//
//  The Residency Pass on the Identity detail: pick ONE fact to share
//  ("a verified resident of Camas School District"), pick a lifetime,
//  issue — the verify link is copied for handing to whoever asked.
//  Claims list with live status, view counts, and one-tap revoke.
//  Mirrors web's ResidencyPassLeaf; parity: Android
//  PlaceResidencyPassContent.
//

import SwiftUI
import UIKit

// MARK: - VM

@Observable
@MainActor
final class PlaceResidencyPassViewModel {
    enum State {
        case loading
        case loaded([ResidencyClaim])
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var isIssuing = false
    // (message, isError): a failed issue must never render in
    // confirmation green — the person may believe a link was copied.
    private(set) var toast: (message: String, isError: Bool)?
    var scope: ResidencyClaimScope = .city
    var expiresInDays = 30
    let homeId: String
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    func load() async {
        do {
            let response: ResidencyClaimsResponse = try await api.request(
                ResidencyClaimsEndpoints.list(homeId: homeId)
            )
            state = .loaded(response.claims)
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't load your claims.")
        } catch {
            state = .error(message: "Couldn't load your claims.")
        }
    }

    func issue() async {
        isIssuing = true
        defer { isIssuing = false }
        do {
            let response: ResidencyClaimResponse = try await api.request(
                ResidencyClaimsEndpoints.issue(
                    homeId: homeId,
                    request: IssueResidencyClaimRequest(scope: scope, expiresInDays: expiresInDays)
                )
            )
            UIPasteboard.general.string = response.claim.verifyUrl
            toast = ("Claim issued — verification link copied.", false)
            await load()
        } catch let error as APIError {
            toast = (error.errorDescription ?? "Couldn't issue the claim.", true)
        } catch {
            toast = ("Couldn't issue the claim.", true)
        }
    }

    func copyLink(_ claim: ResidencyClaim) {
        UIPasteboard.general.string = claim.verifyUrl
        toast = ("Verification link copied.", false)
    }

    func revoke(_ claimId: String) async {
        do {
            _ = try await api.request(
                ResidencyClaimsEndpoints.revoke(homeId: homeId, claimId: claimId)
            ) as ResidencyClaimResponse
            toast = ("Claim revoked — its link no longer checks out as valid.", false)
            await load()
        } catch let error as APIError {
            // Revocation is a promise. A failure that says nothing lets
            // the resident believe a live claim carrying their name and
            // address has been withdrawn when it has not.
            toast = (error.errorDescription ?? "Couldn't revoke the claim.", true)
            await load()
        } catch {
            toast = ("Couldn't revoke the claim.", true)
            await load()
        }
    }

    func clearToast() {
        toast = nil
    }
}

// MARK: - Scope metadata

private let scopeLabels: [ResidencyClaimScope: (label: String, hint: String)] = [
    .city: ("City", "e.g. \u{201C}a verified resident of Portland, OR\u{201D}"),
    .schoolDistrict: ("School district", "For enrollment and school-zone checks"),
    .county: ("County", "For county services and programs"),
    .state: ("State", "For state-residency checks"),
    .congressionalDistrict: ("Congressional district", "For civic and campaign checks"),
    .address: ("Full address", "Discloses your street address — like the letter"),
]

private let durationChoices = [1, 7, 30, 90]

// MARK: - Section

struct PlaceResidencyPassSection: View {
    @Bindable var vm: PlaceResidencyPassViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            composer
            claimsList
            if let toast = vm.toast {
                Text(toast.message)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(toast.isError ? Theme.Color.error : Theme.Color.success)
                    .task {
                        try? await Task.sleep(for: .seconds(3))
                        vm.clearToast()
                    }
            }
        }
    }

    private var composer: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Prove residency without sharing your address")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(
                    "The link shares only the statement you pick — checked live against your verification, "
                        + "logged for you, revocable any time."
                )
                    .font(.system(size: 12.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                scopePicker
                durationPicker
                Button {
                    Task { await vm.issue() }
                } label: {
                    Text(vm.isIssuing ? "Issuing…" : "Issue claim & copy link")
                        .font(.system(size: 14.5, weight: .semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.isIssuing)
            }
        }
    }

    private var scopePicker: some View {
        VStack(spacing: 0) {
            ForEach(Array(ResidencyClaimScope.pickerOrder.enumerated()), id: \.element) { index, scope in
                scopeRow(scope, isFirst: index == 0)
            }
        }
        .background(Theme.Color.appSurfaceSunken, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func scopeRow(_ scope: ResidencyClaimScope, isFirst: Bool) -> some View {
        let meta = scopeLabels[scope] ?? ("Unknown", "")
        let selected = vm.scope == scope
        return Button {
            vm.scope = scope
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .strokeBorder(selected ? Theme.Color.primary600 : Theme.Color.appBorderStrong, lineWidth: 2)
                        .frame(width: 17, height: 17)
                    if selected {
                        Circle().fill(Theme.Color.primary600).frame(width: 8, height: 8)
                    }
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(meta.label)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(meta.hint)
                        .font(.system(size: 11.5))
                        .foregroundStyle(scope == .address ? Theme.Color.warning : Theme.Color.appTextMuted)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .overlay(alignment: .top) {
            if !isFirst {
                Divider().padding(.leading, 12)
            }
        }
    }

    private var durationPicker: some View {
        HStack(spacing: 8) {
            ForEach(durationChoices, id: \.self) { days in
                let selected = vm.expiresInDays == days
                Button {
                    vm.expiresInDays = days
                } label: {
                    Text(days == 1 ? "1 day" : "\(days) days")
                        .font(.system(size: 12.5, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            selected ? Theme.Color.primary100 : Theme.Color.appSurface,
                            in: RoundedRectangle(cornerRadius: 9, style: .continuous)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .strokeBorder(
                                    selected ? Theme.Color.primary600 : Theme.Color.appBorder,
                                    lineWidth: 1.5
                                )
                        )
                        .foregroundStyle(selected ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var claimsList: some View {
        switch vm.state {
        case .loading:
            EmptyView()
        case let .error(message):
            PlaceDetailCard {
                Text(message)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        case let .loaded(claims):
            ForEach(claims) { claim in
                PlaceResidencyClaimRow(claim: claim, vm: vm)
            }
        }
    }
}

// MARK: - One issued claim

private struct PlaceResidencyClaimRow: View {
    let claim: ResidencyClaim
    let vm: PlaceResidencyPassViewModel

    private var statusChip: PlaceChipModel {
        switch claim.status {
        case .active: PlaceChipModel(tone: .success, text: "Active")
        case .revoked: PlaceChipModel(tone: .warning, text: "Revoked")
        case .expired: PlaceChipModel(tone: .neutral, text: "Expired")
        }
    }

    private var viewsLine: String {
        let until = PlacePresentation.fmtMonthYear(claim.expiresAt) ?? ""
        let views = claim.viewCount == 0
            ? "Not checked yet"
            : "Checked \(claim.viewCount) \(claim.viewCount == 1 ? "time" : "times")"
        return "Until \(until) · \(views)"
    }

    var body: some View {
        PlaceDetailCard(padding: 14) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text(claim.claimCode)
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: 0)
                    PlaceChip(model: statusChip)
                }
                Text(claim.statement)
                    .font(.system(size: 13))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextStrong)
                Text(viewsLine)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
                if claim.status == .active {
                    HStack(spacing: 8) {
                        Button {
                            vm.copyLink(claim)
                        } label: {
                            Text("Copy link")
                                .font(.system(size: 13, weight: .semibold))
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        Button(role: .destructive) {
                            Task { await vm.revoke(claim.id) }
                        } label: {
                            Text("Revoke")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
        }
    }
}
