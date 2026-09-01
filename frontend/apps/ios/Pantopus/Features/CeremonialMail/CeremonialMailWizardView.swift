//
//  CeremonialMailWizardView.swift
//  Pantopus
//
//  Four-moment Ceremonial Mail Compose flow. Composes WizardShell
//  with step bodies that mirror the design's pages.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

public struct CeremonialMailWizardView: View {
    @State private var viewModel: CeremonialMailViewModel
    private let onDismiss: @MainActor () -> Void
    private let onOpenMail: @MainActor (String) -> Void

    init(
        viewModel: CeremonialMailViewModel = CeremonialMailViewModel(),
        onDismiss: @escaping @MainActor () -> Void = {},
        onOpenMail: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onDismiss = onDismiss
        self.onOpenMail = onOpenMail
    }

    public var body: some View {
        WizardShell(model: viewModel) {
            stepBody
            if let error = viewModel.submitError {
                HStack(spacing: Spacing.s2) {
                    Icon(.alertCircle, size: 14, color: Theme.Color.error)
                    Text(error)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.Color.error)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Theme.Color.errorBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("ceremonialSubmitError")
            }
        }
        .onChange(of: viewModel.pendingEvent) { _, event in
            handle(event)
        }
        .accessibilityIdentifier("ceremonialMail")
    }

    @ViewBuilder
    private var stepBody: some View {
        switch viewModel.step {
        case .decide: decideStep
        case .verify: verifyStep
        case .compose: composeStep
        case .commit: commitStep
        case .success: successStep
        }
    }

    private func handle(_ event: CeremonialMailEvent?) {
        guard let event else { return }
        switch event {
        case .dismiss: onDismiss()
        case let .openMail(mailId): onOpenMail(mailId)
        }
        viewModel.acknowledgePendingEvent()
    }

    // MARK: - Step 1: decide

    private var decideStep: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HeadlineBlock("Who are you writing to?")
            SubcopyBlock(
                "Choose a verified neighbor, a saved correspondent, or paste a handle. Mail keeps your "
                    + "name and address private — the recipient only sees what you choose to share."
            )
            recipientSearchField
            if !viewModel.recipientResults.isEmpty {
                recipientResults
            }
            if let selected = viewModel.selectedRecipient {
                selectedRecipientCard(selected)
            }
            Text("WHY")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
                .padding(.top, 6)
            VStack(spacing: Spacing.s2) {
                ForEach(CeremonialMailIntent.allCases) { intent in
                    intentRow(intent)
                }
            }
        }
    }

    private var recipientSearchField: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("WHO")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
            HStack {
                Icon(.search, size: 14, color: Theme.Color.appTextSecondary)
                TextField("Search by name or username", text: Binding(
                    get: { viewModel.recipientQuery },
                    set: { viewModel.updateRecipientQuery($0) }
                ))
                .font(Theme.Font.small)
                .accessibilityIdentifier("ceremonialRecipientField")
                if viewModel.isSearchingRecipients {
                    ProgressView().scaleEffect(0.7)
                }
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 44)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }

    private var recipientResults: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(viewModel.recipientResults.enumerated()), id: \.element.id) { index, recipient in
                Button {
                    viewModel.selectRecipient(recipient)
                } label: {
                    HStack(spacing: 10) {
                        Icon(.user, size: 16, color: Theme.Color.primary600)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(recipient.name ?? recipient.username ?? "Recipient")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                            if let address = recipient.homeAddress {
                                Text(address)
                                    .font(.system(size: 11))
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                                    .lineLimit(1)
                            }
                        }
                        Spacer()
                        Icon(.chevronRight, size: 14, color: Theme.Color.appTextSecondary)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 10)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("ceremonialRecipient_\(recipient.userId)")
                if index < viewModel.recipientResults.count - 1 {
                    Rectangle().fill(Theme.Color.appBorder).frame(height: 1).padding(.leading, Spacing.s3)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func selectedRecipientCard(_ recipient: MailRecipientDTO) -> some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.successBg).frame(width: 40, height: 40)
                Icon(.check, size: 18, color: Theme.Color.success)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(recipient.name ?? recipient.username ?? "Recipient")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                if let address = recipient.homeAddress {
                    Text(address)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer()
        }
        .padding(Spacing.s3)
        .background(Theme.Color.successBg.opacity(0.4))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Theme.Color.success, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityIdentifier("ceremonialSelectedRecipient")
    }

    private func intentRow(_ intent: CeremonialMailIntent) -> some View {
        let isSelected = viewModel.intent == intent
        return Button {
            viewModel.selectIntent(intent)
        } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    Circle()
                        .stroke(isSelected ? Theme.Color.primary600 : Theme.Color.appBorderStrong, lineWidth: 2)
                        .frame(width: 20, height: 20)
                    if isSelected {
                        Circle().fill(Theme.Color.primary600).frame(width: 10, height: 10)
                    }
                }
                Icon(intent.icon, size: 16, color: Theme.Color.primary600)
                VStack(alignment: .leading, spacing: 2) {
                    Text(intent.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(intent.subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
            }
            .padding(Spacing.s3)
            .background(isSelected ? Theme.Color.primary50 : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(isSelected ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("ceremonialIntent_\(intent.rawValue)")
    }

    // MARK: - Step 2: verify

    private var verifyStep: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HeadlineBlock("Address it")
            SubcopyBlock("Pantopus verifies physical addresses. By sending, you're confirming this exact recipient. There's no undo.")
            if let ctx = viewModel.homeContext {
                addressCard(ctx)
            } else if let address = viewModel.selectedRecipient?.homeAddress {
                addressCard(simpleAddress: address)
            }
            ackRow(
                title: "Yes, ship to this address",
                isOn: viewModel.addressConfirmed,
                identifier: "ceremonialAddressConfirmed"
            ) { viewModel.toggleAddressConfirmed($0) }
            ackRow(
                title: "Include my return address",
                subtitle: "Off keeps your home address private from the recipient.",
                isOn: viewModel.returnAddressShared,
                identifier: "ceremonialReturnAddressShared"
            ) { viewModel.toggleReturnAddressShared($0) }
        }
    }

    private func addressCard(_ ctx: MailHomeContextResponse) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("DESTINATION")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
            Text(ctx.addressDisplay ?? "Home")
                .font(.system(size: 14.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            if let count = ctx.memberCount {
                Text("\(count) household member\(count == 1 ? "" : "s")")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("ceremonialAddressCard")
    }

    private func addressCard(simpleAddress: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("DESTINATION")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
            Text(simpleAddress)
                .font(.system(size: 14.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("ceremonialAddressCard")
    }

    private func ackRow(
        title: String,
        subtitle: String? = nil,
        isOn: Bool,
        identifier: String,
        onChange: @escaping (Bool) -> Void
    ) -> some View {
        Toggle(isOn: Binding(get: { isOn }, set: { onChange($0) })) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                if let subtitle {
                    Text(subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
        .tint(Theme.Color.primary600)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityIdentifier(identifier)
    }

    // MARK: - Step 3: compose

    private var composeStep: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HeadlineBlock("Write it")
            SubcopyBlock("Pick a stationery + ink, write your note, optionally add a voice postscript.")
            pickerRow(
                title: "Stationery",
                identifier: "ceremonialStationeryPicker",
                options: CeremonialMailStationery.allCases.map { ($0.id, $0.title) },
                selected: viewModel.stationery.id
            ) { id in
                if let s = CeremonialMailStationery(rawValue: id) { viewModel.selectStationery(s) }
            }
            pickerRow(
                title: "Ink",
                identifier: "ceremonialInkPicker",
                options: CeremonialMailInk.allCases.map { ($0.id, $0.title) },
                selected: viewModel.ink.id
            ) { id in
                if let i = CeremonialMailInk(rawValue: id) { viewModel.selectInk(i) }
            }
            pickerRow(
                title: "Seal",
                identifier: "ceremonialSealPicker",
                options: CeremonialMailSeal.allCases.map { ($0.id, $0.title) },
                selected: viewModel.seal.id
            ) { id in
                if let s = CeremonialMailSeal(rawValue: id) { viewModel.selectSeal(s) }
            }
            bodyTextField
            voicePostscriptRow
        }
    }

    private func pickerRow(
        title: String,
        identifier: String,
        options: [(String, String)],
        selected: String,
        onSelect: @escaping (String) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(options, id: \.0) { id, label in
                        let isActive = id == selected
                        Button {
                            onSelect(id)
                        } label: {
                            Text(label)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                                .padding(.horizontal, Spacing.s3)
                                .frame(height: 32)
                                .background(isActive ? Theme.Color.primary600 : Theme.Color.appSurface)
                                .overlay(
                                    Capsule().stroke(
                                        isActive ? Theme.Color.primary600 : Theme.Color.appBorder,
                                        lineWidth: 1
                                    )
                                )
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("\(identifier)_\(id)")
                    }
                }
            }
        }
    }

    private var bodyTextField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("LETTER")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
            ZStack(alignment: .topLeading) {
                if viewModel.bodyText.isEmpty {
                    Text("Dear friend,")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.top, Spacing.s2)
                        .padding(.leading, Spacing.s1)
                }
                TextEditor(text: Binding(
                    get: { viewModel.bodyText },
                    set: { viewModel.updateBody($0) }
                ))
                .frame(minHeight: 120)
                .scrollContentBackground(.hidden)
                .accessibilityIdentifier("ceremonialBodyEditor")
            }
            .padding(Spacing.s2)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }

    private var voicePostscriptRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("VOICE POSTSCRIPT (OPTIONAL)")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
            voicePostscriptControl
        }
    }

    @ViewBuilder
    private var voicePostscriptControl: some View {
        switch viewModel.voiceStatus {
        case .empty:
            Button {
                viewModel.voicePostscriptDidStartRecording()
                // Real recording is the responsibility of the host —
                // this VM only owns the upload + UI state. The host
                // platform overrides `voicePostscriptDidCapture` with
                // its native recorder.
            } label: {
                voiceChip(label: "Record a postscript", icon: .send, accent: false)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("ceremonialVoiceRecord")
        case .recording:
            voiceChip(label: "Recording…", icon: .send, accent: true)
        case .captured:
            HStack {
                voiceChip(label: "Uploading…", icon: .send, accent: true)
            }
        case .uploading:
            voiceChip(label: "Uploading…", icon: .send, accent: true)
        case .uploaded:
            HStack {
                voiceChip(label: "Voice postscript ready", icon: .check, accent: true)
                Button("Remove") { viewModel.clearVoicePostscript() }
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        case let .error(message):
            VStack(alignment: .leading, spacing: Spacing.s1) {
                voiceChip(label: message, icon: .alertCircle, accent: false)
                Button("Try again") { viewModel.clearVoicePostscript() }
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
            }
        }
    }

    private func voiceChip(label: String, icon: PantopusIcon, accent: Bool) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(icon, size: 14, color: accent ? Theme.Color.appTextInverse : Theme.Color.primary600)
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(accent ? Theme.Color.appTextInverse : Theme.Color.primary700)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 36)
        .background(accent ? Theme.Color.primary600 : Theme.Color.primary50)
        .clipShape(Capsule())
    }

    // MARK: - Step 4: commit

    private var commitStep: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HeadlineBlock("Seal and send")
            SubcopyBlock("Take one more look — you can't edit a letter after it's delivered. Pick a wax seal, then send.")
            reviewCard
            Text("WHEN TO DELIVER")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
            VStack(spacing: Spacing.s2) {
                ForEach(CeremonialMailSendTiming.allCases) { timing in
                    sendTimingRow(timing)
                }
            }
        }
    }

    private var reviewCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            reviewLine("To", viewModel.selectedRecipient?.name ?? viewModel.selectedRecipient?.username ?? "—")
            reviewLine("Intent", viewModel.intent.title)
            reviewLine("Stationery", viewModel.stationery.title)
            reviewLine("Ink", viewModel.ink.title)
            reviewLine("Seal", viewModel.seal.title)
            if case .uploaded = viewModel.voiceStatus {
                reviewLine("Voice postscript", "Attached")
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("ceremonialReviewCard")
    }

    private func reviewLine(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(width: 110, alignment: .leading)
            Text(value)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
        }
    }

    private func sendTimingRow(_ timing: CeremonialMailSendTiming) -> some View {
        let isActive = viewModel.sendTiming == timing
        return Button {
            viewModel.selectSendTiming(timing)
        } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    Circle()
                        .stroke(isActive ? Theme.Color.primary600 : Theme.Color.appBorderStrong, lineWidth: 2)
                        .frame(width: 20, height: 20)
                    if isActive {
                        Circle().fill(Theme.Color.primary600).frame(width: 10, height: 10)
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(timing.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(timing.subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
            }
            .padding(Spacing.s3)
            .background(isActive ? Theme.Color.primary50 : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(isActive ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("ceremonialTiming_\(timing.id)")
    }

    // MARK: - Step 5: success

    private var successStep: some View {
        VStack(spacing: Spacing.s4) {
            ZStack {
                Circle().fill(Theme.Color.successBg).frame(width: 96, height: 96)
                Icon(.checkCircle, size: 56, color: Theme.Color.success)
            }
            .padding(.top, Spacing.s5)
            Text("Letter sealed and on its way")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("We'll let you know when it lands. Until then, the only person who sees your letter is the one you addressed it to.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.s3)
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("ceremonialSuccess")
    }
}

#Preview {
    CeremonialMailWizardView()
}
