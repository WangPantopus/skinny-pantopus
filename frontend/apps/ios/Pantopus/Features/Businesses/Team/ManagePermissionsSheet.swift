//
//  ManagePermissionsSheet.swift
//  Pantopus
//
//  Presented from a member row's overflow → "Manage permissions". Fetches
//  the member's effective permission set
//  (`GET /api/businesses/:id/members/:userId/permissions`) and lets the
//  owner toggle a curated set of scoped permissions
//  (`POST …/permissions`). Toggles are optimistic with rollback.
//

import SwiftUI

/// One togglable permission with a human label, grouped by area.
struct BusinessPermissionOption: Identifiable, Hashable {
    let key: String
    let label: String
    let group: String
    var id: String {
        key
    }
}

/// The curated catalog the sheet exposes. A faithful subset of the
/// backend's permission vocabulary (see `businessPermissions.js`) — the
/// management-relevant grants an owner is most likely to tune per member.
enum BusinessPermissionCatalog {
    static let options: [BusinessPermissionOption] = [
        BusinessPermissionOption(key: "profile.edit", label: "Edit profile", group: "Profile & pages"),
        BusinessPermissionOption(key: "pages.publish", label: "Publish pages", group: "Profile & pages"),
        BusinessPermissionOption(key: "catalog.manage", label: "Manage catalog", group: "Catalog & gigs"),
        BusinessPermissionOption(key: "gigs.manage", label: "Manage gigs", group: "Catalog & gigs"),
        BusinessPermissionOption(key: "reviews.respond", label: "Respond to reviews", group: "Customers"),
        BusinessPermissionOption(key: "team.invite", label: "Invite teammates", group: "Team"),
        BusinessPermissionOption(key: "team.manage", label: "Manage team", group: "Team"),
        BusinessPermissionOption(key: "finance.manage", label: "Manage finances", group: "Money"),
        BusinessPermissionOption(key: "insights.view", label: "View insights", group: "Money")
    ]

    /// Group keys in stable display order.
    static let groupOrder: [String] = ["Profile & pages", "Catalog & gigs", "Customers", "Team", "Money"]
}

/// Local load state for the sheet.
private enum PermissionsLoad: Equatable {
    case loading
    case loaded
    case error(String)
}

public struct ManagePermissionsSheet: View {
    @Environment(\.dismiss) private var dismiss

    private let memberName: String
    private let loadPermissions: () async -> BusinessPermissionLoadResult
    private let toggle: (String, Bool) async -> Bool

    @State private var load: PermissionsLoad = .loading
    @State private var granted: Set<String> = []
    @State private var inFlight: Set<String> = []

    public init(
        memberName: String,
        loadPermissions: @escaping () async -> BusinessPermissionLoadResult,
        toggle: @escaping (String, Bool) async -> Bool
    ) {
        self.memberName = memberName
        self.loadPermissions = loadPermissions
        self.toggle = toggle
    }

    public var body: some View {
        NavigationStack {
            content
                .background(Theme.Color.appBg)
                .navigationTitle("Permissions")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") { dismiss() }
                            .accessibilityIdentifier("businessTeam.permissionsDone")
                    }
                }
        }
        .accessibilityIdentifier("businessTeam.permissionsSheet")
        .task { await reload() }
    }

    @ViewBuilder private var content: some View {
        switch load {
        case .loading:
            VStack(spacing: Spacing.s3) {
                ForEach(0..<6, id: \.self) { _ in
                    Shimmer(height: 48, cornerRadius: Radii.md)
                }
            }
            .padding(Spacing.s4)
            .frame(maxHeight: .infinity, alignment: .top)
        case let .error(message):
            VStack(spacing: Spacing.s4) {
                Icon(.alertCircle, size: 40, color: Theme.Color.error)
                Text(message)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                PrimaryButton(title: "Try again") { await reload() }
                    .frame(maxWidth: 240)
            }
            .padding(Spacing.s6)
            .frame(maxHeight: .infinity)
        case .loaded:
            loadedList
        }
    }

    private var loadedList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Text("Fine-tune what \(memberName) can do. These override their role defaults.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)

                ForEach(BusinessPermissionCatalog.groupOrder, id: \.self) { group in
                    let options = BusinessPermissionCatalog.options.filter { $0.group == group }
                    if !options.isEmpty {
                        VStack(alignment: .leading, spacing: Spacing.s2) {
                            Text(group.uppercased())
                                .font(.system(size: 10.5, weight: .bold))
                                .tracking(0.8)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                            VStack(spacing: Spacing.s0) {
                                ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
                                    PermissionToggleRow(
                                        option: option,
                                        isOn: granted.contains(option.key),
                                        isBusy: inFlight.contains(option.key)
                                    ) { newValue in
                                        Task { await apply(option: option, newValue: newValue) }
                                    }
                                    if index < options.count - 1 {
                                        Divider().background(Theme.Color.appBorderSubtle)
                                            .padding(.leading, Spacing.s3)
                                    }
                                }
                            }
                            .background(Theme.Color.appSurface)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                    .stroke(Theme.Color.appBorder, lineWidth: 1)
                            )
                        }
                    }
                }
            }
            .padding(Spacing.s4)
        }
    }

    private func reload() async {
        load = .loading
        switch await loadPermissions() {
        case let .success(permissions):
            granted = Set(permissions)
            load = .loaded
        case let .failure(error):
            load = .error(error.message)
        }
    }

    private func apply(option: BusinessPermissionOption, newValue: Bool) async {
        guard !inFlight.contains(option.key) else { return }
        let previous = granted
        inFlight.insert(option.key)
        if newValue { granted.insert(option.key) } else { granted.remove(option.key) }
        let ok = await toggle(option.key, newValue)
        if !ok { granted = previous }
        inFlight.remove(option.key)
    }
}

private struct PermissionToggleRow: View {
    let option: BusinessPermissionOption
    let isOn: Bool
    let isBusy: Bool
    let onToggle: (Bool) -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Text(option.label)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            Toggle("", isOn: Binding(
                get: { isOn },
                set: { onToggle($0) }
            ))
            .labelsHidden()
            .tint(Theme.Color.business)
            .disabled(isBusy)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .accessibilityIdentifier("businessTeam.permission.\(option.key)")
    }
}

#Preview {
    ManagePermissionsSheet(
        memberName: "Dana Okafor",
        loadPermissions: { .success(["profile.edit", "reviews.respond", "insights.view"]) },
        toggle: { _, _ in true }
    )
}
