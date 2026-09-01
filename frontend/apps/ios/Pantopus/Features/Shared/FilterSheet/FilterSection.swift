//
//  FilterSection.swift
//  Pantopus
//
//  Render models for the shared FilterSheet archetype — every filter /
//  sort bottom-sheet in the app uses this shape. Sections are an
//  ordered list of headers + controls; the shell owns the working
//  copy and emits the applied selection back through `onApply`.
//

import Foundation

/// One selectable option in a chip-group / radio / multi-select.
public struct FilterOption: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String

    public init(id: String, label: String) {
        self.id = id
        self.label = label
    }
}

/// A bounded numeric range with movable lower / upper handles. Used by
/// `FilterControl.rangeSlider` (price ranges, distance, etc.).
public struct FilterRange: Sendable, Hashable {
    /// Domain lower bound (the leftmost reachable value).
    public let min: Double
    /// Domain upper bound (the rightmost reachable value).
    public let max: Double
    /// Current lower handle position. Clamped to `min...upper`.
    public var lower: Double
    /// Current upper handle position. Clamped to `lower...max`.
    public var upper: Double
    /// Step size — handles snap to multiples of `step` from `min`.
    public let step: Double

    public init(min: Double, max: Double, lower: Double, upper: Double, step: Double = 1) {
        self.min = min
        self.max = max
        self.lower = Swift.max(min, Swift.min(lower, upper))
        self.upper = Swift.min(max, Swift.max(upper, lower))
        self.step = step
    }

    /// Returns a copy with lower = min and upper = max — the "no
    /// filter" position used when the user taps Reset.
    public func cleared() -> FilterRange {
        FilterRange(min: min, max: max, lower: min, upper: max, step: step)
    }
}

/// The right-side / inline control on one section.
public enum FilterControl: Sendable, Hashable {
    /// Horizontal flow of selectable pill chips. Multi-select.
    case chipGroup(options: [FilterOption], selectedIds: Set<String>)
    /// Horizontal flow of selectable pill chips. Single-select —
    /// `selectedId == nil` means "no selection". Used for preset-style
    /// dimensions that read as chips but only allow one value (e.g. a
    /// date-range preset).
    case singleChip(options: [FilterOption], selectedId: String?)
    /// Stack of rows, single selection only. `selectedId == nil` means
    /// "no selection" — typically only valid for filter dimensions
    /// that allow an unset state.
    case radio(options: [FilterOption], selectedId: String?)
    /// Stack of rows with checkboxes, multiple selection.
    case multiSelect(options: [FilterOption], selectedIds: Set<String>)
    /// Stack of rows, each a labeled switch. `selectedIds` are the "on"
    /// switches. Same selection shape as `multiSelect` but renders as
    /// toggles — used for boolean filter dimensions (verified-only,
    /// newest-first, open-now).
    case toggle(options: [FilterOption], selectedIds: Set<String>)
    /// Single-thumb slider that snaps to a fixed set of labelled
    /// `stops`. `selectedIndex` indexes into `stops`; `defaultIndex` is
    /// the position Reset returns to (the "no filter" stop). Used for
    /// the distance-radius dimension (0.5 / 1 / 3 / 5 / 10 mi).
    case stepSlider(stops: [FilterOption], selectedIndex: Int, defaultIndex: Int)
    /// Dual-thumb range slider.
    case rangeSlider(FilterRange)

    /// The default / "no selection" form per control kind. Drives the
    /// shell's Reset button — every section is mapped to its cleared
    /// equivalent without dismissing the sheet.
    public func cleared() -> FilterControl {
        switch self {
        case let .chipGroup(options, _):
            .chipGroup(options: options, selectedIds: [])
        case let .singleChip(options, _):
            .singleChip(options: options, selectedId: nil)
        case let .radio(options, _):
            .radio(options: options, selectedId: nil)
        case let .multiSelect(options, _):
            .multiSelect(options: options, selectedIds: [])
        case let .toggle(options, _):
            .toggle(options: options, selectedIds: [])
        case let .stepSlider(stops, _, defaultIndex):
            .stepSlider(stops: stops, selectedIndex: defaultIndex, defaultIndex: defaultIndex)
        case let .rangeSlider(range):
            .rangeSlider(range.cleared())
        }
    }
}

/// One section in the sheet — a header label + a single control.
public struct FilterSection: Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public var control: FilterControl

    public init(id: String, title: String, control: FilterControl) {
        self.id = id
        self.title = title
        self.control = control
    }

    /// Returns a copy with the control reset to its default / empty
    /// form (see `FilterControl.cleared()`).
    public func cleared() -> FilterSection {
        FilterSection(id: id, title: title, control: control.cleared())
    }
}

public extension [FilterSection] {
    /// Map every section to its cleared form. Used by the shell when
    /// the user taps Reset.
    func cleared() -> [FilterSection] {
        map { $0.cleared() }
    }
}
