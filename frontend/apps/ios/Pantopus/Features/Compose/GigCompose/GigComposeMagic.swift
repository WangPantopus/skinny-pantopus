//
//  GigComposeMagic.swift
//  Pantopus
//
//  A12.8 — Magic Task step-1 chrome for the describe-first Post-a-Task
//  wizard: the AI-assisted describe path (default) and the manual
//  category picker (fallback). Step 1 renders `MagicDescribeStep` or
//  `ManualPickerStep` based on `form.composeMode`.
//

import AVFoundation
import PhotosUI
import SwiftUI

// swiftlint:disable file_length

// MARK: - Entity highlighting

/// Ranges of the describe text that fed the parse — (a) $-amounts and
/// numbers glued to "hour(s)", (b) day/time words, (c) the keyword(s)
/// matching the detected category. Pure so it's unit-testable; overlaps
/// are merged and the result is sorted.
@MainActor
func magicHighlightRanges(text: String, draft: MagicDraftDTO?) -> [Range<String.Index>] {
    guard !text.isEmpty else { return [] }
    var ranges: [Range<String.Index>] = []

    func addRegexMatches(_ pattern: String) {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return }
        let whole = NSRange(text.startIndex..<text.endIndex, in: text)
        for match in regex.matches(in: text, options: [], range: whole) {
            if let range = Range(match.range, in: text) { ranges.append(range) }
        }
    }

    // (a) dollar amounts ("$120", "$ 80–120") + bare numbers adjacent to
    // hour words ("3 hours", "2.5hrs").
    addRegexMatches(#"\$\s?\d+(?:[.,]\d+)?(?:\s?[-–]\s?\$?\d+(?:[.,]\d+)?)?"#)
    addRegexMatches(#"\d+(?:\.\d+)?\s*(?:hours?|hrs?|hr)\b"#)
    // (b) day/time words.
    addRegexMatches(
        #"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday"#
            + #"|tomorrow|today|tonight|weekend|morning|afternoon|evening|noon|asap)\b"#
    )
    // (c) keywords that matched the detected category.
    let category = GigComposeCategory.from(backendCategory: draft?.category)
        ?? GigComposeViewModel.detectArchetype(from: text)
    if let category,
       let entry = GigComposeViewModel.archetypeKeywords.first(where: { $0.category == category }) {
        for keyword in entry.keywords {
            let needle = keyword.trimmingCharacters(in: .whitespaces)
            guard !needle.isEmpty else { continue }
            var searchStart = text.startIndex
            while searchStart < text.endIndex,
                  let found = text.range(of: needle, options: [.caseInsensitive], range: searchStart..<text.endIndex) {
                ranges.append(found)
                searchStart = found.upperBound
            }
        }
    }

    let sorted = ranges.sorted { $0.lowerBound < $1.lowerBound }
    var merged: [Range<String.Index>] = []
    for range in sorted {
        if let last = merged.last, range.lowerBound <= last.upperBound {
            if range.upperBound > last.upperBound {
                merged[merged.count - 1] = last.lowerBound..<range.upperBound
            }
        } else {
            merged.append(range)
        }
    }
    return merged
}

/// Render the describe text with the parsed-entity spans painted in the
/// magic accent (magicBg background, magic color, semibold).
@MainActor
func magicHighlightedText(_ text: String, draft: MagicDraftDTO?) -> AttributedString {
    var attributed = AttributedString(text)
    for range in magicHighlightRanges(text: text, draft: draft) {
        guard let lower = AttributedString.Index(range.lowerBound, within: attributed),
              let upper = AttributedString.Index(range.upperBound, within: attributed)
        else { continue }
        attributed[lower..<upper].backgroundColor = Theme.Color.magicBg
        attributed[lower..<upper].foregroundColor = Theme.Color.magic
        attributed[lower..<upper].font = .system(size: 14.5, weight: .semibold)
    }
    return attributed
}

// MARK: - Category accent helper

extension GigComposeCategory {
    /// A12.8 manual path renders the eight concrete archetypes. `Other`
    /// remains valid for restored / backend state, but is not a picker tile.
    static var manualPickerCases: [GigComposeCategory] {
        allCases.filter { $0 != .other }
    }

    /// Accent colour for the manual-picker tile (A12.8 category accents).
    var accent: Color {
        switch self {
        case .handyman: Theme.Color.handyman
        case .cleaning: Theme.Color.cleaning
        case .moving: Theme.Color.moving
        case .petcare: Theme.Color.petCare
        case .childcare: Theme.Color.childCare
        case .tutoring: Theme.Color.tutoring
        case .delivery: Theme.Color.delivery
        case .tech: Theme.Color.tech
        case .other: Theme.Color.appTextSecondary
        }
    }

    var tileIcon: PantopusIcon {
        switch self {
        case .handyman: .hammer
        case .cleaning: .sparkles
        case .moving: .package
        case .petcare: .pawPrint
        case .childcare: .heart
        case .tutoring: .lightbulb
        case .delivery: .send
        case .tech: .laptop
        case .other: .moreHorizontal
        }
    }

    /// Short example list rendered under the tile label.
    var examples: String {
        switch self {
        case .handyman: "Assembly · repairs · install"
        case .cleaning: "Home · move-out · windows"
        case .moving: "Boxes · furniture · loading"
        case .petcare: "Walks · sitting · grooming"
        case .childcare: "Sitting · pickups · tutoring"
        case .tutoring: "Math · music · test prep"
        case .delivery: "Pickups · drops · errands"
        case .tech: "Wifi · setup · troubleshoot"
        case .other: "Anything else"
        }
    }
}

/// "home_service" → "Home service" — the detected-category row's
/// sub-label, humanized from the draft's `task_archetype`.
func gigHumanizedArchetype(_ raw: String?) -> String? {
    guard let raw, !raw.isEmpty else { return nil }
    let spaced = raw.replacingOccurrences(of: "_", with: " ")
    return spaced.prefix(1).uppercased() + spaced.dropFirst()
}

extension GigComposeEngagementMode {
    var label: String {
        switch self {
        case .oneTime: "One-time"
        case .recurring: "Recurring"
        case .openEnded: "Open-ended"
        }
    }

    var subcopy: String {
        switch self {
        case .oneTime: "Done once"
        case .recurring: "Weekly +"
        case .openEnded: "Until done"
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .oneTime: .circleDot
        case .recurring: .repeat2
        case .openEnded: .infinity
        }
    }
}

// MARK: - Identity chip (P6c persona switching)

/// "PERSONAL · YOU" / "ACME PLUMBING · BUSINESS" pill. Static for
/// business-less users; becomes a picker menu once
/// `viewModel.identityOptions` carries business seats. Selection updates
/// the form's `beneficiary_user_id` (nil = personal).
struct ComposeIdentityChip: View {
    @Bindable var viewModel: GigComposeViewModel

    var body: some View {
        Group {
            if viewModel.identityOptions.count > 1 {
                Menu {
                    ForEach(viewModel.identityOptions) { option in
                        Button {
                            viewModel.selectIdentity(option)
                        } label: {
                            if isSelected(option) {
                                Label(option.label, systemImage: "checkmark")
                            } else {
                                Text(option.label)
                            }
                        }
                        .accessibilityIdentifier("gigCompose.identity.option_\(option.id)")
                    }
                } label: {
                    chipBody(showsChevron: true)
                }
                .buttonStyle(.plain)
            } else {
                chipBody(showsChevron: false)
            }
        }
        .accessibilityIdentifier("gigCompose.identity")
        .accessibilityLabel("Posting as \(isBusiness ? (viewModel.form.beneficiaryName ?? "business") : "yourself")")
    }

    private var isBusiness: Bool {
        viewModel.form.beneficiaryUserId != nil
    }

    private func isSelected(_ option: GigComposeIdentityOption) -> Bool {
        option.beneficiaryUserId == viewModel.form.beneficiaryUserId
    }

    private func chipBody(showsChevron: Bool) -> some View {
        let accent = isBusiness ? Theme.Color.business : Theme.Color.personal
        let background = isBusiness ? Theme.Color.businessBg : Theme.Color.personalBg
        let text = isBusiness
            ? "\((viewModel.form.beneficiaryName ?? "Business").uppercased()) · BUSINESS"
            : "PERSONAL · YOU"
        return HStack(spacing: Spacing.s1) {
            Icon(isBusiness ? .building2 : .user, size: 11, color: accent)
            Text(text)
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(accent)
                .lineLimit(1)
            if showsChevron {
                Icon(.chevronDown, size: 10, strokeWidth: 2.6, color: accent)
            }
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }
}

// MARK: - Step 1A: Magic describe

struct MagicDescribeStep: View {
    @Bindable var viewModel: GigComposeViewModel
    @FocusState private var isDescribeFocused: Bool
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showsPhotosPicker = false

    var body: some View {
        ComposeIdentityChip(viewModel: viewModel)
        HeadlineBlock("What do you need done?")
        SubcopyBlock("Describe it in your own words. Pantopus figures out the category, fills in the details, and posts it for bids.")
        MagicDescribeCard(
            viewModel: viewModel,
            isFocused: $isDescribeFocused
        ) { showsPhotosPicker = true }
            .photosPicker(
                isPresented: $showsPhotosPicker,
                selection: $pickerItems,
                maxSelectionCount: max(1, GigComposeLimits.maxPhotos - viewModel.attachments.count),
                matching: .images
            )
            .onChange(of: pickerItems) { _, newItems in
                handlePicked(newItems)
            }
        if viewModel.form.describeText.isEmpty, !viewModel.templates.isEmpty {
            MagicTemplatesRow(templates: viewModel.templates) { template in
                viewModel.applyTemplate(template)
            }
        }
        if let question = viewModel.clarifyingQuestion {
            MagicClarifyingHint(question: question)
        }
        if let archetype = viewModel.form.detectedArchetype {
            DetectedCategoryRow(
                archetype: archetype,
                archetypeSubLabel: gigHumanizedArchetype(
                    viewModel.form.taskArchetype ?? viewModel.magicDraft?.taskArchetype
                )
            ) {
                isDescribeFocused = false
                viewModel.setComposeMode(.manual)
            }
            ModulePromptsCard(prompts: viewModel.modulePrompts) { key in
                isDescribeFocused = false
                if key == .photos {
                    showsPhotosPicker = true
                } else {
                    viewModel.handleModulePromptTap(key)
                }
            }
        }
        EngagementModeControl(
            selected: viewModel.form.engagementTile
        ) { mode in
            isDescribeFocused = false
            viewModel.selectEngagementMode(mode)
        }
    }

    private func handlePicked(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            for item in items {
                if let data = try? await item.loadTransferable(type: Data.self), !data.isEmpty {
                    viewModel.addPhotoData(data)
                }
            }
            pickerItems = []
        }
    }
}

// MARK: - Describe card

private struct MagicDescribeCard: View {
    @Bindable var viewModel: GigComposeViewModel
    @FocusState.Binding var isFocused: Bool
    let onPickPhotos: () -> Void

    @State private var audioRecorder: AVAudioRecorder?
    @State private var isRecording = false
    @State private var isMicDenied = false

    private var text: Binding<String> {
        Binding(
            get: { viewModel.form.describeText },
            set: { viewModel.setDescribeText($0) }
        )
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            editorArea
            toolRow
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("gigCompose.describe.card")
        .onAppear {
            isMicDenied = AVAudioApplication.shared.recordPermission == .denied
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { isFocused = false }
                    .font(.system(size: 16, weight: .semibold))
                    .accessibilityIdentifier("composeGigDescribeKeyboardDone")
            }
        }
    }

    /// Plain editor while typing; once a draft exists and the field is
    /// not focused, an AttributedString overlay paints the parsed-entity
    /// spans. Tapping the overlay refocuses for editing.
    @ViewBuilder private var editorArea: some View {
        let describeText = viewModel.form.describeText
        if !isFocused, viewModel.magicDraft != nil, !describeText.isEmpty {
            Button {
                isFocused = true
            } label: {
                Text(magicHighlightedText(describeText, draft: viewModel.magicDraft))
                    .font(.system(size: 14.5))
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, minHeight: 84, alignment: .topLeading)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("gigCompose.describe.field")
            .accessibilityLabel("Task description: \(describeText). Tap to edit.")
        } else {
            TextEditor(text: text)
                .font(.system(size: 14.5))
                .foregroundStyle(Theme.Color.appText)
                .frame(minHeight: 84)
                .scrollContentBackground(.hidden)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s1)
                .focused($isFocused)
                .overlay(alignment: .topLeading) {
                    if describeText.isEmpty {
                        Text("e.g. Need someone to assemble an IKEA desk this Saturday morning…")
                            .font(.system(size: 14.5))
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .padding(.horizontal, Spacing.s3)
                            .padding(.top, Spacing.s2 + 2)
                            .allowsHitTesting(false)
                    }
                }
                .accessibilityIdentifier("gigCompose.describe.field")
        }
    }

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.sparkles, size: 13, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                .frame(width: 22, height: 22)
                .background(Theme.Color.magic)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            Text("Magic Task")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.Color.magic)
            Spacer(minLength: Spacing.s0)
            statusBadge
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.magicBgSoft)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.magicBorder).frame(height: 1)
        }
    }

    @ViewBuilder private var statusBadge: some View {
        if viewModel.isParsingDraft || viewModel.isTranscribing {
            HStack(spacing: Spacing.s1) {
                ProgressView()
                    .controlSize(.mini)
                    .tint(Theme.Color.magic)
                Text(viewModel.isTranscribing ? "TRANSCRIBING" : "PARSING")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(Theme.Color.magic)
            }
            .accessibilityIdentifier("gigCompose.describe.status")
        } else if viewModel.form.detectedArchetype != nil {
            HStack(spacing: Spacing.s1) {
                Circle()
                    .fill(Theme.Color.success)
                    .frame(width: 6, height: 6)
                    .overlay(
                        Circle()
                            .stroke(Theme.Color.successBg, lineWidth: 2.5)
                    )
                Text("PARSED")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(0.4)
                    .foregroundStyle(Theme.Color.success)
            }
            .accessibilityIdentifier("gigCompose.describe.status")
            .accessibilityLabel("Parsed")
        }
    }

    private var toolRow: some View {
        HStack(spacing: Spacing.s2) {
            if !isMicDenied {
                toolButton(
                    icon: isRecording ? .x : .mic,
                    identifier: "gigCompose.describe.mic",
                    label: isRecording ? "Stop recording" : "Record a voice note",
                    action: toggleRecording
                )
            }
            if isRecording {
                RecordingIndicator { toggleRecording() }
            }
            toolButton(
                icon: .image,
                identifier: "gigCompose.describe.image",
                label: "Add photos",
                action: onPickPhotos
            )
            toolButton(
                icon: .paperclip,
                identifier: "gigCompose.describe.attach",
                label: "Attach a file",
                action: onPickPhotos
            )
            Spacer(minLength: Spacing.s0)
            Text("\(viewModel.form.describeText.count) / \(GigComposeLimits.describeMax)")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextMuted)
                .accessibilityIdentifier("gigCompose.describe.counter")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    private func toolButton(
        icon: PantopusIcon,
        identifier: String,
        label: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Icon(icon, size: 15, color: Theme.Color.appTextSecondary)
                .frame(width: 32, height: 32)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel(label)
    }

    // MARK: Recording

    private func toggleRecording() {
        if isRecording {
            stopRecording()
        } else {
            Task { await startRecording() }
        }
    }

    private func startRecording() async {
        let granted = await AVAudioApplication.requestRecordPermission()
        guard granted else {
            isMicDenied = true
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .default)
            try session.setActive(true)
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("gig-describe-\(UUID().uuidString).m4a")
            let settings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: 44100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue
            ]
            let recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder.record()
            audioRecorder = recorder
            isRecording = true
        } catch {
            // Recording unavailable (simulator without input, etc.) —
            // degrade silently; typing still works.
            audioRecorder = nil
            isRecording = false
        }
    }

    private func stopRecording() {
        let url = audioRecorder?.url
        audioRecorder?.stop()
        audioRecorder = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        guard let url, let data = try? Data(contentsOf: url) else { return }
        Task { await viewModel.appendTranscribedAudio(data) }
        try? FileManager.default.removeItem(at: url)
    }
}

/// Pulsing red dot + "Stop" while a voice note records.
private struct RecordingIndicator: View {
    let onStop: () -> Void
    @State private var pulsing = false

    var body: some View {
        Button(action: onStop) {
            HStack(spacing: Spacing.s1) {
                Circle()
                    .fill(Theme.Color.error)
                    .frame(width: 8, height: 8)
                    .opacity(pulsing ? 0.35 : 1)
                    .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulsing)
                Text("Stop")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.error)
            }
            .padding(.horizontal, Spacing.s2)
            .frame(height: 32)
            .background(Theme.Color.errorBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
        }
        .buttonStyle(.plain)
        .onAppear { pulsing = true }
        .accessibilityLabel("Recording, tap to stop")
    }
}

// MARK: - Inspiration templates

private struct MagicTemplatesRow: View {
    let templates: [GigTaskTemplateDTO]
    let onTap: (GigTaskTemplateDTO) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(templates) { template in
                    Button {
                        onTap(template)
                    } label: {
                        HStack(spacing: Spacing.s1) {
                            if let emoji = template.icon, !emoji.isEmpty {
                                Text(emoji).font(.system(size: 13))
                            }
                            Text(template.label)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                        }
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, Spacing.s2)
                        .background(Theme.Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                                .stroke(Theme.Color.appBorder, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("gigCompose.templateChip_\(template.id)")
                    .accessibilityLabel("Template: \(template.label)")
                }
            }
        }
        .accessibilityIdentifier("gigCompose.templates")
    }
}

/// B.3 — small hint under the describe card surfacing the parser's
/// clarifying question (e.g. "Roughly how many boxes?").
private struct MagicClarifyingHint: View {
    let question: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.info, size: 13, strokeWidth: 2.2, color: Theme.Color.magic)
                .padding(.top, 1)
            Text(question)
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .accessibilityIdentifier("composeGigClarifyingQuestion")
        .accessibilityLabel("Suggestion: \(question)")
    }
}

// MARK: - Detected category row

private struct DetectedCategoryRow: View {
    let archetype: GigComposeCategory
    let archetypeSubLabel: String?
    let onChange: () -> Void

    private var titleLine: String {
        if let sub = archetypeSubLabel, !sub.isEmpty {
            return "\(archetype.label) · \(sub)"
        }
        return archetype.label
    }

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Icon(archetype.tileIcon, size: 18, strokeWidth: 2.2, color: archetype.accent)
                .frame(width: 36, height: 36)
                .background(archetype.accent.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text("DETECTED CATEGORY")
                    .font(.system(size: 10.5, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(titleLine)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s0)
            Button(action: onChange) {
                Text("Change")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("gigCompose.detected.change")
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Detected category: \(titleLine)")
        .accessibilityIdentifier("gigCompose.detected")
    }
}

// MARK: - Live module prompts

private struct ModulePromptsCard: View {
    let prompts: [GigModulePrompt]
    let onTap: (GigModulePrompt.Key) -> Void

    private var filledCount: Int {
        prompts.filter(\.isFilled).count
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            HStack {
                Text("TASK DETAILS")
                    .font(.system(size: 10.5, weight: .semibold))
                    .tracking(0.6)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                Text("\(filledCount) of \(prompts.count) filled")
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.success)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s2)
            ForEach(Array(prompts.enumerated()), id: \.element.id) { index, prompt in
                ModulePromptRow(prompt: prompt) { onTap(prompt.key) }
                if index < prompts.count - 1 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("gigCompose.modulePrompts")
    }
}

private struct ModulePromptRow: View {
    let prompt: GigModulePrompt
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                Icon(
                    prompt.icon,
                    size: 14,
                    strokeWidth: 2.2,
                    color: prompt.isFilled ? Theme.Color.success : Theme.Color.warning
                )
                .frame(width: 28, height: 28)
                .background(prompt.isFilled ? Theme.Color.successBg : Theme.Color.warningBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(prompt.label)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text(prompt.value)
                        .font(.system(size: 13, weight: prompt.isFilled ? .semibold : .regular))
                        .foregroundStyle(prompt.isFilled ? Theme.Color.appText : Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s0)
                if prompt.isFilled {
                    Icon(.check, size: 14, strokeWidth: 2.6, color: Theme.Color.success)
                } else {
                    Text("Add")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.Color.warning)
                        .padding(.horizontal, Spacing.s2)
                        .padding(.vertical, Spacing.s1)
                        .background(Theme.Color.warningBg)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("gigCompose.modulePrompt_\(prompt.key.rawValue)")
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(prompt.label): \(prompt.value)\(prompt.isFilled ? ", filled" : ", needs input")")
    }
}

// MARK: - Engagement tiles

private struct EngagementModeControl: View {
    let selected: GigComposeEngagementMode
    let onSelect: (GigComposeEngagementMode) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("ENGAGEMENT")
                .font(.system(size: 10.5, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                ForEach(GigComposeEngagementMode.allCases, id: \.self) { option in
                    let active = option == selected
                    Button { onSelect(option) } label: {
                        VStack(spacing: Spacing.s1) {
                            Icon(
                                option.icon,
                                size: 16,
                                strokeWidth: 2.2,
                                color: active ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                            )
                            Text(option.label)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(active ? Theme.Color.primary700 : Theme.Color.appText)
                            Text(option.subcopy)
                                .font(.system(size: 10))
                                .foregroundStyle(active ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.s2)
                        .background(active ? Theme.Color.primary50 : Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .stroke(active ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: active ? 1.5 : 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("gigCompose.engagement_\(option.rawValue)")
                    .accessibilityLabel("\(option.label), \(option.subcopy)")
                    .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
                }
            }
        }
    }
}

// MARK: - Step 1B: Manual picker

struct ManualPickerStep: View {
    @Bindable var viewModel: GigComposeViewModel

    private let columns: [GridItem] = [
        GridItem(.flexible(), spacing: Spacing.s2),
        GridItem(.flexible(), spacing: Spacing.s2)
    ]

    var body: some View {
        TryMagicBanner { viewModel.setComposeMode(.magic) }
        ComposeIdentityChip(viewModel: viewModel)
        HeadlineBlock("Pick a category")
        SubcopyBlock("Skipping the describe step? Pick the archetype directly — we'll ask the questions that matter for it.")
        LazyVGrid(columns: columns, spacing: Spacing.s2) {
            ForEach(GigComposeCategory.manualPickerCases, id: \.self) { category in
                MagicCategoryTile(
                    category: category,
                    isSelected: viewModel.form.category == category
                ) { viewModel.selectCategory(category) }
            }
        }
    }
}

private struct TryMagicBanner: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                Icon(.sparkles, size: 14, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    .frame(width: 28, height: 28)
                    .background(Theme.Color.magic)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Try Magic Task instead")
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.Color.magic)
                    Text("Describe it in plain English — faster for most posts.")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.arrowRight, size: 15, color: Theme.Color.magic)
            }
            .padding(Spacing.s3)
            .background(Theme.Color.magicBgSoft)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.magicBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("gigCompose.manual.magicBanner")
        .accessibilityLabel("Try Magic Task instead")
    }
}

private struct MagicCategoryTile: View {
    let category: GigComposeCategory
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Icon(category.tileIcon, size: 17, strokeWidth: 2.2, color: category.accent)
                    .frame(width: 34, height: 34)
                    .background(category.accent.opacity(0.14))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(category.label)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(category.examples)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.s3)
            .background(isSelected ? Theme.Color.primary50 : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(isSelected ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: isSelected ? 2 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("gigCompose.manual.tile_\(category.rawValue)")
        .accessibilityLabel("\(category.label)\(isSelected ? ", selected" : "")")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
