//
//  RouteStack.swift
//  Pantopus
//
//  Small bridge for typed app routes over SwiftUI's type-erased NavigationPath.
//

import SwiftUI

/// Keeps a typed route mirror while presenting SwiftUI with a
/// `NavigationPath`. This avoids comparison crashes in tab shells that host
/// several stacks with different route enum types.
struct RouteStack<Route: Hashable> {
    var navigationPath = NavigationPath()

    /// The routes, first pushed first.
    private(set) var routes: [Route] = []

    var isEmpty: Bool {
        routes.isEmpty
    }

    var last: Route? {
        routes.last
    }

    mutating func append(_ route: Route) {
        routes.append(route)
        navigationPath.append(route)
    }

    mutating func removeLast() {
        guard !routes.isEmpty else { return }
        routes.removeLast()
        navigationPath.removeLast()
    }

    mutating func removeLast(_ count: Int) {
        let count = min(count, routes.count)
        guard count > 0 else { return }
        routes.removeLast(count)
        navigationPath.removeLast(count)
    }

    mutating func removeAll(where shouldRemove: (Route) throws -> Bool) rethrows {
        try routes.removeAll(where: shouldRemove)
        rebuildNavigationPath()
    }

    /// Puts these routes in place of the ones there.
    mutating func replace(with newRoutes: [Route]) {
        routes = newRoutes
        rebuildNavigationPath()
    }

    func contains(_ route: Route) -> Bool {
        routes.contains(route)
    }

    mutating func replaceNavigationPath(_ newPath: NavigationPath) {
        guard newPath.count <= routes.count else { return }
        if newPath.count < routes.count {
            routes.removeLast(routes.count - newPath.count)
        }
        navigationPath = newPath
    }

    private mutating func rebuildNavigationPath() {
        navigationPath = NavigationPath()
        for route in routes {
            navigationPath.append(route)
        }
    }
}
