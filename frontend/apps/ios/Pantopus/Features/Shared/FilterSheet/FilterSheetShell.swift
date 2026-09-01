//
//  FilterSheetShell.swift
//  Pantopus
//
//  Shared bottom-sheet scaffold for filter / sort surfaces. The host
//  wraps this view in `.sheet(isPresented:)` and supplies
//  `.presentationDetents([.medium])` (or accepts the default applied
//  here). The shell owns the working copy of the selection so Reset
//  doesn't leak back to the host until Apply is tapped, and tap-outside
//  dismisses without firing the apply callback.
//

import SwiftUI

/// Scaffold for every filter / sort bottom sheet.
///
/// - The shell maintains an internal working copy of `sections`. Each
///   control mutates that copy without touching the host's bindings.
/// - **Reset** swaps the working copy for `sections.cleared()` — no
///   dismissal.
/// - **Apply** fires `onApply(workingSections)` then `onClose()` so
///   the host can dismiss the sheet.
/// - **Tap-outside** is handled by SwiftUI's `.sheet` binding; the
///   shell never sees it, so `onApply` is never invoked.
@MainActor
public struct FilterSheetShell: View {
    private let title: String
    private let sections: [FilterSection]
    private let applyLabel: String
    private let resetLabel: String
    private let footerAccessory: (@MainActor ([FilterSection]) -> AnyView)?
    private let onApply: @MainActor ([FilterSection]) -> Void
    private let onClose: @MainActor () -> Void

    @State private var working: [FilterSection]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// - Parameters:
    ///   - title: Sheet header label — typically `"Filters"` or `"Sort"`.
    ///   - sections: Initial sections + selection state. The shell
    ///     copies these into its working state on init.
    ///   - applyLabel: Bottom primary button label. Defaults to `"Apply"`.
    ///   - resetLabel: Bottom ghost button label. Defaults to `"Reset"`.
    ///   - footerAccessory: Optional extra footer row rendered under the
    ///     Reset/Apply buttons. Receives the **live working sections**
    ///     so the accessory can react to unapplied edits (e.g. the Gigs
    ///     "Save this search" enablement). `nil` hides the row.
    ///   - onApply: Called with the working sections when the user
    ///     taps the primary button. The shell calls `onClose()` after.
    ///   - onClose: Called whenever the shell wants to dismiss. The
    ///     host toggles its `@State var isPresented = false` here.
    public init(
        title: String = "Filters",
        sections: [FilterSection],
        applyLabel: String = "Apply",
        resetLabel: String = "Reset",
        footerAccessory: (@MainActor ([FilterSection]) -> AnyView)? = nil,
        onApply: @escaping @MainActor ([FilterSection]) -> Void,
        onClose: @escaping @MainActor () -> Void
    ) {
        self.title = title
        self.sections = sections
        self.applyLabel = applyLabel
        self.resetLabel = resetLabel
        self.footerAccessory = footerAccessory
        self.onApply = onApply
        self.onClose = onClose
        _working = State(initialValue: sections)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s6) {
                    ForEach(working.indices, id: \.self) { idx in
                        FilterSectionRow(section: working[idx]) { updated in
                            update(at: idx, with: updated)
                        }
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s4)
                .padding(.bottom, Spacing.s5)
            }
            footer
        }
        .background(Theme.Color.appSurface)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .pantopusAnimation(.componentState, value: working)
        .accessibilityIdentifier("filterSheet")
    }

    // MARK: - Chrome

    private var header: some View {
        HStack {
            Text(title)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("filterSheetTitle")
            Spacer()
            Button(
                action: { onClose() },
                label: {
                    Icon(.x, size: 20, color: Theme.Color.appTextSecondary)
                        .frame(width: 44, height: 44)
                }
            )
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("filterSheetCloseButton")
        }
        .padding(.leading, Spacing.s4)
        .padding(.trailing, Spacing.s2)
        .frame(height: 56)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    private var footer: some View {
        VStack(spacing: Spacing.s2) {
            HStack(spacing: Spacing.s3) {
                GhostButton(title: resetLabel) {
                    await reset()
                }
                .accessibilityIdentifier("filterSheetResetButton")
                PrimaryButton(title: applyLabel) {
                    await apply()
                }
                .accessibilityIdentifier("filterSheetApplyButton")
            }
            if let footerAccessory {
                footerAccessory(working)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    // MARK: - Mutations

    private func update(at index: Int, with section: FilterSection) {
        guard working.indices.contains(index) else { return }
        working[index] = section
    }

    private func reset() async {
        working = working.cleared()
    }

    private func apply() async {
        onApply(working)
        onClose()
    }
}

// MARK: - Section row

@MainActor
struct FilterSectionRow: View {
    let section: FilterSection
    let onUpdate: @MainActor (FilterSection) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text(section.title)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("filterSection_\(section.id)_title")
            control
        }
        .accessibilityIdentifier("filterSection_\(section.id)")
    }

    @ViewBuilder private var control: some View {
        switch section.control {
        case let .chipGroup(options, selectedIds):
            FilterChipGroupControl(
                sectionId: section.id,
                options: options,
                selectedIds: selectedIds
            ) { ids in
                onUpdate(FilterSection(
                    id: section.id,
                    title: section.title,
                    control: .chipGroup(options: options, selectedIds: ids)
                ))
            }
        case let .singleChip(options, selectedId):
            FilterSingleChipControl(
                sectionId: section.id,
                options: options,
                selectedId: selectedId
            ) { id in
                onUpdate(FilterSection(
                    id: section.id,
                    title: section.title,
                    control: .singleChip(options: options, selectedId: id)
                ))
            }
        case let .radio(options, selectedId):
            FilterRadioControl(
                sectionId: section.id,
                options: options,
                selectedId: selectedId
            ) { id in
                onUpdate(FilterSection(
                    id: section.id,
                    title: section.title,
                    control: .radio(options: options, selectedId: id)
                ))
            }
        case let .multiSelect(options, selectedIds):
            FilterMultiSelectControl(
                sectionId: section.id,
                options: options,
                selectedIds: selectedIds
            ) { ids in
                onUpdate(FilterSection(
                    id: section.id,
                    title: section.title,
                    control: .multiSelect(options: options, selectedIds: ids)
                ))
            }
        case let .toggle(options, selectedIds):
            FilterToggleControl(
                sectionId: section.id,
                options: options,
                selectedIds: selectedIds
            ) { ids in
                onUpdate(FilterSection(
                    id: section.id,
                    title: section.title,
                    control: .toggle(options: options, selectedIds: ids)
                ))
            }
        case let .stepSlider(stops, selectedIndex, defaultIndex):
            FilterStepSliderControl(
                sectionId: section.id,
                stops: stops,
                selectedIndex: selectedIndex
            ) { newIndex in
                onUpdate(FilterSection(
                    id: section.id,
                    title: section.title,
                    control: .stepSlider(
                        stops: stops,
                        selectedIndex: newIndex,
                        defaultIndex: defaultIndex
                    )
                ))
            }
        case let .rangeSlider(range):
            FilterRangeSliderControl(sectionId: section.id, range: range) { newRange in
                onUpdate(FilterSection(
                    id: section.id,
                    title: section.title,
                    control: .rangeSlider(newRange)
                ))
            }
        }
    }
}
