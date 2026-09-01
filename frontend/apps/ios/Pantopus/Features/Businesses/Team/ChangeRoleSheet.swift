//
//  ChangeRoleSheet.swift
//  Pantopus
//
//  Role-preset picker presented from a member row's overflow → "Change
//  role". Lists the `BusinessRolePresetDTO`s returned by
//  `/api/businesses/:id/role-presets` and hands the chosen preset back to
//  the host so it can POST the role change optimistically.
//

import SwiftUI

/// Modal sheet that lets the owner pick a new role preset for a member.
public struct ChangeRoleSheet: View {
    @Environment(\.dismiss) private var dismiss

    private let memberName: String
    private let currentRole: BusinessRole
    private let presets: [BusinessRolePresetDTO]
    private let onPick: (BusinessRolePresetDTO) -> Void

    public init(
        memberName: String,
        currentRole: BusinessRole,
        presets: [BusinessRolePresetDTO],
        onPick: @escaping (BusinessRolePresetDTO) -> Void
    ) {
        self.memberName = memberName
        self.currentRole = currentRole
        self.presets = presets
        self.onPick = onPick
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text("Choose a role for \(memberName). This sets what they can see and do.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.top, Spacing.s2)

                    if presets.isEmpty {
                        Text("No roles available.")
                            .pantopusTextStyle(.body)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(Spacing.s6)
                    } else {
                        ForEach(presets) { preset in
                            RolePresetTile(
                                preset: preset,
                                isCurrent: BusinessRole.parse(preset.roleBase) == currentRole
                            ) {
                                onPick(preset)
                                dismiss()
                            }
                        }
                        .padding(.horizontal, Spacing.s4)
                    }
                }
                .padding(.bottom, Spacing.s6)
            }
            .background(Theme.Color.appBg)
            .navigationTitle("Change role")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("businessTeam.changeRoleCancel")
                }
            }
        }
        .accessibilityIdentifier("businessTeam.changeRoleSheet")
    }
}

private struct RolePresetTile: View {
    let preset: BusinessRolePresetDTO
    let isCurrent: Bool
    let onTap: () -> Void

    var body: some View {
        let role = BusinessRole.parse(preset.roleBase)
        let palette = role.palette
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(palette.background)
                    Icon(role.icon, size: 22, color: palette.foreground)
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: Spacing.s2) {
                        Text(preset.displayName)
                            .pantopusTextStyle(.body)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appText)
                        if isCurrent {
                            Text("Current")
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .padding(.horizontal, Spacing.s2)
                                .padding(.vertical, 2)
                                .background(Theme.Color.appSurfaceSunken)
                                .clipShape(Capsule())
                        }
                    }
                    Text(preset.description)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Spacer(minLength: Spacing.s1)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("businessTeam.rolePreset.\(preset.key)")
    }
}

#Preview {
    ChangeRoleSheet(
        memberName: "Dana Okafor",
        currentRole: .admin,
        presets: BusinessTeamSampleData.presets
    ) { _ in }
}
