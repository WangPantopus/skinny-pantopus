//
//  PlanInviteSheet.swift
//  Pantopus
//
//  "Invite friends" for a plan's host (founder decision, October 31). One
//  search box finds people the host knows on Pantopus or takes an email
//  address; "Text an invite" makes a one-person link for the phone's share
//  sheet. Below, the invitations already sent and where each stands. The
//  same screen on Android (PlanInviteSheet.kt), with the same test tags.
//

import SwiftUI

struct PlanInviteSheet: View {
    let card: PlanCardDTO

    @State private var viewModel: PlanInviteViewModel
    @State private var toast: String?
    @Environment(\.dismiss) private var dismiss
    @FocusState private var searchFocused: Bool

    init(card: PlanCardDTO) {
        self.card = card
        _viewModel = State(initialValue: PlanInviteViewModel(planId: card.id, atHome: card.placeKind == .home))
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    Text(subtitle)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    searchField
                    if let email = viewModel.emailInQuery { emailRow(email) }
                    if viewModel.chosenCount > 0 { chosen }
                    content
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s2)
                .padding(.bottom, Spacing.s6)
            }
            .scrollDismissesKeyboard(.interactively)
            sendBar
        }
        .background(Theme.Color.appSurface)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(26)
        .presentationBackground(Theme.Color.appSurface)
        .task { await viewModel.load() }
        .task(id: viewModel.searchText) {
            // A short pause while typing, then the people list for the name.
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            await viewModel.search()
        }
        .alert("Share your address?", isPresented: $viewModel.asksAboutAddress) {
            Button("Invite") { Task { await viewModel.agreeToShareAddress() } }
            Button("Not now", role: .cancel) {}
        } message: {
            Text("This plan is at your place. People you invite see your address once they say they're in.")
        }
        .sheet(item: $viewModel.textInvite) { invite in
            SystemShareSheet(items: invite.items) {
                Task { await viewModel.textInviteShared() }
            }
            .presentationDetents([.medium, .large])
        }
        .overlay(alignment: .bottom) { toastView }
        .onChange(of: viewModel.notice) { _, notice in
            guard let notice else { return }
            toast = notice
            viewModel.notice = nil
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planInviteSheet")
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Text("Invite friends")
                .planFont(.h3)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Button { dismiss() } label: {
                Icon(.x, size: 16, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Theme.Color.appSurfaceSunken))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("planInviteClose")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s5)
    }

    private var subtitle: String {
        // A playdate still needs a verified address (founder decision, October 31), as on Android.
        let who = card.kind == .playdate ? "Families with a verified address are" : "They're"
        let start = "\(card.title). \(who) in as soon as they say yes"
        return viewModel.atHome ? "\(start), and see your address then." : "\(start)."
    }

    // MARK: - Search

    private var searchField: some View {
        HStack(spacing: 10) {
            Icon(.search, size: 18, color: Theme.Color.appTextMuted)
            TextField("Name or email", text: $viewModel.query)
                .planFont(.body)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.emailAddress)
                .submitLabel(.done)
                .focused($searchFocused)
                .onSubmit { viewModel.addEmailFromQuery() }
                .accessibilityLabel("Name or email")
                .accessibilityIdentifier("planInviteSearch")
            if !viewModel.query.isEmpty {
                Button { viewModel.query = "" } label: {
                    Icon(.xCircle, size: 18, color: Theme.Color.appTextMuted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear")
            }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 48)
        .background(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
    }

    /// "Invite alex@example.com by email".
    private func emailRow(_ email: String) -> some View {
        Button { viewModel.addEmailFromQuery() } label: {
            HStack(spacing: Spacing.s3) {
                iconSquare(.mail)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Invite \(email)")
                        .planFont(.bodyStrong)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Text("By email. Pantopus sends it, with the plan's card.")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.plusCircle, size: 22, color: Theme.Color.primary600)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("planInviteAddEmail")
    }

    /// The people and addresses chosen, each with an X.
    private var chosen: some View {
        ScrollView(.horizontal) {
            HStack(spacing: Spacing.s2) {
                ForEach(viewModel.chosenPeople) { person in
                    chip(person.displayName, icon: .user) { viewModel.removePerson(person.userId) }
                }
                ForEach(viewModel.chosenEmails, id: \.self) { email in
                    chip(email, icon: .mail) { viewModel.removeEmail(email) }
                }
            }
        }
        .scrollIndicators(.hidden)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planInviteChosen")
    }

    private func chip(_ text: String, icon: PantopusIcon, onRemove: @escaping () -> Void) -> some View {
        HStack(spacing: 6) {
            Icon(icon, size: 14, color: Theme.Color.primary700)
            Text(text)
                .planFont(.smallStrong)
                .foregroundStyle(Theme.Color.primary700)
                .lineLimit(1)
            Button(action: onRemove) {
                Icon(.x, size: 12, strokeWidth: 2.5, color: Theme.Color.primary700)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(text)")
        }
        .padding(.leading, 10)
        .padding(.trailing, Spacing.s1)
        .frame(minHeight: 36)
        .background(Capsule().fill(Theme.Color.primary100))
    }
}

// MARK: - People, text invite and the invitations sent

extension PlanInviteSheet {
    @ViewBuilder private var content: some View {
        switch viewModel.phase {
        case .loading:
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .fill(Theme.Color.appSurfaceSunken)
                        .frame(height: 52)
                }
            }
            .accessibilityLabel("Loading")
        case let .error(message):
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Couldn't load your people").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                Text(message).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                Button("Try again") { Task { await viewModel.load() } }
                    .planButton(.secondary, size: .small)
                    .accessibilityIdentifier("planInviteRetry")
            }
        case .loaded:
            peopleSection
            textInviteCard
            sentSection
            Text("Each invitation is for one person. Emails and texts show the plan's card and area, never your address.")
                .planFont(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var peopleSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text.planOverline(viewModel.searchText.isEmpty ? "People you know" : "People")
                .padding(.bottom, Spacing.s1)
            if viewModel.people.isEmpty {
                Text(viewModel.searchText.isEmpty
                    ? "Your connections and people who came to your plans show here. Anyone else: type their email."
                    : "No one you know by that name. Type their email to invite them.")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.vertical, Spacing.s2)
            }
            ForEach(Array(viewModel.people.enumerated()), id: \.element.id) { index, person in
                if index > 0 { Divider().overlay(Theme.Color.appBorder) }
                personRow(person)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planInvitePeople")
    }

    private func personRow(_ person: PlanInviteCandidateDTO) -> some View {
        Button { viewModel.toggle(person) } label: {
            HStack(spacing: Spacing.s3) {
                PlanAvatar(name: person.displayName, url: person.avatarUrl)
                VStack(alignment: .leading, spacing: 0) {
                    Text(person.displayName).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    Text(PlanInviteLines.reason(person.reason))
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let state = person.state {
                    Text(PlanInviteLines.candidateState(state))
                        .planFont(.smallStrong)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                } else {
                    PlanCheckbox(isOn: viewModel.isChosen(person))
                }
            }
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(person.state != nil)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(viewModel.isChosen(person) ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("planInvitePerson")
    }

    private var textInviteCard: some View {
        PlanCardBox(padding: 14) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: Spacing.s3) {
                    iconSquare(.messageCircle)
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Text an invite").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                        Text("Send a link from your phone. It works for one person, so make one for each friend.")
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Button { Task { await viewModel.makeTextInvite() } } label: {
                    PlanButtonLabel(title: "Text an invite", icon: .send, kind: .secondary, isLoading: viewModel.isMakingLink)
                }
                .planButton(.secondary, size: .small)
                .disabled(viewModel.isMakingLink)
                .accessibilityIdentifier("planInviteText")
            }
        }
    }

    @ViewBuilder private var sentSection: some View {
        let rows = viewModel.list?.invites ?? []
        let unopened = viewModel.list?.unopenedLinks ?? 0
        if !rows.isEmpty || unopened > 0 {
            VStack(alignment: .leading, spacing: 0) {
                Text.planOverline(PlanInviteLines.sentTitle(viewModel.list?.counts))
                    .padding(.bottom, Spacing.s1)
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    if index > 0 { Divider().overlay(Theme.Color.appBorder) }
                    sentRow(row)
                }
                if unopened > 0 {
                    if !rows.isEmpty { Divider().overlay(Theme.Color.appBorder) }
                    HStack(spacing: Spacing.s3) {
                        iconSquare(.messageCircle)
                        Text(unopened == 1 ? "1 text invite not opened yet" : "\(unopened) text invites not opened yet")
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    .padding(.vertical, 10)
                    .accessibilityIdentifier("planInviteUnopened")
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("planInviteSent")
        }
    }

    private func sentRow(_ row: PlanInviteRowDTO) -> some View {
        HStack(spacing: Spacing.s3) {
            if let person = row.person {
                PlanAvatar(name: person.displayName, url: person.avatarUrl)
            } else {
                iconSquare(row.channel == .email ? .mail : .messageCircle)
            }
            VStack(alignment: .leading, spacing: 0) {
                Text(row.title)
                    .planFont(.bodyStrong)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Text(PlanInviteLines.state(row))
                    .planFont(.small)
                    .foregroundStyle(row.emailFailed || row.state == .asked ? Theme.Color.warning : Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if row.canCancel {
                Menu {
                    Button("Take back invitation", role: .destructive) { Task { await viewModel.cancel(row) } }
                } label: {
                    Icon(.moreHorizontal, size: 18, color: Theme.Color.appTextSecondary)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("More for \(row.title)")
                .accessibilityIdentifier("planInviteRowMenu")
            }
        }
        .padding(.vertical, Spacing.s1)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planInviteRow")
    }

    private func iconSquare(_ icon: PantopusIcon) -> some View {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Theme.Color.primary100)
            .frame(width: 40, height: 40)
            .overlay(Icon(icon, size: 20, color: Theme.Color.primary700))
            .accessibilityHidden(true)
    }

    // MARK: - Send

    private var sendBar: some View {
        VStack(spacing: Spacing.s2) {
            if let error = viewModel.error {
                Text(error)
                    .planFont(.footnote)
                    .foregroundStyle(Theme.Color.error)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("planInviteError")
            }
            Button { Task { await viewModel.send() } } label: {
                PlanButtonLabel(title: sendTitle, kind: .primary, isLoading: viewModel.isSending)
            }
            .planButton(.primary)
            .disabled(viewModel.chosenCount == 0 || viewModel.isSending)
            .accessibilityIdentifier("planInviteSend")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s2)
        .background(Theme.Color.appSurface.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Divider().overlay(Theme.Color.appBorder) }
    }

    private var sendTitle: String {
        switch viewModel.chosenCount {
        case 0: "Choose people to invite"
        case 1: "Send invite"
        default: "Send \(viewModel.chosenCount) invites"
        }
    }

    @ViewBuilder private var toastView: some View {
        if let toast {
            ToastView(message: ToastMessage(text: toast))
                .padding(.bottom, 96)
                .dismissToast(after: toast, minimum: 2.5) {
                    self.toast = nil
                }
        }
    }
}

/// The invitation words the host sees (the same on Android).
enum PlanInviteLines {
    /// Why someone is in the people list.
    static func reason(_ reason: String?) -> String {
        switch reason {
        case "came_before": "Came to your plans"
        case "both": "Connection · came to your plans"
        default: "Connection"
        }
    }

    /// Someone who can't be chosen again.
    static func candidateState(_ state: String) -> String {
        switch state {
        case "in": "In"
        case "asked": "Asked"
        default: "Invited"
        }
    }

    /// Where one invitation stands.
    static func state(_ row: PlanInviteRowDTO) -> String {
        let how = switch row.channel {
        case .email: "By email"
        case .link: "By text"
        case .account: "On Pantopus"
        }
        switch row.state {
        case .invited:
            return row.emailFailed ? "Couldn't email this address" : "\(how) · Hasn't answered yet"
        case .opened: return "Opened your text invite · Hasn't answered yet"
        case .isIn: return "Said yes · In"
        case .waitlisted: return "Said yes · On the waitlist"
        case .asked: return "Opened your email invitation from another address · Waiting for your yes in Requests"
        case .cantMakeIt: return "Can't make it"
        case .left: return "Said yes, then left"
        }
    }

    /// "Invited · 3 waiting · 2 in".
    static func sentTitle(_ counts: PlanInviteCountsDTO?) -> String {
        guard let counts else { return "Invited" }
        var parts: [String] = []
        if counts.invited > 0 { parts.append("\(counts.invited) waiting") }
        if counts.isIn > 0 { parts.append("\(counts.isIn) in") }
        if counts.cantMakeIt > 0 { parts.append("\(counts.cantMakeIt) can't make it") }
        return parts.isEmpty ? "Invited" : "Invited · " + parts.joined(separator: " · ")
    }
}
