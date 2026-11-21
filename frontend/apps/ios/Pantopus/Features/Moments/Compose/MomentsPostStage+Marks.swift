//
//  MomentsPostStage+Marks.swift
//  Pantopus
//
//  The pills over the picture on the Post screen: Retake, and on a photo
//  Text, Draw and Resize (board T1), which open the marks editor in that tool. On the phone
//  they sit at the top right; on the iPhone Duo they follow Retake in one
//  row, because two poses keep the clock at the top right. Where the row is
//  too narrow, the tools that don't fit drop to a second row with their words
//  (founder, 2026-11-21). While a Post is going they are off.
//

import SwiftUI

extension MomentsPostStage {
    /// The phone's top row: Retake at the left, Text, Draw and Resize at the right (board T1). A tool that doesn't fit
    /// drops to a second row under them, keeping its word (founder, 2026-11-21): Resize where the four don't fit across
    /// (every phone narrower than 429 points), Draw too on the narrowest.
    var phonePills: some View {
        pillRows(alignment: .trailing)
    }

    /// The iPhone Duo's row: Retake, then Text, Draw and Resize; the ones that don't fit drop under Retake.
    var pillRow: some View {
        pillRows(alignment: .leading)
    }

    /// The tools this picture offers, in their order: Text and Draw on a photo or a video, and Resize on a photo.
    private var tools: [MomentsMarking.Tool] {
        (model.offersMarks ? [.text, .draw] : []) + (model.offersResize ? [.resize] : [])
    }

    /// Retake and as many tools as fit in one row, the rest in a second: never a pill without its word.
    private func pillRows(alignment: HorizontalAlignment) -> some View {
        ViewThatFits(in: .horizontal) {
            ForEach(Array((1...max(tools.count, 1)).reversed()), id: \.self) { first in
                VStack(alignment: alignment, spacing: Spacing.s2) {
                    HStack(spacing: Spacing.s2) {
                        retakeButton
                        if alignment == .trailing { Spacer(minLength: Spacing.s2) }
                        ForEach(tools.prefix(first), id: \.self) { toolPill($0) }
                    }
                    if tools.count > first {
                        HStack(spacing: Spacing.s2) {
                            ForEach(tools.dropFirst(first), id: \.self) { toolPill($0) }
                        }
                    }
                }
            }
        }
    }

    /// One tool's pill, off while a Post is going.
    private func toolPill(_ tool: MomentsMarking.Tool) -> some View {
        Group {
            switch tool {
            case .text:
                markPill(.text, name: "Text", id: "moments.post.text") {
                    // "Aa" is lettering, not an icon (board T1).
                    Text("Aa").font(.system(size: 16, weight: .bold)).kerning(-0.5)
                    Text("Text")
                }
            case .draw:
                markPill(.draw, name: "Draw", id: "moments.post.draw") {
                    Icon(.pencil, size: 18, strokeWidth: 2.2, color: .white)
                    Text("Draw")
                }
            case .resize:
                markPill(.resize, name: "Resize", id: "moments.post.resize") {
                    Icon(.maximize, size: 17, strokeWidth: 2.2, color: .white)
                    Text("Resize")
                }
            }
        }
        .disabled(model.isPosting)
        .opacity(model.isPosting ? 0.5 : 1)
    }

    private func markPill(_ tool: MomentsMarking.Tool, name: String, id: String, @ViewBuilder label: () -> some View) -> some View {
        Button { model.openMarks(tool) } label: {
            HStack(spacing: 6) { label() }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.leading, Spacing.s3)
                .padding(.trailing, 14)
                .frame(height: 40)
                .background(Capsule().fill(Color.black.opacity(0.42)))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(name)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier(id)
    }

    var retakeButton: some View {
        let isText = model.draft == .text
        return Button { model.askRetake() } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.chevronLeft, size: 20, strokeWidth: 2.2, color: .white)
                Text(isText ? "Edit" : "Retake").font(.system(size: 15, weight: .semibold))
            }
            .foregroundStyle(.white)
            .padding(.leading, Spacing.s2)
            .padding(.trailing, 14)
            .frame(height: 40)
            .background(Capsule().fill(Color.black.opacity(isText ? 0.25 : 0.42)))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        // Off from the request that makes the Moment until that Post ends; before that it cancels the Post.
        .disabled(model.isSending)
        .opacity(model.isSending ? 0.5 : 1)
        .accessibilityIdentifier("moments.post.retake")
    }
}
