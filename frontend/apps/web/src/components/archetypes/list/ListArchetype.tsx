// ============================================================
// ListArchetype — highest-leverage web page pattern.
// Composition:
//   ArchetypePageHeader (title + CTA + subtitle)
//   · Optional TabStrip under the header
//   · Optional renderHeader() banner row
//   · Flat rows or grouped rows
//   · Empty state when length === 0
//   · Loading skeleton slot
//
// Unlike mobile, there is no phone chrome — `AppShell` is
// already rendered by the layout, so this archetype renders
// only the page body.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  ArchetypeEmptyState,
  type ArchetypeEmptyStateProps,
  ArchetypePageHeader,
  type ArchetypePageHeaderProps,
  Overline,
  TabStrip,
  type TabStripItem,
} from '../primitives';

export interface ListArchetypeGroup<Row> {
  key: string;
  label: string;
  count?: number;
  rows: Row[];
  /** Wrap rows in a white boxed card (with divider between children). Default false. */
  boxed?: boolean;
}

export interface ListArchetypeProps<Row> {
  /** Title appears in the archetype page header. */
  title: ReactNode;
  subtitle?: ReactNode;
  overline?: string;
  primaryAction?: ArchetypePageHeaderProps['primaryAction'];
  secondaryActions?: ArchetypePageHeaderProps['secondaryActions'];
  /** Tabs rendered under the page header. */
  tabs?: TabStripItem[];
  activeTabKey?: string;
  onTabChange?: (key: string) => void;
  scrollableTabs?: boolean;
  /** Filter / search bar rendered inside the page-header row below the title. */
  headerFilters?: ReactNode;
  /** Banner row or toolbar rendered between header/tabs and the rows. */
  renderHeader?: () => ReactNode;
  /** Flat rows model. Mutually exclusive with groups. */
  rows?: Row[];
  /** Grouped rows (e.g. Docs by category). */
  groups?: ListArchetypeGroup<Row>[];
  renderRow: (row: Row, index: number) => ReactNode;
  keyExtractor: (row: Row, index: number) => string;
  /** Vertical spacing between rows. Tailwind `space-y-*` key. */
  rowSpacing?: 2 | 3 | 4 | 6;
  /** Loading state (when true and no rows, shows the loading slot). */
  loading?: boolean;
  loadingSlot?: ReactNode;
  /** Empty state config (or renderEmpty override). */
  emptyState?: Omit<ArchetypeEmptyStateProps, 'icon'> & { icon: LucideIcon };
  renderEmpty?: () => ReactNode;
  /** Footer slot (pagination, "load more", etc.). */
  renderFooter?: () => ReactNode;
  className?: string;
}

const SPACING: Record<NonNullable<ListArchetypeProps<unknown>['rowSpacing']>, string> = {
  2: 'space-y-2',
  3: 'space-y-3',
  4: 'space-y-4',
  6: 'space-y-6',
};

export default function ListArchetype<Row>({
  title,
  subtitle,
  overline,
  primaryAction,
  secondaryActions,
  tabs,
  activeTabKey,
  onTabChange,
  scrollableTabs,
  headerFilters,
  renderHeader,
  rows,
  groups,
  renderRow,
  keyExtractor,
  rowSpacing = 3,
  loading,
  loadingSlot,
  emptyState,
  renderEmpty,
  renderFooter,
  className = '',
}: ListArchetypeProps<Row>) {
  const isGrouped = !!groups;
  const totalItems = isGrouped
    ? groups!.reduce((sum, g) => sum + g.rows.length, 0)
    : rows?.length ?? 0;
  const isEmpty = !loading && totalItems === 0;

  return (
    <div className={className}>
      <ArchetypePageHeader
        overline={overline}
        title={title}
        subtitle={subtitle}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      >
        {headerFilters ?? null}
      </ArchetypePageHeader>

      {tabs && tabs.length > 0 && activeTabKey && onTabChange ? (
        <div className="-mt-2 mb-5">
          <TabStrip tabs={tabs} activeKey={activeTabKey} onChange={onTabChange} scrollable={scrollableTabs} />
        </div>
      ) : null}

      {renderHeader ? <div className="mb-5">{renderHeader()}</div> : null}

      {loading && totalItems === 0 ? (
        loadingSlot ?? <ListLoadingDefault />
      ) : isEmpty ? (
        renderEmpty ? (
          renderEmpty()
        ) : emptyState ? (
          <ArchetypeEmptyState {...emptyState} />
        ) : null
      ) : isGrouped ? (
        <div className="space-y-6">
          {groups!.map((group) => (
            <section key={group.key}>
              <div className="mb-3 flex items-baseline gap-2">
                <Overline>{group.label}</Overline>
                {group.count != null ? (
                  <span className="text-[11px] font-medium text-app-text-muted">({group.count})</span>
                ) : null}
              </div>
              {group.boxed ? (
                <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
                  {group.rows.map((row, i) => (
                    <div key={keyExtractor(row, i)}>{renderRow(row, i)}</div>
                  ))}
                </div>
              ) : (
                <div className={SPACING[rowSpacing]}>
                  {group.rows.map((row, i) => (
                    <div key={keyExtractor(row, i)}>{renderRow(row, i)}</div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className={SPACING[rowSpacing]}>
          {rows!.map((row, i) => (
            <div key={keyExtractor(row, i)}>{renderRow(row, i)}</div>
          ))}
        </div>
      )}

      {renderFooter ? <div className="mt-6">{renderFooter()}</div> : null}
    </div>
  );
}

function ListLoadingDefault() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-20 rounded-2xl border border-app-border bg-app-surface animate-pulse"
        />
      ))}
    </div>
  );
}
