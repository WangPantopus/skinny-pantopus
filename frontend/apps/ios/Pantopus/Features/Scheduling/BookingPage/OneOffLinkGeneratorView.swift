//
//  OneOffLinkGeneratorView.swift
//  Pantopus
//
//  C4 One-off / Single-use Link Generator · Stream I4. A bottom-sheet form
//  that creates a private booking link for one invitee, collapsing to a
//  result card once generated. Presented as a sheet from C1 / the C4 routed
//  stub (the parent supplies the grabber via `.presentationDragIndicator`).
//  Tokens only.
//
// swiftlint:disable file_length

import SwiftUI

public struct OneOffLinkGeneratorView: View {
    @State private var viewModel: OneOffLinkGeneratorViewModel
    @State private var showCopied = false
    @State private var copiedInline = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    public init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: OneOffLinkGeneratorViewModel(owner: owner, push: push))
    }

    init(viewModel: OneOffLinkGeneratorViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            content
        }
        .background(Theme.Color.appBg)
        .toolbar(.hidden, for: .navigationBar)
        .task { await viewModel.load() }
        .overlay(alignment: .top) {
            if showCopied { OneOffCopiedToast().padding(.top, Spacing.s12) }
        }
        .accessibilityIdentifier("oneOffLinkGenerator.screen")
    }

    // MARK: - Header (title + caption + trailing pillar chip; no close button)

    private var header: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Create a one-off link")
                    .pantopusTextStyle(.h3)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appText)
                Text("Send a private link for one person.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            PillarHeaderChip(theme: viewModel.theme)
                .padding(.top, 2)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s3)
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            OneOffLoadingView()
        case .configuring, .generating:
            configuringForm
        case let .generated(link):
            generatedCard(link)
        case let .loadError(message):
            OneOffErrorView(message: message) { Task { await viewModel.load() } }
        }
    }

    // MARK: - Configuring

    private var configuringForm: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s5) {
                if viewModel.eventTypeOptions.isEmpty {
                    BookingCard {
                        InlineNote(
                            tone: .warning,
                            text: "Create a service first so there's something to book.",
                            icon: .alertTriangle
                        )
                        CompactButton(title: "Add a service", variant: .ghost, size: .inlineAction) {
                            viewModel.createService()
                        }
                    }
                } else {
                    OneOffSection(label: "Event type") {
                        OneOffEventTypeCard(viewModel: viewModel)
                    }
                    if let error = viewModel.generateError {
                        OneOffGenerateErrorNote(message: error) {
                            await viewModel.generate()
                        }
                    }
                    OneOffSection(label: "Availability") {
                        OneOffAvailabilityCard(viewModel: viewModel)
                    }
                    OneOffSection(label: "Link expires") {
                        OneOffExpiryChips(viewModel: viewModel)
                    }
                    OneOffSection(label: "Options") {
                        OneOffOptionsCard(viewModel: viewModel)
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s1)
            .padding(.bottom, Spacing.s4)
        }
        .safeAreaInset(edge: .bottom) {
            generateBar
        }
    }

    private var generateBar: some View {
        OneOffGenerateButton(
            isLoading: viewModel.state == .generating,
            isEnabled: viewModel.canGenerate
        ) { await viewModel.generate() }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s5)
            .background(alignment: .top) {
                VStack(spacing: Spacing.s0) {
                    Rectangle()
                        .fill(Theme.Color.appBorder)
                        .frame(height: 1)
                    Rectangle()
                        .fill(.ultraThinMaterial)
                }
                .background(Theme.Color.appSurface.opacity(0.6))
            }
            .accessibilityIdentifier("oneOffLinkGenerator.generate")
    }

    // MARK: - Generated

    private func generatedCard(_ link: OneOffGeneratedLink) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                OneOffResultHero()
                OneOffResultURL(
                    displayURL: link.displayURL,
                    copied: copiedInline
                ) {
                    BookingLinkActions.copy(link.shareURL)
                    flashCopied()
                }
                OneOffMetaPill(expiryText: link.expiryText, singleUse: link.singleUse)
                OneOffSection(label: "Send via") {
                    HStack(spacing: Spacing.s3) {
                        OneOffShareTile(icon: .share, title: "Share") {
                            BookingLinkActions.presentShare([link.shareURL])
                        }
                        OneOffShareTile(icon: .messageCircle, title: "Messages") {
                            BookingLinkActions.openMessages(with: link.shareURL, openURL: openURL)
                        }
                        OneOffShareTile(icon: .mail, title: "Email") {
                            BookingLinkActions.openEmail(with: link.shareURL, openURL: openURL)
                        }
                    }
                }
                OneOffCreateAnotherButton { viewModel.reset() }
                    .frame(maxWidth: .infinity)
                    .padding(.top, Spacing.s1)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s1)
            .padding(.bottom, Spacing.s5)
        }
        .accessibilityIdentifier("oneOffLinkGenerator.generated")
    }

    private func flashCopied() {
        copiedInline = true
        showCopied = true
        Task {
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            copiedInline = false
            showCopied = false
        }
    }
}

// MARK: - Section (neutral label above a group)

private struct OneOffSection<Content: View>: View {
    let label: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionLabel(text: label)
            content
        }
    }
}

// MARK: - Event-type card (row + chevron menu, then custom-duration chips)

private struct OneOffEventTypeCard: View {
    @Bindable var viewModel: OneOffLinkGeneratorViewModel

    var body: some View {
        BookingCard(padding: Spacing.s0) {
            VStack(spacing: Spacing.s0) {
                Menu {
                    ForEach(viewModel.eventTypeOptions) { option in
                        Button {
                            viewModel.selectEventType(option.id)
                        } label: {
                            Text("\(option.name) · \(option.durationLabel)")
                        }
                    }
                } label: {
                    eventRow
                }
                .accessibilityIdentifier("oneOffLinkGenerator.eventTypePicker")
            }
        }
    }

    private var eventRow: some View {
        HStack(spacing: Spacing.s3) {
            if let selected = viewModel.selectedEventType {
                Icon(selected.icon, size: 16, color: Theme.Color.primary600)
                    .frame(width: 34, height: 34)
                    .background(Theme.Color.primary50)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(selected.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    // The event type's real default duration — the invitee
                    // always books this; a chip-selected duration was a no-op
                    // (the one-off API has no duration field).
                    Text("\(selected.durationLabel) · \(selected.modalityLabel)")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            } else {
                Text("Choose a service")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .contentShape(Rectangle())
    }

    // NOTE: the design's "Custom duration" chip row is intentionally not
    // rendered — the one-off API has no duration field, so the chips were a
    // silent no-op (see OneOffEventTypeOption).
}

// MARK: - Availability (toggle row + removable proposed slots + add a time)

private struct OneOffAvailabilityCard: View {
    @Bindable var viewModel: OneOffLinkGeneratorViewModel

    var body: some View {
        BookingCard(padding: Spacing.s0) {
            VStack(spacing: Spacing.s0) {
                toggleRow
                if viewModel.offerSpecificTimes {
                    Rectangle()
                        .fill(Theme.Color.appBorder)
                        .frame(height: 1)
                    slotList
                }
            }
        }
    }

    private var toggleRow: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Offer specific times")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(viewModel.offerSpecificTimes
                    ? "They pick from the times you propose."
                    : "We'll show your full availability.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s2)
            Toggle("", isOn: Binding(
                get: { viewModel.offerSpecificTimes },
                set: { viewModel.setOfferSpecificTimes($0) }
            ))
            .labelsHidden()
            .tint(Theme.Color.primary600)
            .accessibilityIdentifier("oneOffLinkGenerator.offerTimesToggle")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
    }

    @ViewBuilder private var slotList: some View {
        if viewModel.slotsLoading {
            HStack(spacing: Spacing.s2) {
                ProgressView().controlSize(.small)
                Text("Finding open times…")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
        } else if viewModel.selectedSlots.isEmpty && viewModel.slotOptions.isEmpty {
            Text("No open times in the next two weeks.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s3)
        } else {
            VStack(spacing: Spacing.s0) {
                ForEach(viewModel.selectedSlots) { slot in
                    OneOffSlotRow(slot: slot) { viewModel.removeSlot(slot.id) }
                    Rectangle()
                        .fill(Theme.Color.appBorder)
                        .frame(height: 1)
                }
                addTimeMenu
            }
        }
    }

    private var addable: [OneOffSlotOption] {
        viewModel.slotOptions.filter { !viewModel.selectedSlotIds.contains($0.id) }
    }

    @ViewBuilder private var addTimeMenu: some View {
        if addable.isEmpty {
            EmptyView()
        } else {
            Menu {
                ForEach(addable) { slot in
                    Button {
                        viewModel.toggleSlot(slot.id)
                    } label: {
                        Text("\(slot.dateLabel) · \(slot.timeLabel)")
                    }
                }
            } label: {
                HStack(spacing: Spacing.s1) {
                    Icon(.plus, size: 13, strokeWidth: 2.4, color: Theme.Color.primary600)
                    Text("Add a time")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.primary600)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .accessibilityIdentifier("oneOffLinkGenerator.addTime")
        }
    }
}

private struct OneOffSlotRow: View {
    let slot: OneOffSlotOption
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.calendar, size: 14, color: Theme.Color.primary600)
                .frame(width: 30, height: 30)
                .background(Theme.Color.primary50)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(slot.dateLabel)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                if !slot.timeLabel.isEmpty {
                    Text(slot.timeLabel)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: Spacing.s2)
            Button(action: onRemove) {
                Icon(.x, size: 15, color: Theme.Color.appTextMuted)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("oneOffLinkGenerator.removeSlot")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .accessibilityIdentifier("oneOffLinkGenerator.slotRow")
    }
}

// MARK: - Expiry chips (bare wrap, no card)

private struct OneOffExpiryChips: View {
    @Bindable var viewModel: OneOffLinkGeneratorViewModel

    var body: some View {
        OneOffFlowLayout(spacing: Spacing.s2) {
            ForEach(OneOffExpiry.allCases, id: \.self) { option in
                BookingPillChip(
                    title: option.label,
                    isSelected: viewModel.expiry == option
                ) { viewModel.expiry = option }
            }
        }
        .accessibilityIdentifier("oneOffLinkGenerator.expiryChips")
    }
}

// MARK: - Options card (single use + ask intake questions, icon-tile toggles)

private struct OneOffOptionsCard: View {
    @Bindable var viewModel: OneOffLinkGeneratorViewModel

    var body: some View {
        BookingCard(padding: Spacing.s0) {
            // "Ask intake questions" is intentionally absent — oneOffSchema
            // has no intake field, so the toggle was a silent no-op.
            OneOffOptionRow(
                icon: .ticket,
                title: "Single use",
                subtitle: "Link stops working after one booking.",
                isOn: $viewModel.singleUse,
                identifier: "oneOffLinkGenerator.singleUseToggle"
            )
        }
    }
}

private struct OneOffOptionRow: View {
    let icon: PantopusIcon
    let title: String
    let subtitle: String
    @Binding var isOn: Bool
    let identifier: String

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            Icon(icon, size: 15, color: isOn ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                .frame(width: 30, height: 30)
                .background(isOn ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s2)
            Toggle("", isOn: $isOn)
                .labelsHidden()
                .tint(Theme.Color.primary600)
                .accessibilityIdentifier(identifier)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
    }
}

// MARK: - Generate button (sky fill + leading link icon)

private struct OneOffGenerateButton: View {
    let isLoading: Bool
    let isEnabled: Bool
    let action: () async -> Void

    var body: some View {
        Button {
            Task { await action() }
        } label: {
            HStack(spacing: Spacing.s2) {
                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                        .tint(Theme.Color.appTextInverse)
                } else {
                    Icon(.link, size: 16, color: Theme.Color.appTextInverse)
                    Text("Generate link")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .bookingShadow(isEnabled ? .primary : nil)
            .opacity(isEnabled ? 1 : 0.5)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || isLoading)
    }
}

// MARK: - Generated result pieces

private struct OneOffResultHero: View {
    var body: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.check, size: 20, strokeWidth: 3, color: Theme.Color.appTextInverse)
                .frame(width: 40, height: 40)
                .background(Theme.Color.success)
                .clipShape(Circle())
                .overlay(
                    Circle().stroke(Theme.Color.success.opacity(0.12), lineWidth: 5)
                )
            VStack(alignment: .leading, spacing: 1) {
                Text("Link ready")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("A private link for one person.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
        }
    }
}

private struct OneOffResultURL: View {
    let displayURL: String
    let copied: Bool
    let onCopy: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Text(displayURL)
                .font(.system(size: 13, weight: .medium, design: .monospaced))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onCopy) {
                HStack(spacing: Spacing.s1) {
                    Icon(
                        copied ? .check : .copy,
                        size: 14,
                        strokeWidth: 2.4,
                        color: Theme.Color.appTextInverse
                    )
                    Text(copied ? "Copied" : "Copy")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .background(copied ? Theme.Color.success : Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("oneOffLinkGenerator.copy")
        }
        .padding(.leading, Spacing.s3)
        .padding(.trailing, Spacing.s2)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .pantopusShadow(.sm)
    }
}

private struct OneOffMetaPill: View {
    let expiryText: String
    let singleUse: Bool

    var body: some View {
        HStack(spacing: Spacing.s2) {
            segment(icon: .calendarClock, text: expiryText)
            if singleUse {
                Circle()
                    .fill(Theme.Color.appTextMuted)
                    .frame(width: 3, height: 3)
                segment(icon: .ticket, text: "Single use")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private func segment(icon: PantopusIcon, text: String) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon, size: 12, color: Theme.Color.appTextStrong)
            Text(text)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineLimit(1)
        }
    }
}

private struct OneOffShareTile: View {
    let icon: PantopusIcon
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Spacing.s2) {
                Icon(icon, size: 21, color: Theme.Color.primary600)
                    .frame(maxWidth: .infinity)
                    .aspectRatio(1, contentMode: .fit)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .pantopusShadow(.sm)
                Text(title)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("oneOffLinkGenerator.shareTarget.\(title)")
    }
}

private struct OneOffCreateAnotherButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                Icon(.plus, size: 14, strokeWidth: 2.2, color: Theme.Color.primary600)
                Text("Create another")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("oneOffLinkGenerator.createAnother")
    }
}

// MARK: - Generate-error note (two lines + try-again with refresh)

private struct OneOffGenerateErrorNote: View {
    let message: String
    let retry: () async -> Void

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.circleAlert, size: 16, strokeWidth: 2.2, color: Theme.Color.error)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(message)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.error)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Your settings are saved — nothing was lost.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.error)
                    .fixedSize(horizontal: false, vertical: true)
                Button {
                    Task { await retry() }
                } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.rotateCcw, size: 13, strokeWidth: 2.4, color: Theme.Color.error)
                        Text("Try again")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Theme.Color.error)
                    }
                    .padding(.top, Spacing.s1)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("oneOffLinkGenerator.retryGenerate")
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.errorLight, lineWidth: 1)
        )
        .accessibilityIdentifier("oneOffLinkGenerator.generateError")
    }
}

// MARK: - Copied toast (success-tinted)

private struct OneOffCopiedToast: View {
    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.checkCircle2, size: 15, strokeWidth: 2.4, color: Theme.Color.success)
            Text("Link copied")
                .font(.system(size: 12.5, weight: .bold))
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .pantopusShadow(.md)
    }
}

// MARK: - Loading / load-error states

private struct OneOffLoadingView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            ForEach(0..<3, id: \.self) { _ in
                Shimmer(height: 60, cornerRadius: Radii.lg)
            }
            Spacer()
        }
        .padding(Spacing.s4)
        .accessibilityIdentifier("oneOffLinkGenerator.loading")
    }
}

private struct OneOffErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Icon(.alertCircle, size: 36, color: Theme.Color.error)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            PrimaryButton(title: "Try again") { await MainActor.run { retry() } }
                .frame(maxWidth: 240)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("oneOffLinkGenerator.error")
    }
}

// MARK: - Flow layout (hug-width wrapping for chip groups)

private struct OneOffFlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var maxRowWidth: CGFloat = 0

        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                totalHeight += rowHeight + spacing
                maxRowWidth = max(maxRowWidth, x - spacing)
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }

        totalHeight += rowHeight
        maxRowWidth = max(maxRowWidth, x - spacing)
        return CGSize(width: maxRowWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        let maxWidth = proposal.width ?? bounds.width
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0

        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.minX + maxWidth, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

#if DEBUG
#Preview("Configuring") {
    let viewModel = OneOffLinkGeneratorViewModel(owner: .personal) { _ in }
    viewModel.setStateForPreview(.configuring, options: [
        OneOffEventTypeOption(
            id: "et_1",
            name: "Intro call",
            durationLabel: "30 min",
            icon: .video,
            slug: "intro",
            modalityLabel: "video"
        )
    ])
    return OneOffLinkGeneratorView(viewModel: viewModel)
}

#Preview("Generated") {
    let viewModel = OneOffLinkGeneratorViewModel(owner: .personal) { _ in }
    viewModel.setStateForPreview(
        .generated(OneOffGeneratedLink(
            displayURL: "pantopus.com/book/x/7gq4f2",
            shareURL: "https://pantopus.com/book/x/7gq4f2",
            caption: "Expires in 7 days · Single use",
            expiryText: "Expires in 7 days",
            singleUse: true
        )),
        options: []
    )
    return OneOffLinkGeneratorView(viewModel: viewModel)
}
#endif
