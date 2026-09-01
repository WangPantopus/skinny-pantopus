//
//  TasksMapSampleData.swift
//  Pantopus
//
//  Deterministic seed for the Tasks map (previews + unit tests). The nine
//  items reproduce the design's nine pins — handyman ×2, cleaning ×2, pet
//  care ×2, plus moving / child care / tutoring. The moving + tutoring
//  pins are `.pending` (A11.1 semantic: unverified poster — no white
//  ring, dashed category outline). The first three mirror the design's
//  rail cards verbatim so previews and snapshots match the frame.
//  Coordinates cluster inside the ~0.024° camera span around the anchor
//  so every pin lands on screen.
//

import Foundation

public enum TasksMapSampleData {
    /// "You are here" anchor — Midtown Manhattan, matching the shared
    /// MapListHybrid preview + Nearby map default.
    public static let anchor = MapAnchor(latitude: 40.7484, longitude: -73.9857)

    public static let items: [TaskMapItem] = [
        TaskMapItem(
            id: "handyman-1",
            category: .handyman,
            state: .confirmed,
            latitude: 40.7499,
            longitude: -73.9881,
            title: "Hang 3 floating shelves",
            body: "Drywall anchors provided. Two are above the desk, one in the hallway.",
            price: "$60",
            distanceLabel: "0.2 mi",
            bidCount: 4
        ),
        TaskMapItem(
            id: "cleaning-1",
            category: .cleaning,
            state: .confirmed,
            latitude: 40.7515,
            longitude: -73.9845,
            title: "Deep clean 2BR before move-out",
            body: "Landlord inspection Friday — kitchen, bathroom, and inside the oven.",
            price: "$180",
            distanceLabel: "0.5 mi",
            bidCount: 7
        ),
        TaskMapItem(
            id: "petcare-1",
            category: .petcare,
            state: .confirmed,
            latitude: 40.7468,
            longitude: -73.9832,
            title: "Midday dog walks Tue/Thu",
            body: "Friendly golden retriever, 30-minute loop around the park.",
            price: "$22/walk",
            distanceLabel: "0.3 mi",
            bidCount: 2
        ),
        TaskMapItem(
            id: "moving-1",
            category: .moving,
            state: .pending,
            latitude: 40.7526,
            longitude: -73.9808,
            title: "Help move a couch up 2 flights",
            price: "$90",
            distanceLabel: "0.6 mi",
            bidCount: 1
        ),
        TaskMapItem(
            id: "childcare-1",
            category: .childcare,
            state: .confirmed,
            latitude: 40.7455,
            longitude: -73.9869,
            title: "After-school pickup + sitting",
            price: "$25/hr",
            distanceLabel: "0.4 mi",
            bidCount: 3
        ),
        TaskMapItem(
            id: "handyman-2",
            category: .handyman,
            state: .confirmed,
            latitude: 40.7441,
            longitude: -73.9819,
            title: "Mount a 55\" TV on drywall",
            price: "$75",
            distanceLabel: "0.7 mi",
            bidCount: 5
        ),
        TaskMapItem(
            id: "tutoring-1",
            category: .tutoring,
            state: .pending,
            latitude: 40.7432,
            longitude: -73.9795,
            title: "Algebra tutoring, twice weekly",
            price: "$40/hr",
            distanceLabel: "0.8 mi",
            bidCount: 0
        ),
        TaskMapItem(
            id: "petcare-2",
            category: .petcare,
            state: .confirmed,
            latitude: 40.7508,
            longitude: -73.9912,
            title: "Weekend cat sitting",
            price: "$30/day",
            distanceLabel: "0.5 mi",
            bidCount: 2
        ),
        TaskMapItem(
            id: "cleaning-2",
            category: .cleaning,
            state: .confirmed,
            latitude: 40.7462,
            longitude: -73.9788,
            title: "Weekly apartment tidy-up",
            price: "$70",
            distanceLabel: "0.6 mi",
            bidCount: 6
        )
    ]
}
