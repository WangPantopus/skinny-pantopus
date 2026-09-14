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
                    Text("Your session changed. Reopen residency review to check access.")
                } else {
                    Text("Review the current claim and membership before approving or rejecting residency.")
                    if model.isWorking { ProgressView("Checking residency review…").accessibilityIdentifier("homeResidencyReview.loading") }
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
                        Text("No residency decision needs recovery on this device. Choose a claim to review.")
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
                            .accessibilityLabel("Reload current access")
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
        Section("Current residency claim") {
            if let claimant = model.claimant { Text(claimant).font(.headline) }
            Text("Claim reference: \(review.claimId.suffix(8)) · Applicant account: \(review.applicantId.suffix(8))").font(.caption)
            Text("Claim status: \(words(review.claim["status"]))").accessibilityIdentifier("homeResidencyReview.claimStatus")
            Text("Requested role: \(words(review.claim["claimed_role"]))")
            if let address = review.claim["claimed_address"]?.stringValue { Text("Claimed address: \(address)") }
            if let note = review.claim["review_note"]?.stringValue, !note.isEmpty { Text("Current review note: \(note)") }
            if model
                .pending !=
                nil { Text("This is the latest claim state. The saved decision below records the earlier request.").font(.caption) }
        }
    }

    private func currentMembership(_ review: HomeResidencyCurrentReview) -> some View {
        Section("Current membership") {
            if let occupancy = review.occupancy {
                Text("Membership record: \(occupancy["is_active"] == .bool(true) ? "Active" : "Inactive")")
                    .accessibilityIdentifier("homeResidencyReview.membershipStatus")
                Text("Role: \(words(occupancy["role_base"] == .null ? occupancy["role"] : occupancy["role_base"]))")
                Text("Age band: \(words(occupancy["age_band"]))")
                Text("Verification: \(words(occupancy["verification_status"]))")
                ForEach(["start_at", "end_at", "access_start_at", "access_end_at", "verification_expires_at"], id: \.self) { key in
                    LabeledContent(dateTitle(key), value: dateLabel(occupancy[key]))
                }
                Text("Access also depends on the current dates, verification and household permissions.").font(.caption)
            } else { Text("No membership record exists for this applicant yet.") }
        }
    }

    private var controls: some View {
        Section("Review your decision") {
            Picker("Residency decision", selection: $model.action) {
                ForEach(HomeResidencyDecision.allCases, id: \.self) { Text($0.label).tag($0) }
            }.accessibilityIdentifier("homeResidencyReview.action")
            if model.action == .approve {
                Text(
                    "Confirm residency within the existing role, age and access limits. " +
                        "Existing verified memberships keep their role and restrictions. " +
                        "Ownership and expired or removed access need their own review."
                )
                .font(.caption)
                Picker("Role for an unverified membership", selection: $model.role) {
                    ForEach(HomeResidencyReviewRole.allCases, id: \.self) { Text($0.label).tag($0) }
                }.accessibilityIdentifier("homeResidencyReview.role")
            } else {
                Text("Reject this pending residency claim. Existing membership access stays unchanged.").font(.caption)
                Text("Reason for rejection (optional)").font(.caption)
                TextField("Reason for rejection (optional)", text: $model.reason, axis: .vertical)
                    .lineLimit(3...8).focused($reasonFocused).accessibilityIdentifier("homeResidencyReview.reason")
                Text("\(model.reason.utf16.count)/2000").font(.caption)
            }
            Toggle("I reviewed the current claim, membership limits and selected decision.", isOn: $model.reviewed)
                .accessibilityIdentifier("homeResidencyReview.reviewed")
            Button("Save residency decision") { reasonFocused = false
                Task { await model.submit() }
            }.disabled(!model.canSubmit).accessibilityIdentifier("homeResidencyReview.submit")
        }.disabled(!model.canDecide)
    }

    private func recovery(_ pending: PendingHomeResidencyReview) -> some View {
        Section(model.receipt != nil ? "Original decision confirmed" : "Decision needs confirmation") {
            Text(pending.action.label)
            if let role = pending.role { Text("Originally selected role: \(role.label)") }
            if let reason = pending.reason, !reason.isEmpty { Text("Original reason: \(reason)") }
            if let receipt = model.receipt {
                Text("Recorded \(dateLabel(.string(receipt.recordedAt)))")
                Text(pending
                    .action == .approve ? "The original residency claim was approved." : "The original residency claim was rejected.")
                Text("Later changes remain in effect. This confirmation does not restore access or decide a resubmitted claim.")
                    .font(.caption)
            } else {
                Text("The original decision is saved on this device. Retry it to confirm the outcome without submitting a second decision.")
                    .font(.caption)
            }
            if model.isRecoveringAnotherClaim { Text("Finish this saved decision before reviewing another claim.").font(.caption) }
            if model.canRetry {
                Button(model.receipt != nil ? "Save confirmation again" : "Retry original decision") { Task { await model.retry() } }
                    .accessibilityIdentifier("homeResidencyReview.retry")
            }
            if model.canAcknowledge {
                Button(pending.receipt != nil ? "I reviewed this confirmation" : "Review current claim again") {
                    Task { await model.acknowledge() }
                }
                .accessibilityIdentifier("homeResidencyReview.acknowledge")
            }
        }
    }

    private func words(_ value: JSONValue?) -> String {
        (value?.stringValue ?? "Unknown").replacingOccurrences(of: "_", with: " ")
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
