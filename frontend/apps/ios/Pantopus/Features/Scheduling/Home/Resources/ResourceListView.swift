//
//  ResourceListView.swift
//  Pantopus
//
//  Stream I12 — F9 Bookable Home Resources · List. Bespoke Home-pillar list:
//  the design's `ResourceRow` (13.5pt/700 title · 11pt type tile · dot+label
//  trailing) and the empty-frame templates quick-start (explainer card +
//  "TEMPLATES" overline + 5 tappable template rows) can't be expressed through
//  the shared `ListOfRows` row chrome, so the loaded / empty / offline frames
//  render bespoke. Loading / error mirror the shared shell visuals locally.
//  Five frames: empty (templates) · loaded · loading · error · offline.
//

import SwiftUI

struct ResourceListView: View {
    @State private var viewModel: ResourceListViewModel

    init(viewModel: ResourceListViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    private var isOffline: Bool {
        !NetworkMonitor.shared.isOnline
    }

    /// FAB shows on the loaded + empty frames only (not loading / error /
    /// offline), matching the design's per-frame FAB visibility.
    private var showsFAB: Bool {
        guard !isOffline else { return false }
        switch viewModel.state {
        case .loaded, .empty: return true
        case .loading, .error: return false
        }
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            stateBody
            // Design F9 FAB — secondary-create, Home tint, bottom-right. Shown
            // on the loaded + empty frames (the design hides it while loading /
            // errored / offline).
            if showsFAB {
                Button { viewModel.openEditor() } label: {
                    Icon(.plus, size: 22, color: Theme.Color.appTextInverse)
                        .frame(width: 52, height: 52)
                        .background(Theme.Color.home)
                        .clipShape(Circle())
                        .shadow(color: Theme.Color.home.opacity(0.3), radius: 8, y: 4)
                }
                .buttonStyle(.plain)
                .padding(Spacing.s4)
                .accessibilityLabel("Add a resource")
                .accessibilityIdentifier("scheduling.resourceList.fab")
            }
        }
        .background(Theme.Color.appBg)
        .navigationTitle("Resources")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add") { viewModel.openEditor() }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.home)
                    .accessibilityLabel("Add a resource")
                    .accessibilityIdentifier("scheduling.resourceList.add")
            }
        }
        .offlineBanner(isOffline: isOffline)
        .accessibilityIdentifier("scheduling.resourceList")
        .task { await viewModel.load() }
    }

    // MARK: Frames

    @ViewBuilder private var stateBody: some View {
        switch viewModel.state {
        case .loading:
            loadingFrame
        case .empty:
            emptyFrame
        case .loaded:
            loadedFrame
        case let .error(message):
            errorFrame(message)
        }
    }

    private var loadedFrame: some View {
        ScrollView {
            VStack(spacing: 9) {
                ForEach(viewModel.items) { item in
                    ResourceRow(item: item, dim: isOffline) {
                        viewModel.openDetail(item.id)
                    }
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s16)
        }
        .refreshable { await viewModel.refresh() }
    }

    // MARK: Empty (templates)

    private var emptyFrame: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 9) {
                explainerCard
                Text("Templates")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, 2)
                    .padding(.top, Spacing.s1)
                    .accessibilityAddTraits(.isHeader)
                ForEach(ResourceListViewModel.templates) { template in
                    TemplateRow(template: template) {
                        viewModel.openTemplate(template)
                    }
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s16)
        }
    }

    private var explainerCard: some View {
        VStack(spacing: Spacing.s0) {
            Icon(.packageOpen, size: 24, color: Theme.Color.home)
                .frame(width: 50, height: 50)
                .background(Theme.Color.homeBg)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .padding(.bottom, Spacing.s3)
            Text("Add what your household shares")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text("Anything members book — rooms, the driveway, tools. Start from a template.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.top, 5)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 18)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    // MARK: Loading

    private var loadingFrame: some View {
        ScrollView {
            VStack(spacing: 9) {
                ForEach(0..<5, id: \.self) { _ in
                    HStack(spacing: 11) {
                        Shimmer(width: 40, height: 40, cornerRadius: 11)
                        VStack(alignment: .leading, spacing: 7) {
                            Shimmer(width: 120, height: 12)
                            Shimmer(width: 48, height: 14, cornerRadius: 9)
                        }
                        Spacer()
                        Shimmer(width: 56, height: 11)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 11)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
        }
        .disabled(true)
    }

    // MARK: Error

    private func errorFrame(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.cloudOff, size: 26, color: Theme.Color.error)
                .frame(width: 56, height: 56)
                .background(Theme.Color.errorBg)
                .clipShape(Circle())
            Text("Couldn't load resources")
                .font(.system(size: 15.5, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 220)
            HomePrimaryButton(title: "Retry", icon: .refreshCw) {
                Task { await viewModel.load() }
            }
            .frame(maxWidth: 160)
            .padding(.top, Spacing.s2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s6)
    }
}

// MARK: - Resource row

/// Design `ResourceRow` — 11pt Home tile · 13.5pt/700 name · sunken type
/// badge · 7pt dot + 11pt colored status text. Dimmed to 0.55 when offline.
private struct ResourceRow: View {
    let item: ResourceListItem
    var dim: Bool = false
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 11) {
                Icon(item.kind.icon, size: 20, strokeWidth: 2, color: Theme.Color.home)
                    .frame(width: 40, height: 40)
                    .background(Theme.Color.homeBg)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                VStack(alignment: .leading, spacing: 5) {
                    Text(item.name)
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(item.kind.label)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.horizontal, Spacing.s2)
                        .padding(.vertical, 2)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(Capsule())
                }
                Spacer(minLength: Spacing.s2)
                HStack(spacing: 5) {
                    Circle()
                        .fill(item.isFree ? Theme.Color.success : Theme.Color.appTextMuted)
                        .frame(width: 7, height: 7)
                    Text(item.statusLabel)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(item.isFree ? Theme.Color.success : Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(dim ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.name), \(item.kind.label), \(item.statusLabel)")
        .accessibilityAddTraits(.isButton)
        // Mirrors Android's `scheduling.resourceList.row.<id>` testTag.
        .accessibilityIdentifier("scheduling.resourceList.row.\(item.id)")
    }
}

// MARK: - Template row

/// Design empty-frame template row — 10pt tile (Home accent, or neutral for
/// "Other") · 13.5pt/700 label · trailing chevron. Tapping opens the editor.
private struct TemplateRow: View {
    let template: ResourceListViewModel.ResourceTemplate
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 11) {
                Icon(
                    template.icon,
                    size: 18,
                    color: template.isNeutral ? Theme.Color.appTextSecondary : Theme.Color.home
                )
                .frame(width: 36, height: 36)
                .background(template.isNeutral ? Theme.Color.appSurfaceSunken : Theme.Color.homeBg)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                Text(template.label)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add \(template.label)")
        .accessibilityIdentifier("scheduling.resourceList.template.\(template.id)")
    }
}
