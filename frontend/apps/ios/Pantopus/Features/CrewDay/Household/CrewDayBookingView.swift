//
//  CrewDayBookingView.swift
//  Pantopus
//
//  5. Your Crew Day (build kit 01-spec.md, board `CrewDay`): one page per
//  booking, like the Plans plan page: the street's mini-map with round Back
//  and More buttons, the title block, the four-step status line, the state
//  card, then "Your booking", "For the crew", and Message the crew · Change
//  or cancel (8) · Share with neighbors (12) · Who sees what.
//

import SwiftUI

struct CrewDayBookingView: View {
    @State var viewModel: CrewDayBookingViewModel
    let onBack: () -> Void
    /// The existing invoice page: Pay now, See receipt.
    let onOpenInvoice: (String) -> Void
    /// Your Crew Days (Find another Crew Day).
    let onOpenMine: () -> Void
    let onAsk: () -> Void

    @State private var sheet: CrewDayBookingSheet?
    @State private var problem: CrewDayProblemRequest?
    @State private var viewer: CrewDayPhotoViewerRequest?
    @State private var confirmsCancel = false
    @State private var editingNote = false
    @State private var noteDraft = ""
    @State private var dateChoice: String?
    @State private var toast: String?
    @State private var appeared = false
    @FocusState private var noteFocused: Bool
    @Environment(\.openURL) private var openURL

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                VStack(spacing: 0) {
                    PlanNavBar(title: "Your Crew Day", onLeading: onBack)
                    CrewDayLoadingView()
                }
            case let .failed(message):
                VStack(spacing: 0) {
                    PlanNavBar(title: "Your Crew Day", onLeading: onBack)
                    if viewModel.unavailable { unavailable } else { CrewDayErrorView(message: message) { await viewModel.load() } }
                }
            case let .loaded(booking):
                page(booking)
            }
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        // Back from the invoice page (Pay now) or Messages: read what is true now.
        .onAppear {
            if appeared { Task { await viewModel.load() } }
            appeared = true
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .sheet(item: $sheet) { which in sheetView(which) }
        .fullScreenCover(item: $problem) { request in
            CrewDayProblemView(request: request) { booking in
                problem = nil
                if let booking { viewModel.replace(with: booking, notice: request.adding ? "Sent to Pantopus support." : nil) }
            }
        }
        .fullScreenCover(item: $viewer) { request in
            MediaViewerView(items: CrewDayPhotoGrid.items(request.photos), startIndex: request.index)
        }
        .alert(cancelTitle, isPresented: $confirmsCancel) {
            Button("Cancel booking", role: .destructive) { Task { await viewModel.cancel() } }
            Button("Keep it", role: .cancel) {}
        } message: {
            Text("Nothing has been charged.")
        }
        .overlay(alignment: .bottom) { toastView }
        .onChange(of: viewModel.notice) { _, notice in
            guard let notice else { return }
            toast = notice
            viewModel.notice = nil
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayBooking")
    }

    // MARK: - The page

    private func page(_ booking: CrewDayBookingDTO) -> some View {
        ZStack(alignment: .top) {
            ScrollView {
                VStack(spacing: 0) {
                    CrewDayStreetMap(street: booking.crewDay.streetLabel ?? "")
                    VStack(alignment: .leading, spacing: Spacing.s5) {
                        titleBlock(booking)
                        if !CrewDayBookingPageCopy.isEnded(booking) {
                            CrewDayStatusLine(steps: CrewDayBookingPageCopy.steps(booking))
                        }
                        CrewDayBookingStateSection(
                            booking: booking,
                            viewModel: viewModel,
                            dateChoice: $dateChoice,
                            onOpenInvoice: onOpenInvoice,
                            onProblem: { problem = CrewDayProblemRequest(booking: booking) },
                            onEditNote: { startEditingNote(booking) },
                            onOpenPhoto: { viewer = CrewDayPhotoViewerRequest(photos: $0, index: $1) },
                            onFindAnother: onOpenMine,
                            onAsk: onAsk
                        )
                        if let error = viewModel.actionError {
                            CrewDayErrorText(text: error, identifier: "crewDayBookingError")
                        }
                        yourBooking(booking)
                        if !CrewDayBookingPageCopy.isEnded(booking), booking.status != "paid" { forTheCrew(booking) }
                        actions(booking)
                    }
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, 18)
                    .padding(.bottom, Spacing.s10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22, style: .continuous)
                            .fill(Theme.Color.appBg)
                    )
                    .padding(.top, -22)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await viewModel.load() }
            topButtons(booking)
        }
    }

    private func topButtons(_ booking: CrewDayBookingDTO) -> some View {
        HStack {
            PlanGlassButton(icon: .chevronLeft, label: "Back", action: onBack)
                .accessibilityIdentifier("crewDayBookingBack")
            Spacer()
            Menu {
                if booking.crewDay.crew?.businessUserId != nil {
                    Button("Message the crew") { Task { await viewModel.messageCrew() } }
                }
                if booking.share != nil, !CrewDayBookingPageCopy.isEnded(booking) {
                    Button("Share with neighbors") { sheet = .share }
                }
                Button("How Crew Day works") { openWeb("/crew-day/how-it-works") }
                Button("Who sees what") { openWeb("/crew-day/who-sees-what") }
            } label: {
                PlanGlassIcon(icon: .moreHorizontal)
            }
            .accessibilityLabel("More")
            .accessibilityIdentifier("crewDayBookingMore")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s1)
    }

    private func titleBlock(_ booking: CrewDayBookingDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            CrewDayServiceTag(service: booking.crewDay.service)
            Text(booking.crewDay.title)
                .planFont(.h2)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("crewDayBookingTitle")
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                Icon(.calendarDays, size: 16, color: Theme.Color.appTextStrong)
                Text(CrewDayBookingPageCopy.when(booking))
                    .planFont(.small)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let crew = booking.crewDay.crew { CrewDayCrewRow(crew: crew).padding(.top, Spacing.s1) }
        }
    }

    // MARK: - Sheets

    @ViewBuilder
    private func sheetView(_ which: CrewDayBookingSheet) -> some View {
        if let booking = viewModel.booking {
            switch which {
            case .menu:
                CrewDayChangeSheet(
                    booking: booking,
                    onDetails: { sheet = .details },
                    onNote: {
                        sheet = nil
                        startEditingNote(booking)
                    },
                    onCancel: {
                        sheet = nil
                        confirmsCancel = true
                    },
                    onAskRelease: {
                        sheet = nil
                        Task { await viewModel.askRelease() }
                    }
                )
            case .details:
                CrewDayDetailsSheet(viewModel: viewModel, booking: booking) { sheet = .menu }
            case .share:
                CrewDayShareSheet(viewModel: viewModel, booking: booking)
            }
        }
    }

    private var cancelTitle: String {
        let title = viewModel.booking?.crewDay.title ?? "Crew Day"
        let short = title.components(separatedBy: " on ").first ?? title
        return "Cancel your \(short) booking?"
    }

    private func openWeb(_ path: String) {
        if let url = URL(string: InviteLinks.publicPageURLString(path: path)) { openURL(url) }
    }

    @ViewBuilder private var toastView: some View {
        if let toast {
            ToastView(message: ToastMessage(text: toast))
                .padding(.bottom, Spacing.s6)
                .dismissToast(after: toast, minimum: 2.5) { self.toast = nil }
                .accessibilityIdentifier("crewDayBookingToast")
        }
    }

    private var unavailable: some View {
        EmptyState(
            icon: .truck,
            headline: "This booking isn't available",
            subcopy: "It isn't yours, or it's gone. Your Crew Days lists every booking you have.",
            cta: EmptyState.CTA(title: "Open Your Crew Days") { @MainActor in onOpenMine() },
            tint: Theme.Color.homeBg,
            accent: Theme.Color.home
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("crewDayBookingUnavailable")
    }
}

// MARK: - Your booking, for the crew, actions

private extension CrewDayBookingView {
    // MARK: - Your booking

    func yourBooking(_ booking: CrewDayBookingDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            CrewDaySectionTitle(text: "Your booking")
            CrewDayCard {
                CrewDayInfoRow(icon: .mapPin, title: booking.address?.line ?? "Your home", detail: cityLine(booking.address)) {
                    CrewDayLockLine(text: "Visible to your crew and Pantopus.").padding(.top, 2)
                }
                Divider().overlay(Theme.Color.appBorder)
                CrewDayInfoRow(
                    icon: .house,
                    title: homeLine(booking),
                    detail: (booking.crewDay.included ?? []).joined(separator: " · "),
                    identifier: "crewDayBookingHome"
                )
                Divider().overlay(Theme.Color.appBorder)
                CrewDayInfoRow(icon: .tag, title: priceLine(booking), detail: refundLine(booking), identifier: "crewDayBookingPrice")
                Divider().overlay(Theme.Color.appBorder)
                CrewDayInfoRow(
                    icon: .creditCard,
                    title: CrewDayBookingPageCopy.cardLabel(booking),
                    detail: CrewDayBookingPageCopy.cardLine(booking),
                    identifier: "crewDayBookingCard"
                )
                if let cutoff = CrewDayBookingPageCopy.cutoffLine(booking) {
                    Divider().overlay(Theme.Color.appBorder)
                    CrewDayInfoRow(icon: .calendarX, title: cutoff, identifier: "crewDayBookingCutoff")
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("crewDayBookingDetails")
        }
    }

    func cityLine(_ address: CrewDayBookingDTO.Address?) -> String {
        let stateZip = [address?.state, address?.zip].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        return [address?.city, stateZip].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
    }

    /// "Two stories · Clean the gutter guards".
    func homeLine(_ booking: CrewDayBookingDTO) -> String {
        let parts = [booking.option?.label].compactMap { $0 } + booking.addOns.map(\.label)
        return parts.isEmpty ? (booking.crewDay.serviceLabel ?? "Your home") : parts.joined(separator: " · ")
    }

    func priceLine(_ booking: CrewDayBookingDTO) -> String {
        CrewDayBookingPageCopy.price(booking).map { "\($0) · including tax" } ?? "After a look"
    }

    func refundLine(_ booking: CrewDayBookingDTO) -> String? {
        guard let refunded = booking.charge?.refundedCents, refunded > 0, let price = booking.priceCents else { return nil }
        if refunded >= price { return "Refunded in full" }
        return "\(CrewDayFormat.price(refunded)) refunded · \(CrewDayFormat.price(price - refunded)) paid"
    }

    // MARK: - For the crew

    func forTheCrew(_ booking: CrewDayBookingDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            CrewDaySectionTitle(text: "For the crew")
            CrewDayCard {
                if editingNote {
                    TextField("Gate, pets, parking…", text: $noteDraft, axis: .vertical)
                        .planFont(.body)
                        .lineLimit(3...8)
                        .focused($noteFocused)
                        .padding(Spacing.s3)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.appSurface))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
                        .onChange(of: noteDraft) { _, text in if text.count > 500 { noteDraft = String(text.prefix(500)) } }
                        .accessibilityLabel("Note for the crew")
                        .accessibilityIdentifier("crewDayNoteField")
                    HStack(spacing: Spacing.s2) {
                        Button {
                            Task { if await viewModel.saveNote(noteDraft) { editingNote = false } }
                        } label: {
                            PlanButtonLabel(title: "Save note", isLoading: viewModel.working == .note)
                        }
                        .planButton(.primary, size: .small)
                        .disabled(viewModel.working != nil)
                        .accessibilityIdentifier("crewDayNoteSave")
                        Button("Cancel") { editingNote = false }
                            .planButton(.tonal, size: .small)
                            .accessibilityIdentifier("crewDayBookingCancelNote")
                    }
                } else {
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        Text(booking.accessNote?.isEmpty == false ? booking.accessNote ?? "" : "No note yet.")
                            .planFont(.body)
                            .foregroundStyle(booking.accessNote?.isEmpty == false ? Theme.Color.appText : Theme.Color.appTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("crewDayBookingNote")
                        Button("Edit") { startEditingNote(booking) }
                            .planButton(.text, size: .extraSmall)
                            .accessibilityLabel("Edit the note for the crew")
                            .accessibilityIdentifier("crewDayBookingEditNote")
                    }
                }
                CrewDayLockLine(text: "The crew sees this on the day only.")
            }
        }
    }

    func startEditingNote(_ booking: CrewDayBookingDTO) {
        noteDraft = booking.accessNote ?? ""
        editingNote = true
        noteFocused = true
    }

    // MARK: - Actions

    func actions(_ booking: CrewDayBookingDTO) -> some View {
        let ended = CrewDayBookingPageCopy.isEnded(booking)
        let canChange = booking.canChange || booking.canCancel || booking.canAskRelease || booking.releaseAskedAt != nil
        return VStack(spacing: 0) {
            if booking.crewDay.crew?.businessUserId != nil {
                CrewDayActionRow(icon: .messageCircle, title: "Message the crew", identifier: "crewDayBookingMessage") {
                    Task { await viewModel.messageCrew() }
                }
                Divider().overlay(Theme.Color.appBorder)
            }
            if canChange, !ended {
                CrewDayActionRow(icon: .pencil, title: "Change or cancel", identifier: "crewDayBookingChange") { sheet = .menu }
                Divider().overlay(Theme.Color.appBorder)
            }
            if booking.share != nil, !ended {
                CrewDayActionRow(icon: .share, title: "Share with neighbors", identifier: "crewDayBookingShare") { sheet = .share }
                Divider().overlay(Theme.Color.appBorder)
            }
            CrewDayActionRow(icon: .shieldCheck, title: "Who sees what", identifier: "crewDayBookingWhoSees") {
                openWeb("/crew-day/who-sees-what")
            }
        }
        .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayBookingActions")
    }
}

/// The page's sheets: Change or cancel (8), Change my home details, the share kit (12).
enum CrewDayBookingSheet: String, Identifiable {
    case menu, details, share

    var id: String {
        rawValue
    }
}

/// The photos the full-screen viewer opens on.
struct CrewDayPhotoViewerRequest: Identifiable {
    let id = UUID()
    let photos: [CrewDayPhoto]
    let index: Int
}
