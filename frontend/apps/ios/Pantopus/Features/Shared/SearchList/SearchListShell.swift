//
//  SearchListShell.swift
//  Pantopus
//
//  P4.1 — Reusable search-list scaffold. Owns the search bar, 250ms
//  debounce, recent-queries section, and the four lifecycle states
//  (recent / typing-shimmer / results / empty). Concrete screens hand
//  in their fetched results + an empty-state payload and a row builder.
//
//  The shell is fully decoupled from any specific data source — callers
//  drive `query` via a `Binding`, supply `results` + `isLoading`, and
//  wire a `RecentQueriesStore` if they want persistence (see
//  `SearchListState.swift`).
//

import SwiftUI

/// Reusable search-list shell. Generic over the result type so concrete
/// screens get type-safe row builders without leaking their domain type
/// into the shell.
///
/// Layout:
///   ┌──────────────────────────────────────────┐
///   │  ‹  [ 🔍  query…                  ✕ ]   │  Header  (cancel + field + clear)
///   ├──────────────────────────────────────────┤
///   │  RECENT                                   │
///   │  🕒  recent query                         │
///   │  🕒  recent query                         │  Body — phase-driven:
///   │  ...                                      │   recent / typing / results / empty
///   └──────────────────────────────────────────┘
public struct SearchListShell<Result: Hashable & Sendable, Row: View>: View {
    private let placeholder: String
    @Binding private var query: String
    private let results: [Result]
    private let isLoading: Bool
    private let recentQueries: [String]
    private let onRecentTap: (String) -> Void
    private let emptyState: EmptyStateContent
    /// Optional chrome rendered between the search field and the phase
    /// body — e.g. a category-chip filter strip. Visible in every phase
    /// so the user can pre-filter before (or while) typing. `nil` keeps
    /// the original field-then-results layout for callers without filters.
    private let filters: AnyView?
    private let row: (Result) -> Row
    private let onCancel: () -> Void

    /// 250ms-debounced echo of `query`. The shell uses this to gate
    /// the transition from "typing-shimmer" to "show empty" so the user
    /// doesn't see an empty-result flash on every keystroke.
    @State private var debouncedQuery: String = ""
    @FocusState private var fieldFocused: Bool

    public init(
        placeholder: String,
        query: Binding<String>,
        results: [Result],
        isLoading: Bool,
        recentQueries: [String] = [],
        onRecentTap: @escaping (String) -> Void = { _ in },
        filters: AnyView? = nil,
        emptyState: EmptyStateContent,
        @ViewBuilder row: @escaping (Result) -> Row,
        onCancel: @escaping () -> Void
    ) {
        self.placeholder = placeholder
        _query = query
        self.results = results
        self.isLoading = isLoading
        self.recentQueries = recentQueries
        self.onRecentTap = onRecentTap
        self.filters = filters
        self.emptyState = emptyState
        self.row = row
        self.onCancel = onCancel
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            Divider().background(Theme.Color.appBorderSubtle)
            if let filters {
                filters
            }
            phaseBody
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("searchListShell")
        .task(id: query) {
            // Wait 250ms before promoting the live `query` into the
            // debounced echo. If the user keeps typing, `task(id:)`
            // cancels the prior task before `Task.sleep` returns —
            // the cancellation throws and `try?` swallows it.
            try? await Task.sleep(nanoseconds: 250_000_000)
            debouncedQuery = query
        }
        .onAppear { fieldFocused = true }
    }

    // MARK: - Header (cancel + search field + clear)

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onCancel) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cancel search")
            .accessibilityIdentifier("searchListCancel")

            HStack(spacing: Spacing.s2) {
                Icon(.search, size: 16, color: Theme.Color.appTextSecondary)
                TextField(placeholder, text: $query)
                    .font(Theme.Font.role(.body))
                    .foregroundStyle(Theme.Color.appText)
                    .submitLabel(.search)
                    .focused($fieldFocused)
                    .accessibilityIdentifier("searchListField")
                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                    .accessibilityIdentifier("searchListClear")
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
    }

    // MARK: - Body phase

    /// What is the shell rendering right now?
    private enum BodyPhase {
        case recent
        case typing
        case results
        case empty
    }

    /// Resolve the current phase. Keeping this in one place lets tests
    /// pin the exact transitions (e.g. "typing → empty only after the
    /// debounced echo settles").
    private var phase: BodyPhase {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return .recent }
        if isLoading { return .typing }
        if !results.isEmpty { return .results }
        // After the debounce echo catches up, an empty result set is
        // genuinely empty; before it catches up, keep shimmering so
        // the user doesn't see an empty-result flash on every keystroke.
        if debouncedQuery == query { return .empty }
        return .typing
    }

    @ViewBuilder private var phaseBody: some View {
        switch phase {
        case .recent: recentSection
        case .typing: shimmerSection
        case .results: resultsSection
        case .empty: emptySection
        }
    }

    // MARK: - Phases

    private var recentSection: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                if !recentQueries.isEmpty {
                    Text("Recent")
                        .pantopusTextStyle(.overline)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.top, Spacing.s4)
                        .padding(.bottom, Spacing.s2)
                        .accessibilityAddTraits(.isHeader)
                    ForEach(Array(recentQueries.enumerated()), id: \.offset) { _, entry in
                        Button { onRecentTap(entry) } label: {
                            HStack(spacing: Spacing.s3) {
                                Icon(.history, size: 18, color: Theme.Color.appTextSecondary)
                                Text(entry)
                                    .pantopusTextStyle(.body)
                                    .foregroundStyle(Theme.Color.appText)
                                Spacer(minLength: Spacing.s0)
                            }
                            .padding(.horizontal, Spacing.s4)
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Search for \(entry)")
                        .accessibilityIdentifier("searchListRecent.\(entry)")
                        Divider()
                            .background(Theme.Color.appBorderSubtle)
                            .padding(.leading, Spacing.s4 + 18 + Spacing.s3)
                    }
                }
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("searchListRecentSection")
    }

    private var shimmerSection: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                ForEach(0..<6, id: \.self) { _ in
                    HStack(spacing: Spacing.s3) {
                        Shimmer(width: 40, height: 40, cornerRadius: Radii.pill)
                        VStack(alignment: .leading, spacing: Spacing.s1) {
                            Shimmer(width: 180, height: 14)
                            Shimmer(width: 120, height: 12)
                        }
                        Spacer()
                    }
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                }
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("searchListShimmer")
    }

    private var resultsSection: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.s0) {
                ForEach(results, id: \.self) { result in
                    row(result)
                }
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("searchListResults")
    }

    private var emptySection: some View {
        EmptyState(
            icon: emptyState.icon,
            headline: emptyState.headline,
            subcopy: emptyState.subcopy
        )
        .accessibilityIdentifier("searchListEmpty")
    }
}
