//
//  ScheduleVisitView.swift
//  Pantopus
//
//  Stream I12 — F13 Schedule a Visit. Grouped FormShell: title + type, who must
//  be home, when (date / time / length), and an entry note. Commits one
//  concrete visit and pushes its detail.
//

import SwiftUI

struct ScheduleVisitView: View {
    @State private var viewModel: ScheduleVisitViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: ScheduleVisitViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        FormShell(
            title: "Schedule a visit",
            leading: .close,
            rightActionLabel: "Schedule",
            isValid: isReady && viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: { dismiss() },
            onCommit: { Task { _ = await viewModel.save() } },
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
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.scheduleVisit")
        .task { await viewModel.load() }
        .alert("Couldn't schedule", isPresented: saveErrorPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.saveError ?? "")
        }
    }

    private var isReady: Bool {
        if case .ready = viewModel.loadState { return true }
        return false
    }

    @ViewBuilder private var readyBody: some View {
        explainer
        detailsGroup
        hostsGroup
        whenGroup
        accessGroup
    }

    private var explainer: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.info, size: 15, color: Theme.Color.info)
            // Spec explainer copy (visit-setup-frames `VisitExplainer`).
            Text("Slots come from when your chosen hosts are personally free.")
                .font(.system(size: 11.5, weight: .medium))
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.primary800)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.infoBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.infoLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s4)
    }

    /// Sections render via the local `SectionCard` (Home-green overline,
    /// matching the spec's `Section` overline color H.accent700 and Android),
    /// not the shared `FormFieldGroup` (gray overline). Horizontally inset to
    /// align with the FormShell's section gutter.
    private var detailsGroup: some View {
        SectionCard {
            TextField("e.g. Plumber visit", text: $viewModel.title)
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityIdentifier("scheduling.scheduleVisit.titleField")
            if let error = viewModel.titleError {
                fieldError(error)
            }
            Divider().background(Theme.Color.appBorderSubtle)
            Text("Visit type")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            HStack(spacing: Spacing.s2) {
                ForEach(VisitKind.allCases, id: \.self) { kind in
                    SelectChipIcon(label: kind.label, icon: kind.icon, isOn: kind == viewModel.kind) {
                        viewModel.kind = kind
                    }
                }
                Spacer()
            }
        }
        .padding(.horizontal, Spacing.s4)
    }

    private var hostsGroup: some View {
        SectionCard(overline: "Who must be home") {
            if viewModel.members.isEmpty {
                Text("No household members found.")
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            } else {
                ForEach(Array(viewModel.members.enumerated()), id: \.element.id) { index, member in
                    Button { viewModel.toggleHost(member.id) } label: {
                        HStack(spacing: Spacing.s2) {
                            ResourceHomeMemberAvatar(member: member, size: 32)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(member.name)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Theme.Color.appText)
                                Text("Required at home")
                                    .pantopusTextStyle(.caption)
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                            }
                            Spacer()
                            SelectionCheck(isOn: viewModel.whoIsHome.contains(member.id))
                        }
                    }
                    .buttonStyle(.plain)
                    if index < viewModel.members.count - 1 {
                        Divider().background(Theme.Color.appBorderSubtle)
                    }
                }
            }
            if let error = viewModel.hostError {
                fieldError(error)
            }
        }
        .padding(.horizontal, Spacing.s4)
    }

    private var whenGroup: some View {
        SectionCard(overline: "When") {
            DatePicker("Date", selection: $viewModel.date, displayedComponents: .date)
                .tint(Theme.Color.home)
            Divider().background(Theme.Color.appBorderSubtle)
            DatePicker("Start time", selection: $viewModel.startTime, displayedComponents: .hourAndMinute)
                .tint(Theme.Color.home)
            Divider().background(Theme.Color.appBorderSubtle)
            CounterRow(label: "Visit length", value: $viewModel.durationHours, unit: "hr", range: 1...12)
        }
        .padding(.horizontal, Spacing.s4)
    }

    private var accessGroup: some View {
        SectionCard(overline: "Access") {
            TextField("Entry note for the visitor", text: $viewModel.entryNote)
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityIdentifier("scheduling.scheduleVisit.entryNoteField")
            Text("Optional — e.g. \u{201C}Front door code 4827\u{201D}.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            // Spec AccessNote secondary affordance — view-only (the access-code
            // directory has no v1 backend), mirroring Android's `LinkAccessCodeRow`.
            linkAccessCodeRow
        }
        .padding(.horizontal, Spacing.s4)
    }

    private var linkAccessCodeRow: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.keyRound, size: 15, color: Theme.Color.appTextStrong)
                .frame(width: 30, height: 30)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            Text("Link an access code")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: Spacing.s2)
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .contentShape(Rectangle())
        .accessibilityLabel("Link an access code")
        .accessibilityIdentifier("scheduling.scheduleVisit.linkAccessCode")
    }

    private var loadingBody: some View {
        VStack(spacing: Spacing.s3) {
            ForEach(0..<3, id: \.self) { _ in
                Shimmer(height: 90, cornerRadius: Radii.lg)
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

    private var saveErrorPresented: Binding<Bool> {
        Binding(get: { viewModel.saveError != nil }, set: { if !$0 { viewModel.saveError = nil } })
    }
}

/// Icon + label selectable pill (visit type).
struct SelectChipIcon: View {
    let label: String
    let icon: PantopusIcon
    let isOn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 13, color: isOn ? Theme.Color.homeDark : Theme.Color.appTextStrong)
                Text(label)
                    .font(.system(size: 12, weight: isOn ? .bold : .semibold))
                    .foregroundStyle(isOn ? Theme.Color.homeDark : Theme.Color.appTextStrong)
            }
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
