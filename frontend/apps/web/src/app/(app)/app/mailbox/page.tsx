'use client';

import { Suspense, useState } from 'react';
import { Mailbox, MailOpen } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SearchInput from '@/components/SearchInput';
import useMailboxData from './_components/useMailboxData';
import MailListItem from './_components/MailListItem';
import MailDetail from './_components/MailDetail';
import ComposeMailModal from './_components/ComposeMailModal';
import { MAIL_TYPES } from './_components/mailbox-constants';

function MailboxPageContent() {
  const data = useMailboxData();
  const [composeOpen, setComposeOpen] = useState(false);

  const {
    isDev, summary, loading, mailScope, setMailScope, scopeHomeId, setScopeHomeId,
    availableHomes, scopeError, typeFilter, setTypeFilter, viewFilter, setViewFilter,
    search, setSearch, selectedMail, setSelectedMail, detailBodyRef,
    currentUserId, seedLoading, actionError, setActionError, actionSuccess, setActionSuccess,
    loadMail, handleMailClick, handleStar, handleArchive, handleDelete, handleCloseDetail,
    handleDetailScroll, handleSeedInbox, getSenderName, getDisplayTitle, getPreviewText,
    getDeliverableMeta, getPrimaryActionLabel, filteredMail, selectedHomeLabel, detailQuery,
  } = data;

  const mailboxTitle = mailScope === 'personal'
    ? <><Mailbox className="w-5 h-5 inline" /> Personal Mailbox</>
    : mailScope === 'home'
      ? <><MailOpen className="w-5 h-5 inline" /> Home Mailbox</>
      : <><Mailbox className="w-5 h-5 inline" /> Unified Mailbox</>;
  const mailboxSubtitle = mailScope === 'personal'
    ? 'Your personal mail and documents'
    : mailScope === 'home'
      ? 'Household mail addressed to this home'
      : 'Everything you can access across personal and homes';

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <PageHeader title={mailboxTitle} subtitle={mailboxSubtitle}>
        <div className="flex items-center gap-3 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Search mail…" className="max-w-xs" />
          <button
            onClick={() => setComposeOpen(true)}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-black transition"
          >
            Compose
          </button>
          {isDev && (
            <button
              onClick={handleSeedInbox}
              disabled={seedLoading}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-app-border bg-app-surface text-app-text-strong hover:bg-app-hover transition disabled:opacity-50"
            >
              {seedLoading ? 'Seeding…' : 'Seed Inbox'}
            </button>
          )}
          {summary && summary.total_earned > 0 && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 text-right ml-auto">
              <div className="text-xs text-teal-600 font-medium">Ad Earnings</div>
              <div className="text-lg font-bold text-teal-700">${summary.total_earned.toFixed(2)}</div>
            </div>
          )}
        </div>
        {(actionError || actionSuccess) && (
          <div className={`mt-3 text-sm px-3 py-2 rounded-lg border ${
            actionError ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
          }`}>
            {actionError || actionSuccess}
          </div>
        )}
      </PageHeader>

      {scopeError && (
        <div className="mb-4 text-sm px-3 py-2 rounded-lg border bg-red-50 text-red-700 border-red-200">{scopeError}</div>
      )}

      {/* Scope selector */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-app-text-secondary">Scope:</span>
        {(['personal', 'home', 'all'] as const).map((scope) => (
          <button
            key={scope}
            onClick={() => { setMailScope(scope); setSelectedMail(null); }}
            className={`inline-flex items-center px-2.5 py-1 text-xs rounded-full transition ${
              mailScope === scope ? 'bg-gray-900 text-white' : 'bg-app-surface-sunken text-app-text-strong hover:bg-app-hover'
            }`}
          >
            {scope === 'personal' ? 'Personal' : scope === 'home' ? (mailScope === 'home' ? `Home: ${selectedHomeLabel}` : 'Home') : 'All'}
          </button>
        ))}
        {mailScope !== 'home' && availableHomes.length > 0 && (
          <select
            value=""
            onChange={(e) => { if (!e.target.value) return; setMailScope('home'); setScopeHomeId(e.target.value); setSelectedMail(null); }}
            className="border border-app-border rounded-lg px-2.5 py-1.5 text-xs bg-app-surface"
          >
            <option value="">Jump to home mailbox…</option>
            {availableHomes.map((home) => <option key={home.id} value={home.id}>{home.label}</option>)}
          </select>
        )}
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-4 mb-4 border-b border-app-border pb-3">
        {[
          { key: 'inbox', label: 'Inbox', count: summary?.unread_count },
          { key: 'starred', label: 'Starred', count: summary?.starred_count },
          { key: 'archived', label: 'Archived', count: 0 },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => { setViewFilter(v.key as typeof viewFilter); setSelectedMail(null); }}
            className={`text-sm font-medium pb-1 border-b-2 transition ${
              viewFilter === v.key ? 'border-gray-900 text-app-text' : 'border-transparent text-app-text-secondary hover:text-app-text-strong'
            }`}
          >
            {v.label}
            {v.count ? (
              <span className="ml-1 text-[10px] bg-app-surface-sunken text-app-text-strong px-1.5 py-0.5 rounded-full font-bold">{v.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Type filter chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition ${
            typeFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
          }`}
        >
          All
        </button>
        {Object.entries(MAIL_TYPES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition flex items-center gap-1 ${
              typeFilter === key ? 'bg-gray-900 text-white' : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
            }`}
          >
            <span className="text-sm">{val.icon}</span> {val.label}
          </button>
        ))}
      </div>

      {/* Content — split view */}
      <div className="flex gap-4 min-h-[500px]">
        {/* Mail list */}
        <div className={`${selectedMail ? 'hidden sm:block sm:w-2/5' : 'w-full'} space-y-1`}>
          {loading ? (
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-app-border border-t-gray-600 mx-auto" />
              <p className="text-sm text-app-text-secondary mt-3">Loading mail...</p>
            </div>
          ) : filteredMail.length === 0 ? (
            <div className="py-16 text-center bg-app-surface rounded-xl border border-app-border">
              <div className="mb-3 flex justify-center"><Mailbox className="w-12 h-12 text-app-text-muted" /></div>
              <h3 className="text-lg font-semibold text-app-text mb-1">Mailbox is empty</h3>
              <p className="text-sm text-app-text-secondary">
                {viewFilter === 'inbox' ? "No mail yet. When you receive letters, bills, or packages they'll appear here."
                  : viewFilter === 'starred' ? 'No starred mail.' : 'No archived mail.'}
              </p>
            </div>
          ) : (
            filteredMail.map(item => (
              <MailListItem
                key={item.id}
                item={item}
                isSelected={selectedMail?.id === item.id}
                detailQuery={detailQuery}
                onClick={handleMailClick}
                onStar={handleStar}
                getSenderName={getSenderName}
                getDisplayTitle={getDisplayTitle}
                getPreviewText={getPreviewText}
                getDeliverableMeta={getDeliverableMeta}
                getPrimaryActionLabel={getPrimaryActionLabel}
              />
            ))
          )}
        </div>

        {/* Detail view */}
        {selectedMail && (
          <MailDetail
            mail={selectedMail}
            detailBodyRef={detailBodyRef}
            onClose={handleCloseDetail}
            onStar={handleStar}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onScroll={handleDetailScroll}
            getSenderName={getSenderName}
            getDisplayTitle={getDisplayTitle}
          />
        )}
      </div>

      {/* Compose modal */}
      {composeOpen && (
        <ComposeMailModal
          currentUserId={currentUserId}
          availableHomes={availableHomes}
          scopeHomeId={scopeHomeId}
          onClose={() => setComposeOpen(false)}
          onSent={loadMail}
          setActionError={setActionError}
          setActionSuccess={setActionSuccess}
        />
      )}
    </div>
  );
}

export default function MailboxPage() {
  return (
    <Suspense>
      <MailboxPageContent />
    </Suspense>
  );
}
