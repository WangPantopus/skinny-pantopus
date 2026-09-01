// swiftlint:disable file_length
//
//  SchedulingOnboardingScreen.swift
//  Pantopus
//
//  A6 Scheduling Onboarding — picks Home (green, 3 steps) or Business (violet, 4
//  steps) by owner, wrapping `WizardShell` with the matching identity. Home:
//  member multi-select · collective/round-robin mode picker (+ rule) · success.
//  Business: handle claim · service tile picker (+ duration/price) · team
//  seating · auto-confirm vs approve · success. Reuses the WizardStepViews
//  pieces. Matches `onboarding-home-frames.jsx` / `onboarding-business-frames.jsx`.
//

import SwiftUI
import UIKit

struct SchedulingOnboardingScreen: View {
    @State private var model: SchedulingOnboardingModel
    @Environment(\.dismiss) private var dismiss

    init(owner: SchedulingOwner, push: @escaping @MainActor (SchedulingRoute) -> Void) {
        _model = State(wrappedValue: SchedulingOnboardingModel(owner: owner, push: push))
    }

    var body: some View {
        WizardShell(model: model, identity: model.identity) {
            content
        }
        .navigationBarBackButtonHidden(true)
        .onChange(of: model.isFinished) { _, finished in
            if finished { dismiss() }
        }
        .sheet(item: shareBinding) { item in
            OnboardingShareSheet(items: [item.url])
        }
    }

    private var shareBinding: Binding<ShareItem?> {
        Binding(
            get: { model.pendingShareURL.map(ShareItem.init) },
            set: { newValue in
                if newValue == nil {
                    model.pendingShareURL = nil
                    model.finishAfterShare()
                }
            }
        )
    }

    @ViewBuilder
    private var content: some View {
        if model.isSuccess {
            successBody
        } else {
            if model.stepIndex == 1 {
                OnboardingPillarChip(identity: model.identity, label: model.flow == .home ? "Home" : "Business")
            }
            WizardStepRail(steps: model.steps, current: model.displayStep, accent: model.accent, accentBg: model.accentBg)
            if model.flow == .home { homeStep } else { businessStep }
            if let submitError = model.submitError {
                submitErrorNote(submitError)
            }
        }
    }

    /// Inline finish failure above the wizard footer — the user stays on the
    /// last input step with their entries intact and can retry the CTA.
    private func submitErrorNote(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 9) {
            Icon(.alertTriangle, size: 16, color: Theme.Color.error).padding(.top, 1)
            Text(message)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.error)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 11)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("onboardingSubmitError")
    }

    // MARK: Home steps

    @ViewBuilder
    private var homeStep: some View {
        switch model.stepIndex {
        case 1:
            WizardHeadline(
                title: "Choose who's scheduled",
                sub: "Pick the household members people can book. Family scheduling uses everyone's own hours — no one sets times twice."
            )
            OnboardingMemberList(model: model)
        case 2:
            WizardHeadline(title: "How should times combine?", sub: combineSub)
            OnboardingModePicker(model: model)
            if model.combineMode == "round_robin" {
                OnboardingRoundRobinRule(model: model)
            }
            ComposedAvailabilityNote(
                identity: model.identity,
                message: "Times come from each member's personal availability — you're not setting hours twice.",
                timezone: model.timezoneIdentifier
            )
        default:
            EmptyView()
        }
    }

    /// Design has two distinct step-2 subcopies (`onboarding-home-frames.jsx`
    /// HomeCollective / HomeRoundRobin), with the live member count
    /// interpolated in the collective case. Mirrors Android's
    /// `OnboardingHomeBusinessScreen` branch.
    private var combineSub: String {
        if model.combineMode == "round_robin" {
            return "Whoever's free gets the booking. Pick a rule for who hosts when more than one person is open."
        }
        let count = model.selectedMembers.count
        let memberWord = count == 1 ? "Member is" : "\(count) members are"
        return "\(memberWord) scheduled. Choose how their availability turns into one set of bookable times."
    }

    // MARK: Business steps

    @ViewBuilder
    private var businessStep: some View {
        switch model.stepIndex {
        case 1:
            WizardHeadline(
                title: "Claim your business link",
                sub: "This is where clients book you. Pick something short — your business name usually works best."
            )
            WizardHandleField(
                slug: $model.slug,
                state: model.slugState,
                accent: model.accent,
                accentBg: model.accentBg,
                overline: "Your business link",
                availableHint: "Clients will book your business here."
            ) { model.pickSuggestion($0) }
        case 2:
            WizardHeadline(
                title: "Add your first service",
                sub: "Clients pick a service when they book. Start with one — you can add more from settings."
            )
            OnboardingServicePicker(model: model)
        case 3:
            WizardHeadline(
                title: "Seat your team",
                sub: "Seated teammates can take bookings. Front-desk roles manage the calendar without being booked."
            )
            OnboardingTeamList(model: model)
            ComposedAvailabilityNote(
                identity: model.identity,
                message: "Booking times come from each seated teammate's personal availability — no one re-enters their hours.",
                timezone: model.timezoneIdentifier
            )
        case 4:
            WizardHeadline(
                title: "Auto-confirm or approve?",
                sub: "Decide what happens when a client picks a time. You can change this any time."
            )
            OnboardingConfirmMode(model: model)
            if model.confirmMode == "approve" {
                OnboardingApproveExplainer(identity: model.identity)
            }
        default:
            EmptyView()
        }
    }

    // MARK: Success

    private var successBody: some View {
        // Design BizSuccess (and the Home success frame) keep the StepRail —
        // all steps done — above the success hero. The design passes `done`
        // including the current step (`done={[1,2,3,4]}`), so every disc
        // renders the check glyph; `allComplete` mirrors that.
        VStack(spacing: Spacing.s5) {
            WizardStepRail(
                steps: model.steps,
                current: model.displayStep,
                accent: model.accent,
                accentBg: model.accentBg,
                allComplete: true
            )
            WizardSuccessHero(
                accent: model.accent,
                accentBg: model.accentBg,
                shadow: model.identity.ctaShadow,
                title: model.flow == .home ? "Your family link is live" : "Your business is taking bookings",
                sub: model.flow == .home
                    ? "Share it and people can book any free member during their own hours. Bookings show up on the family schedule."
                    : {
                        let confirmSuffix = model.confirmMode == "approve"
                            ? "You approve each booking before it's confirmed."
                            : "Bookings confirm automatically."
                        return "Your link is live with your first service and seated team. \(confirmSuffix)"
                    }(),
                link: model.shareLink
            ) { UIPasteboard.general.string = "https://\(model.shareLink)" }
        }
    }
}

// MARK: - Pillar chip

struct OnboardingPillarChip: View {
    let identity: WizardIdentity
    let label: String

    var body: some View {
        HStack(spacing: 5) {
            Icon(icon, size: 11, strokeWidth: 2.4, color: identity.accent)
            Text(label.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(identity.accent)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s1)
        .background(identity.accentBg)
        .clipShape(Capsule())
    }

    private var icon: PantopusIcon {
        identity == .home ? .home : .briefcase
    }
}

// MARK: - Composed-availability note (onboarding)

struct ComposedAvailabilityNote: View {
    let identity: WizardIdentity
    let message: String
    let timezone: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(identity.accent)
                    Icon(.calendarClock, size: 15, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                }
                .frame(width: 30, height: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Availability is composed automatically")
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(identity.accent)
                    Text(message)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .lineSpacing(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Spacing.s0)
            }
            HStack(spacing: Spacing.s2) {
                Icon(.globe, size: 14, color: identity.accent)
                Text("Everyone's set to \(timezone)")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: Spacing.s2)
                HStack(spacing: Spacing.s1) {
                    Icon(.check, size: 10, strokeWidth: 3, color: Theme.Color.appTextInverse)
                    Text("CONFIRMED")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.4)
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 3)
                .background(Theme.Color.success)
                .clipShape(Capsule())
            }
            .padding(.horizontal, 10)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).stroke(identity.accentBg, lineWidth: 1))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .background(identity.accentBg.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(identity.accentBg, lineWidth: 1))
    }
}

// MARK: - Home: member list

private struct OnboardingMemberList: View {
    @Bindable var model: SchedulingOnboardingModel

    private struct Member: Identifiable { let id: String
        let name: String
        let rel: String
    }

    private let members: [Member] = [
        Member(id: "you", name: "You", rel: "Verified · household admin"),
        Member(id: "m2", name: "David K.", rel: "Verified household member"),
        Member(id: "m3", name: "Lena K.", rel: "Verified household member")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            WizardOverline(text: "Household members")
            VStack(spacing: Spacing.s0) {
                ForEach(Array(members.enumerated()), id: \.element.id) { idx, m in
                    memberRow(m)
                    if idx < members.count { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
                }
                inviteRow
            }
            .setupCard(radius: Radii.lg, shadow: .sm)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func memberRow(_ m: Member) -> some View {
        let on = model.selectedMembers.contains(m.id)
        let tone = SchedulingHubModel.avatarTone(for: m.name)
        return HStack(spacing: Spacing.s3) {
            Text(setupInitials(m.name))
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(tone.fg)
                .frame(width: 40, height: 40)
                .background(tone.bg)
                .clipShape(Circle())
                .overlay(alignment: .bottomTrailing) {
                    if on { memberVerifiedBadge.offset(x: 2, y: 2) }
                }
            VStack(alignment: .leading, spacing: 1) {
                Text(m.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(m.rel)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s2)
            Button { model.toggleMember(m.id) } label: { SetupMiniToggle(isOn: on, accent: model.accent) }
                .accessibilityIdentifier("onboardingMember_\(m.id)")
                .accessibilityLabel(m.name)
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 11)
    }

    /// Green verified/selected check badge on a selected member's avatar.
    private var memberVerifiedBadge: some View {
        ZStack {
            Circle().fill(Theme.Color.success)
            Icon(.check, size: 9, strokeWidth: 3.5, color: Theme.Color.appTextInverse)
        }
        .frame(width: 16, height: 16)
        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
    }

    private var inviteRow: some View {
        Button {} label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    Circle().fill(model.accentBg)
                    Icon(.userPlus, size: 17, color: model.accent)
                }
                .frame(width: 40, height: 40)
                .overlay(Circle().stroke(style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])).foregroundStyle(model.accentBg))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Invite someone")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(model.accent)
                    Text("Add a family member by phone or email")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("onboardingInviteMember")
    }
}

// MARK: - Home: mode picker

private struct OnboardingModePicker: View {
    @Bindable var model: SchedulingOnboardingModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            WizardOverline(text: "How times combine")
            HStack(spacing: 10) {
                tile(mode: "collective", title: "Collective", line: "Everyone must be free. Times are the overlap of all selected members.")
                tile(
                    mode: "round_robin",
                    title: "Round-robin",
                    line: "Whoever's free gets the booking. Times are the union, assigned by a rule."
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func tile(mode: String, title: String, line: String) -> some View {
        let active = model.combineMode == mode
        return Button { model.combineMode = mode } label: {
            VStack(alignment: .leading, spacing: 9) {
                HStack {
                    Icon(
                        mode == "collective" ? .users : .arrowsRepeat,
                        size: 22,
                        strokeWidth: 2,
                        color: active ? model.accent : Theme.Color.appTextMuted
                    )
                    Spacer()
                    ZStack {
                        Circle().fill(active ? model.accent : Color.clear)
                        if active { Icon(.check, size: 11, strokeWidth: 3, color: Theme.Color.appTextInverse) }
                    }
                    .frame(width: 18, height: 18)
                    .overlay(Circle().stroke(active ? model.accent : Theme.Color.appBorderStrong, lineWidth: 1.5))
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.system(size: 13.5, weight: .bold)).foregroundStyle(active ? model.accent : Theme.Color.appText)
                    Text(line).font(.system(size: 11.5)).foregroundStyle(Theme.Color.appTextSecondary).lineSpacing(2).fixedSize(
                        horizontal: false,
                        vertical: true
                    )
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(13)
            .background(active ? model.accentBg : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(
                active ? model.accent : Theme.Color.appBorder,
                lineWidth: 1.5
            ))
        }
        .accessibilityIdentifier("onboardingMode_\(mode)")
    }
}

// MARK: - Home: round-robin rule

private struct OnboardingRoundRobinRule: View {
    @Bindable var model: SchedulingOnboardingModel

    // swiftlint:disable:next large_tuple
    private let rules: [(String, String, PantopusIcon)] = [
        ("balanced", "Balanced — even out who hosts", .arrowDownUp),
        ("priority", "By priority order", .listChecks)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            WizardOverline(text: "Assignment rule")
            VStack(spacing: Spacing.s0) {
                ForEach(Array(rules.enumerated()), id: \.element.0) { idx, rule in
                    row(rule)
                    if idx < rules.count - 1 { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
                }
            }
            .setupCard(radius: Radii.lg, shadow: .sm)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // swiftlint:disable:next large_tuple
    private func row(_ rule: (String, String, PantopusIcon)) -> some View {
        let on = model.roundRobinRule == rule.0
        return Button { model.roundRobinRule = rule.0 } label: {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(on ? model.accentBg : Theme.Color.appSurfaceSunken)
                    Icon(rule.2, size: 14, strokeWidth: 2.2, color: on ? model.accent : Theme.Color.appTextSecondary)
                }
                .frame(width: 28, height: 28)
                Text(rule.1).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                ZStack {
                    Circle().fill(on ? model.accent : Color.clear)
                    if on { Circle().fill(Theme.Color.appTextInverse).frame(width: 7, height: 7) }
                }
                .frame(width: 18, height: 18)
                .overlay(Circle().stroke(on ? model.accent : Theme.Color.appBorderStrong, lineWidth: 1.5))
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("onboardingRule_\(rule.0)")
    }
}

// MARK: - Business: service picker

private struct OnboardingServicePicker: View {
    @Bindable var model: SchedulingOnboardingModel

    // swiftlint:disable:next large_tuple
    private let services: [(String, String, PantopusIcon)] = [
        ("consultation", "Consultation", .messageSquare),
        ("quote", "Quote visit", .home),
        ("survey", "Site survey", .clipboardList),
        ("service_call", "Service call", .wrench)
    ]
    private let durations = [15, 30, 45, 60]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                WizardOverline(text: "Service type")
                VStack(spacing: Spacing.s2) {
                    ForEach(
                        stride(from: 0, to: services.count, by: 2).map { Array(services[$0..<min($0 + 2, services.count)]) },
                        id: \.first!.0
                    ) { pair in
                        HStack(spacing: Spacing.s2) {
                            ForEach(pair, id: \.0) { s in tile(s) }
                        }
                    }
                }
            }
            // Design Field shows Price ($120) beside Duration unconditionally.
            // The price input is always visible; the VM still gates whether the
            // entered amount is submitted as priceCents on `paidEnabled`.
            HStack(spacing: 10) {
                durationField
                priceField
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // swiftlint:disable:next large_tuple
    private func tile(_ s: (String, String, PantopusIcon)) -> some View {
        let active = model.serviceType == s.0
        return Button { model.serviceType = s.0 } label: {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(active ? model.accent : Theme.Color.appSurfaceSunken)
                    Icon(s.2, size: 15, strokeWidth: 2.2, color: active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                }
                .frame(width: 30, height: 30)
                Text(s.1)
                    .font(.system(size: 12.5, weight: active ? .bold : .semibold))
                    .foregroundStyle(active ? model.accent : Theme.Color.appText)
                    .lineLimit(1)
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 13)
            .background(active ? model.accentBg : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(
                active ? model.accent : Theme.Color.appBorder,
                lineWidth: 1.5
            ))
        }
        .accessibilityIdentifier("onboardingService_\(s.0)")
    }

    private var durationField: some View {
        VStack(alignment: .leading, spacing: 6) {
            WizardOverline(text: "Duration")
            Menu {
                ForEach(durations, id: \.self) { d in
                    Button("\(d) min") { model.duration = d }
                }
            } label: {
                HStack(spacing: 6) {
                    Text("\(model.duration) min").font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: Spacing.s0)
                    Icon(.chevronDown, size: 14, color: Theme.Color.appTextMuted)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, 10)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            .accessibilityIdentifier("onboardingDuration")
        }
        .frame(maxWidth: .infinity)
    }

    private var priceField: some View {
        VStack(alignment: .leading, spacing: 6) {
            WizardOverline(text: "Price")
            HStack(spacing: 6) {
                Text("$")
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextField("0", text: $model.priceText)
                    .font(.system(size: 13.5, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Theme.Color.appText)
                    .keyboardType(.numberPad)
                    .accessibilityIdentifier("onboardingPrice")
                Icon(.pencil, size: 14, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Business: team seating

private struct OnboardingTeamList: View {
    @Bindable var model: SchedulingOnboardingModel

    private struct Teammate: Identifiable { let id: String
        let name: String
        let role: String
    }

    /// Design TeamList (onboarding-business-frames.jsx) seats 4 teammates — the
    /// 4th, Dana W. (Front desk · not seated), demonstrates the front-desk role
    /// the step subcopy references.
    private let team: [Teammate] = [
        Teammate(id: "owner", name: "You", role: "Owner"),
        Teammate(id: "t2", name: "Priya N.", role: "Stylist"),
        Teammate(id: "t3", name: "Marcus L.", role: "Stylist"),
        Teammate(id: "t4", name: "Dana W.", role: "Front desk")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .firstTextBaseline) {
                WizardOverline(text: "Team seats")
                Spacer()
                // Design counter reads "3 of 5 seats used" — surface the plan
                // capacity, not just the live seated count.
                Text("\(model.seatedTeam.count) of 5 seats used")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(model.accent)
                    .monospacedDigit()
            }
            VStack(spacing: Spacing.s0) {
                ForEach(Array(team.enumerated()), id: \.element.id) { idx, m in
                    row(m)
                    if idx < team.count { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
                }
                inviteRow
            }
            .setupCard(radius: Radii.lg, shadow: .sm)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func row(_ m: Teammate) -> some View {
        let on = model.seatedTeam.contains(m.id)
        let tone = SchedulingHubModel.avatarTone(for: m.name)
        let owner = m.role == "Owner"
        return HStack(spacing: Spacing.s3) {
            Text(setupInitials(m.name))
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(tone.fg)
                .frame(width: 40, height: 40)
                .background(tone.bg)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 7) {
                    Text(m.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(m.role.uppercased())
                        .font(.system(size: 9.5, weight: .bold))
                        .tracking(0.4)
                        .foregroundStyle(owner ? model.accent : Theme.Color.appTextStrong)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(owner ? model.accentBg : Theme.Color.appSurfaceSunken)
                        .clipShape(Capsule())
                }
                Text(on ? "Seated · bookable" : "Not seated")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Button { model.toggleSeat(m.id) } label: { SetupMiniToggle(isOn: on, accent: model.accent) }
                .accessibilityIdentifier("onboardingSeat_\(m.id)")
                .accessibilityLabel(m.name)
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 11)
    }

    private var inviteRow: some View {
        Button {} label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    Circle().fill(model.accentBg)
                    Icon(.userPlus, size: 17, color: model.accent)
                }
                .frame(width: 40, height: 40)
                .overlay(Circle().stroke(style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])).foregroundStyle(model.accentBg))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Invite teammate")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(model.accent)
                    Text("2 seats left on your plan")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("onboardingInviteTeammate")
    }
}

// MARK: - Business: confirm mode

private struct OnboardingConfirmMode: View {
    @Bindable var model: SchedulingOnboardingModel

    // swiftlint:disable:next large_tuple
    private let opts: [(String, String, PantopusIcon)] = [
        ("auto", "Auto-confirm bookings", .zap),
        ("approve", "I approve each one", .userCheck)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            WizardOverline(text: "How bookings get confirmed")
            HStack(spacing: Spacing.s1) {
                ForEach(opts, id: \.0) { opt in segment(opt) }
            }
            .padding(Spacing.s1)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // swiftlint:disable:next large_tuple
    private func segment(_ opt: (String, String, PantopusIcon)) -> some View {
        let active = model.confirmMode == opt.0
        return Button { model.confirmMode = opt.0 } label: {
            HStack(spacing: 6) {
                Icon(opt.2, size: 14, color: active ? model.accent : Theme.Color.appTextSecondary)
                Text(opt.1)
                    .font(.system(size: 12.5, weight: active ? .bold : .semibold))
                    .foregroundStyle(active ? model.accent : Theme.Color.appTextSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(active ? Theme.Color.appSurface : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            .overlay(active ? RoundedRectangle(cornerRadius: 9, style: .continuous).stroke(model.accent, lineWidth: 1.5) : nil)
            .pantopusShadow(active ? .sm : .init(color: .clear, opacity: 0, radius: 0, x: 0, y: 0))
        }
        .accessibilityIdentifier("onboardingConfirm_\(opt.0)")
    }
}

private struct OnboardingApproveExplainer: View {
    let identity: WizardIdentity

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(identity.accent)
                Icon(.userCheck, size: 15, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text("You approve each booking")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(identity.accent)
                Text("Requests land in your queue. The slot is held for 24 hours and the client is notified once you confirm.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .background(identity.accentBg.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(identity.accentBg, lineWidth: 1))
    }
}

// MARK: - Share sheet plumbing

private struct ShareItem: Identifiable {
    let url: URL
    var id: String {
        url.absoluteString
    }
}

private struct OnboardingShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context _: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_: UIActivityViewController, context _: Context) {}
}
