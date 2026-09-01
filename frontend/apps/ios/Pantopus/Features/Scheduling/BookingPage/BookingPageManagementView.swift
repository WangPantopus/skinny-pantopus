//
//  BookingPageManagementView.swift
//  Pantopus
//
//  C1 Booking Link / Public Page Management · Stream I4. A FormShell-based
//  editor for the owner's public booking page: live/paused/draft status, the
//  public slug with live availability check, header fields, per-service
//  visibility, intro/confirmation copy, page visibility, an intake+payments
//  links card, and the copy/share/QR footer. Presents C3 (ShareLinkSheet)
//  locally and pushes the C2 preview. Tokens only — matched to
//  booking-link-frames.jsx + event-editor-shell.jsx.
//
// swiftlint:disable file_length

import SwiftUI

public struct BookingPageManagementView: View {
    @State private var viewModel: BookingPageManagementViewModel
    @State private var activeSheet: ManagementSheet?
    @State private var previewRequest: PreviewRequest?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    public init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        _viewModel = State(initialValue: BookingPageManagementViewModel(owner: owner, push: push))
    }

    /// Test/preview seam.
    init(viewModel: BookingPageManagementViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        content
            .background(Theme.Color.appBg)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .toolbar(.hidden, for: .navigationBar)
            .task { await viewModel.load() }
            .sheet(item: $activeSheet, content: sheetBody)
            .fullScreenCover(item: $previewRequest) { request in
                BookingPagePreviewView(owner: viewModel.owner, slug: request.slug)
            }
            .accessibilityIdentifier("bookingPageManagement.screen")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            ManagementLoadingView()
        case .loaded:
            form
        case let .error(message):
            ManagementErrorView(message: message) { Task { await viewModel.refresh() } }
        }
    }

    // MARK: - Loaded form

    private var form: some View {
        FormShell(
            title: "Booking link",
            leading: .back,
            rightActionLabel: nil,
            bottomActionLabel: bottomActionLabel,
            bottomActionIcon: viewModel.isValid ? nil : .lock,
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: { dismiss() },
            onCommit: { Task { await viewModel.save() } },
            content: {
                Group {
                    PillarHeaderChip(theme: viewModel.theme)
                    BookingMgmtStatusCard(viewModel: viewModel)
                    BookingMgmtSlugCard(viewModel: viewModel)
                    BookingMgmtHeaderCard(viewModel: viewModel)
                    BookingMgmtServicesCard(viewModel: viewModel)
                    BookingMgmtCopyCard(viewModel: viewModel)
                    BookingMgmtVisibilityCard(viewModel: viewModel)
                    linksCard
                    BookingMgmtFooterButtons(
                        disabled: viewModel.isDraft,
                        onCopy: { BookingLinkActions.copy(viewModel.shareURL) },
                        onShare: { activeSheet = .share },
                        onViewQR: { activeSheet = .share }
                    )
                    if let saveError = viewModel.saveError {
                        InlineNote(tone: .error, text: saveError, icon: .alertCircle)
                    }
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
        .overlay(alignment: .bottom) {
            if viewModel.showSavedToast {
                BookingMgmtSavedToast().padding(.bottom, Spacing.s16)
            }
        }
    }

    /// The bottom save-bar label varies: a locked label when the slug is
    /// invalid/taken (FormShell disables the CTA), "Save draft" for an
    /// unpublished page, else "Save changes".
    private var bottomActionLabel: String {
        viewModel.isValid ? viewModel.saveLabel : "Fix your link to save"
    }

    /// Single card: Intake questions + Connect Stripe, one `BookingLinkRow` each.
    private var linksCard: some View {
        BookingCard(padding: Spacing.s2) {
            BookingLinkRow(
                icon: .listChecks,
                title: "Intake questions",
                value: viewModel.questionCount,
                showsDivider: viewModel.showPaymentsRow
            ) { viewModel.openIntakeQuestions() }
            if viewModel.showPaymentsRow {
                BookingLinkRow(
                    icon: .creditCard,
                    title: "Connect Stripe to take paid bookings"
                ) { viewModel.openPayments() }
            }
        }
    }

    // MARK: - Sheets

    @ViewBuilder private func sheetBody(_ sheet: ManagementSheet) -> some View {
        switch sheet {
        case .share:
            ShareLinkSheet(
                url: viewModel.shareURL,
                theme: viewModel.theme,
                isLive: viewModel.isAcceptingBookings,
                showOnProfile: viewModel.visibility == .listed,
                addToSignature: viewModel.addToSignature,
                onCopy: {},
                onShare: { BookingLinkActions.presentShare([viewModel.shareURL]) },
                onMessages: { BookingLinkActions.openMessages(with: viewModel.shareURL, openURL: openURL) },
                onEmail: { BookingLinkActions.openEmail(with: viewModel.shareURL, openURL: openURL) },
                onToggleShowOnProfile: { value in
                    Task { @MainActor in await viewModel.setListed(value) }
                },
                onToggleSignature: { value in
                    Task { @MainActor in viewModel.addToSignature = value }
                },
                onRegenerate: { Task { await viewModel.regenerateLink() } },
                onTurnOnPage: viewModel.isAcceptingBookings ? nil : { Task { await viewModel.turnOnPage() } }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
    }

    enum ManagementSheet: Identifiable {
        case share
        var id: String {
            "share"
        }
    }

    struct PreviewRequest: Identifiable {
        let slug: String
        var id: String {
            slug
        }
    }
}

// MARK: - Status card

private struct BookingMgmtStatusCard: View {
    @Bindable var viewModel: BookingPageManagementViewModel

    var body: some View {
        BookingCard {
            CardOverline(text: "Status", accent: viewModel.theme.accent)
            HStack(alignment: .center, spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    BookingStatusChip(tone: viewModel.statusTone)
                    Text(viewModel.statusCopy)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Spacing.s2)
                // Per the design, the status switch (and all toggles/CTAs) stay
                // sky/primary regardless of the page's pillar accent.
                Toggle("", isOn: Binding(
                    get: { viewModel.isAcceptingBookings },
                    set: { value in Task { await viewModel.setAcceptingBookings(value) } }
                ))
                .labelsHidden()
                .tint(Theme.Color.primary600)
                .accessibilityIdentifier("bookingPageManagement.statusToggle")
            }
        }
    }
}

// MARK: - Slug card

private struct BookingMgmtSlugCard: View {
    @Bindable var viewModel: BookingPageManagementViewModel

    private var isError: Bool {
        switch viewModel.slugState {
        case .taken, .invalid: true
        default: false
        }
    }

    var body: some View {
        BookingCard {
            CardOverline(text: "Your link", accent: viewModel.theme.accent)
            HStack(spacing: Spacing.s0) {
                Text("\(BookingLinkURL.displayOrigin)/book/")
                    .font(.system(size: 12.5, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextField("your-handle", text: $viewModel.slugText)
                    .font(.system(size: 12.5, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Theme.Color.appText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onChange(of: viewModel.slugText) { _, _ in viewModel.slugTextChanged() }
                    .accessibilityIdentifier("bookingPageManagement.slugField")
                trailingStatusIcon
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(isError ? Theme.Color.error : Theme.Color.appBorder, lineWidth: 1.5)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.errorBg, lineWidth: 3)
                    .opacity(isError ? 1 : 0)
                    .padding(-3)
            )
            slugStatusLine
        }
    }

    /// The design's slug input box holds only the `pantopus.com/book/` prefix
    /// and the editable handle — availability is shown on the line *below*, not
    /// as an in-box glyph. Only the transient debounce spinner lives in-box.
    @ViewBuilder private var trailingStatusIcon: some View {
        switch viewModel.slugState {
        case .checking:
            ProgressView().controlSize(.small)
        case .available, .taken, .invalid, .unchanged:
            EmptyView()
        }
    }

    @ViewBuilder private var slugStatusLine: some View {
        switch viewModel.slugState {
        case .available:
            statusText("Available", color: Theme.Color.success, icon: .checkCircle)
        case let .invalid(message):
            statusText(message, color: Theme.Color.error, icon: .alertCircle)
        case let .taken(suggestions):
            VStack(alignment: .leading, spacing: Spacing.s2) {
                statusText("That handle is taken. Try another.", color: Theme.Color.error, icon: .alertCircle)
                if !suggestions.isEmpty {
                    BookingMgmtSuggestionChips(suggestions: suggestions) { viewModel.applySuggestion($0) }
                }
            }
        case .checking, .unchanged:
            EmptyView()
        }
    }

    private func statusText(_ text: String, color: Color, icon: PantopusIcon) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon, size: 13, strokeWidth: 2.4, color: color)
            Text(text)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(color)
        }
        .accessibilityIdentifier("bookingPageManagement.slugStatus")
    }
}

private struct BookingMgmtSuggestionChips: View {
    let suggestions: [String]
    let onTap: (String) -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(suggestions, id: \.self) { suggestion in
                BookingPillChip(title: suggestion, isSelected: false, mono: true) {
                    onTap(suggestion)
                }
                .accessibilityIdentifier("bookingPageManagement.slugSuggestion")
            }
            Spacer(minLength: Spacing.s0)
        }
    }
}

// MARK: - Header card (avatar + change photo, then name + tagline)

private struct BookingMgmtHeaderCard: View {
    @Bindable var viewModel: BookingPageManagementViewModel

    var body: some View {
        BookingCard {
            CardOverline(text: "Page header", accent: viewModel.theme.accent)
            HStack(spacing: Spacing.s3) {
                BookingPageAvatar(
                    name: viewModel.titleText.isEmpty ? "You" : viewModel.titleText,
                    size: 48,
                    accent: viewModel.theme.accent
                )
                Button {
                    // Photo upload is not wired in this stream.
                } label: {
                    Text("Change photo")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("bookingPageManagement.changePhoto")
                Spacer(minLength: Spacing.s0)
            }
            BookingMgmtField(
                label: "Display name",
                placeholder: "Your name",
                text: $viewModel.titleText,
                identifier: "bookingPageManagement.titleField"
            )
            BookingMgmtField(
                label: "Tagline",
                placeholder: "One short line",
                text: $viewModel.taglineText,
                identifier: "bookingPageManagement.taglineField"
            )
        }
    }
}

// MARK: - Services card (pure toggle rows)

private struct BookingMgmtServicesCard: View {
    @Bindable var viewModel: BookingPageManagementViewModel

    var body: some View {
        BookingCard {
            CardOverline(text: "Services people can book", accent: viewModel.theme.accent)
            if !viewModel.hasVisibleService {
                InlineNote(
                    tone: .warning,
                    text: "Turn on at least one service so people can book",
                    icon: .alertTriangle
                )
            }
            ForEach(Array(viewModel.serviceRows.enumerated()), id: \.element.id) { index, row in
                BookingMgmtServiceRow(
                    row: row,
                    isLast: index == viewModel.serviceRows.count - 1
                ) { visible in
                    Task { await viewModel.setServiceVisible(eventTypeId: row.id, visible: visible) }
                }
            }
        }
    }
}

private struct BookingMgmtServiceRow: View {
    let row: BookingServiceRow
    let isLast: Bool
    let onToggle: (Bool) -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            HStack(spacing: Spacing.s3) {
                Icon(
                    row.locationIcon,
                    size: 15,
                    color: row.isVisible ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                )
                .frame(width: 30, height: 30)
                .background(row.isVisible ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(row.name)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(row.durationLabel)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                Toggle("", isOn: Binding(get: { row.isVisible }, set: onToggle))
                    .labelsHidden()
                    .tint(Theme.Color.primary600)
                    .accessibilityIdentifier("bookingPageManagement.serviceToggle.\(row.id)")
            }
            .padding(.vertical, Spacing.s2)
            if !isLast {
                Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            }
        }
    }
}

// MARK: - Intro & confirmation

private struct BookingMgmtCopyCard: View {
    @Bindable var viewModel: BookingPageManagementViewModel

    var body: some View {
        BookingCard {
            CardOverline(text: "Intro & confirmation", accent: viewModel.theme.accent)
            BookingMgmtMultilineField(
                label: "Intro message",
                placeholder: "A short welcome shown on your page",
                text: $viewModel.introText,
                identifier: "bookingPageManagement.introField"
            )
            BookingMgmtMultilineField(
                label: "Confirmation message",
                placeholder: "Shown after someone books",
                text: $viewModel.confirmationText,
                identifier: "bookingPageManagement.confirmationField"
            )
        }
    }
}

// MARK: - Page visibility

private struct BookingMgmtVisibilityCard: View {
    @Bindable var viewModel: BookingPageManagementViewModel

    var body: some View {
        BookingCard {
            CardOverline(text: "Visibility", accent: viewModel.theme.accent)
            BookingSegmented(
                options: [("Listed", BookingPageVisibility.listed), ("Link-only", .unlisted)],
                selection: $viewModel.visibility
            )
            Text(viewModel.visibility == .listed
                ? "Shown on your Pantopus profile and in search."
                : "Only people with the link can find your page.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }
}

// MARK: - Shared field bits

private struct BookingMgmtField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    let identifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            TextField(placeholder, text: $text)
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1.5)
                )
                .accessibilityIdentifier(identifier)
        }
    }
}

private struct BookingMgmtMultilineField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    let identifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            TextField(placeholder, text: $text, axis: .vertical)
                .lineLimit(2...5)
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .frame(minHeight: 48, alignment: .top)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1.5)
                )
                .accessibilityIdentifier(identifier)
        }
    }
}

// MARK: - Footer action buttons (copy · share · QR)

private struct BookingMgmtFooterButtons: View {
    let disabled: Bool
    let onCopy: () -> Void
    let onShare: () -> Void
    let onViewQR: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            BookingMgmtFooterButton(icon: .copy, title: "Copy link", disabled: disabled, action: onCopy)
            BookingMgmtFooterButton(icon: .share, title: "Share", disabled: disabled, action: onShare)
            BookingMgmtFooterButton(icon: .qrCode, title: "View QR", disabled: disabled, action: onViewQR)
        }
        .opacity(disabled ? 0.5 : 1)
    }
}

private struct BookingMgmtFooterButton: View {
    let icon: PantopusIcon
    let title: String
    let disabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 13, color: disabled ? Theme.Color.appTextMuted : Theme.Color.primary600)
                Text(title)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .frame(maxWidth: .infinity, minHeight: 40)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityIdentifier("bookingPageManagement.footer.\(title)")
    }
}

// MARK: - Toast / loading / error

private struct BookingMgmtSavedToast: View {
    var body: some View {
        HStack(spacing: Spacing.s2) {
            // Design uses a bare lucide `check` (not a circled check), strokeWidth 3.
            Icon(.check, size: 15, strokeWidth: 3, color: Theme.Color.success)
            Text("Saved")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appText)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .pantopusShadow(.lg)
        .accessibilityIdentifier("bookingPageManagement.savedToast")
    }
}

private struct ManagementLoadingView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                ForEach(0..<4, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Shimmer(width: 90, height: 11, cornerRadius: Radii.sm)
                        Shimmer(height: 52, cornerRadius: Radii.lg)
                    }
                }
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("bookingPageManagement.loading")
    }
}

private struct ManagementErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load your booking page")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            PrimaryButton(title: "Try again") { await MainActor.run { retry() } }
                .frame(maxWidth: 240)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("bookingPageManagement.error")
    }
}

#if DEBUG
#Preview("Loaded") {
    let viewModel = BookingPageManagementViewModel(owner: .personal) { _ in }
    viewModel.hydrateForPreview(page: BookingPageSampleData.livePage, eventTypes: BookingPageSampleData.eventTypes)
    return NavigationStack { BookingPageManagementView(viewModel: viewModel) }
}
#endif
// swiftlint:enable file_length
