//
//  PlanOutcomeScreens.swift
//  Pantopus
//
//  Board J8 "Didn't work out" (declined, removed or expired: no blame, other
//  plans this week, host your own), board J9 (a playdate link for someone
//  without a verified address), and board H12 "Cancel this plan?".
//

import SwiftUI

// MARK: - J8

struct PlanNotThisTimeScreen: View {
    let card: PlanCardDTO
    let status: PlanRequestStatus
    let otherPlans: [PlanCardDTO]
    let onBack: () -> Void
    let onOpen: (PlanCardDTO) -> Void
    let onSeeAll: () -> Void
    let onHost: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: "", leading: .back, onLeading: onBack)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        PlanTypeTag(kind: card.kind)
                        Text(card.title)
                            .planFont(.h2)
                            .foregroundStyle(Theme.Color.appText)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)
                        Text(subline)
                            .planFont(.small)
                            .monospacedDigit()
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    PlanBanner(
                        tone: .neutral,
                        icon: .info,
                        title: status == .removed ? "You're no longer on this plan" : "This one didn't work out",
                        message: reason
                    )
                    if !otherPlans.isEmpty {
                        VStack(alignment: .leading, spacing: 0) {
                            Text.planOverline("Other plans this week").padding(.bottom, 2)
                            ForEach(Array(otherPlans.enumerated()), id: \.element.id) { index, other in
                                PlanRow(model: .listed(other), showsDivider: index > 0) { onOpen(other) }
                            }
                        }
                    }
                    Button("See all plans", action: onSeeAll)
                        .planButton(.secondary)
                        .accessibilityIdentifier("planSeeAllPlans")
                    Button("Host your own \(card.kind.title.lowercased())", action: onHost)
                        .planButton(.text, size: .extraSmall)
                        .frame(maxWidth: .infinity)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s1)
                .padding(.bottom, Spacing.s6)
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("planNotThisTime")
    }

    /// "Sunday, Oct 18 · 1:25 PM · Sam R."
    private var subline: String {
        let calendar = PlanFormat.calendar(for: card.timezone)
        let when = card.startsAtDate.map {
            "\(PlanFormat.dayHeading($0, calendar: calendar)) · \(PlanFormat.time($0, calendar: calendar))"
        } ?? PlanFormat.dayPartPhrase(card.dayPart, day: card.startsOnDate, calendar: calendar)
        return "\(when) · \(card.host.displayName)"
    }

    /// No blame, and nothing about who said no.
    private var reason: String {
        let host = PlanCardLines.firstName(card.host.displayName)
        switch status {
        case .expired: return "It started before \(host) could answer."
        case .removed: return "\(host) made a change to who's coming."
        default: return "\(host) couldn't fit you this time."
        }
    }
}

// MARK: - J9

struct PlanVerifyScreen: View {
    let city: String?
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: "Shared with you", leading: .close, onLeading: onClose)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        PlanTypeTag(kind: .playdate)
                        Text(city.map { "A playdate near \($0)" } ?? "A playdate near you")
                            .planFont(.h2)
                            .foregroundStyle(Theme.Color.appText)
                            .accessibilityAddTraits(.isHeader)
                        Text("Someone shared this with you.")
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    PlanCardBox(padding: Spacing.s4) {
                        VStack(alignment: .leading, spacing: Spacing.s3) {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(Theme.Color.appSurfaceSunken)
                                .frame(width: 48, height: 48)
                                .overlay(Icon(.lock, size: 22, color: Theme.Color.appTextStrong))
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: Spacing.s1) {
                                Text("Playdates are for verified neighbors").planFont(.h4).foregroundStyle(Theme.Color.appText)
                                Text("Verify your address to see the time, the place and who's going, and to ask to join. "
                                    + "Everyone at a playdate has done the same.")
                                    .planFont(.small)
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            VStack(alignment: .leading, spacing: 6) {
                                check("A code arrives by mail in 3 to 7 days")
                                check("Your address stays private")
                                check("Watch parties, pickup games and walks are open now")
                            }
                        }
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s3)
            }
            VStack(spacing: Spacing.s2) {
                Button("Verify your address") { PlanVerification.open() }
                    .planButton(.primary)
                    .accessibilityIdentifier("planVerifyAddress")
                Button("See other plans", action: onClose)
                    .planButton(.text, size: .extraSmall)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .top) { Divider().overlay(Theme.Color.appBorder) }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("planVerify")
    }

    private func check(_ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            Icon(.check, size: 16, color: Theme.Color.success)
                .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 3 }
            Text(text)
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - H12

struct PlanCancelSheet: View {
    let viewModel: PlanScreenViewModel
    let onClose: () -> Void
    @State private var note = ""
    @State private var isCancelling = false
    @State private var contentHeight: CGFloat = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Cancel this plan?")
                        .planFont(.h3)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text(sentence)
                        .planFont(.body)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text.planOverline("Add a note · optional")
                    TextField("Sorry, something came up.", text: $note, axis: .vertical)
                        .accessibilityLabel("Add a note, optional")
                        .planFont(.body)
                        .lineLimit(2...4)
                        .padding(.horizontal, 14)
                        .padding(.vertical, Spacing.s3)
                        .background(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(Theme.Color.appSurface))
                        .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(
                            Theme.Color.appBorderStrong,
                            lineWidth: 1
                        ))
                        .accessibilityIdentifier("planCancelNote")
                }
                if let error = viewModel.actionError {
                    Text(error).planFont(.small).foregroundStyle(Theme.Color.error)
                }
                VStack(spacing: Spacing.s2) {
                    Button {
                        Task {
                            isCancelling = true
                            let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
                            let done = await viewModel.cancelPlan(note: trimmed.isEmpty ? nil : trimmed)
                            isCancelling = false
                            if done { onClose() }
                        }
                    } label: {
                        PlanButtonLabel(title: "Cancel plan", kind: .danger, isLoading: isCancelling)
                    }
                    .planButton(.danger)
                    .accessibilityIdentifier("planCancelConfirm")
                    Button("Keep plan", action: onClose)
                        .planButton(.secondary)
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("Removing one guest instead?").planFont(.smallStrong).foregroundStyle(Theme.Color.appText)
                    Text("Open their row on your plan. If the plan is at your place, they've already seen the address; "
                        + "they lose the plan, the note and the chat from then on.")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, Spacing.s3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.appSurfaceSunken))
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s5)
            .padding(.bottom, Spacing.s6)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
        }
        // Just tall enough (board H12); taller than the screen opens fully and scrolls.
        .presentationDetents(contentHeight > 0 ? [.height(contentHeight), .large] : [.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(26)
        // Opaque, as the boards draw the modal: the plan behind must not show through.
        .presentationBackground(Theme.Color.appSurface)
        .accessibilityIdentifier("planCancelSheet")
    }

    /// "We'll tell the 5 people who are in and the 2 who asked. The pin comes off the map and the chat closes."
    private var sentence: String {
        let going = (viewModel.plan?.people ?? []).filter { !$0.isHost }.count
        let asked = viewModel.card?.requestsCount ?? viewModel.hostRequests?.pending.count ?? 0
        var told: [String] = []
        if going > 0 { told.append(going == 1 ? "the 1 person who's in" : "the \(going) people who are in") }
        if asked > 0 { told.append("the \(asked) who asked") }
        let tell = told.isEmpty ? "Nobody has joined yet. " : "We'll tell \(told.joined(separator: " and ")). "
        return tell + "The pin comes off the map and the chat closes."
    }
}
