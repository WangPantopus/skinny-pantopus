//
//  PlaceUnlistedSection.swift
//  Pantopus
//
//  Unlisted (Wave 4) on the Identity detail — "get my address off the
//  internet", for a home this person has claimed. Parity: Android
//  PlaceUnlistedContent; API `backend/routes/unlisted.js`.
//
//  THE READER. Someone opening this is disproportionately likely to be
//  doing it because of a specific person. Four things follow, and they
//  are not stylistic:
//
//  1. THE STATE PROGRAM LEADS, above the broker list, always. Most
//     states run an Address Confidentiality Program — a legal substitute
//     address that fixes this at the SOURCE instead of chasing it across
//     thirty sites forever. For this reader that outweighs every opt-out
//     link combined.
//  2. THE THREE STATE ANSWERS READ DIFFERENTLY. A program, or "we
//     checked and this state runs none", or "we have not confirmed one
//     for your state" — never collapsed, because telling someone in
//     danger that no help exists when we simply did not look is the
//     worst failure this surface can have.
//  3. WE NEVER IMPLY THE PERSON IS LISTED. We do not query these sites:
//     searching them would hand them the address. `method_note` says so
//     and is rendered verbatim, next to the list it qualifies.
//  4. NO DARK PATTERNS. No gate on the state program, no urgency, no
//     countdown, and no suggestion that Pantopus removes anything —
//     every removal happens on the broker's own site and we only track
//     what the resident tells us they have done.
//
//  Failure surfaces rather than collapsing: a failed load keeps the
//  section visible with a retry, and `removals == null` (the progress
//  read failed) renders as "we could not load your progress", never as
//  a confident empty checklist.
//

import SwiftUI

// MARK: - VM

@Observable
@MainActor
final class PlaceUnlistedViewModel {
    enum State {
        case loading
        case loaded(UnlistedExposureProfile)
        case error(message: String)
    }

    /// What we can honestly show for one broker's row.
    enum RowProgress: Sendable, Hashable {
        case status(UnlistedRemovalStatus)
        /// The progress read failed — we do not know, and must not guess.
        case unknown
    }

    private(set) var state: State = .loading
    private(set) var progress: UnlistedRemovalProgress = .notApplicable
    private(set) var savingBrokerId: String?
    /// (message, isError) — a failed save must never render as a
    /// confirmation; the resident would believe a step was recorded.
    private(set) var toast: (message: String, isError: Bool)?

    /// Steps saved since the last load. They win over `progress` so a
    /// row the person just set reads back correctly even when the read
    /// of everything else failed.
    ///
    /// Holds the RESOLVED progress, not the raw server status. Caching
    /// the raw value let an unreadable echo
    /// become `.status(.unknown)`, which highlights no button AND does
    /// not match the `.unknown` case that renders "we couldn't read your
    /// saved progress" — so the row went silently blank behind a green
    /// "Saved." toast. It under-reports rather than over-reports, which
    /// is the right direction to fail, but the reader was told the
    /// opposite of what they were shown.
    private var recentEdits: [String: RowProgress] = [:]

    let homeId: String
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    func load() async {
        do {
            let response: UnlistedProfileResponse = try await api.request(
                UnlistedEndpoints.profile(homeId: homeId)
            )
            state = .loaded(response.unlisted)
            progress = response.unlisted.removals
            recentEdits = [:]
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't load your removal list.")
        } catch {
            state = .error(message: "Couldn't load your removal list.")
        }
    }

    func refresh() async {
        await load()
    }

    /// Record where the resident has got to with one broker. Bookkeeping
    /// they own — the removal itself happens on the broker's own site.
    func setStatus(brokerId: String, to status: UnlistedRemovalStatus) async {
        guard status != .unknown else { return }
        savingBrokerId = brokerId
        defer { savingBrokerId = nil }
        do {
            let response: UnlistedRemovalResponse = try await api.request(
                UnlistedEndpoints.setRemovalStatus(homeId: homeId, brokerId: brokerId, status: status)
            )
            // Same honesty check the read path applies. A status this
            // build cannot read is not progress we may render.
            let echoed = response.removal.status
            if echoed == .unknown {
                recentEdits[brokerId] = .unknown
                toast = ("Saved, but this app can't show that step yet — update to see it.", false)
            } else {
                recentEdits[brokerId] = .status(echoed)
                toast = ("Saved. Only you can see this.", false)
            }
        } catch let error as APIError {
            toast = (Self.saveFailureMessage(error), true)
        } catch {
            toast = ("Couldn't save that step.", true)
        }
    }

    /// What this row can claim. `.unknown` when the progress read failed
    /// and the person has not set this one since.
    func rowProgress(brokerId: String) -> RowProgress {
        if let edited = recentEdits[brokerId] { return edited }
        switch progress {
        case let .recorded(rows):
            guard let row = rows.first(where: { $0.brokerId == brokerId }) else {
                // Genuinely nothing recorded for this one yet.
                return .status(.todo)
            }
            // A status this build cannot read is not progress we may
            // render: showing no selection would look identical to a row
            // the person has never touched, quietly losing a step they
            // did take. Say we could not read it instead.
            return row.status == .unknown ? .unknown : .status(row.status)
        case .unavailable, .notApplicable:
            return .unknown
        }
    }

    /// True only when the server said the progress read FAILED — not
    /// when there is simply nothing recorded yet.
    var isProgressUnavailable: Bool {
        progress == .unavailable
    }

    func clearToast() {
        toast = nil
    }

    static func saveFailureMessage(_ error: APIError) -> String {
        switch error {
        case .forbidden:
            "You don't have access to this place any more, so nothing was saved."
        case let .clientError(_, message):
            message ?? "That step couldn't be saved."
        default:
            error.errorDescription ?? "That step couldn't be saved."
        }
    }
}

// MARK: - Section

struct PlaceUnlistedSection: View {
    let vm: PlaceUnlistedViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            switch vm.state {
            case .loading:
                PlaceDetailCard {
                    PlaceSkeleton(widthFraction: 1, height: 96, radius: Radii.lg)
                }
                PlaceDetailCard {
                    PlaceSkeleton(widthFraction: 1, height: 64, radius: Radii.lg)
                }
            case let .error(message):
                errorCard(message)
            case let .loaded(profile):
                // 1. The escape hatch leads — always above the list.
                UnlistedStateProgramCard(answer: profile.stateProgramAnswer, stateCode: profile.state)
                // 2. The honesty line, next to the list it qualifies.
                UnlistedMethodNoteCard(profile: profile)
                if vm.isProgressUnavailable {
                    UnlistedProgressUnavailableCard(vm: vm)
                } else {
                    // How far through the list this person actually is.
                    // Android has told them since Wave 4; iOS said
                    // nothing, so the same account got a progress summary
                    // on one phone and a bare list on the other.
                    UnlistedProgressLine(profile: profile, vm: vm)
                }
                ForEach(profile.groups) { group in
                    UnlistedGroupCard(group: group, profile: profile, vm: vm)
                }
                UnlistedFooterNote()
            }
            if let toast = vm.toast {
                Text(toast.message)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(toast.isError ? Theme.Color.error : Theme.Color.success)
                    .accessibilityIdentifier("place.unlisted.toast")
                    .task {
                        try? await Task.sleep(for: .seconds(3))
                        vm.clearToast()
                    }
            }
        }
        .accessibilityIdentifier("place.unlisted")
    }

    private func errorCard(_ message: String) -> some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Couldn't load your removal list")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(message)
                    .font(.system(size: 13))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Button {
                    Task { await vm.refresh() }
                } label: {
                    Text("Try again")
                        .font(.system(size: 13, weight: .semibold))
                }
                .buttonStyle(.plain)
                .foregroundStyle(Theme.Color.primary600)
                .accessibilityIdentifier("place.unlisted.retry")
            }
        }
        .accessibilityIdentifier("place.unlisted.error")
    }
}

// MARK: - The state program (leads)

private struct UnlistedStateProgramCard: View {
    let answer: UnlistedStateProgramAnswer
    let stateCode: String?

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 11) {
                    PlaceIconTile(icon: icon, tone: tone, size: 34)
                    Text(headline)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: 0)
                }
                Text(explainer)
                    .font(.system(size: 13))
                    .lineSpacing(2.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                switch answer {
                case let .program(program):
                    if !program.eligibility.isEmpty {
                        eligibilityBlock(program.eligibility, title: "Who qualifies")
                    }
                    if let url = program.programURL {
                        linkRow("Open the official program page", url: url, id: "official")
                    }
                    if let source = program.sourceURL, source != program.programURL {
                        linkRow("What we checked this against", url: source, id: "source")
                    }
                    verifiedStamp(program.verifiedAt)
                case let .noProgram(program):
                    if !program.eligibility.isEmpty {
                        eligibilityBlock(program.eligibility, title: "What this state does offer")
                    }
                    if let source = program.sourceURL {
                        linkRow("What we checked this against", url: source, id: "source")
                    }
                    verifiedStamp(program.verifiedAt)
                case .unconfirmed:
                    Text(
                        "Search for “address confidentiality program” plus your state, "
                            + "or ask a local victim-services organisation — many states run one."
                    )
                    .font(.system(size: 12.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        }
        .accessibilityIdentifier("place.unlisted.stateProgram.\(identifierSuffix)")
    }

    // The three answers are three different claims. Only one of them is
    // "this state has none", and it is only ever made when we checked.
    private var headline: String {
        switch answer {
        case let .program(program):
            program.name.isEmpty ? "Your state has an address confidentiality program" : program.name
        case .noProgram:
            "\(stateName) does not run an address confidentiality program"
        case .unconfirmed:
            "We have not confirmed a program for your state"
        }
    }

    private var explainer: String {
        switch answer {
        case .program:
            "A legal substitute address you can use on public records, so the real one stays out of them "
                + "at the source instead of being chased across every site below."
        case .noProgram:
            // Not "we checked with the state": some no-program answers rest
            // on a national program-operator directory rather than a page
            // the state itself publishes. The source link says which.
            "We checked the published program sources and there is no substitute-address program "
                + "to apply to. The removals below are the route that is open to you."
        case .unconfirmed:
            "We could not confirm one for your state — that is a gap in what we have verified, "
                + "not a finding that no program exists. Most US states run one."
        }
    }

    private var icon: PantopusIcon {
        switch answer {
        case .program: .shieldCheck
        case .noProgram: .info
        case .unconfirmed: .helpCircle
        }
    }

    private var tone: PlaceIconTile.Tone {
        switch answer {
        case .program: .home
        case .noProgram, .unconfirmed: .muted
        }
    }

    private var identifierSuffix: String {
        switch answer {
        case .program: "available"
        case .noProgram: "absent"
        case .unconfirmed: "unconfirmed"
        }
    }

    private var stateName: String {
        guard let stateCode, !stateCode.isEmpty else { return "This state" }
        return stateCode
    }

    private func eligibilityBlock(_ text: String, title: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.system(size: 11.5, weight: .bold))
                .kerning(0.5)
                .foregroundStyle(Theme.Color.appTextMuted)
            Text(text)
                .font(.system(size: 12.5))
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(11)
        .background(Theme.Color.appSurfaceSunken, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func linkRow(_ title: String, url: URL, id: String) -> some View {
        Link(destination: url) {
            HStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                Icon(.externalLink, size: 13, strokeWidth: 2, color: Theme.Color.primary600)
            }
            .foregroundStyle(Theme.Color.primary600)
        }
        .accessibilityIdentifier("place.unlisted.stateProgram.link.\(id)")
    }

    @ViewBuilder
    private func verifiedStamp(_ isoDay: String?) -> some View {
        if let day = unlistedFormatDay(isoDay) {
            Text("Checked \(day)")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }
}

// MARK: - The honesty line (rendered verbatim)

private struct UnlistedMethodNoteCard: View {
    let profile: UnlistedExposureProfile

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack(spacing: Spacing.s2) {
                    // Describes the SITES, not the person. "Where your
                    // address gets republished" would assert that it is
                    // republished on these — a scan we deliberately never
                    // ran and therefore a claim we cannot make.
                    Text("Sites that republish county records")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: 0)
                    if profile.brokerCount > 0 {
                        PlaceChip(model: PlaceChipModel(tone: .neutral, text: "\(profile.brokerCount) sites"))
                    }
                }
                // Verbatim, never paraphrased: without it this list
                // implies a scan we did not run.
                if !profile.methodNote.isEmpty {
                    Text(profile.methodNote)
                        .font(.system(size: 12.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .accessibilityIdentifier("place.unlisted.methodNote")
                }
                if let day = unlistedFormatDay(profile.registryVerifiedAt) {
                    Text("Opt-out paths last checked \(day)")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        }
    }
}

// MARK: - Footer

private struct UnlistedFooterNote: View {
    var body: some View {
        Text(
            "Every removal happens on the site's own page — Pantopus does not submit anything for you, "
                + "and only records the steps you tell us about. What you mark here is visible to you alone."
        )
        .font(.system(size: 11.5))
        .lineSpacing(2)
        .foregroundStyle(Theme.Color.appTextMuted)
        .padding(.horizontal, Spacing.s1)
        .padding(.top, Spacing.s1)
        .accessibilityIdentifier("place.unlisted.footer")
    }
}

// MARK: - Dates

/// "Aug 27, 2026" from a bare calendar day ("2026-08-27"), the shape
/// `verified_at` arrives in. Anchored to UTC on the way in AND out:
/// routing a bare day through a US-local zone renders the previous day.
/// Returns nil rather than inventing a stamp we cannot parse.
func unlistedFormatDay(_ isoDay: String?) -> String? {
    guard let raw = isoDay?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else { return nil }
    let parse = DateFormatter()
    parse.locale = Locale(identifier: "en_US_POSIX")
    parse.timeZone = TimeZone(identifier: "UTC")
    parse.dateFormat = "yyyy-MM-dd"
    guard let date = parse.date(from: String(raw.prefix(10))) else { return nil }
    let out = DateFormatter()
    out.locale = Locale(identifier: "en_US_POSIX")
    out.timeZone = TimeZone(identifier: "UTC")
    out.dateFormat = "MMM d, yyyy"
    return out.string(from: date)
}
