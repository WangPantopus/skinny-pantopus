'use client';

import { MARKETPLACE_TABS, type MarketplaceTab } from './constants';

interface MarketplaceTabsProps {
  activeTab: MarketplaceTab;
  onTabChange: (tab: MarketplaceTab) => void;
}

export default function MarketplaceTabs({ activeTab, onTabChange }: MarketplaceTabsProps) {
  return (
    <div role="tablist" aria-label="Marketplace tabs" className="flex rounded-lg border border-app-border overflow-hidden bg-app-surface-raised">
      {MARKETPLACE_TABS.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeTab === tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition whitespace-nowrap ${
            activeTab === tab.key
              ? 'bg-app-surface text-app-text shadow-sm'
              : 'text-app-text-secondary hover:text-app-text-strong hover:bg-app-hover'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
