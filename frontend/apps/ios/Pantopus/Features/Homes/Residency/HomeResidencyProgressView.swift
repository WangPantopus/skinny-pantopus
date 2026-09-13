import SwiftUI

struct HomeResidencyProgressView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var viewModel: HomeResidencyProgressViewModel
    @State private var visible = false
    private let onNavigate: (HomeResidencyNavigation) -> Void

    init(viewModel: HomeResidencyProgressViewModel, onNavigate: @escaping (HomeResidencyNavigation) -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onNavigate = onNavigate
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s5) {
                if viewModel.isLoading {
                    ProgressView("Checking your current status…")
                        .accessibilityIdentifier("homeResidencyLoading")
                } else if let error = viewModel.error {
                    Text(error).pantopusTextStyle(.body)
                        .accessibilityIdentifier("homeResidencyError")
                    Button("Retry") { Task { await viewModel.refresh() } }.frame(minHeight: 44)
                        .accessibilityIdentifier("homeResidencyRetry")
                } else if let progress = viewModel.progress {
                    if let request = progress.request {
                        VStack(alignment: .leading, spacing: Spacing.s2) {
                            Text("Your submitted residency address").pantopusTextStyle(.caption)
                            Text(request.label).pantopusTextStyle(.body)
                                .accessibilityIdentifier("homeResidencyAddress")
                            Text(request.reviewLabel).pantopusTextStyle(.caption).foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        .padding(Spacing.s4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                    }
                    Text(progress.title).pantopusTextStyle(.h3)
                        .accessibilityIdentifier("homeResidencyHeading")
                    Text(progress.explanation).pantopusTextStyle(.body).foregroundStyle(Theme.Color.appTextSecondary)
                    if viewModel.permits(.home) { action("Open Home", .home) }
                    if viewModel.permits(.mail) { action("Review mail verification", .mail) }
                    if viewModel.permits(.ownership) { action("Continue ownership verification", .ownership) }
                    if viewModel.permits(.addHome) {
                        action(
                            progress.needsResidencyRequest ? "Check address and request residency" : "Check address and resubmit",
                            .addHome
                        )
                    }
                    Button("Refresh status") { Task { await viewModel.refresh() } }.frame(minHeight: 44)
                        .accessibilityIdentifier("homeResidencyRefresh")
                }
            }
            .padding(Spacing.s5)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.Color.appBg)
        .navigationTitle("Residency status")
        .accessibilityIdentifier("homeResidencyStatus")
        .task { visible = true
            await viewModel.refresh()
        }
        .onDisappear { visible = false
            viewModel.suspend()
        }
        .onChange(of: scenePhase) { _, phase in
            guard visible else { return }
            if phase == .active { Task { await viewModel.refresh() } } else { viewModel.suspend() }
        }
        .onChange(of: viewModel.isCurrent) { _, current in
            if !current { viewModel.suspend()
                Task { await viewModel.refresh() }
            }
        }
    }

    private func action(_ label: String, _ destination: HomeResidencyNavigation) -> some View {
        Button(label) { if viewModel.permits(destination) { onNavigate(destination) } }
            .frame(minHeight: 44)
            .accessibilityIdentifier("homeResidencyAction")
    }
}
