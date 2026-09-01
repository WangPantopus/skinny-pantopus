//
//  OrganizerControlsSections.swift
//  Pantopus
//
//  S1 — the Manage-train control stacks: dates, helper roster,
//  co-organizers, the open-slots nudge, the gift fund, and the lifecycle
//  rows. All stateless: the screen passes rows + closures so previews and
//  snapshots render without a view-model.
//

// swiftlint:disable file_length

import SwiftUI

// MARK: - Shared chrome

@MainActor
struct ManageSectionHeader: View {
    let title: String
    var actionTitle: String?
    var actionIdentifier: String?
    var onAction: (@MainActor () -> Void)?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.66)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Spacing.s2)
            if let actionTitle, let onAction {
                Button(action: onAction) {
                    Text(actionTitle)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier(actionIdentifier ?? "manageTrainSectionAction")
            }
        }
    }
}

@MainActor
private struct OrganizerSectionCard<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            content
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

@MainActor
struct ManagePillButton: View {
    let title: String
    var icon: PantopusIcon?
    var destructive = false
    var identifier: String
    var isDisabled = false
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                if let icon {
                    Icon(icon, size: 13, color: destructive ? Theme.Color.error : Theme.Color.appText)
                }
                Text(title)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(destructive ? Theme.Color.error : Theme.Color.appText)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 34)
            .background(destructive ? Theme.Color.errorBg : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(destructive ? Theme.Color.errorLight : Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.5 : 1)
        .accessibilityIdentifier(identifier)
    }
}

// MARK: - Dates

@MainActor
struct ManageDatesSection: View {
    let rows: [ManageSlotRow]
    let isBusy: Bool
    let onAdd: @MainActor () -> Void
    let onEdit: @MainActor (ManageSlotRow) -> Void
    let onRemove: @MainActor (ManageSlotRow) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ManageSectionHeader(
                title: "Dates (\(rows.count))",
                actionTitle: "Add date",
                actionIdentifier: "manageTrainAddDateButton",
                onAction: onAdd
            )
            Text(
                """
                Add a new date, move an open one, or remove one you no \
                longer need. If someone already signed up, remove the \
                helper first.
                """
            )
            .font(.system(size: 12.5))
            .foregroundStyle(Theme.Color.appTextSecondary)
            if rows.isEmpty {
                OrganizerSectionCard {
                    Text("No dates added yet")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            ForEach(rows) { row in
                OrganizerSectionCard {
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.dateLabel)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                            Text(row.metaLabel)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer(minLength: Spacing.s2)
                        Text(row.badge)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    if row.isEditable {
                        HStack(spacing: Spacing.s2) {
                            ManagePillButton(
                                title: "Edit",
                                icon: .pencil,
                                identifier: "manageTrainEditDate-\(row.id)",
                                isDisabled: isBusy
                            ) { onEdit(row) }
                            ManagePillButton(
                                title: "Remove",
                                icon: .trash2,
                                destructive: true,
                                identifier: "manageTrainRemoveDate-\(row.id)",
                                isDisabled: isBusy
                            ) { onRemove(row) }
                            Spacer(minLength: Spacing.s0)
                        }
                    } else {
                        Text("A helper already has this date. Remove their signup before changing it.")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
            }
        }
        .accessibilityIdentifier("manageTrainDatesSection")
    }
}

// MARK: - Helper roster

@MainActor
struct ManageHelpersSection: View {
    let rows: [ManageHelperRow]
    let isBusy: Bool
    let onShareAddress: @MainActor (ManageHelperRow) -> Void
    let onConfirm: @MainActor (ManageHelperRow) -> Void
    let onRemove: @MainActor (ManageHelperRow) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ManageSectionHeader(title: "Helpers (\(rows.count))")
            if rows.isEmpty {
                OrganizerSectionCard {
                    Text("No signups yet")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            ForEach(rows) { row in
                OrganizerSectionCard {
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.name)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                            if !row.slotLabel.isEmpty {
                                Text(row.slotLabel)
                                    .pantopusTextStyle(.caption)
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                            }
                            if !row.contribution.isEmpty {
                                Text(row.contribution)
                                    .pantopusTextStyle(.caption)
                                    .foregroundStyle(Theme.Color.appTextMuted)
                            }
                        }
                        Spacer(minLength: Spacing.s2)
                        Text(row.status.capitalized)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    HStack(spacing: Spacing.s2) {
                        if row.canShareAddress {
                            ManagePillButton(
                                title: row.isGuest ? "Email address" : "Share address",
                                icon: .mapPin,
                                identifier: "manageTrainShareAddress-\(row.id)",
                                isDisabled: isBusy
                            ) { onShareAddress(row) }
                        } else if row.status != "canceled" {
                            Text(row.isGuest ? "Exact location sent" : "Exact location shared")
                                .font(.system(size: 11.5))
                                .foregroundStyle(Theme.Color.success)
                        }
                        if row.canConfirm {
                            ManagePillButton(
                                title: "Confirm delivery",
                                icon: .checkCircle,
                                identifier: "manageTrainConfirmDelivery-\(row.id)",
                                isDisabled: isBusy
                            ) { onConfirm(row) }
                        }
                        if row.canRemove {
                            ManagePillButton(
                                title: "Remove",
                                icon: .userMinus,
                                destructive: true,
                                identifier: "manageTrainRemoveHelper-\(row.id)",
                                isDisabled: isBusy
                            ) { onRemove(row) }
                        }
                        Spacer(minLength: Spacing.s0)
                    }
                }
            }
        }
        .accessibilityIdentifier("manageTrainHelpersSection")
    }
}

// MARK: - Co-organizers

@MainActor
struct ManageOrganizersSection: View {
    let rows: [ManageOrganizerRow]
    /// Only the primary organizer may edit the roster
    /// (`backend/routes/supportTrains.js:1055`).
    let canEdit: Bool
    let isBusy: Bool
    @Binding var newOrganizerUserId: String
    let onAdd: @MainActor () -> Void
    let onRemove: @MainActor (ManageOrganizerRow) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ManageSectionHeader(title: "Co-organizers")
            ForEach(rows) { row in
                OrganizerSectionCard {
                    HStack(spacing: Spacing.s2) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.name)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                            Text(row.role.replacingOccurrences(of: "_", with: " ").capitalized)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer(minLength: Spacing.s2)
                        if canEdit, !row.isPrimary {
                            ManagePillButton(
                                title: "Remove",
                                icon: .userMinus,
                                destructive: true,
                                identifier: "manageTrainRemoveOrganizer-\(row.id)",
                                isDisabled: isBusy
                            ) { onRemove(row) }
                        }
                    }
                }
            }
            if canEdit {
                OrganizerSectionCard {
                    Text("Add a co-organizer by user id")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    TextField("User id", text: $newOrganizerUserId)
                        .textFieldStyle(.plain)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .padding(Spacing.s2)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                        .accessibilityIdentifier("manageTrainOrganizerIdField")
                    ManagePillButton(
                        title: "Add co-organizer",
                        icon: .userPlus,
                        identifier: "manageTrainAddOrganizerButton",
                        isDisabled: isBusy || newOrganizerUserId.trimmingCharacters(
                            in: .whitespacesAndNewlines
                        ).isEmpty
                    ) { onAdd() }
                }
            }
        }
        .accessibilityIdentifier("manageTrainOrganizersSection")
    }
}

// MARK: - Nudge

@MainActor
struct ManageNudgeSection: View {
    let openSlotCount: Int
    let draft: String?
    let isBusy: Bool
    let onDraft: @MainActor () -> Void
    let onEditDraft: @MainActor (String) -> Void
    let onSend: @MainActor () -> Void
    let onDiscard: @MainActor () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ManageSectionHeader(title: "Remind helpers")
            if openSlotCount == 0 {
                OrganizerSectionCard {
                    Text("All slots are filled!")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            } else {
                OrganizerSectionCard {
                    Text("\(openSlotCount) open \(openSlotCount == 1 ? "date" : "dates"). Draft a reminder for the campaign chat.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    if let draft {
                        TextEditor(text: Binding(get: { draft }, set: { onEditDraft($0) }))
                            .frame(minHeight: 90)
                            .padding(Spacing.s2)
                            .background(Theme.Color.appSurfaceSunken)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                            .accessibilityIdentifier("manageTrainNudgeDraftField")
                        HStack(spacing: Spacing.s2) {
                            ManagePillButton(
                                title: "Send to chat",
                                icon: .send,
                                identifier: "manageTrainSendNudgeButton",
                                isDisabled: isBusy || draft.trimmingCharacters(
                                    in: .whitespacesAndNewlines
                                ).isEmpty
                            ) { onSend() }
                            ManagePillButton(
                                title: "Discard",
                                icon: .x,
                                identifier: "manageTrainDiscardNudgeButton",
                                isDisabled: isBusy
                            ) { onDiscard() }
                            Spacer(minLength: Spacing.s0)
                        }
                    } else {
                        ManagePillButton(
                            title: "Draft a reminder",
                            icon: .megaphone,
                            identifier: "manageTrainDraftNudgeButton",
                            isDisabled: isBusy
                        ) { onDraft() }
                    }
                }
            }
        }
        .accessibilityIdentifier("manageTrainNudgeSection")
    }
}

// MARK: - Gift fund

@MainActor
struct ManageFundSection: View {
    let fund: SupportTrainFundDTO?
    /// Enabling is primary + co-organizer; disabling is primary-only
    /// (`backend/routes/supportTrains.js:1696` / l.1759).
    let canDisable: Bool
    let isBusy: Bool
    @Binding var goalDollars: String
    let onEnable: @MainActor () -> Void
    let onDisable: @MainActor () -> Void

    private var isEnabled: Bool {
        fund?.enabled == true
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ManageSectionHeader(title: "Gift fund")
            OrganizerSectionCard {
                if isEnabled {
                    Text(totalLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Neighbors can chip in from the train's page.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                } else {
                    Text("Let neighbors chip in money as well as meals.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                HStack(spacing: Spacing.s2) {
                    TextField("Goal in dollars (optional)", text: $goalDollars)
                        .textFieldStyle(.plain)
                        .keyboardType(.numberPad)
                        .padding(Spacing.s2)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                        .accessibilityIdentifier("manageTrainFundGoalField")
                    ManagePillButton(
                        title: isEnabled ? "Update goal" : "Enable fund",
                        icon: .gift,
                        identifier: "manageTrainEnableFundButton",
                        isDisabled: isBusy
                    ) { onEnable() }
                }
                if isEnabled, canDisable {
                    ManagePillButton(
                        title: "Disable fund",
                        icon: .x,
                        destructive: true,
                        identifier: "manageTrainDisableFundButton",
                        isDisabled: isBusy
                    ) { onDisable() }
                }
            }
        }
        .accessibilityIdentifier("manageTrainFundSection")
    }

    private var totalLabel: String {
        let total = Double(fund?.totalAmount ?? 0) / 100
        guard let goal = fund?.goalAmount, goal > 0 else {
            return String(format: "$%.0f raised", total)
        }
        return String(format: "$%.0f of $%.0f goal", total, Double(goal) / 100)
    }
}

// MARK: - Lifecycle

@MainActor
struct ManageLifecycleSection: View {
    let status: String
    let viewerRole: SupportTrainViewerRole
    let isBusy: Bool
    let onPause: @MainActor () -> Void
    let onResume: @MainActor () -> Void
    let onUnpublish: @MainActor () -> Void
    let onArchive: @MainActor () -> Void
    let onDelete: @MainActor () -> Void

    private var isLive: Bool {
        status == "published" || status == "active"
    }

    private var isPrimary: Bool {
        viewerRole == .primaryOrganizer
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ManageSectionHeader(title: "Train status · \(status.capitalized)")
            OrganizerSectionCard {
                if isLive {
                    ManagePillButton(
                        title: "Pause train",
                        icon: .pause,
                        identifier: "manageTrainPauseButton",
                        isDisabled: isBusy
                    ) { onPause() }
                }
                if status == "paused" {
                    ManagePillButton(
                        title: "Resume train",
                        icon: .play,
                        identifier: "manageTrainResumeButton",
                        isDisabled: isBusy
                    ) { onResume() }
                }
                if isLive, isPrimary {
                    ManagePillButton(
                        title: "Unpublish (back to draft)",
                        icon: .eyeOff,
                        destructive: true,
                        identifier: "manageTrainUnpublishButton",
                        isDisabled: isBusy
                    ) { onUnpublish() }
                }
                if status == "completed", isPrimary {
                    ManagePillButton(
                        title: "Archive train",
                        icon: .archive,
                        destructive: true,
                        identifier: "manageTrainArchiveButton",
                        isDisabled: isBusy
                    ) { onArchive() }
                }
                if isPrimary {
                    ManagePillButton(
                        title: "Delete train",
                        icon: .trash2,
                        destructive: true,
                        identifier: "manageTrainDeleteButton",
                        isDisabled: isBusy
                    ) { onDelete() }
                    Text("Permanent. Only possible while no helper has committed and no gift-fund money has come in.")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        }
        .accessibilityIdentifier("manageTrainLifecycleSection")
    }
}
