//
//  ResourceEditorView.swift
//  Pantopus
//
//  Stream I12 — F10 Resource Editor. Grouped FormShell: name + type, who can
//  book, booking rules, available hours, and (edit) a destructive delete.
//

import SwiftUI

// swiftlint:disable file_length

struct ResourceEditorView: View {
    @State private var viewModel: ResourceEditorViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: ResourceEditorViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        FormShell(
            title: viewModel.screenTitle,
            leading: .close,
            rightActionLabel: "Save",
            isValid: isReady && viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: { dismiss() },
            onCommit: { Task { if await viewModel.save() { dismiss() } } },
            content: {
                switch viewModel.loadState {
                case .loading:
                    loadingBody
                case let .error(message):
                    errorBody(message)
                case .ready:
                    readyBody
                }
            }
        )
        .opacity(viewModel.isSaving ? 0.45 : 1)
        .allowsHitTesting(!viewModel.isSaving)
        .overlay {
            if viewModel.isSaving {
                savingOverlay
            }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.resourceEditor")
        .task { await viewModel.load() }
        .alert("Couldn't save", isPresented: saveErrorPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.saveError ?? "")
        }
        // F10 Frame 5 (FrameDelete): centered Dialog overlay with trash-2 icon,
        // title, body, and two stacked full-width 44dp buttons (Delete / Keep).
        // Replaces the previous native bottom action sheet (.confirmationDialog).
        .overlay {
            if viewModel.showDeleteConfirm {
                ResourceDeleteDialog(
                    resourceName: viewModel.name,
                    isPresented: $viewModel.showDeleteConfirm
                ) { Task { if await viewModel.confirmDelete() { dismiss() } } }
            }
        }
    }

    private var isReady: Bool {
        if case .ready = viewModel.loadState { return true }
        return false
    }

    // MARK: Ready body

    @ViewBuilder private var readyBody: some View {
        detailsGroup
        photoGroup
        whoCanBookGroup
        rulesGroup
        hoursGroup
        if !viewModel.isCreate {
            deleteButton
        }
    }

    private var detailsGroup: some View {
        FormFieldGroup("Details") {
            TextField("Name this resource", text: $viewModel.name)
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityIdentifier("scheduling.resourceEditor.nameField")
            if let error = viewModel.nameError {
                fieldError(error)
            }
            Divider().background(Theme.Color.appBorderSubtle)
            Text("Type")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            typeChips
        }
    }

    private var typeChips: some View {
        ResourceFlowChips(items: ResourceKind.allCases) { kind in
            SelectChip(label: kind.label, isOn: kind == viewModel.kind) {
                viewModel.selectKind(kind)
            }
        }
    }

    /// F10 "Photo" section — dashed "Add a photo · Optional" affordance. The
    /// image-picker wiring is deferred; this renders the designed structure.
    private var photoGroup: some View {
        FormFieldGroup("Photo") {
            PhotoAddRow()
        }
    }

    private var whoCanBookGroup: some View {
        FormFieldGroup("Who can book") {
            Picker("Who can book", selection: $viewModel.whoCanBook) {
                ForEach(WhoCanBook.allCases, id: \.self) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)
            if viewModel.whoCanBook == .specific {
                specificMemberPicker
            }
        }
    }

    /// F10 "Specific" member picker — avatar + name + check rows. The member
    /// directory feed is deferred (see ResourceEditorViewModel.members), so the
    /// rows render once a roster is present and otherwise show the caption.
    @ViewBuilder private var specificMemberPicker: some View {
        if viewModel.members.isEmpty {
            Text("In this version, all active home members can book. Per-member access is coming soon.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        } else {
            VStack(spacing: Spacing.s0) {
                ForEach(Array(viewModel.members.enumerated()), id: \.element.id) { index, member in
                    MemberSelectRow(
                        member: member,
                        isOn: viewModel.selectedMemberIds.contains(member.id),
                        showsDivider: index < viewModel.members.count - 1
                    ) {
                        viewModel.toggleMember(member.id)
                    }
                }
            }
        }
    }

    /// F10 "Booking rules" collapsible disclosure. The header carries a green
    /// overline + chevron; collapsed shows the smart-defaults helper, expanded
    /// shows the Max duration / Buffer / Requires-approval rows.
    private var rulesGroup: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { viewModel.toggleRules() }
            } label: {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        Text("Booking rules".uppercased())
                            .pantopusTextStyle(.overline)
                            .foregroundStyle(Theme.Color.homeDark)
                        if !viewModel.isRulesExpanded {
                            Text(viewModel.ruleHelper)
                                .font(.system(size: 10.5, weight: .regular))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                    Spacer()
                    Icon(
                        viewModel.isRulesExpanded ? .chevronUp : .chevronDown,
                        size: 18,
                        color: Theme.Color.appTextMuted
                    )
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("scheduling.resourceEditor.rulesDisclosure")
            .accessibilityAddTraits(.isHeader)
            if viewModel.isRulesExpanded {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    CounterRow(
                        label: "Max duration",
                        value: $viewModel.maxDurationHours,
                        unit: "hr",
                        range: 1...24,
                        error: viewModel.durationError != nil
                    )
                    if let error = viewModel.durationError {
                        fieldError(error)
                    }
                    Divider().background(Theme.Color.appBorderSubtle)
                    CounterRow(label: "Buffer between bookings", value: $viewModel.bufferMin, unit: "min", range: 0...120, step: 5)
                    Divider().background(Theme.Color.appBorderSubtle)
                    Toggle(isOn: $viewModel.requiresApproval) {
                        Text("Requires approval")
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                    .tint(Theme.Color.home)
                }
                .padding(.top, Spacing.s3)
            }
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s4)
    }

    private var hoursGroup: some View {
        FormFieldGroup("Available hours") {
            WeekdayPicker(selected: viewModel.hoursDays) { viewModel.toggleDay($0) }
            Divider().background(Theme.Color.appBorderSubtle)
            HStack {
                Text("Hours")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                Spacer()
                DatePicker("Start", selection: $viewModel.hoursStart, displayedComponents: .hourAndMinute)
                    .labelsHidden()
                    .accessibilityLabel("Available from")
                Text("–").foregroundStyle(Theme.Color.appTextMuted)
                DatePicker("End", selection: $viewModel.hoursEnd, displayedComponents: .hourAndMinute)
                    .labelsHidden()
                    .accessibilityLabel("Available until")
            }
        }
    }

    private var deleteButton: some View {
        Button(role: .destructive) {
            viewModel.showDeleteConfirm = true
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.trash2, size: 14, color: Theme.Color.error)
                Text("Delete resource")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.error)
            }
            .frame(maxWidth: .infinity, minHeight: 38)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("scheduling.resourceEditor.delete")
    }

    // MARK: Loading / error

    private var loadingBody: some View {
        VStack(spacing: Spacing.s3) {
            ForEach(0..<3, id: \.self) { _ in
                Shimmer(height: 96, cornerRadius: Radii.lg)
            }
        }
        .padding(.horizontal, Spacing.s4)
    }

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.cloudOff, size: 32, color: Theme.Color.error)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            HomeSecondaryButton(title: "Retry", icon: .refreshCw) {
                Task { await viewModel.load() }
            }
            .frame(maxWidth: 200)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.s5)
    }

    private func fieldError(_ message: String) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(.circleAlert, size: 11, color: Theme.Color.error)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.error)
        }
    }

    // MARK: Saving overlay (F10 "saving" frame)

    /// Centered white card with a spinning green loader + "Saving resource",
    /// floated over the dimmed form while a commit is in flight.
    private var savingOverlay: some View {
        VStack(spacing: Spacing.s3) {
            ResourceSavingSpinner()
            Text("Saving resource")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.vertical, Spacing.s5)
        .padding(.horizontal, Spacing.s6)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .shadow(color: Theme.Color.appText.opacity(0.1), radius: 12, y: 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Saving resource")
    }

    private var saveErrorPresented: Binding<Bool> {
        Binding(get: { viewModel.saveError != nil }, set: { if !$0 { viewModel.saveError = nil } })
    }
}

// MARK: - Small form primitives (stream-local)

/// Selectable home-green pill.
struct SelectChip: View {
    let label: String
    let isOn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12, weight: isOn ? .bold : .semibold))
                .foregroundStyle(isOn ? Theme.Color.homeDark : Theme.Color.appTextStrong)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, 7)
                .background(isOn ? Theme.Color.homeBg : Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                        .stroke(isOn ? .clear : Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}

/// F10 "Add a photo" dashed-border row. View-only affordance — the image
/// picker is deferred until a media-upload path exists for resources.
struct PhotoAddRow: View {
    var body: some View {
        Button {
            // Image-picker wiring deferred (no resource photo-upload endpoint).
        } label: {
            HStack(spacing: Spacing.s3) {
                Icon(.imagePlus, size: 17, color: Theme.Color.appTextSecondary)
                    .frame(width: 34, height: 34)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                Text("Add a photo")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                Spacer()
                Text("Optional")
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(
                        Theme.Color.appBorderStrong,
                        style: StrokeStyle(lineWidth: 1.5, dash: [4, 4])
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.resourceEditor.addPhoto")
        .accessibilityLabel("Add a photo, optional")
    }
}

/// F10 "Specific" picker row: avatar + name + trailing selection check.
struct MemberSelectRow: View {
    let member: ResourceHomeMember
    let isOn: Bool
    var showsDivider: Bool = true
    let action: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Button(action: action) {
                HStack(spacing: Spacing.s3) {
                    ResourceHomeMemberAvatar(member: member, size: 32)
                    Text(member.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer()
                    SelectionCheck(isOn: isOn)
                }
                .padding(.vertical, Spacing.s2)
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
            if showsDivider {
                Divider().background(Theme.Color.appBorderSubtle)
            }
        }
    }
}

/// Continuously rotating green loader for the F10 saving overlay.
private struct ResourceSavingSpinner: View {
    @State private var spinning = false

    var body: some View {
        Icon(.loaderCircle, size: 26, color: Theme.Color.home)
            .rotationEffect(.degrees(spinning ? 360 : 0))
            .animation(
                .linear(duration: 0.8).repeatForever(autoreverses: false),
                value: spinning
            )
            .onAppear { spinning = true }
            .accessibilityHidden(true)
    }
}

// MARK: - Delete dialog (F10 Frame 5)

/// Centered dialog overlay matching the design's FrameDelete:
/// trash-2 icon, title, body, and two stacked full-width 44dp buttons —
/// red "Delete" on top, bordered "Keep" below. Shown as a scrim overlay
/// rather than a native bottom action sheet, per the design spec.
struct ResourceDeleteDialog: View {
    let resourceName: String
    @Binding var isPresented: Bool
    let onDelete: () -> Void

    var body: some View {
        ZStack {
            // Scrim
            Color.black.opacity(0.35)
                .ignoresSafeArea()
                .onTapGesture { isPresented = false }

            // Dialog card
            VStack(spacing: Spacing.s0) {
                // Icon
                ZStack {
                    Circle()
                        .fill(Theme.Color.errorBg)
                        .frame(width: 48, height: 48)
                    Icon(.trash2, size: 20, color: Theme.Color.error)
                }
                .padding(.bottom, Spacing.s3)

                // Title
                Text("Delete \(resourceName.isEmpty ? "resource" : resourceName)?")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, Spacing.s1)

                // Body
                Text("Existing bookings stay on the calendar. New bookings will be turned off.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, Spacing.s4)

                // Stacked full-width buttons — Delete (red, 44pt) / Keep (bordered, 44pt)
                VStack(spacing: Spacing.s2) {
                    Button {
                        isPresented = false
                        onDelete()
                    } label: {
                        Text("Delete")
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(Theme.Color.error)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("scheduling.resourceEditor.deleteConfirm")

                    Button {
                        isPresented = false
                    } label: {
                        Text("Keep")
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(Theme.Color.appSurface)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                    .stroke(Theme.Color.appBorderStrong, lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("scheduling.resourceEditor.keepConfirm")
                }
            }
            .padding(Spacing.s5)
            .frame(maxWidth: 320)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .shadow(color: Color.black.opacity(0.12), radius: 24, y: 8)
            .padding(.horizontal, Spacing.s5)
        }
        .accessibilityElement(children: .contain)
    }
}

/// Simple wrapping chip row.
struct ResourceFlowChips<Item: Hashable, Chip: View>: View {
    let items: [Item]
    @ViewBuilder let chip: (Item) -> Chip

    var body: some View {
        // Two-row wrap is sufficient for ≤5 items; uses a lazy grid so it
        // reflows under Dynamic Type.
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 84), spacing: Spacing.s2)], alignment: .leading, spacing: Spacing.s2) {
            ForEach(items, id: \.self) { item in
                chip(item)
            }
        }
    }
}

/// "− value unit +" stepper row.
struct CounterRow: View {
    let label: String
    @Binding var value: Int
    let unit: String
    let range: ClosedRange<Int>
    var step: Int = 1
    var error: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(error ? Theme.Color.error : Theme.Color.appTextStrong)
            Spacer()
            HStack(spacing: 0) {
                stepButton(icon: .minus) { value = max(range.lowerBound, value - step) }
                Text("\(value) \(unit)")
                    .font(.system(size: 13, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appText)
                    .frame(minWidth: 56)
                stepButton(icon: .plus) { value = min(range.upperBound, value + step) }
            }
            .overlay(
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .stroke(error ? Theme.Color.error : Theme.Color.appBorder, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
        }
    }

    private func stepButton(icon: PantopusIcon, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(icon, size: 14, color: Theme.Color.appTextStrong)
                .frame(width: 32, height: 34)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(icon == .plus ? "Increase \(label)" : "Decrease \(label)")
    }
}

/// S M T W T F S availability toggle row (Calendar weekday 1…7).
struct WeekdayPicker: View {
    let selected: Set<Int>
    let onToggle: (Int) -> Void

    private let symbols = ["S", "M", "T", "W", "T", "F", "S"]

    var body: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(0..<7, id: \.self) { index in
                let weekday = index + 1
                let isOn = selected.contains(weekday)
                Button { onToggle(weekday) } label: {
                    Text(symbols[index])
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(isOn ? Theme.Color.appTextInverse : Theme.Color.appTextMuted)
                        .frame(maxWidth: .infinity, minHeight: 30)
                        .background(isOn ? Theme.Color.home : Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Self.dayName(index))
                .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
            }
        }
    }

    private static func dayName(_ index: Int) -> String {
        ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index]
    }
}
