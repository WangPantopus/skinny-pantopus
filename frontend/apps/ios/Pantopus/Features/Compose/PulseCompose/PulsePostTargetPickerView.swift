//
//  PulsePostTargetPickerView.swift
//  Pantopus
//
//  Step 1 — "Where do you want to post?" Card-based chooser grouped
//  into "Your places" (current location / homes / businesses) and
//  "Your network" (connections).
//

import SwiftUI

// swiftlint:disable function_parameter_count multiple_closures_with_trailing_closure type_body_length

public struct PulsePostTargetPickerView: View {
    @State private var viewModel = PulsePostTargetPickerViewModel()
    @State private var expandedHomeList = false
    @State private var expandedBusinessList = false
    @State private var locationError: String?

    private let onSelect: @MainActor (PulsePostingTarget) -> Void
    private let onCancel: @MainActor () -> Void
    /// Hides the "Your network / Connections" card. RN's task-share
    /// picker passes `allowedTargets={['current_location','home','business']}`
    /// (`gig/[id].tsx:1478`) because a task share is always a place post.
    private let hidesNetworkTarget: Bool

    public init(
        onSelect: @escaping @MainActor (PulsePostingTarget) -> Void,
        onCancel: @escaping @MainActor () -> Void,
        hidesNetworkTarget: Bool = false
    ) {
        self.onSelect = onSelect
        self.onCancel = onCancel
        self.hidesNetworkTarget = hidesNetworkTarget
    }

    public var body: some View {
        FormShell(
            title: "New post",
            leading: .close,
            rightActionLabel: nil,
            isValid: false,
            isDirty: false,
            onClose: onCancel,
            onCommit: {},
            content: {
                switch viewModel.state {
                case .loading:
                    loadingBody
                case .ready:
                    listBody
                case let .error(message):
                    EmptyState(
                        icon: .alertCircle,
                        headline: "Couldn't load posting options",
                        subcopy: message,
                        cta: EmptyState.CTA(title: "Try again") {
                            await viewModel.load()
                        }
                    )
                }
            }
        )
        .task { await viewModel.load() }
        .accessibilityIdentifier("pulsePostTargetPicker")
    }

    // MARK: - Loading

    private var loadingBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(width: 230, height: 22, cornerRadius: Radii.sm)
            Shimmer(width: 180, height: 13, cornerRadius: Radii.sm)
                .padding(.bottom, Spacing.s2)
            ForEach(0..<3, id: \.self) { _ in
                Shimmer(height: 72, cornerRadius: Radii.lg)
            }
            Shimmer(width: 110, height: 11, cornerRadius: Radii.sm)
                .padding(.top, Spacing.s2)
            Shimmer(height: 72, cornerRadius: Radii.lg)
        }
        .padding(.horizontal, Spacing.s4)
    }

    // MARK: - Body

    private var listBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Where do you want to post?")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Pick the place or audience your post should reach.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }

            sectionLabel("Your places")

            VStack(spacing: Spacing.s2) {
                targetCard(
                    iconStyle: TargetCardIconStyle(
                        icon: .compass,
                        background: Theme.Color.primary50,
                        color: Theme.Color.primary600
                    ),
                    title: "Current Location",
                    subtitle: "Post to the area where you are right now",
                    isLoading: viewModel.isLocating,
                    identifier: "pulseTarget_currentLocation"
                ) {
                    Task {
                        locationError = nil
                        if let target = await viewModel.selectCurrentLocation() {
                            onSelect(target)
                        } else {
                            locationError = "Could not get your location. Check permissions and try again."
                        }
                    }
                }

                if let locationError {
                    Text(locationError)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                homeSection
                businessSection
            }

            if !hidesNetworkTarget {
                sectionLabel("Your network")
                    .padding(.top, Spacing.s1)

                targetCard(
                    iconStyle: TargetCardIconStyle(
                        icon: .link,
                        background: Theme.Color.warmAmberBg,
                        color: Theme.Color.warmAmber
                    ),
                    title: "Connections",
                    subtitle: "Share with people you trust, wherever they are",
                    identifier: "pulseTarget_connections"
                ) {
                    onSelect(.connections)
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.6)
            .foregroundStyle(Theme.Color.appTextMuted)
    }

    // MARK: - Homes

    @ViewBuilder
    private var homeSection: some View {
        if viewModel.homes.isEmpty {
            targetCard(
                iconStyle: TargetCardIconStyle(
                    icon: .home,
                    background: Theme.Color.homeBg,
                    color: Theme.Color.home
                ),
                title: "Home Area",
                subtitle: "Add a home to post here",
                muted: true,
                identifier: "pulseTarget_homeEmpty"
            ) {}
        } else if viewModel.homes.count == 1, let home = viewModel.homes.first {
            targetCard(
                iconStyle: TargetCardIconStyle(
                    icon: .home,
                    background: Theme.Color.homeBg,
                    color: Theme.Color.home
                ),
                title: "Home Area",
                subtitle: home.label,
                identifier: "pulseTarget_home"
            ) {
                onSelect(.home(homeId: home.id, latitude: home.latitude, longitude: home.longitude, label: home.label))
            }
        } else {
            expandableCard(
                iconStyle: TargetCardIconStyle(
                    icon: .home,
                    background: Theme.Color.homeBg,
                    color: Theme.Color.home
                ),
                title: "Home Area",
                subtitle: "\(viewModel.homes.count) homes",
                isExpanded: expandedHomeList,
                identifier: "pulseTarget_homeGroup",
                toggle: { expandedHomeList.toggle() }
            ) {
                ForEach(viewModel.homes) { home in
                    subRow(title: home.label, identifier: "pulseTargetHome_\(home.id)") {
                        onSelect(.home(homeId: home.id, latitude: home.latitude, longitude: home.longitude, label: home.label))
                    }
                }
            }
        }
    }

    // MARK: - Businesses

    @ViewBuilder
    private var businessSection: some View {
        if !viewModel.businesses.isEmpty {
            if viewModel.businesses.count == 1, let biz = viewModel.businesses.first {
                targetCard(
                    iconStyle: TargetCardIconStyle(
                        icon: .building2,
                        background: Theme.Color.businessBg,
                        color: Theme.Color.business
                    ),
                    title: "Business Area",
                    subtitle: biz.name,
                    identifier: "pulseTarget_business"
                ) {
                    onSelect(.business(businessId: biz.id, latitude: biz.latitude, longitude: biz.longitude, label: biz.label))
                }
            } else {
                expandableCard(
                    iconStyle: TargetCardIconStyle(
                        icon: .building2,
                        background: Theme.Color.businessBg,
                        color: Theme.Color.business
                    ),
                    title: "Business Area",
                    subtitle: "\(viewModel.businesses.count) businesses",
                    isExpanded: expandedBusinessList,
                    identifier: "pulseTarget_businessGroup",
                    toggle: { expandedBusinessList.toggle() }
                ) {
                    ForEach(viewModel.businesses) { biz in
                        subRow(title: biz.name, hint: biz.label, identifier: "pulseTargetBusiness_\(biz.id)") {
                            onSelect(.business(businessId: biz.id, latitude: biz.latitude, longitude: biz.longitude, label: biz.label))
                        }
                    }
                }
            }
        }
    }

    // MARK: - Card builders

    private struct TargetCardIconStyle {
        let icon: PantopusIcon
        let background: Color
        let color: Color
    }

    private func iconTile(_ style: TargetCardIconStyle, muted: Bool = false) -> some View {
        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
            .fill(style.background.opacity(muted ? 0.5 : 1))
            .frame(width: 44, height: 44)
            .overlay {
                Icon(style.icon, size: 22, strokeWidth: 2, color: style.color.opacity(muted ? 0.5 : 1))
            }
    }

    private func cardLabel(title: String, subtitle: String, muted: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(muted ? Theme.Color.appTextMuted : Theme.Color.appText)
            Text(subtitle)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(2)
        }
    }

    private func cardBackground(muted: Bool = false) -> some View {
        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
            .fill(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(
                        Theme.Color.appBorder,
                        style: muted
                            ? StrokeStyle(lineWidth: 1, dash: [4, 3])
                            : StrokeStyle(lineWidth: 1)
                    )
            )
    }

    private func targetCard(
        iconStyle: TargetCardIconStyle,
        title: String,
        subtitle: String,
        muted: Bool = false,
        isLoading: Bool = false,
        identifier: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                iconTile(iconStyle, muted: muted)
                cardLabel(title: title, subtitle: subtitle, muted: muted)
                Spacer(minLength: Spacing.s0)
                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                } else if !muted {
                    Icon(.chevronRight, size: 18, color: Theme.Color.appTextMuted)
                }
            }
            .padding(Spacing.s3)
            .background(cardBackground(muted: muted))
            .contentShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(muted || isLoading)
        .accessibilityIdentifier(identifier)
    }

    /// Card that expands in place to reveal one row per home/business.
    private func expandableCard(
        iconStyle: TargetCardIconStyle,
        title: String,
        subtitle: String,
        isExpanded: Bool,
        identifier: String,
        toggle: @escaping @MainActor () -> Void,
        @ViewBuilder rows: () -> some View
    ) -> some View {
        VStack(spacing: Spacing.s0) {
            Button(action: toggle) {
                HStack(spacing: Spacing.s3) {
                    iconTile(iconStyle)
                    cardLabel(title: title, subtitle: subtitle, muted: false)
                    Spacer(minLength: Spacing.s0)
                    Icon(isExpanded ? .chevronUp : .chevronDown, size: 18, color: Theme.Color.appTextMuted)
                }
                .padding(Spacing.s3)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier(identifier)

            if isExpanded {
                Divider()
                    .padding(.horizontal, Spacing.s3)
                rows()
            }
        }
        .background(cardBackground())
        .pantopusAnimation(.componentState, value: isExpanded)
    }

    private func subRow(
        title: String,
        hint: String? = nil,
        identifier: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(.mapPin, size: 16, color: Theme.Color.appTextSecondary)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.Color.appText)
                    if let hint {
                        Text(hint)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.leading, 44)
            .padding(.vertical, Spacing.s3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}
