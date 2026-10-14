//
//  PlanRequestsScreen.swift
//  Pantopus
//
//  Board H10 "Requests": spots filled, the "people you've hosted" switch,
//  each request (first name, verified badge, distance band, plans joined,
//  mutual connections, party, hello) with Decline and Accept, and the
//  waitlist. At home, accepting shares the address; the screen says so and
//  the first accept asks once (`confirm_shares_address`).
//

import SwiftUI

@Observable
@MainActor
final class PlanRequestsViewModel {
    let planId: String
    private(set) var plan: PlanDetailDTO?
    private(set) var requests: PlanRequestsResponse?
    private(set) var loadFailed = false
    private(set) var working: Set<String> = []
    var error: String?
    /// "Accepted. They're in." after an answer (as Android's toast).
    var toast: String?
    private let api: APIClient

    init(planId: String, api: APIClient = .shared) {
        self.planId = planId
        self.api = api
    }

    var isAtHome: Bool {
        plan?.card.placeKind == .home
    }

    func load() async {
        async let detail = try? PlansStoreReads.detail(id: planId)
        async let list = try? PlansStoreReads.requests(planId: planId)
        let (loadedPlan, loadedRequests) = await (detail, list)
        if let loadedPlan { plan = loadedPlan }
        if let loadedRequests { requests = loadedRequests }
        loadFailed = loadedRequests == nil && requests == nil
    }

    func accept(_ request: PlanRequestViewDTO, confirmedSharing: Bool) async {
        let accepted = await act(request.id) {
            _ = try await api.request(
                PlansEndpoints.accept(planId: planId, requestId: request.id, confirmSharesAddress: isAtHome ? confirmedSharing : nil),
                as: EmptyResponse.self
            )
        }
        if accepted { toast = "Accepted. They're in." }
    }

    func decline(_ request: PlanRequestViewDTO) async {
        let declined = await act(request.id) {
            _ = try await api.request(PlansEndpoints.decline(planId: planId, requestId: request.id), as: EmptyResponse.self)
        }
        if declined { toast = "Declined. They won't see who said no." }
    }

    /// "Let in people you've hosted".
    func setHostedBefore(_ isOn: Bool) async {
        var rules = Set(plan?.autoRules ?? [])
        if isOn { rules.insert(.hostedBefore) } else { rules.remove(.hostedBefore) }
        var body = UpdatePlanBody()
        body.autoRules = PlanAutoRule.allCases.filter(rules.contains)
        await act("rules") {
            plan = try await api.request(PlansEndpoints.update(id: planId, body))
        }
    }

    @discardableResult
    private func act(_ key: String, _ work: () async throws -> Void) async -> Bool {
        working.insert(key)
        error = nil
        defer { working.remove(key) }
        do {
            try await work()
            PlansStoreReads.changed(planId: planId)
            await load()
            return true
        } catch {
            // Android's words for the two answers the server can refuse.
            if case let APIError.clientError(status, body) = error, status == 409, PlanErrors.code(in: body) == "full" {
                self.error = "Their party doesn't fit the spots left. Make room first, or decline."
            } else if case let APIError.clientError(_, body) = error, PlanErrors.code(in: body) == "not_waiting" {
                self.error = "They're no longer waiting."
            } else {
                self.error = PlanErrors.sentence(for: error)
            }
            return false
        }
    }
}

struct PlanRequestsScreen: View {
    @State private var viewModel: PlanRequestsViewModel
    let onBack: () -> Void
    @State private var pendingAccept: PlanRequestViewDTO?

    init(planId: String, onBack: @escaping () -> Void) {
        _viewModel = State(initialValue: PlanRequestsViewModel(planId: planId))
        self.onBack = onBack
    }

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: "Requests", leading: .back, onLeading: onBack)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    if let card = viewModel.plan?.card { summary(card) }
                    if let plan = viewModel.plan, plan.card.kind != .playdate { hostedSwitch(plan) }
                    if let error = viewModel.error {
                        Text(error).planFont(.small).foregroundStyle(Theme.Color.error).fixedSize(horizontal: false, vertical: true)
                    }
                    requestList
                    if viewModel.isAtHome {
                        PlanScopeLine(
                            text: "This plan is at your place. Accepting someone shares your address with them. "
                                + "Declining needs no reason, and they won't see who said no.",
                            icon: .home
                        )
                    } else {
                        PlanScopeLine(text: "Declining needs no reason, and they won't see who said no.")
                    }
                    waitlist
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s1)
                .padding(.bottom, Spacing.s6)
            }
            .refreshable { await viewModel.load() }
        }
        .background(Theme.Color.appBg)
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: ToastMessage(text: toast))
                    .padding(.bottom, Spacing.s8)
                    .task(id: toast) {
                        try? await Task.sleep(for: .seconds(2.5))
                        viewModel.toast = nil
                    }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            if let notice = PlansNavigator.shared.notice {
                PlansNavigator.shared.notice = nil
                viewModel.error = notice
            }
            await viewModel.load()
        }
        .refreshesOnStoreChange(affects: { PlansStoreReads.affects($0) }, perform: { await viewModel.load() })
        .alert(
            // The brief's words (section 6), as on Android.
            "Accepting shares your address with them",
            isPresented: Binding(get: { pendingAccept != nil }, set: { if !$0 { pendingAccept = nil } }),
            presenting: pendingAccept
        ) { request in
            Button("Accept and share") {
                PlanHomeSharing.markConfirmed(viewModel.planId)
                Task { await viewModel.accept(request, confirmedSharing: true) }
            }
            Button("Not now", role: .cancel) {}
        } message: { request in
            let first = PlanCardLines.firstName(request.user.displayName)
            Text("\(first) will see your address, your note and who's going. You'll be asked once for this plan.")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planRequests")
    }

    private func summary(_ card: PlanCardDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            // Board H10: "Seahawks game · Sun 1:25 PM".
            Text("\(card.details?.game.map { "\($0.label) game" } ?? card.title) · \(PlanScreenLines.shortWhen(card))")
                .planFont(.small)
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack {
                (Text("\(card.goingCount) of \(card.spots)").fontWeight(.semibold)
                    + Text(" spots filled").foregroundColor(Theme.Color.appTextSecondary))
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Text(card.isFull ? "Full" : "\(card.spotsLeft) left").planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
            }
            PlanSlotMeter(spots: card.spots, filled: card.goingCount)
        }
        .accessibilityElement(children: .combine)
    }

    private func hostedSwitch(_ plan: PlanDetailDTO) -> some View {
        let isOn = plan.autoRules?.contains(.hostedBefore) ?? false
        return Toggle(isOn: Binding(get: { isOn }, set: { new in Task { await viewModel.setHostedBefore(new) } })) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Let in people you've hosted").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                Text("They get in right away, until the spots fill").planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .tint(Theme.Color.successSolid)
        .disabled(viewModel.working.contains("rules"))
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityIdentifier("planHostedBeforeSwitch")
    }

    @ViewBuilder private var requestList: some View {
        if let pending = viewModel.requests?.pending {
            if pending.isEmpty {
                Text("No requests right now. We'll tell you when someone asks.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            ForEach(pending) { request in
                PlanRequestCard(
                    request: request,
                    kind: viewModel.plan?.card.kind ?? .watchParty,
                    isWorking: viewModel.working.contains(request.id),
                    onDecline: { Task { await viewModel.decline(request) } },
                    onAccept: { accept(request) }
                )
            }
        } else if viewModel.loadFailed {
            Button("Try again") { Task { await viewModel.load() } }.planButton(.secondary, size: .small)
        } else {
            Shimmer(width: nil, height: 140, cornerRadius: Radii.xl2)
        }
    }

    @ViewBuilder private var waitlist: some View {
        let waiting = viewModel.requests?.waitlisted ?? []
        if waiting.isEmpty {
            Text("Waitlist: nobody yet").planFont(.caption).foregroundStyle(Theme.Color.appTextSecondary)
        } else {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text.planOverline("Waitlist")
                ForEach(waiting) { request in
                    PlanRequestCard(
                        request: request,
                        kind: viewModel.plan?.card.kind ?? .watchParty,
                        isWorking: viewModel.working.contains(request.id),
                        onDecline: { Task { await viewModel.decline(request) } },
                        onAccept: { accept(request) }
                    )
                }
            }
        }
    }

    private func accept(_ request: PlanRequestViewDTO) {
        if viewModel.isAtHome, !PlanHomeSharing.isConfirmed(viewModel.planId) {
            pendingAccept = request
        } else {
            Task { await viewModel.accept(request, confirmedSharing: true) }
        }
    }
}

/// One request: who, how far, their party and hello, Decline and Accept.
struct PlanRequestCard: View {
    let request: PlanRequestViewDTO
    let kind: PlanKind
    let isWorking: Bool
    let onDecline: () -> Void
    let onAccept: () -> Void

    var body: some View {
        PlanCardBox(padding: Spacing.s4) {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                HStack(spacing: Spacing.s3) {
                    PlanAvatar(name: request.user.displayName, url: request.user.avatarUrl)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: Spacing.s2) {
                            Text(request.user.displayName).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                            if request.user.verifiedAddress { PlanVerifiedLabel(text: "Verified") }
                        }
                        Text(facts)
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    // The word carries the state (board P2); VoiceOver hears just the word.
                    StatusChip(party, variant: .neutral).accessibilityLabel(party)
                }
                .accessibilityElement(children: .combine)
                if let note = request.note, !note.isEmpty {
                    Text("\u{201C}\(note)\u{201D}")
                        .planFont(.body)
                        .italic()
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: 10) {
                    Button("Decline", action: onDecline)
                        .planButton(.secondary, size: .small)
                        .accessibilityLabel("Decline \(PlanCardLines.firstName(request.user.displayName))")
                    Button(action: onAccept) {
                        PlanButtonLabel(title: "Accept", kind: .primary, isLoading: isWorking)
                    }
                    .planButton(.primary, size: .small)
                    .accessibilityLabel("Accept \(PlanCardLines.firstName(request.user.displayName))")
                    .accessibilityIdentifier("planAccept.\(request.id)")
                }
                .disabled(isWorking)
            }
        }
    }

    /// "About 1 mi away · joined 2 plans · 1 mutual connection".
    private var facts: String {
        var parts: [String] = []
        if let distance = PlanFormat.distance(request.user.distanceBand) {
            parts.append(distance.prefix(1).uppercased() + distance.dropFirst() + " away")
        }
        if request.user.hostedBefore { parts.append("you hosted them before") }
        if let joined = request.user.plansJoined, joined > 0 {
            parts.append("joined \(joined) plan\(joined == 1 ? "" : "s")")
        }
        if let mutual = request.user.mutualConnections, mutual > 0 {
            parts.append("\(mutual) mutual connection\(mutual == 1 ? "" : "s")")
        }
        // Only when nothing else speaks for them (as on Android).
        if (request.user.plansJoined ?? 0) == 0, (request.user.mutualConnections ?? 0) == 0, !request.user.hostedBefore {
            parts.append("new to Pantopus")
        }
        return parts.joined(separator: " · ")
    }

    /// "Just Priya", "Priya + 1" (as the host's push says it); for a playdate "2 kids · ages 2–5".
    private var party: String {
        if kind == .playdate {
            let kids = request.kidsCount ?? 1
            let ages = PlanRowModel.ages(request.kidsAgeBands).map { " · \($0)" } ?? ""
            return "\(kids) kid\(kids == 1 ? "" : "s")\(ages)"
        }
        let name = PlanCardLines.firstName(request.user.displayName)
        return request.partySize <= 1 ? "Just \(name)" : "\(name) + \(request.partySize - 1)"
    }
}

/// Whether the host already agreed, for this plan at home, that accepting shares the address.
@MainActor
enum PlanHomeSharing {
    static func isConfirmed(_ planId: String) -> Bool {
        UserDefaults.standard.bool(forKey: key(planId))
    }

    static func markConfirmed(_ planId: String) {
        UserDefaults.standard.set(true, forKey: key(planId))
    }

    private static func key(_ planId: String) -> String {
        "pantopus.plans.shareConfirmed.\(ScreenStore.accountKey).\(planId.lowercased())"
    }
}
