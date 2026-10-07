import SwiftUI

struct HomeResidencyReviewView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State var model: HomeResidencyReviewViewModel
    @State private var visible = false
    @FocusState private var reasonFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                if !model.isCurrent {
                    Text("Your account changed. Close this and open it again to continue.")
                } else {
                    Text("Check who’s asking to join and the access they have now, then approve or reject.")
                    if model.isWorking { ProgressView("Loading…").accessibilityIdentifier("homeResidencyReview.loading") }
                    if let error = model.error {
                        Text(error).foregroundStyle(Theme.Color.error).accessibilityIdentifier("homeResidencyReview.error")
                    }
                    if let review = model.review {
                        currentClaim(review)
                        currentMembership(review)
                        if let pending = model.pending {
                            recovery(pending)
                        } else if model.showsDecisionForm {
                            controls
                        } else if !model.isWorking {
                            Text(model.unavailableDecisionMessage)
                                .accessibilityIdentifier("homeResidencyReview.noPendingClaim")
                        }
                    } else if model.opened, model.error == nil, !model.isWorking {
                        Text("Nothing to finish here. Choose a request to review.")
                            .accessibilityIdentifier("homeResidencyReview.empty")
                    }
                }
            }
            .navigationTitle("Residency review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { model.suspend()
                        dismiss()
                    }.accessibilityIdentifier("homeResidencyReview.close")
                }
                ToolbarItem(placement: .confirmationAction) {
                    if reasonFocused {
                        Button("Done") { reasonFocused = false }.accessibilityIdentifier("homeResidencyReview.keyboardDone")
                    } else {
                        Button("Reload") { Task { await model.open() } }
                            .disabled(model.isWorking || !model.isCurrent)
                            .accessibilityLabel("Reload")
                            .accessibilityIdentifier("homeResidencyReview.reload")
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("homeResidencyReview")
            .task { visible = true
                await model.open()
            }
            .onDisappear { visible = false
                retire()
            }
            .onChange(of: scenePhase) { _, phase in
                guard visible else { return }
                if phase == .active { Task { await model.open() } } else { retire() }
            }
            .onChange(of: model.isCurrent) { _, current in if !current { retire() } }
        }
    }

    private func retire() {
        reasonFocused = false
        model.suspend()
    }

    private func currentClaim(_ review: HomeResidencyCurrentReview) -> some View {
        Section("Request") {
            if let claimant = model.claimant { Text(claimant).font(.headline) }
            Text("Reference: \(review.claimId.suffix(8))").font(.caption)
            Text("Status: \(claimStatus(review.claim["status"]))").accessibilityIdentifier("homeResidencyReview.claimStatus")
            Text("Asked to join as: \(joinedAs(review.claim["claimed_role"]))")
            if let address = review.claim["claimed_address"]?.stringValue { Text("Address: \(address)") }
            if let note = review.claim["review_note"]?.stringValue, !note.isEmpty { Text("Note: \(note)") }
            if model.pending != nil { Text("Your saved decision below was for an earlier request.").font(.caption) }
        }
    }

    private func currentMembership(_ review: HomeResidencyCurrentReview) -> some View {
        Section("Their access now") {
            if let occupancy = review.occupancy {
                Text("Membership: \(occupancy["is_active"] == .bool(true) ? "Active" : "Ended")")
                    .accessibilityIdentifier("homeResidencyReview.membershipStatus")
                Text("Role: \(roleLabel(occupancy["role_base"] == .null ? occupancy["role"] : occupancy["role_base"]))")
                Text("Age group: \(words(occupancy["age_band"]))")
                Text("Verification: \(verification(occupancy["verification_status"]))")
                ForEach(["start_at", "end_at", "access_start_at", "access_end_at", "verification_expires_at"], id: \.self) { key in
                    LabeledContent(dateTitle(key), value: dateLabel(occupancy[key]))
                }
                Text("What they can do also depends on these dates and their permissions.").font(.caption)
            } else { Text("They don’t have access to this Home yet.") }
        }
    }

    private var controls: some View {
        Section("Your decision") {
            Picker("Your decision", selection: $model.action) {
                ForEach(HomeResidencyDecision.allCases, id: \.self) { Text($0.label).tag($0) }
            }.accessibilityIdentifier("homeResidencyReview.action")
            if model.action == .approve {
                Text("Approving lets them into this Home with the role you choose. It doesn’t make them an owner.")
                    .font(.caption)
                Picker("Their role", selection: $model.role) {
                    ForEach(HomeResidencyReviewRole.allCases, id: \.self) { Text($0.label).tag($0) }
                }.accessibilityIdentifier("homeResidencyReview.role")
            } else {
                Text("Rejecting declines this request. It doesn’t change anyone’s current access.").font(.caption)
                Text("Reason for rejection (optional)").font(.caption)
                TextField("Reason for rejection (optional)", text: $model.reason, axis: .vertical)
                    .lineLimit(3...8).focused($reasonFocused).accessibilityIdentifier("homeResidencyReview.reason")
                Text("\(model.reason.utf16.count)/2000").font(.caption)
            }
            Toggle("I’ve checked this request and my decision.", isOn: $model.reviewed)
                .accessibilityIdentifier("homeResidencyReview.reviewed")
            Button("Save decision") { reasonFocused = false
                Task { await model.submit() }
            }.disabled(!model.canSubmit).accessibilityIdentifier("homeResidencyReview.submit")
        }.disabled(!model.canDecide)
    }

    private func recovery(_ pending: PendingHomeResidencyReview) -> some View {
        Section(model.receipt != nil ? "Decision saved" : "Check your last decision") {
            Text("You chose: \(pending.action.label)")
            if let role = pending.role { Text("Role: \(role.label)") }
            if let reason = pending.reason, !reason.isEmpty { Text("Reason: \(reason)") }
            if let receipt = model.receipt {
                Text("Saved \(dateLabel(.string(receipt.recordedAt)))")
                Text(pending.action == .approve ? "You approved this request." : "You rejected this request.")
            } else {
                Text("We couldn’t confirm your decision went through. Try again; it won’t be applied twice.")
                    .font(.caption)
            }
            if model.isRecoveringAnotherClaim { Text("Finish this before reviewing another request.").font(.caption) }
            if model.canRetry {
                Button(model.receipt != nil ? "Save again" : "Try again") { Task { await model.retry() } }
                    .accessibilityIdentifier("homeResidencyReview.retry")
            }
            if model.canAcknowledge {
                Button(pending.receipt != nil ? "Done" : "Start over") {
                    Task { await model.acknowledge() }
                }
                .accessibilityIdentifier("homeResidencyReview.acknowledge")
            }
        }
    }

    private func words(_ value: JSONValue?) -> String {
        (value?.stringValue ?? "Not given").replacingOccurrences(of: "_", with: " ")
    }

    private func claimStatus(_ value: JSONValue?) -> String {
        switch value?.stringValue {
        case "pending": "Waiting for your decision"
        case "verified": "Approved"
        case "rejected": "Rejected"
        default: words(value)
        }
    }

    private func joinedAs(_ value: JSONValue?) -> String {
        switch value?.stringValue {
        case "household", "member": "Household member"
        case "renter", "tenant": "Renter"
        default: words(value)
        }
    }

    private func roleLabel(_ value: JSONValue?) -> String {
        value?.stringValue.flatMap(HomeResidencyReviewRole.init(rawValue:))?.label ?? words(value)
    }

    private func verification(_ value: JSONValue?) -> String {
        switch value?.stringValue {
        case "verified": "Verified"
        case "pending_approval": "Waiting for approval"
        case "pending_postcard": "Waiting for a postcard"
        case "provisional_bootstrap", "provisional": "Provisional"
        case "moved_out": "Left this Home"
        case "inactive": "Removed"
        default: words(value)
        }
    }

    private func dateTitle(_ key: String) -> String {
        [
            "start_at": "Membership starts",
            "end_at": "Membership ends",
            "access_start_at": "Access starts",
            "access_end_at": "Access ends",
            "verification_expires_at": "Verification expires"
        ][key] ?? key
    }

    private func dateLabel(_ value: JSONValue?) -> String {
        guard let value = value?.stringValue else { return "Not set" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = formatter.date(from: value)
        if date == nil { formatter.formatOptions = [.withInternetDateTime]
            date = formatter.date(from: value)
        }
        return date?.formatted(date: .abbreviated, time: .shortened) ?? "Unavailable"
    }
}
