//
//  InlineReplyCTA.swift
//  Pantopus
//
//  `inline_reply` CTA slot for the Pulse post detail. The reply composer
//  is part of the body (see `BodyReactionsBody`), so this CTA renders
//  nothing — it exists as a distinct type to preserve the design's slot
//  vocabulary and to satisfy `ContentDetailShell`'s generic signature.
//

import SwiftUI

/// Empty CTA shelf used by Pulse post detail. The composer ships inline
/// in the body; no sticky footer is required.
public struct InlineReplyCTA: View {
    public init() {}

    public var body: some View {
        EmptyView()
    }
}
