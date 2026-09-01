//
//  FilterSheetControls.swift
//  Pantopus
//

import SwiftUI

// MARK: - Chip group

@MainActor
struct FilterChipGroupControl: View {
    let sectionId: String
    let options: [FilterOption]
    let selectedIds: Set<String>
    let onChange: @MainActor (Set<String>) -> Void

    var body: some View {
        FilterSheetFlowLayout(spacing: Spacing.s2) {
            ForEach(options) { option in
                let isOn = selectedIds.contains(option.id)
                Button {
                    var next = selectedIds
                    if isOn { next.remove(option.id) } else { next.insert(option.id) }
                    onChange(next)
                } label: {
                    Text(option.label)
                        .font(.system(size: 14, weight: isOn ? .semibold : .regular))
                        .foregroundStyle(isOn ? Theme.Color.primary600 : Theme.Color.appText)
                        .padding(.horizontal, Spacing.s3)
                        .frame(minHeight: 36)
                        .background(isOn ? Theme.Color.primary50 : Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                                .stroke(
                                    isOn ? Theme.Color.primary600 : Theme.Color.appBorder,
                                    lineWidth: isOn ? 1.5 : 1
                                )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                }
                .buttonStyle(.plain)
                .frame(minHeight: 44)
                .accessibilityLabel(option.label)
                .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("filterChip_\(sectionId)_\(option.id)")
            }
        }
    }
}

// MARK: - Single-select chip group

@MainActor
struct FilterSingleChipControl: View {
    let sectionId: String
    let options: [FilterOption]
    let selectedId: String?
    let onChange: @MainActor (String?) -> Void

    var body: some View {
        FilterSheetFlowLayout(spacing: Spacing.s2) {
            ForEach(options) { option in
                let isOn = selectedId == option.id
                Button {
                    onChange(isOn ? nil : option.id)
                } label: {
                    Text(option.label)
                        .font(.system(size: 14, weight: isOn ? .semibold : .regular))
                        .foregroundStyle(isOn ? Theme.Color.primary600 : Theme.Color.appText)
                        .padding(.horizontal, Spacing.s3)
                        .frame(minHeight: 36)
                        .background(isOn ? Theme.Color.primary50 : Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                                .stroke(
                                    isOn ? Theme.Color.primary600 : Theme.Color.appBorder,
                                    lineWidth: isOn ? 1.5 : 1
                                )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                }
                .buttonStyle(.plain)
                .frame(minHeight: 44)
                .accessibilityLabel(option.label)
                .accessibilityValue(isOn ? "Selected" : "Not selected")
                .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("filterSingleChip_\(sectionId)_\(option.id)")
            }
        }
    }
}

// MARK: - Radio

@MainActor
struct FilterRadioControl: View {
    let sectionId: String
    let options: [FilterOption]
    let selectedId: String?
    let onChange: @MainActor (String?) -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(options) { option in
                let isOn = selectedId == option.id
                Button {
                    onChange(isOn ? nil : option.id)
                } label: {
                    HStack(spacing: Spacing.s3) {
                        radioGlyph(isOn: isOn)
                        Text(option.label)
                            .font(.system(size: 15, weight: isOn ? .semibold : .regular))
                            .foregroundStyle(Theme.Color.appText)
                        Spacer(minLength: Spacing.s0)
                    }
                    .padding(.vertical, Spacing.s3)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(option.label)
                .accessibilityValue(isOn ? "Selected" : "Not selected")
                .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("filterRadio_\(sectionId)_\(option.id)")
                if option.id != options.last?.id {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.leading, Spacing.s8)
                }
            }
        }
    }

    private func radioGlyph(isOn: Bool) -> some View {
        ZStack {
            Circle()
                .stroke(
                    isOn ? Theme.Color.primary600 : Theme.Color.appBorderStrong,
                    lineWidth: 1.5
                )
                .frame(width: 20, height: 20)
            if isOn {
                Circle()
                    .fill(Theme.Color.primary600)
                    .frame(width: 10, height: 10)
            }
        }
    }
}

// MARK: - Multi-select

@MainActor
struct FilterMultiSelectControl: View {
    let sectionId: String
    let options: [FilterOption]
    let selectedIds: Set<String>
    let onChange: @MainActor (Set<String>) -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(options) { option in
                let isOn = selectedIds.contains(option.id)
                Button {
                    var next = selectedIds
                    if isOn { next.remove(option.id) } else { next.insert(option.id) }
                    onChange(next)
                } label: {
                    HStack(spacing: Spacing.s3) {
                        checkboxGlyph(isOn: isOn)
                        Text(option.label)
                            .font(.system(size: 15, weight: .regular))
                            .foregroundStyle(Theme.Color.appText)
                        Spacer(minLength: Spacing.s0)
                    }
                    .padding(.vertical, Spacing.s3)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(option.label)
                .accessibilityValue(isOn ? "Checked" : "Not checked")
                .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("filterMulti_\(sectionId)_\(option.id)")
                if option.id != options.last?.id {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.leading, Spacing.s8)
                }
            }
        }
    }

    private func checkboxGlyph(isOn: Bool) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.sm)
                .fill(isOn ? Theme.Color.primary600 : Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.sm)
                        .stroke(
                            isOn ? Theme.Color.primary600 : Theme.Color.appBorderStrong,
                            lineWidth: 1.5
                        )
                )
                .frame(width: 20, height: 20)
            if isOn {
                Icon(.check, size: 12, color: Theme.Color.appTextInverse)
            }
        }
    }
}

// MARK: - Toggle list

@MainActor
struct FilterToggleControl: View {
    let sectionId: String
    let options: [FilterOption]
    let selectedIds: Set<String>
    let onChange: @MainActor (Set<String>) -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(options) { option in
                let isOn = selectedIds.contains(option.id)
                Toggle(
                    isOn: Binding(
                        get: { isOn },
                        set: { newValue in
                            var next = selectedIds
                            if newValue { next.insert(option.id) } else { next.remove(option.id) }
                            onChange(next)
                        }
                    )
                ) {
                    Text(option.label)
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(Theme.Color.appText)
                }
                .toggleStyle(SwitchToggleStyle(tint: Theme.Color.primary600))
                .frame(minHeight: 44)
                .accessibilityIdentifier("filterToggle_\(sectionId)_\(option.id)")
                if option.id != options.last?.id {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                }
            }
        }
    }
}

// MARK: - Step slider (discrete stops)

@MainActor
struct FilterStepSliderControl: View {
    let sectionId: String
    let stops: [FilterOption]
    let selectedIndex: Int
    let onChange: @MainActor (Int) -> Void

    private var maxIndex: Int {
        max(stops.count - 1, 0)
    }

    private var clampedIndex: Int {
        min(max(selectedIndex, 0), maxIndex)
    }

    private var currentStop: FilterOption? {
        stops.indices.contains(clampedIndex) ? stops[clampedIndex] : nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Slider(
                value: Binding(
                    get: { Double(clampedIndex) },
                    set: { onChange(Int($0.rounded())) }
                ),
                in: 0...Double(maxIndex),
                step: 1
            )
            .tint(Theme.Color.primary600)
            .accessibilityIdentifier("filterStepSlider_\(sectionId)")
            .accessibilityLabel("Distance radius")
            .accessibilityValue(currentStop?.label ?? "")
            HStack {
                Text(stops.first?.label ?? "")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                Text(currentStop?.label ?? "")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                    .accessibilityIdentifier("filterStepSliderValue_\(sectionId)")
                Spacer()
                Text(stops.last?.label ?? "")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Range slider

@MainActor
struct FilterRangeSliderControl: View {
    let sectionId: String
    let range: FilterRange
    let onChange: @MainActor (FilterRange) -> Void

    private let trackHeight: CGFloat = 4
    private let thumbSize: CGFloat = 24

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            GeometryReader { geo in
                let usableWidth = max(geo.size.width - thumbSize, 1)
                let lowerFraction = fraction(for: range.lower)
                let upperFraction = fraction(for: range.upper)
                let lowerX = lowerFraction * usableWidth
                let upperX = upperFraction * usableWidth

                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Theme.Color.appBorder)
                        .frame(height: trackHeight)
                        .padding(.horizontal, thumbSize / 2)
                    Capsule()
                        .fill(Theme.Color.primary600)
                        .frame(width: max(upperX - lowerX, 0), height: trackHeight)
                        .offset(x: lowerX + thumbSize / 2)
                    thumb()
                        .offset(x: lowerX)
                        .gesture(makeDrag(usableWidth: usableWidth, isUpper: false, coordinateSpaceName: "filterRange_\(sectionId)"))
                        .accessibilityLabel("Minimum")
                        .accessibilityValue("\(Int(range.lower))")
                        .accessibilityIdentifier("filterRangeLower_\(sectionId)")
                    thumb()
                        .offset(x: upperX)
                        .gesture(makeDrag(usableWidth: usableWidth, isUpper: true, coordinateSpaceName: "filterRange_\(sectionId)"))
                        .accessibilityLabel("Maximum")
                        .accessibilityValue("\(Int(range.upper))")
                        .accessibilityIdentifier("filterRangeUpper_\(sectionId)")
                }
                .coordinateSpace(name: "filterRange_\(sectionId)")
                .frame(height: thumbSize)
            }
            .frame(height: thumbSize)
            HStack {
                Text("\(Int(range.lower))")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Text("\(Int(range.upper))")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
            }
        }
        .accessibilityElement(children: .contain)
    }

    private func thumb() -> some View {
        Circle()
            .fill(Theme.Color.appSurface)
            .overlay(Circle().stroke(Theme.Color.primary600, lineWidth: 2))
            .frame(width: thumbSize, height: thumbSize)
            .pantopusShadow(.sm)
    }

    private func fraction(for value: Double) -> CGFloat {
        let span = range.max - range.min
        guard span > 0 else { return 0 }
        return CGFloat((value - range.min) / span)
    }

    private func value(forFraction fraction: CGFloat) -> Double {
        let span = range.max - range.min
        let raw = range.min + Double(min(max(fraction, 0), 1)) * span
        guard range.step > 0 else { return raw }
        let stepped = (raw - range.min) / range.step
        return range.min + stepped.rounded() * range.step
    }

    private func makeDrag(usableWidth: CGFloat, isUpper: Bool, coordinateSpaceName: String) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named(coordinateSpaceName))
            .onChanged { drag in
                let normalized = (drag.location.x - thumbSize / 2) / max(usableWidth, 1)
                let newValue = value(forFraction: normalized)
                var next = range
                if isUpper {
                    next.upper = min(max(newValue, range.lower), range.max)
                } else {
                    next.lower = max(min(newValue, range.upper), range.min)
                }
                onChange(next)
            }
    }
}
