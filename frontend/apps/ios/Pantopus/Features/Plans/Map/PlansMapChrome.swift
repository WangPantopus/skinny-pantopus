//
//  PlansMapChrome.swift
//  Pantopus
//
//  What floats over the Plans map (boards F1, F3, F4): the area and time
//  pill, "Show my location", the type chips (glass, 36 pt, the choice
//  rule), the Host button, and with a pin selected the back button and the
//  "Area only until you're in" chip.
//

import SwiftUI

struct PlansMapTopBar: View {
    let viewModel: PlansMapViewModel
    let showsPlaydates: Bool
    let onAreaTap: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if viewModel.selectedId != nil {
                selectedBar
            } else if viewModel.phase == .ready {
                HStack(spacing: Spacing.s2) {
                    areaPill
                    if !viewModel.isEmpty { locateButton }
                }
                if !viewModel.isEmpty { chipRow }
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s1)
    }

    // MARK: - Area pill

    private var areaPill: some View {
        Button(action: onAreaTap) {
            HStack(spacing: 10) {
                Icon(.mapPin, size: 18, color: Theme.Color.appText)
                (Text(viewModel.areaName ?? "Near you").fontWeight(.semibold)
                    + Text(" · \(windowLabel)").fontWeight(.medium).foregroundColor(Theme.Color.appTextSecondary))
                    .planFont(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronDown, size: 16, color: Theme.Color.appText)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 48)
            .background(Capsule().fill(.regularMaterial))
            .shadow(color: .black.opacity(0.12), radius: 5, x: 0, y: 2)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Area and time: \(viewModel.areaName ?? "near you"), \(windowLabel)")
        .accessibilityHint("Changes the area and the time")
        .accessibilityIdentifier("plansAreaPill")
    }

    private var windowLabel: String {
        switch viewModel.window {
        case .now: "Now"
        case .today: "Today"
        case .week: "This week"
        case .weekend: "This weekend"
        }
    }

    private var locateButton: some View {
        Button {
            Task { await viewModel.locate() }
        } label: {
            Icon(.locationArrow, size: 20, color: Theme.Color.appText)
                .frame(width: 48, height: 48)
                .background(Circle().fill(.regularMaterial))
                .shadow(color: .black.opacity(0.12), radius: 5, x: 0, y: 2)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Show my location")
        .accessibilityIdentifier("plansLocate")
    }

    // MARK: - Type chips

    private var chipRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                allChip
                ForEach(kinds) { kind in kindChip(kind) }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s1)
        }
        .padding(.horizontal, -Spacing.s3)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Plan types")
    }

    private var kinds: [PlanKind] {
        PlanKind.displayOrder.filter { $0 != .playdate || showsPlaydates }
    }

    private var allChip: some View {
        let isOn = viewModel.kindFilter == nil
        return chip(isOn: isOn, label: "All") {
            if isOn { Icon(.check, size: 14, strokeWidth: 2.8, color: Theme.Color.primary700) }
        } action: {
            change { viewModel.setKind(nil) }
        }
    }

    private func kindChip(_ kind: PlanKind) -> some View {
        let isOn = viewModel.kindFilter == kind
        return chip(isOn: isOn, label: kind.title) {
            PlanSwatch(kind: kind)
        } action: {
            change { viewModel.setKind(isOn ? nil : kind) }
        }
    }

    private func chip(isOn: Bool, label: String, @ViewBuilder leading: () -> some View, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 7) {
                leading()
                Text(label)
                    .planFont(.smallStrong)
                    .foregroundStyle(isOn ? Theme.Color.primary700 : Theme.Color.appText)
                    .lineLimit(1)
            }
            .padding(.leading, Spacing.s2)
            .padding(.trailing, Spacing.s3)
            .frame(minHeight: 36)
            .background(Capsule().fill(isOn ? AnyShapeStyle(Theme.Color.primary50) : AnyShapeStyle(.regularMaterial)))
            .overlay(Capsule().stroke(isOn ? Theme.Color.primary700 : Color.clear, lineWidth: 1))
            .shadow(color: .black.opacity(0.12), radius: 5, x: 0, y: 2)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
        .accessibilityLabel(label)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("plansChip.\(label)")
    }

    private func change(_ update: () -> Void) {
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.18), update)
    }

    // MARK: - Selected pin

    private var selectedBar: some View {
        HStack(spacing: Spacing.s2) {
            Button {
                withAnimation(reduceMotion ? .easeInOut(duration: 0.15) : .spring(response: 0.35, dampingFraction: 0.86)) {
                    viewModel.clearSelection()
                }
            } label: {
                Icon(.chevronLeft, size: 20, color: Theme.Color.appText)
                    .frame(width: 48, height: 48)
                    .background(Circle().fill(.regularMaterial))
                    .shadow(color: .black.opacity(0.12), radius: 5, x: 0, y: 2)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back to all plans")
            .accessibilityIdentifier("plansSelectedBack")
            Spacer(minLength: Spacing.s2)
            if showsAreaChip { PlanScopeChip(text: "Area only until you're in") }
        }
    }

    /// The host and people who are in see the exact place; everyone else the area.
    private var showsAreaChip: Bool {
        guard let id = viewModel.selectedId, let pin = viewModel.pin(for: id) else { return true }
        return !pin.isExactPoint
    }
}

/// Board F1 "Host": the floating primary button over the map.
struct PlansHostButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(.plus, size: 20, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                Text("Host")
                    .planFont(.bodyStrong)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.leading, Spacing.s4)
            .padding(.trailing, Spacing.s5)
            .frame(minHeight: 50)
            .background(Capsule().fill(Theme.Color.primarySolid))
            .shadow(color: Theme.Color.primary600.opacity(0.32), radius: 8, x: 0, y: 6)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Host a plan")
        .accessibilityIdentifier("plansHostButton")
    }
}
