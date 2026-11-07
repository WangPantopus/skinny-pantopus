//
//  CreateBusinessSampleData.swift
//  Pantopus
//
//  Fixed content for the A12.10 Create Business wizard: the "What you'll
//  get" payload shown under Home services. The search list lives in
//  `CreateBusinessCategoryCatalog`.
//

import Foundation

enum CreateBusinessSampleData {
    /// "What you'll get with home services" strip content. Mirrors the
    /// 3-row payload baked into the design's `WhatYouGet` block.
    static let homeServicesWhatYouGet: [WhatYouGetItem] = [
        WhatYouGetItem(
            id: "listings",
            icon: .listChecks,
            label: "Service catalog",
            subcopy: "Add services and prices after setup"
        ),
        WhatYouGetItem(
            id: "profile",
            icon: .fileText,
            label: "Business profile",
            subcopy: "Add your name, description, and contact details"
        ),
        WhatYouGetItem(
            id: "draft",
            icon: .shield,
            label: "Save as draft",
            subcopy: "Keep your page hidden until you publish"
        )
    ]
}
