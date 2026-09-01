//
//  BookingFilterSheet.swift
//  Pantopus
//
//  Stream I9 — E9 Booking Search & Filter. A bottom sheet reusing the shared
//  filter-sheet idiom: a search field, stacked facet sections of wrapping pill
//  chips (Status / Owner context / Event type / Date range), a removable
//  active-filter summary, and a sticky CTA showing the live result count.
//  Present from the bookings inbox via `.sheet(isPresented:)`.
//

import SwiftUI

struct BookingFilterSheet: View {
    @State private var viewModel: BookingFilterViewModel
    let onApply: (BookingFilters) -> Void
    let onClose: () -> Void

    init(
        viewModel: BookingFilterViewModel,
        onApply: @escaping (BookingFilters) -> Void,
        onClose: @escaping () -> Void
    ) {
        _viewModel = State(wrappedValue: viewModel)
        self.onApply = onApply
        self.onClose = onClose
    }

    var body: some View {
        VStack(spacing: 0) {
            ExtrasSheetGrabber()
            titleRow
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    searchField
                    if !viewModel.activeSummary.isEmpty { activeSummarySection }
                    // No-results frame (JSX FrameNoResults) replaces the facet
                    // sections with the empty note — the only escape is Clear all.
                    if viewModel.resultCount == 0 {
                        noResults
                    } else {
                        statusSection
                        ownerContextSection
                        if !viewModel.eventTypeOptions.isEmpty { eventTypeSection }
                        dateRangeSection
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s1)
                .padding(.bottom, Spacing.s3)
            }
            footer
        }
        .background(Theme.Color.appSurface)
        .presentationDetents([.large])
        .presentationDragIndicator(.hidden)
        .accessibilityIdentifier("scheduling.bookingFilter")
        .task(id: viewModel.filterSignature) {
            await viewModel.recountDebounced()
        }
    }

    // MARK: Title row

    private var titleRow: some View {
        HStack {
            Text("Filter bookings")
                .font(.system(size: 16.5, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            Button("Clear all") { viewModel.clearAll() }
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(viewModel.hasActiveFilters ? Theme.Color.primary600 : Theme.Color.appTextMuted)
                .disabled(!viewModel.hasActiveFilters)
                .buttonStyle(.plain)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s3)
    }

    private var searchField: some View {
        @Bindable var viewModel = viewModel
        return HStack(spacing: Spacing.s2 + 1) {
            Icon(.search, size: 16, color: Theme.Color.appTextMuted)
            TextField("Search invitee or intake text", text: $viewModel.searchText)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appText)
                .submitLabel(.search)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 42)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    // MARK: Active summary

    private var activeSummarySection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2 + 1) {
            ExtrasOverline(text: "Active filters")
            ExtrasFlowLayout {
                ForEach(viewModel.activeSummary) { chip in
                    let colors = chipColors(chip.tint)
                    ExtrasRemovableChip(
                        title: chip.title,
                        foreground: colors.foreground,
                        background: colors.background
                    ) {
                        viewModel.removeChip(chip.id)
                    }
                }
            }
        }
    }

    // MARK: Facets

    private var statusSection: some View {
        facetSection("Status") {
            ForEach(BookingFilterStatus.allCases) { status in
                let colors = chipColors(viewModel.statusTint(status))
                ExtrasPillChip(
                    title: status.label,
                    isSelected: viewModel.selectedStatus == status,
                    selectedForeground: colors.foreground,
                    selectedBackground: colors.background
                ) {
                    viewModel.toggleStatus(status)
                }
            }
        }
    }

    private var ownerContextSection: some View {
        facetSection("Owner context") {
            ForEach(BookingScopeFilter.allCases) { scope in
                let colors = chipColors(viewModel.scopeTint(scope))
                ExtrasPillChip(
                    title: scope.label,
                    isSelected: viewModel.scope == scope,
                    selectedForeground: colors.foreground,
                    selectedBackground: colors.background,
                    showsDot: scope != .all
                ) {
                    viewModel.selectScope(scope)
                }
            }
        }
    }

    private var eventTypeSection: some View {
        facetSection("Event type") {
            ForEach(viewModel.eventTypeOptions) { option in
                ExtrasPillChip(
                    title: option.name,
                    isSelected: viewModel.selectedEventTypeId == option.id
                ) {
                    viewModel.toggleEventType(option.id)
                }
            }
        }
    }

    private var dateRangeSection: some View {
        @Bindable var viewModel = viewModel
        return VStack(alignment: .leading, spacing: Spacing.s2 + 1) {
            ExtrasOverline(text: "Date range")
            ExtrasFlowLayout {
                ForEach(BookingDateRangeFilter.allCases) { range in
                    ExtrasPillChip(
                        title: range.label,
                        isSelected: viewModel.selectedDateRange == range
                    ) {
                        viewModel.toggleDateRange(range)
                    }
                }
            }
            if viewModel.selectedDateRange == .custom {
                VStack(spacing: Spacing.s2) {
                    DatePicker("From", selection: $viewModel.customFrom, displayedComponents: .date)
                    DatePicker("To", selection: $viewModel.customTo, displayedComponents: .date)
                }
                .font(.system(size: 12.5, weight: .semibold))
                .tint(Theme.Color.primary600)
                .padding(.top, Spacing.s1)
            }
        }
    }

    private func facetSection(_ title: String, @ViewBuilder chips: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2 + 1) {
            ExtrasOverline(text: title)
            ExtrasFlowLayout { chips() }
        }
    }

    // MARK: No results

    private var noResults: some View {
        VStack(spacing: Spacing.s3) {
            ExtrasIconDisc(
                icon: .searchX,
                background: Theme.Color.appSurfaceSunken,
                foreground: Theme.Color.appTextSecondary,
                diameter: 60
            )
            Text("No bookings match these filters")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Button("Clear all") { viewModel.clearAll() }
                .font(.system(size: 12.5, weight: .bold))
                .foregroundStyle(Theme.Color.primary600)
                .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s5)
    }

    // MARK: Footer

    private var footer: some View {
        ExtrasStickyFooter {
            ExtrasSolidButton(
                title: viewModel.ctaTitle,
                isEnabled: viewModel.ctaEnabled
            ) {
                onApply(viewModel.currentFilters())
                onClose()
            }
        }
    }

    // MARK: Tint mapping

    private func chipColors(_ tint: BookingFilterViewModel.ChipTint) -> (foreground: Color, background: Color) {
        switch tint {
        case .neutral: (Theme.Color.primary600, Theme.Color.primary50)
        case .warning: (Theme.Color.warning, Theme.Color.warningBg)
        case .error: (Theme.Color.error, Theme.Color.errorBg)
        case .personal: (Theme.Color.personal, Theme.Color.personalBg)
        case .home: (Theme.Color.home, Theme.Color.homeBg)
        case .business: (Theme.Color.business, Theme.Color.businessBg)
        }
    }
}

#if DEBUG
#Preview {
    Color.black.sheet(isPresented: .constant(true)) {
        BookingFilterSheet(
            viewModel: BookingFilterViewModel(
                owner: .business(id: "biz"),
                eventTypeOptions: [
                    .init(id: "1", name: "30-min intro"),
                    .init(id: "2", name: "Consultation"),
                    .init(id: "3", name: "Group class")
                ],
                client: .shared
            ),
            onApply: { _ in },
            onClose: {}
        )
    }
}
#endif
