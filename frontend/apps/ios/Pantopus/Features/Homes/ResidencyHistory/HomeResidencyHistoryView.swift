import SwiftUI

@MainActor
struct HomeResidencyHistoryView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var model: HomeResidencyHistoryViewModel
    @State private var visible = false
    private let onClose: () -> Void

    init(homeId: String, onClose: @escaping () -> Void) {
        _model = State(initialValue: .live(homeId: homeId))
        self.onClose = onClose
    }

    init(model: HomeResidencyHistoryViewModel, onClose: @escaping () -> Void) {
        _model = State(initialValue: model)
        self.onClose = onClose
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Text("Your past residency decisions").pantopusTextStyle(.h2)
                Text("Only your recorded decisions for this Home. Current reviewer permission is required.").pantopusTextStyle(.body)
                content
                if model.isCurrent {
                    Button("Reload recent decisions") { Task { await model.refresh() } }
                        .frame(minHeight: 44).accessibilityIdentifier("homeResidencyHistory.refresh")
                } else {
                    Text("Close history and reopen it under the intended account.")
                }
                Button("Close") { model.suspend()
                    onClose()
                }.frame(minHeight: 44).accessibilityIdentifier("homeResidencyHistory.close")
            }.padding(Spacing.s5).frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.Color.appBg)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("homeResidencyHistory")
        .onAppear {
            visible = true
            if scenePhase == .active {
                model.resume()
                Task { await model.refresh() }
            }
        }
        .onDisappear { visible = false
            model.suspend()
        }
        .onChange(of: scenePhase) { _, phase in
            guard visible else { return }
            if phase == .active {
                model.resume()
                Task { await model.refresh() }
            } else { model.suspend() }
        }
        .onChange(of: model.isCurrent) { _, current in if !current { model.suspend() } }
    }

    @ViewBuilder private var content: some View {
        switch model.state {
        case .loading:
            ProgressView("Checking your decisions…").accessibilityIdentifier("homeResidencyHistory.loading")
        case let .failure(error):
            Text(error.localizedDescription).foregroundStyle(Theme.Color.error).accessibilityIdentifier("homeResidencyHistory.error")
            if model.isCurrent, error == .unavailable {
                Button("Retry this read") { Task { await model.retry() } }.frame(minHeight: 44)
                    .accessibilityIdentifier("homeResidencyHistory.retry")
            }
        case let .list(page):
            if page.items.isEmpty {
                Text("No recorded residency decisions for you in this Home.").accessibilityIdentifier("homeResidencyHistory.empty")
            } else {
                Text("\(page.items.count) recorded decisions loaded").pantopusTextStyle(.caption)
                    .accessibilityIdentifier("homeResidencyHistory.count")
                ForEach(page.items) { item in
                    Button { Task { await model.open(item.id) } } label: {
                        VStack(alignment: .leading, spacing: Spacing.s2) {
                            Text(item.decisionLabel).font(.headline)
                            Text(item.applicantLabel)
                            Text(displayDate(item.createdAt)).font(.caption)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(Spacing.s3)
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("homeResidencyHistory.row." + item.id)
                    Divider()
                }
                if page.nextCursor != nil {
                    Button("Load older decisions") { Task { await model.loadMore() } }
                        .frame(minHeight: 44).accessibilityIdentifier("homeResidencyHistory.more")
                }
            }
        case let .detail(item):
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text("Recorded decision").font(.headline)
                Text(item.decisionLabel).accessibilityIdentifier("homeResidencyHistory.decision")
                Text("Recorded: " + displayDate(item.createdAt))
                Text("Reviewed: " + displayDate(item.reviewedAt))
                if item.action == .approve {
                    Text("Recorded role: " + (item.role?.label ?? "Unavailable in this saved decision"))
                        .accessibilityIdentifier("homeResidencyHistory.role")
                }
                if item.legacyRequest { Text("Recorded by an older client.") }
                Text("Original reasons, requested terms and an original applicant name were not saved in this history.")
                    .pantopusTextStyle(.caption)
                Divider()
                Text("Current claim reference").font(.headline)
                Text(item.applicantLabel).accessibilityIdentifier("homeResidencyHistory.applicant")
                Text("Current claim: " + claimLabel(item.currentClaimStatus)).accessibilityIdentifier("homeResidencyHistory.claimStatus")
                Text("This identity is looked up through today's claim; it is not a saved historical name.").pantopusTextStyle(.caption)
                Text("Current household access has not been checked.").accessibilityIdentifier("homeResidencyHistory.accessNotChecked")
            }.accessibilityElement(children: .contain).accessibilityIdentifier("homeResidencyHistory.detail")
        }
    }

    private func claimLabel(_ status: String) -> String {
        switch status {
        case "pending": "Pending"
        case "verified": "Verified claim"
        default: "Rejected"
        }
    }

    private func displayDate(_ value: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = formatter.date(from: value)
        if date == nil { formatter.formatOptions = [.withInternetDateTime]
            date = formatter.date(from: value)
        }
        return date?.formatted(date: .abbreviated, time: .standard) ?? "Recorded date unavailable"
    }
}
