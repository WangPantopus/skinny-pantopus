// @ts-nocheck
'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import { ChevronLeft, Wallet, Package, Users, AlertCircle, Home, ClipboardList, AlertTriangle, Hammer, Clock, Building2 } from 'lucide-react';
import { confirmStore } from '@/components/ui/confirm-store';
import { toast } from '@/components/ui/toast-store';

import { ShareCenter } from '@/components/home/share';
import { MembersSecurityTab as MembersSecurityTabComponent } from '@/components/home/members';
import { HomeSettingsTab } from '@/components/home/settings';

import TaskSlidePanel from '@/components/home/TaskSlidePanel';
import { useHomeTaskActions } from '@/components/home/tasks/useHomeTaskActions';
import IssueSlidePanel from '@/components/home/IssueSlidePanel';
import BillSlidePanel from '@/components/home/BillSlidePanel';
import PackageSlidePanel from '@/components/home/PackageSlidePanel';

import InviteMemberModal from '@/components/home/InviteMemberModal';

import HomeHeader from '@/components/home/HomeHeader';
import TodayCard from '@/components/home/TodayCard';
import UnifiedFAB from '@/components/UnifiedFAB';
import { QuickCreateIcons } from '@/lib/icons';
import VerificationCenter from '@/components/home/VerificationCenter';
import VendorsTab from '@/components/home/VendorsTab';
import { HomePermissionsProvider, useHomePermissions } from '@/components/home/useHomePermissions';

import {
  PropertyDetailsCardPreview,
  TasksCard, TasksCardPreview,
  HomeHelpCard, HomeHelpCardPreview,
  BillsBudgetCard, BillsBudgetCardPreview,
  CalendarCard, CalendarCardPreview,
  DeliveriesCard, DeliveriesCardPreview,
  MaintenanceCard, MaintenanceCardPreview,
  DocsCard, DocsCardPreview,
  AccessCard, AccessCardPreview,
  EmergencyCard, EmergencyCardPreview,
  PetsCard, PetsCardPreview,
  PollsCard, PollsCardPreview,
} from '@/components/home/cards';

import { useHomeData, type UseHomeDataReturn } from '@/hooks/useHomeData';
import { homeAccessFingerprint } from '@/components/home/homeAccessFingerprint';
import { useHomePanels } from '@/hooks/useHomePanels';
import { useHomeIntelligence } from '@/hooks/useHomeIntelligence';

import HealthScoreRing from '@/components/home/HealthScoreRing';
import SeasonalChecklist from '@/components/home/SeasonalChecklist';
import PropertyValueCard from '@/components/home/PropertyValueCard';
import BillTrendChart from '@/components/home/BillTrendChart';
import HomeTimeline from '@/components/home/HomeTimeline';
import HomeSummaryBoundary from '@/components/home/HomeSummaryBoundary';

type HighLevelTab = 'dashboard' | 'share' | 'security' | 'settings';

/** Sidebar items (Overview, Tasks, Issues, etc.) map to dashboard or a specific card/header tab */
const SIDEBAR_CARD_TABS = ['tasks', 'issues', 'bills', 'packages', 'documents', 'vendors', 'emergency'] as const;
const SIDEBAR_TO_EXPANDED_CARD: Record<string, string> = {
  tasks: 'tasks',
  issues: 'maintenance',
  bills: 'bills',
  packages: 'deliveries',
  documents: 'documents',
  vendors: 'vendors',
  emergency: 'emergency',
};

export default function HomeDashboardPage() {
  const params = useParams();
  const homeId = params.id as string;

  return (
    <HomePermissionsProvider key={homeId} homeId={homeId}>
      <HomeDashboardContent />
    </HomePermissionsProvider>
  );
}

function HomeDashboardContent() {
  const router = useRouter();
  const homeId = useParams().id as string;
  const { access, error: permissionsError, needsVerification, loading: permissionsLoading, reload: reloadPermissions } = useHomePermissions();
  const data = useHomeData(homeId);
  const { loading, error } = data;
  const accessError = error || permissionsError || (!loading && !permissionsLoading &&
    (!access || (!access.hasAccess && !access.verification_required) || homeAccessFingerprint(access) !== data.accessFingerprint)
    ? 'Home access changed while loading. Reload to check current access.' : null);

  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
          <p className="mt-4 text-app-secondary">Loading home dashboard…</p>
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mb-3 flex justify-center"><AlertCircle className="w-10 h-10 text-red-500" /></div>
          <p role="alert" className="text-red-600 font-medium">{accessError}</p>
          <button onClick={() => void Promise.all([data.refresh(), reloadPermissions()])} className="mt-4 mr-3 rounded-lg border border-app-border px-4 py-2 text-sm">Reload current home access</button>
          <button
            onClick={() => router.push('/app')}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!permissionsLoading && needsVerification) {
    return <VerificationCenter homeId={homeId} onRefresh={async () => { await Promise.all([data.refresh(), reloadPermissions()]); }} />;
  }

  // Unmount private panels, deferred summaries and local edits whenever authority retires.
  return <HomeDashboardReady key={homeId} homeId={homeId} data={data} />;
}

function HomeDashboardReady({ homeId, data }: { homeId: string; data: UseHomeDataReturn }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    home, members, tasks, issues, bills, packages, documents, events,
    secrets, emergencies, nearbyGigs, homeGigs, pets, polls,
    currentUserId, taskSession, myAccess, can, refresh,
    setTasks, setIssues, setBills, setPackages, setSecrets,
  } = data;

  const { reload: reloadPermissions } = useHomePermissions();
  const reloadAccess = useCallback(() => { void Promise.all([refresh(), reloadPermissions()]); }, [refresh, reloadPermissions]);
  const intelligence = useHomeIntelligence(homeId, can, reloadAccess);
  const [selectedBillType, setSelectedBillType] = useState<string | null>(null);

  // Show toast when the season transitions
  useEffect(() => {
    if (intelligence.seasonTransition) {
      toast.info(`New season! Your ${intelligence.seasonTransition.toLabel} checklist is ready.`);
      intelligence.clearSeasonTransition();
    }
  }, [intelligence.seasonTransition, intelligence.clearSeasonTransition]);

  const {
    taskPanel, issuePanel, billPanel, packagePanel,
    inviteModal, expandedCard,
    openTaskPanel, closeTaskPanel,
    openIssuePanel, closeIssuePanel,
    openBillPanel, closeBillPanel,
    openPackagePanel, closePackagePanel,
    openInviteModal, closeInviteModal,
    setExpandedCard,
  } = useHomePanels();

  const tabFromUrl = searchParams.get('tab') || 'dashboard';
  const linkedType = searchParams.get('linkedType');
  const linkedId = searchParams.get('linkedId') || '';

  // Map sidebar tabs to content: members -> security; tasks/issues/bills/etc. -> dashboard (with card expanded)
  const effectiveTab: HighLevelTab =
    tabFromUrl === 'members'
      ? 'security'
      : SIDEBAR_CARD_TABS.includes(tabFromUrl as (typeof SIDEBAR_CARD_TABS)[number])
        ? 'dashboard'
        : (['dashboard', 'share', 'security', 'settings'].includes(tabFromUrl) ? tabFromUrl : 'dashboard') as HighLevelTab;
  const tab = effectiveTab;

  // When sidebar links to a card (e.g. ?tab=tasks), expand that card; when Overview, collapse
  useEffect(() => {
    if (effectiveTab === 'dashboard' && SIDEBAR_CARD_TABS.includes(tabFromUrl as (typeof SIDEBAR_CARD_TABS)[number])) {
      const card = SIDEBAR_TO_EXPANDED_CARD[tabFromUrl];
      if (card) setExpandedCard(card);
    } else if (tabFromUrl === 'dashboard' || tabFromUrl === 'overview' || !tabFromUrl) {
      setExpandedCard(null);
    }
  }, [effectiveTab, tabFromUrl, setExpandedCard]);

  // Deferred intelligence data: load below-the-fold components when dashboard tab is active
  useEffect(() => {
    if (tab === 'dashboard') {
      intelligence.ensurePropertyValue();
      intelligence.ensureBillTrends();
    }
  }, [tab, intelligence.ensurePropertyValue, intelligence.ensureBillTrends]);

  // Timeline loads separately (further below the fold)
  useEffect(() => {
    if (tab === 'dashboard') {
      intelligence.ensureTimeline();
    }
  }, [tab, intelligence.ensureTimeline]);

  const currentTaskAction = useHomeTaskActions(homeId, taskSession);
  const taskActionBusy = useRef(false);

  // ── Task handlers ──

  const handleTaskSaved = useCallback((saved: import('@/components/home/tasks/homeTaskModel').HomeTask) => {
    setTasks(previous => previous.some(task => task.id === saved.id)
      ? previous.map(task => task.id === saved.id ? { ...task, ...saved } : task) : [saved, ...previous]);
  }, [setTasks]);

  const handleTaskStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    if (taskActionBusy.current) return;
    taskActionBusy.current = true;
    try {
      const client = currentTaskAction(); const revision = client.revision;
      const saved = await client.edit(taskId, { status: newStatus });
      client.requireCurrent(revision);
      if (currentTaskAction() === client) handleTaskSaved(saved);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Task update was not confirmed. Reload before retrying.');
    } finally { taskActionBusy.current = false; }
  }, [currentTaskAction, handleTaskSaved]);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    if (taskActionBusy.current) return;
    taskActionBusy.current = true;
    try {
      const client = currentTaskAction(); const revision = client.revision;
      const yes = await confirmStore.open({ title: 'Delete this task?', confirmLabel: 'Delete', variant: 'destructive' });
      if (!yes) return;
      client.requireCurrent(revision);
      if (currentTaskAction() !== client) return;
      await client.delete(taskId);
      client.requireCurrent(revision);
      if (currentTaskAction() === client) setTasks(previous => previous.filter(task => task.id !== taskId));
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Task deletion was not confirmed. Reload before retrying.');
    } finally { taskActionBusy.current = false; }
  }, [currentTaskAction, setTasks]);

  // ── Member / Invite handler ──

  const handleInvite = useCallback(
    async (data: { email?: string; user_id?: string; username?: string; relationship: string; preset_key?: string; message?: string; start_at?: string; end_at?: string }) => {
      const result = await api.homes.inviteToHome(homeId, data);
      await refresh();
      return result;
    },
    [homeId, refresh]
  );

  // ── Issue handler ──

  const handleIssueSave = useCallback(
    async (data: Record<string, any>) => {
      const mediaFiles: File[] | undefined = data._mediaFiles;
      delete data._mediaFiles;

      if (issuePanel.issue) {
        const result = await api.homeProfile.updateHomeIssue(homeId, issuePanel.issue.id, data);
        setIssues((prev) => prev.map((i) => (i.id === issuePanel.issue.id ? { ...i, ...result.issue } : i)));
      } else {
        const result = await api.homeProfile.createHomeIssue(homeId, data);
        setIssues((prev) => [result.issue, ...prev]);
      }

      void mediaFiles;
    },
    [homeId, issuePanel.issue, setIssues]
  );

  // ── Bill handlers ──

  const handleBillSave = useCallback(
    async (data: Record<string, any>) => {
      const mediaFiles: File[] | undefined = data._mediaFiles;
      delete data._mediaFiles;

      if (billPanel.bill) {
        const result = await api.homeProfile.updateHomeBill(homeId, billPanel.bill.id, data);
        setBills((prev) => prev.map((b) => (b.id === billPanel.bill.id ? { ...b, ...result.bill } : b)));
      } else {
        const result = await api.homeProfile.createHomeBill(homeId, data);
        setBills((prev) => [result.bill, ...prev]);
      }

      void mediaFiles;
    },
    [homeId, billPanel.bill, setBills]
  );

  const handleBillMarkPaid = useCallback(
    async (billId: string) => {
      try {
        const result = await api.homeProfile.updateHomeBill(homeId, billId, {
          status: 'paid',
          paid_at: new Date().toISOString(),
        });
        setBills((prev) => prev.map((b) => (b.id === billId ? { ...b, ...result.bill, status: 'paid' } : b)));
      } catch (err) {
        console.error('Failed to mark bill as paid:', err);
      }
    },
    [homeId, setBills]
  );

  // ── Package handlers ──

  const handlePackageSave = useCallback(
    async (data: Record<string, any>) => {
      const mediaFiles: File[] | undefined = data._mediaFiles;
      delete data._mediaFiles;

      if (packagePanel.pkg) {
        const result = await api.homeProfile.updateHomePackage(homeId, packagePanel.pkg.id, data);
        setPackages((prev) =>
          prev.map((p) => (p.id === packagePanel.pkg.id ? { ...p, ...result.package } : p))
        );
      } else {
        const result = await api.homeProfile.createHomePackage(homeId, data);
        setPackages((prev) => [result.package, ...prev]);
      }

      void mediaFiles;
    },
    [homeId, packagePanel.pkg, setPackages]
  );

  const handlePackageMarkPickedUp = useCallback(
    async (pkgId: string) => {
      try {
        const result = await api.homeProfile.updateHomePackage(homeId, pkgId, { status: 'picked_up' });
        setPackages((prev) =>
          prev.map((p) => (p.id === pkgId ? { ...p, ...result.package, status: 'picked_up' } : p))
        );
      } catch (err) {
        console.error('Failed to mark package as picked up:', err);
      }
    },
    [homeId, setPackages]
  );

  // ── Stat helpers ──

  const activeTasks = data.summaryCounts?.tasks_open ?? 0;
  const openIssues = data.summaryCounts?.issues_open ?? 0;
  const billsDueCount = data.summaryCounts?.bills_due ?? 0;
  const pendingPkgs = data.summaryCounts?.packages_expected ?? 0;

  // ── Tab navigation ──

  const setHighLevelTab = (t: string) => {
    if (t === 'dashboard') {
      router.push(`/app/homes/${homeId}/dashboard`);
    } else {
      router.push(`/app/homes/${homeId}/dashboard?tab=${t}`);
    }
    setExpandedCard(null);
  };


  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-32 md:pr-24">
      {/* Slide-over Panels */}
      <TaskSlidePanel
        open={taskPanel.open}
        onClose={closeTaskPanel}
        onSaved={handleTaskSaved}
        openingScope={taskSession}
        task={taskPanel.task}
        members={members}
        homeId={homeId}
      />
      <IssueSlidePanel
        open={issuePanel.open}
        onClose={closeIssuePanel}
        onSave={handleIssueSave}
        issue={issuePanel.issue}
      />
      <BillSlidePanel
        open={billPanel.open}
        onClose={closeBillPanel}
        onSave={handleBillSave}
        bill={billPanel.bill}
      />
      <PackageSlidePanel
        open={packagePanel.open}
        onClose={closePackagePanel}
        onSave={handlePackageSave}
        pkg={packagePanel.pkg}
      />

      {/* Modals */}
      <InviteMemberModal
        open={inviteModal}
        onClose={closeInviteModal}
        onInvite={handleInvite}
        homeId={homeId}
      />

      {/* Header with High-Level Tabs */}
      <HomeHeader
        homeName={home?.name || home?.address || home?.address_line1 || 'Home Dashboard'}
        homeAddress={home?.name ? (home.address || home.address_line1) : undefined}
        roleBadge={myAccess.role_base}
        isOwner={myAccess.isOwner}
        homeId={homeId}
        activeTab={tab}
        onTabChange={setHighLevelTab}
      />

      {/* Tab Content */}
      {tab === 'dashboard' && (
        <DashboardTab
          home={home}
          homeId={homeId}
          activeTasks={activeTasks}
          openIssues={openIssues}
          billsDueCount={billsDueCount}
          pendingPkgs={pendingPkgs}
          tasks={tasks}
          issues={issues}
          bills={bills}
          packages={packages}
          documents={documents}
          events={events}
          nearbyGigs={nearbyGigs}
          homeGigs={homeGigs}
          members={members}
          secrets={secrets}
          emergencies={emergencies}
          can={can}
          expandedCard={expandedCard}
          onExpandCard={setExpandedCard}
          onAddTask={() => openTaskPanel()}
          onTaskClick={(task: Record<string, any>) => openTaskPanel(task)}
          onTaskStatusChange={handleTaskStatusChange}
          onTaskDelete={handleTaskDelete}
          onAddIssue={() => openIssuePanel()}
          onViewIssue={(issue: Record<string, any>) => openIssuePanel(issue)}
          onAddBill={() => openBillPanel()}
          onMarkBillPaid={handleBillMarkPaid}
          onAddPackage={() => openPackagePanel()}
          onMarkPackagePickedUp={handlePackageMarkPickedUp}
          onInviteMember={openInviteModal}
          onSecretsChange={(s: Record<string, any>[]) => setSecrets(() => s)}
          pets={pets}
          polls={polls}
          linkedType={linkedType}
          linkedId={linkedId}
          intelligence={intelligence}
          selectedBillType={selectedBillType}
          onBillTypeChange={setSelectedBillType}
          entityErrors={data.entityErrors}
          onReloadData={() => void refresh()}
        />
      )}

      {tab === 'share' && (
        <ShareCenter
          homeId={homeId}
          home={home}
          secrets={secrets}
          emergencies={emergencies}
          can={can}
          onSecretsChange={(s: Record<string, any>[]) => setSecrets(() => s)}
        />
      )}

      {tab === 'security' && (
        <MembersSecurityTabComponent
          homeId={homeId}
          home={home}
          members={members}
          can={can}
          currentUserId={currentUserId}
          onInvite={handleInvite}
          onMembersChange={refresh}
        />
      )}

      {tab === 'settings' && (
        <HomeSettingsTab
          homeId={homeId}
          home={home}
          members={members}
          can={can}
          currentUserId={currentUserId}
          onHomeUpdate={refresh}
        />
      )}

      {/* Unified FAB with home-specific actions */}
      {tab === 'dashboard' && (
        <UnifiedFAB
          contextActions={[
            ...(can('tasks.edit') || can('tasks.manage') ? [{ key: 'add-task', icon: QuickCreateIcons.task, label: 'Add Task', iconColor: 'text-emerald-600', onAction: () => openTaskPanel() }] : []),
            ...(can('maintenance.edit') || can('maintenance.manage') ? [{ key: 'report-issue', icon: QuickCreateIcons.issue, label: 'Report Issue', iconColor: 'text-amber-600', onAction: () => openIssuePanel() }] : []),
            ...(can('finance.manage') ? [{ key: 'track-bill', icon: QuickCreateIcons.bill, label: 'Track Bill', iconColor: 'text-red-600', onAction: () => openBillPanel() }] : []),
            ...(can('packages.edit') || can('packages.manage') ? [{ key: 'track-package', icon: QuickCreateIcons.package, label: 'Track Package', iconColor: 'text-violet-600', onAction: () => openPackagePanel() }] : []),
            ...(can('members.manage') ? [{ key: 'invite-member', icon: QuickCreateIcons.member, label: 'Invite Member', iconColor: 'text-orange-600', onAction: openInviteModal }] : []),
            { key: 'post-home-task', icon: QuickCreateIcons.gig, label: 'Post Home Task', iconColor: 'text-primary-600', onAction: () => router.push(`/app/gigs/new?home_id=${homeId}`) },
          ]}
        />
      )}
    </div>
  );
}

// ── Dashboard Tab — Card-based "Household Control Center" ──

function DashboardTab({
  home,
  homeId,
  activeTasks,
  openIssues,
  billsDueCount,
  pendingPkgs,
  tasks,
  issues,
  bills,
  packages,
  documents,
  events,
  nearbyGigs,
  homeGigs,
  members,
  secrets,
  emergencies,
  can,
  expandedCard,
  onExpandCard,
  onAddTask,
  onTaskClick,
  onTaskStatusChange,
  onTaskDelete,
  onAddIssue,
  onViewIssue,
  onAddBill,
  onMarkBillPaid,
  onAddPackage,
  onMarkPackagePickedUp,
  onInviteMember,
  onSecretsChange,
  pets,
  polls,
  linkedType,
  linkedId,
  intelligence,
  selectedBillType,
  onBillTypeChange,
  entityErrors,
  onReloadData,
}: {
  home: Record<string, any>;
  homeId: string;
  activeTasks: number;
  openIssues: number;
  billsDueCount: number;
  pendingPkgs: number;
  tasks: Record<string, any>[];
  issues: Record<string, any>[];
  bills: Record<string, any>[];
  packages: Record<string, any>[];
  documents: Record<string, any>[];
  events: Record<string, any>[];
  nearbyGigs: Record<string, any>[];
  homeGigs: Record<string, any>[];
  members: Record<string, any>[];
  secrets: Record<string, any>[];
  emergencies: Record<string, any>[];
  can: (perm: string) => boolean;
  expandedCard: string | null;
  onExpandCard: (card: string | null) => void;
  onAddTask: () => void;
  onTaskClick: (task: Record<string, any>) => void;
  onTaskStatusChange: (taskId: string, newStatus: string) => void;
  onTaskDelete: (taskId: string) => void;
  onAddIssue: () => void;
  onViewIssue: (issue: Record<string, any>) => void;
  onAddBill: () => void;
  onMarkBillPaid: (billId: string) => void;
  onAddPackage: () => void;
  onMarkPackagePickedUp: (pkgId: string) => void;
  onInviteMember: () => void;
  onSecretsChange: (s: Record<string, any>[]) => void;
  pets: Record<string, any>[];
  polls: Record<string, any>[];
  linkedType: string | null;
  linkedId: string;
  intelligence: ReturnType<typeof useHomeIntelligence>;
  selectedBillType: string | null;
  onBillTypeChange: (type: string) => void;
  entityErrors: UseHomeDataReturn['entityErrors'];
  onReloadData: () => void;
}) {
  const router = useRouter();
  const onBack = () => onExpandCard(null);

  const cardPermissions: Record<string, string> = {
    tasks: 'tasks.view', bills: 'finance.view', calendar: 'calendar.view', deliveries: 'packages.view',
    maintenance: 'maintenance.view', documents: 'docs.view', emergency: 'sensitive.view',
  };
  const cardEntities: Record<string, keyof UseHomeDataReturn['entityErrors']> = {
    homehelp: 'homeGigs', access: 'secrets', emergency: 'emergencies', pets: 'pets', polls: 'polls',
  };
  if (expandedCard && ((cardPermissions[expandedCard] && !can(cardPermissions[expandedCard]))
    || (expandedCard === 'access' && !can('access.view_wifi') && !can('access.view_codes')))) {
    return <div role="status"><p>This Home section is not available with your current access.</p><button onClick={onBack} className="mt-3 rounded-lg border px-3 py-2">Back to overview</button></div>;
  }
  const expandedError = expandedCard === 'homehelp' ? entityErrors.homeGigs || entityErrors.nearbyGigs
    : expandedCard ? entityErrors[cardEntities[expandedCard]] : undefined;
  if (expandedCard && expandedError) return <div><button onClick={onBack} className="mb-3 rounded-lg border px-3 py-2">Back to overview</button><HomeSummaryBoundary title="Home records" error={expandedError} loading={false} onRetry={onReloadData}>{null}</HomeSummaryBoundary></div>;

  // If a card is expanded, show its full-view detail component
  if (expandedCard) {
    return (
      <div>
        {expandedCard === 'tasks' && (
          <TasksCard
            tasks={tasks}
            members={members}
            homeId={homeId}
            onAddTask={onAddTask}
            onTaskClick={onTaskClick}
            onTaskStatusChange={onTaskStatusChange}
            onTaskDelete={onTaskDelete}
            onBack={onBack}
          />
        )}
        {expandedCard === 'homehelp' && (
          <HomeHelpCard
            homeGigs={homeGigs}
            nearbyGigs={nearbyGigs}
            homeId={homeId}
            tasks={tasks}
            onBack={onBack}
          />
        )}
        {expandedCard === 'bills' && (
          <BillsBudgetCard
            bills={bills}
            homeId={homeId}
            members={members}
            onAddBill={onAddBill}
            onMarkBillPaid={onMarkBillPaid}
            onBack={onBack}
            canManage={can('finance.manage')}
            highlightBillId={linkedType === 'bill' ? linkedId : undefined}
          />
        )}
        {expandedCard === 'calendar' && (
          <CalendarCard
            tasks={can('tasks.view') ? tasks : []}
            bills={can('finance.view') ? bills : []}
            events={events}
            packages={can('packages.view') ? packages : []}
            onBack={onBack}
          />
        )}
        {expandedCard === 'deliveries' && (
          <DeliveriesCard
            packages={packages}
            homeId={homeId}
            onAddPackage={onAddPackage}
            onMarkPickedUp={onMarkPackagePickedUp}
            onPackageClick={() => {}}
            onBack={onBack}
            highlightPackageId={linkedType === 'package' ? linkedId : undefined}
          />
        )}
        {expandedCard === 'maintenance' && (
          <MaintenanceCard
            issues={issues}
            homeId={homeId}
            home={home}
            onAddIssue={onAddIssue}
            onViewIssue={onViewIssue}
            onBack={onBack}
            canManage={can('maintenance.edit') || can('maintenance.manage')}
          />
        )}
        {expandedCard === 'documents' && (
          <DocsCard
            documents={documents}
            homeId={homeId}
            onBack={onBack}
            highlightDocumentId={linkedType === 'document' ? linkedId : undefined}
          />
        )}
        {expandedCard === 'access' && (
          <AccessCard
            secrets={secrets}
            homeId={homeId}
            can={can}
            onSecretsChange={onSecretsChange}
            onBack={onBack}
          />
        )}
        {expandedCard === 'emergency' && (
          <EmergencyCard
            emergencies={emergencies}
            home={home}
            homeId={homeId}
            onBack={onBack}
          />
        )}
        {expandedCard === 'pets' && (
          <PetsCard homeId={homeId} onBack={onBack} />
        )}
        {expandedCard === 'polls' && (
          <PollsCard homeId={homeId} onBack={onBack} />
        )}
        {expandedCard === 'vendors' && (
          <div className="space-y-4">
            <button onClick={onBack} className="text-sm text-app-secondary hover:text-app-strong transition flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
            <VendorsTab homeId={homeId} />
          </div>
        )}
      </div>
    );
  }

  // Empty state
  const isEmpty = tasks.length === 0 && issues.length === 0 && bills.length === 0 &&
    packages.length === 0 && documents.length === 0 && homeGigs.length === 0 &&
    events.length === 0 && pets.length === 0 && polls.length === 0 && Object.keys(entityErrors).length === 0;

  return (
    <div className="space-y-4">
      {/* Today Card — at-a-glance summary */}
      <TodayCard
        activeTasks={activeTasks}
        openIssues={openIssues}
        billsDueCount={billsDueCount}
        pendingPkgs={pendingPkgs}
        memberCount={can('members.view') ? members.length : null}
        events={events}
        onNavigateTab={(t) => onExpandCard(t)}
      />

      {/* Home summaries keep unavailable reads separate from valid empty data. */}
      <div className={`grid grid-cols-1 ${intelligence.canReadHealth ? 'md:grid-cols-2' : ''} gap-4`}>
        {intelligence.canReadHealth && <HomeSummaryBoundary title="Home health" error={intelligence.errors.health} loading={intelligence.healthLoading} onRetry={() => void intelligence.reloadSummary('health')}>
          <div className="flex flex-col items-center">
            <HealthScoreRing score={intelligence.healthScore?.score ?? 0} topIssue={intelligence.healthScore?.topIssue ?? null}
              topAction={intelligence.healthScore?.topAction ?? null} loading={intelligence.healthLoading}
              isNewHome={false} homeId={homeId}
              onActionPress={(route) => {
                const prefix = `/homes/${homeId}/`;
                const target = route.startsWith(prefix) ? route.slice(prefix.length) : '';
                const tab = ({ maintenance: 'issues', bills: 'bills', emergency: 'emergency', members: 'members', documents: 'documents', dashboard: 'dashboard' } as Record<string, string>)[target];
                if (tab) router.push(`/app/homes/${homeId}/dashboard?tab=${tab}`);
              }} />
          </div>
        </HomeSummaryBoundary>}
        <HomeSummaryBoundary title="Seasonal checklist" error={intelligence.errors.checklist} loading={intelligence.checklistLoading} onRetry={() => void intelligence.reloadSummary('checklist')}>
          <SeasonalChecklist checklist={intelligence.checklist} loading={intelligence.checklistLoading}
            canEdit={can('home.edit')} busy={intelligence.checklistBusy}
            onComplete={(itemId) => void intelligence.completeChecklistItem(itemId)}
            onSkip={(itemId) => void intelligence.skipChecklistItem(itemId)}
            onHireHelp={(item) => router.push(`/app/gigs/new?initialText=${encodeURIComponent(item.gig_title_suggestion || item.title)}`)}
            onGenerate={() => void intelligence.generateChecklist()} />
        </HomeSummaryBoundary>
      </div>
      <div className={`grid grid-cols-1 ${intelligence.canReadBills ? 'md:grid-cols-2' : ''} gap-4`}>
        <HomeSummaryBoundary title="Property information" error={intelligence.errors.property} loading={intelligence.propertyValueLoading} onRetry={() => void intelligence.reloadSummary('property')}>
          <PropertyValueCard data={intelligence.propertyValue} loading={intelligence.propertyValueLoading} />
        </HomeSummaryBoundary>
        {intelligence.canReadBills && <HomeSummaryBoundary title="Bill trends" error={intelligence.errors.bills} loading={intelligence.billTrendsLoading} onRetry={() => void intelligence.reloadSummary('bills')}>
          <BillTrendChart data={intelligence.billTrends} selectedType={selectedBillType} onTypeChange={onBillTypeChange}
            loading={intelligence.billTrendsLoading} onAddBill={can('finance.manage') ? onAddBill : undefined}
            savingPreference={intelligence.benchmarkBusy} onCurrencyChange={intelligence.setBillCurrency} onOptInChange={can('home.edit') ? (optedIn) => void intelligence.setBillBenchmarkOptIn(optedIn) : undefined} />
        </HomeSummaryBoundary>}
      </div>
      {intelligence.canReadTimeline && <HomeSummaryBoundary title="Home activity" error={intelligence.errors.timeline} loading={intelligence.timelineLoading} onRetry={() => void intelligence.reloadSummary('timeline')}>
        <HomeTimeline items={intelligence.timeline} loading={intelligence.timelineLoading}
          hasMore={intelligence.timelineHasMore} onLoadMore={() => void intelligence.loadMoreTimeline()} />
      </HomeSummaryBoundary>}

      {/* Card grid */}
      {!isEmpty ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PropertyDetailsCardPreview
            home={home}
            onOpen={() => router.push(`/app/homes/${homeId}/property-details`)}
          />

          {can('tasks.view') && (
            <TasksCardPreview tasks={tasks} members={members} activeTasks={activeTasks} onExpand={() => onExpandCard('tasks')} />
          )}

          {(homeGigs.length > 0 || nearbyGigs.length > 0 || entityErrors.homeGigs || entityErrors.nearbyGigs) && (
            <HomeSummaryBoundary title="Home help" error={entityErrors.homeGigs || entityErrors.nearbyGigs || null} loading={false} onRetry={onReloadData}><HomeHelpCardPreview homeGigs={homeGigs} nearbyGigs={nearbyGigs} onExpand={() => onExpandCard('homehelp')} /></HomeSummaryBoundary>
          )}

          {can('finance.view') && (
            <BillsBudgetCardPreview bills={bills} billsDueCount={billsDueCount} onExpand={() => onExpandCard('bills')} />
          )}

          {can('calendar.view') && <CalendarCardPreview events={events} onExpand={() => onExpandCard('calendar')} />}

          {can('packages.view') && (
            <DeliveriesCardPreview packages={packages} pendingPkgs={pendingPkgs} onExpand={() => onExpandCard('deliveries')} />
          )}

          {can('maintenance.view') && (
            <MaintenanceCardPreview issues={issues} onExpand={() => onExpandCard('maintenance')} />
          )}

          {can('docs.view') && (
            <DocsCardPreview documents={documents} onExpand={() => onExpandCard('documents')} />
          )}

          {(can('access.view_wifi') || can('access.view_codes')) && (
            <HomeSummaryBoundary title="Access information" error={entityErrors.secrets || null} loading={false} onRetry={onReloadData}><AccessCardPreview secrets={secrets} onExpand={() => onExpandCard('access')} /></HomeSummaryBoundary>
          )}

          {can('sensitive.view') && <HomeSummaryBoundary title="Emergency information" error={entityErrors.emergencies || null} loading={false} onRetry={onReloadData}><EmergencyCardPreview emergencies={emergencies} onExpand={() => onExpandCard('emergency')} /></HomeSummaryBoundary>}

          <HomeSummaryBoundary title="Pets" error={entityErrors.pets || null} loading={false} onRetry={onReloadData}><PetsCardPreview pets={pets} onExpand={() => onExpandCard('pets')} /></HomeSummaryBoundary>

          <HomeSummaryBoundary title="Polls" error={entityErrors.polls || null} loading={false} onRetry={onReloadData}><PollsCardPreview polls={polls} onExpand={() => onExpandCard('polls')} /></HomeSummaryBoundary>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-app p-8 text-center">
          <div className="mb-3 flex justify-center"><Home className="w-12 h-12 text-app-muted" /></div>
          <div className="text-lg font-semibold text-app mb-1">Welcome to your home dashboard!</div>
          <p className="text-sm text-app-secondary max-w-sm mx-auto">
            Your household’s shared details and activity appear here.
          </p>
          <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
            <ActionPill icon={<Building2 className="w-4 h-4" />} label="Property Details" onClick={() => router.push(`/app/homes/${homeId}/property-details`)} />
            {(can('tasks.edit') || can('tasks.manage')) && <ActionPill icon={<ClipboardList className="w-4 h-4" />} label="Add Task" onClick={onAddTask} />}
            {(can('maintenance.edit') || can('maintenance.manage')) && <ActionPill icon={<AlertTriangle className="w-4 h-4" />} label="Report Issue" onClick={onAddIssue} />}
            {(can('finance.manage')) && <ActionPill icon={<Wallet className="w-4 h-4" />} label="Track Bill" onClick={onAddBill} />}
            {(can('packages.edit') || can('packages.manage')) && <ActionPill icon={<Package className="w-4 h-4" />} label="Track Package" onClick={onAddPackage} />}
            {(can('members.manage')) && <ActionPill icon={<Users className="w-4 h-4" />} label="Invite Member" onClick={onInviteMember} />}
            <ActionPill icon={<Hammer className="w-4 h-4" />} label="Post Home Gig" onClick={() => router.push(`/app/gigs/new?home_id=${homeId}`)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ActionPill({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 bg-surface-muted hover:bg-surface-muted rounded-full text-sm font-medium text-app-strong transition"
    >
      <span className="flex items-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
