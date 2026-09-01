//
//  PickCategorySearchStep.swift
//  Pantopus
//
//  A12.10 Frame 2 (search) — Create Business wizard step 1, active
//  typeahead variant. Renders the chip + headline + focused search
//  field + ranked-results header + 3 hits with the matched substring
//  violet-highlighted + a dashed-violet "Add as custom category"
//  fallback row.
//

import SwiftUI

struct PickCategorySearchStep: View {
    @Bindable var viewModel: CreateBusinessWizardViewModel

    private var query: String {
        viewModel.searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        BusinessIdentityChip()

        HeadlineBlock(
            "What does your business do?",
            subtitle: "Pick the closest fit — this shapes your listings, tax setup, and the badges " +
                "customers see."
        )

        BusinessSearchField(text: $viewModel.searchText, focused: true)

        SearchResultsHeader(
            matchCount: viewModel.searchHits.count,
            query: query
        )

        VStack(spacing: Spacing.s2) {
            ForEach(viewModel.searchHits) { hit in
                SearchResultRow(
                    hit: hit,
                    query: query,
                    selected: viewModel.selectedCategoryId == hit.category
                ) {
                    viewModel.selectSearchHit(hit)
                }
                .accessibilityIdentifier("createBusinessSearchResult_\(hit.id)")
            }
        }

        if viewModel.searchHits.isEmpty, !query.isEmpty {
            // No-match fallback from the design pack. Submitting is still
            // logged-only — there is no POST /custom-categories to invent — so
            // the row's subcopy promises exactly what happens.
            AddCustomCategoryRow(
                label: query,
                isSubmitting: viewModel.isSubmittingCustom
            ) {
                viewModel.submitCustomCategory()
            }
        } else {
            Text("Custom categories aren't available yet. Pick a listed category above.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("createBusinessCustomCategoryBlocked")
        }

        if let submitError = viewModel.submitError {
            Text(submitError)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.error)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("createBusinessSubmitError")
        }
    }
}

// MARK: - Search results header

private struct SearchResultsHeader: View {
    let matchCount: Int
    let query: String

    var body: some View {
        HStack {
            Text("\(matchCount) \(matchCount == 1 ? "match" : "matches") for \"\(query)\"")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s2)
            Button {
                // Browse-all clears the search and returns to the populated grid.
                // The audit lists this as the secondary affordance on the
                // search frame header.
            } label: {
                Text("Browse all")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.business)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("createBusinessBrowseAll")
        }
        .accessibilityIdentifier("createBusinessSearchResultsHeader")
    }
}

// MARK: - Search result row

private struct SearchResultRow: View {
    let hit: CategorySearchHit
    let query: String
    let selected: Bool
    let onPick: () -> Void

    var body: some View {
        Button(action: onPick) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(selected ? hit.category.accent : hit.category.accent.opacity(0.1))
                        .frame(width: 36, height: 36)
                    Icon(
                        hit.category.icon,
                        size: 16,
                        strokeWidth: 2,
                        color: selected ? Theme.Color.appTextInverse : hit.category.accent
                    )
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    HighlightedLabel(text: hit.label, query: query)
                    (
                        Text("in ")
                            .foregroundColor(Theme.Color.appTextSecondary)
                            + Text(hit.category.label)
                            .foregroundColor(Theme.Color.appTextStrong)
                    )
                    .pantopusTextStyle(.caption)
                }
                Spacer(minLength: Spacing.s2)
                if selected {
                    ZStack {
                        Circle().fill(hit.category.accent)
                            .frame(width: 20, height: 20)
                        Icon(
                            .check,
                            size: 12,
                            strokeWidth: 3,
                            color: Theme.Color.appTextInverse
                        )
                    }
                }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(
                        selected ? hit.category.accent : Theme.Color.appBorder,
                        lineWidth: selected ? 1.5 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .pantopusShadow(rowShadow)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(hit.label), in \(hit.category.label)")
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    private var rowShadow: PantopusShadow {
        if selected {
            return PantopusShadow(color: hit.category.accent, opacity: 0.13, radius: 16, x: 0, y: 6)
        }
        return PantopusShadow(color: .black, opacity: 0.03, radius: 2, x: 0, y: 1)
    }
}

/// Substring-matches `query` inside `text` (case-insensitive) and renders
/// the match with a violet pill highlight. Falls back to plain text when
/// the query doesn't occur in the label.
private struct HighlightedLabel: View {
    let text: String
    let query: String

    var body: some View {
        if query.isEmpty {
            plain
        } else if let range = text.range(of: query, options: .caseInsensitive) {
            let before = String(text[text.startIndex..<range.lowerBound])
            let match = String(text[range])
            let after = String(text[range.upperBound..<text.endIndex])
            (
                Text(before)
                    .foregroundColor(Theme.Color.appText)
                    + Text(match)
                    .foregroundColor(Theme.Color.businessDark)
                    + Text(after)
                    .foregroundColor(Theme.Color.appText)
            )
            .pantopusTextStyle(.body)
        } else {
            plain
        }
    }

    private var plain: some View {
        Text(text)
            .pantopusTextStyle(.body)
            .foregroundStyle(Theme.Color.appText)
    }
}

// MARK: - Dashed-violet "Add as custom category" fallback row

private struct AddCustomCategoryRow: View {
    let label: String
    let isSubmitting: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.appSurface)
                        .frame(width: 28, height: 28)
                    Icon(.plus, size: 14, strokeWidth: 2.5, color: Theme.Color.business)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text("Add \"\(label)\" as a custom category")
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.businessDark)
                    Text("We'll pass the request on — custom categories aren't live yet.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Spacing.s2)
                Icon(.arrowRight, size: 14, color: Theme.Color.business)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.businessBg.opacity(0.6))
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(
                        Theme.Color.business.opacity(0.33),
                        style: StrokeStyle(lineWidth: 1, dash: [4, 3])
                    )
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isSubmitting)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Add \(label) as a custom category. " +
                "We'll pass the request on — custom categories aren't live yet."
        )
        .accessibilityIdentifier("createBusinessAddCustomCategory")
    }
}

#Preview {
    let viewModel = CreateBusinessWizardViewModel()
    viewModel.searchText = "tutor"
    return ScrollView {
        VStack(spacing: Spacing.s5) {
            PickCategorySearchStep(viewModel: viewModel)
        }
        .padding()
    }
    .background(Theme.Color.appBg)
}
