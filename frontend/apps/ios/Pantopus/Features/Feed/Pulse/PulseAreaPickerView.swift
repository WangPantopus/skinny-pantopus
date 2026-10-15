import SwiftUI

struct PulseAreaPickerView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = PulseAreaPickerViewModel()
    let selectedAreaId: String?
    let onSelect: (PulseAreaChoice) -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    if viewModel.isSearching {
                        TextField("Search towns", text: $viewModel.searchText)
                            .pulseFont(.body)
                            .textInputAutocapitalization(.words)
                            .submitLabel(.search)
                            .padding(Spacing.s3)
                            .background(Theme.Color.appSurface, in: RoundedRectangle(cornerRadius: Radii.md))
                            .accessibilityIdentifier("pulseAreaSearch")
                        Text("Browsing another place doesn't change your home or who can read your posts.")
                            .pulseFont(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    content
                    if !viewModel.isSearching {
                        Button("Another place") { viewModel.isSearching = true }
                            .pulseFont(.button)
                            .accessibilityIdentifier("pulseAreaAnotherPlace")
                    }
                }
                .padding(Spacing.s4)
            }
            .background(Theme.Color.appBg)
            .navigationTitle(viewModel.isSearching ? "Another place" : "Area")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(viewModel.isSearching ? "Back" : "Done") {
                        if viewModel.isSearching { viewModel.isSearching = false } else { dismiss() }
                    }
                    .accessibilityIdentifier("pulseAreaClose")
                }
            }
            .task(id: "\(viewModel.isSearching):\(viewModel.searchText)") {
                await viewModel.load(debounce: viewModel.isSearching)
            }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        }
        .accessibilityIdentifier("pulseAreaPicker")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            FeedSkeletonCard()
                .accessibilityLabel("Loading areas")
        case let .loaded(areas):
            ForEach(areas) { area in
                Button {
                    onSelect(area)
                    dismiss()
                } label: {
                    HStack(spacing: Spacing.s3) {
                        VStack(alignment: .leading, spacing: Spacing.s1) {
                            Text(area.title).pulseFont(.button)
                            Text(area.detail).pulseFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer(minLength: Spacing.s2)
                        if area.id == selectedAreaId {
                            Icon(.check, size: 20, color: Theme.Color.primaryInk).accessibilityHidden(true)
                        }
                    }
                    .foregroundStyle(Theme.Color.appText)
                    .padding(Spacing.s3)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .background(Theme.Color.appSurface, in: RoundedRectangle(cornerRadius: Radii.md))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(area.title), \(area.detail)")
                .accessibilityAddTraits(area.id == selectedAreaId ? .isSelected : [])
                .accessibilityIdentifier("pulseAreaOption_\(area.id)")
            }
        case .empty:
            EmptyState(
                icon: .mapPin,
                headline: viewModel.isSearching ? "No towns found" : "No open areas yet",
                subcopy: viewModel.isSearching ? "Try another town name." : "Try another place to look around.",
                cta: .init(title: "Try again") { await viewModel.load() }
            )
        case let .error(message):
            PulsePageErrorCard(message: message) { Task { await viewModel.load() } }
        }
    }
}
