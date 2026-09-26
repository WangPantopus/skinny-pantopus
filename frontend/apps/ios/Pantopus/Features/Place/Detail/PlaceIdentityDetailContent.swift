//
//  PlaceIdentityDetailContent.swift
//  Pantopus
//
//  C9 — Identity. The verified-resident status, the server-attested
//  residency-letter generator (issue / history / revoke via the real
//  `/api/homes/:id/residency-letters` API), and the portable-ID
//  coming-soon row.
//

import QuickLook
import SwiftUI

// swiftlint:disable file_length

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
    /// (message, isError) — a failed revoke must never be silent.
    private(set) var toast: (message: String, isError: Bool)?
    var purpose = ""
    /// The letter PDF on disk while the system viewer (Quick Look) shows it.
    var pdfURL: URL?
    private(set) var openingLetterId: String?
    let homeId: String
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    /// Fetches the exact issued PDF and opens it in the phone's viewer.
    func openPDF(_ letter: ResidencyLetter) async {
        openingLetterId = letter.id
        defer { openingLetterId = nil }
        do {
            let data = try await api.requestData(ResidencyLettersEndpoints.pdf(homeId: homeId, letterId: letter.id))
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("pantopus-residency-letter-\(letter.id.prefix(8)).pdf")
            try data.write(to: url, options: [.atomic, .completeFileProtection])
            pdfURL = url
        } catch let error as APIError {
            toast = (error.errorDescription ?? "Couldn't open the letter PDF.", true)
        } catch {
            toast = ("Couldn't open the letter PDF.", true)
        }
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
        } catch let error as APIError {
            // A refused issue (403, daily limit, outage) must not look like a
            // no-op: the list reload succeeds, so say why. The purpose stays
            // for a retry.
            toast = (error.errorDescription ?? "Couldn't issue the letter.", true)
            await load()
        } catch {
            toast = ("Couldn't issue the letter.", true)
            await load()
        }
    }

    func revoke(_ letterId: String) async {
        do {
            _ = try await api.request(
                ResidencyLettersEndpoints.revoke(homeId: homeId, letterId: letterId)
            ) as ResidencyLetterResponse
            toast = ("Letter revoked — its code no longer verifies.", false)
            await load()
        } catch let error as APIError {
            // Revocation is a promise. A silent failure lets the resident
            // believe a live letter carrying their name and street address
            // has been withdrawn when it still verifies.
            toast = (error.errorDescription ?? "Couldn't revoke the letter.", true)
            await load()
        } catch {
            toast = ("Couldn't revoke the letter.", true)
            await load()
        }
    }

    func clearToast() {
        toast = nil
    }
}

// MARK: - Mailbox reality check VM (Wave 1, #3)

// Reads the claim-time postal validation surfaced as a diagnostic —
// zero vendor calls server-side. The physical-leg copy is per-caller,
// which makes this card the identity page's honest verify nudge.

@Observable
@MainActor
final class PlaceMailboxCheckViewModel {
    enum State {
        case loading
        case loaded(MailboxCheck)
        case error(message: String)
    }

    private(set) var state: State = .loading
    let homeId: String
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    func load() async {
        do {
            let response: MailboxCheckResponse = try await api.request(
                MailboxCheckEndpoints.check(homeId: homeId)
            )
            state = .loaded(response.check)
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't run the mailbox check.")
        } catch {
            state = .error(message: "Couldn't run the mailbox check.")
        }
    }
}

// MARK: - Viewer access

/// Who is looking: guests and service providers have verified access to a
/// home but don't live there, and the server refuses them residency letters
/// and passes (`NON_RESIDENT_ROLES`).
@Observable
@MainActor
final class PlaceIdentityAccessViewModel {
    /// The viewer's `role_base` for this home; nil until read, or if it can't be.
    private(set) var roleBase: String?
    let homeId: String
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    var isNonResident: Bool {
        roleBase == "guest" || roleBase == "service_provider"
    }

    func load() async {
        let access = try? await api.request(HomeAdminEndpoints.myAccess(homeId: homeId), as: HomeAccessDTO.self)
        roleBase = access?.roleBase
    }
}

// MARK: - Identity content

struct PlaceIdentityDetailContent: View {
    let intel: PlaceIntelligence
    let vm: PlaceDetailViewModel
    @State private var letters: PlaceResidencyLetterViewModel
    @State private var mailbox: PlaceMailboxCheckViewModel
    @State private var pass: PlaceResidencyPassViewModel
    @State private var unlisted: PlaceUnlistedViewModel
    @State private var access: PlaceIdentityAccessViewModel

    init(intel: PlaceIntelligence, vm: PlaceDetailViewModel) {
        self.intel = intel
        self.vm = vm
        _letters = State(initialValue: PlaceResidencyLetterViewModel(homeId: vm.homeId))
        _mailbox = State(initialValue: PlaceMailboxCheckViewModel(homeId: vm.homeId))
        _pass = State(initialValue: PlaceResidencyPassViewModel(homeId: vm.homeId))
        _unlisted = State(initialValue: PlaceUnlistedViewModel(homeId: vm.homeId))
        _access = State(initialValue: PlaceIdentityAccessViewModel(homeId: vm.homeId))
    }

    private var isVerified: Bool {
        intel.tier == .t4
    }

    private var hasIssuedClaims: Bool {
        if case let .loaded(claims) = pass.state { return !claims.isEmpty }
        return false
    }

    /// The residency letter and Residency Pass sections (residents only).
    @ViewBuilder
    private var residencySections: some View {
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

        PlaceDetailSectionLabel(text: "Residency Pass")
        if isVerified {
            PlaceResidencyPassSection(vm: pass)
                .task { await pass.load() }
        } else {
            PlaceLockedCard(
                icon: .idCard,
                title: "Prove residency without sharing your address",
                reason: "Verify your address to share one fact — your city, school district, or county — behind a live-checked link.",
                cta: "Verify address",
                onTap: nil
            )
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PlaceDetailSectionLabel(text: "Verification")
            VerifiedStatusCard(isVerified: isVerified, roleBase: access.roleBase, address: placeDetailAddress(intel.place))

            if isVerified, access.isNonResident {
                // No issuing, but letters and passes from when they lived
                // here stay listed so they can still open or revoke them.
                PlaceDetailSectionLabel(text: "Residency letter")
                ResidencyLetterSection(vm: letters, canIssue: false)
                    .task {
                        await letters.load()
                        await pass.load()
                    }
                if hasIssuedClaims {
                    PlaceDetailSectionLabel(text: "Residency Pass")
                    PlaceResidencyPassSection(vm: pass, canIssue: false)
                }
            } else {
                residencySections
            }

            // Unlisted is gated on ACCESS, not verification: someone who
            // has just claimed their address is exactly who needs to start
            // removing it, and making them wait for a postcard would
            // invert the product.
            PlaceDetailSectionLabel(text: "Get your address off the internet")
            PlaceUnlistedSection(vm: unlisted)
                .task { await unlisted.load() }

            PlaceDetailSectionLabel(text: "Mailbox")
            MailboxCheckSection(vm: mailbox)
                .task { await mailbox.load() }

            PlaceDetailSectionLabel(text: "Portable ID")
            PlaceComingSoonRow(
                icon: .shieldCheck,
                title: "Portable ID",
                subtitle: "Carry your verified status to other apps"
            )
        }
        .task { await access.load() }
    }
}

// MARK: - Mailbox reality check section

private struct MailboxCheckSection: View {
    let vm: PlaceMailboxCheckViewModel

    var body: some View {
        switch vm.state {
        case .loading:
            PlaceDetailCard {
                Text("Checking how databases see this address…")
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        case let .error(message):
            PlaceDetailCard {
                Text(message)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        case let .loaded(check):
            MailboxCheckCard(check: check)
        }
    }
}

private struct MailboxCheckCard: View {
    let check: MailboxCheck

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Text("Mailbox reality check")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: 0)
                    PlaceChip(model: verdictChip)
                }
                Text("How USPS databases and real mail see this address")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(check.findings.enumerated()), id: \.offset) { _, finding in
                        findingRow(icon: severityIcon(finding.severity), title: finding.title, detail: finding.detail)
                    }
                    findingRow(icon: physicalIcon, title: check.physical.title, detail: check.physical.detail)
                }
            }
        }
    }

    private var verdictChip: PlaceChipModel {
        switch check.verdict {
        case .looksGood: PlaceChipModel(tone: .success, text: "Looks good")
        case .needsAttention: PlaceChipModel(tone: .warning, text: "Needs attention")
        case .problem: PlaceChipModel(tone: .warning, text: "Problem found", icon: .alertCircle)
        case .unknown: PlaceChipModel(tone: .neutral, text: "Not checked yet")
        }
    }

    private func severityIcon(_ severity: MailboxFindingSeverity) -> (PantopusIcon, Color) {
        switch severity {
        case .ok: (.badgeCheck, Theme.Color.success)
        case .info: (.info, Theme.Color.appTextMuted)
        case .attention: (.triangleAlert, Theme.Color.warning)
        case .problem: (.alertCircle, Theme.Color.error)
        }
    }

    private var physicalIcon: (PantopusIcon, Color) {
        switch check.physical.status {
        case .proven: (.badgeCheck, Theme.Color.success)
        case .inProgress: (.clock, Theme.Color.warning)
        case .notRun: (.info, Theme.Color.appTextMuted)
        }
    }

    private func findingRow(icon: (PantopusIcon, Color), title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 9) {
            Icon(icon.0, size: 15, strokeWidth: 2.25, color: icon.1)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(detail)
                    .font(.system(size: 12.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }
}

private struct VerifiedStatusCard: View {
    let isVerified: Bool
    /// The viewer's role here: guests and service providers are verified, but not residents.
    let roleBase: String?
    let address: String

    private var title: String {
        guard isVerified else { return "Claimed — not yet verified" }
        switch roleBase {
        case "guest": return "Verified guest"
        case "service_provider": return "Verified service provider"
        default: return "Verified resident"
        }
    }

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
                        Text(title)
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
    /// Guests and service providers can't issue letters (the server refuses them).
    var canIssue = true

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let toast = vm.toast {
                Text(toast.message)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(toast.isError ? Theme.Color.error : Theme.Color.success)
                    .task {
                        try? await Task.sleep(for: .seconds(3))
                        vm.clearToast()
                    }
            }
            if canIssue {
                composer
            } else {
                PlaceDetailCard {
                    Text("Residency letters and passes are for the people who live here, so guest and service access can't issue them.")
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            history
        }
        .quickLookPreview($vm.pdfURL)
    }

    private var composer: some View {
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
                Button(vm.openingLetterId == letter.id ? "Opening…" : "PDF") { Task { await vm.openPDF(letter) } }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.home)
                    .disabled(vm.openingLetterId != nil)
                    .accessibilityIdentifier("place.letter.pdf")
                if letter.status == .issued {
                    Button("Revoke") { Task { await vm.revoke(letter.id) } }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.error)
                } else {
                    let label = letter.status == .expired ? "Expired" : (letter.status == .revoked ? "Revoked" : "Unavailable")
                    PlaceChip(model: PlaceChipModel(tone: .neutral, text: label))
                }
            }
        }
    }
}
