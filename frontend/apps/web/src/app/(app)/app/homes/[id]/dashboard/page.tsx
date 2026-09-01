// @ts-nocheck
'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import { ChevronLeft, Wallet, Package, Users, AlertCircle, Home, ClipboardList, AlertTriangle, Hammer, Clock, Building2 } from 'lucide-react';
import { confirmStore } from '@/components/ui/confirm-store';
import { toast } from '@/components/ui/toast-store';

import { ShareCenter } from '@/components/home/share';
import { MembersSecurityTab as MembersSecurityTabComponent } from '@/components/home/members';
import { HomeSettingsTab } from '@/components/home/settings';

import TaskSlidePanel from '@/components/home/TaskSlidePanel';
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

import { useHomeData } from '@/hooks/useHomeData';
import { useHomePanels } from '@/hooks/useHomePanels';
import { useHomeIntelligence } from '@/hooks/useHomeIntelligence';

import HealthScoreRing from '@/components/home/HealthScoreRing';
import SeasonalChecklist from '@/components/home/SeasonalChecklist';
import PropertyValueCard from '@/components/home/PropertyValueCard';
import BillTrendChart from '@/components/home/BillTrendChart';
import HomeTimeline from '@/components/home/HomeTimeline';

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
    <HomePermissionsProvider homeId={homeId}>
      <HomeDashboardContent />
    </HomePermissionsProvider>
  );
}

function HomeDashboardContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const homeId = params.id as string;

  const { needsVerification, loading: permissionsLoading } = useHomePermissions();

  const {
    home, members, tasks, issues, bills, packages, documents, events,
    secrets, emergencies, nearbyGigs, homeGigs, pets, polls,
    loading, error, currentUserId, myAccess, can, refresh,
    setTasks, setIssues, setBills, setPackages, setMembers, setSecrets,
  } = useHomeData(homeId);

  const intelligence = useHomeIntelligence(homeId);
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

  // ── Task handlers ──

  const handleTaskSave = useCallback(
    async (data: Record<string, any>) => {
      const mediaFiles: File[] | undefined = data._mediaFiles;
      delete data._mediaFiles;

      if (taskPanel.task) {
        const result = await api.homeProfile.updateHomeTask(homeId, taskPanel.task.id, data);
        setTasks((prev) => prev.map((t) => (t.id === taskPanel.task.id ? { ...t, ...result.task } : t)));

        if (mediaFiles && mediaFiles.length > 0) {
          try {
            await api.upload.uploadHomeTaskMedia(homeId, taskPanel.task.id, mediaFiles);
          } catch (err) {
            console.error('Media upload failed:', err);
          }
        }
      } else {
        const result = await api.homeProfile.createHomeTask(homeId, data);
        setTasks((prev) => [result.task, ...prev]);

        if (mediaFiles && mediaFiles.length > 0 && result.task?.id) {
          try {
            await api.upload.uploadHomeTaskMedia(homeId, result.task.id, mediaFiles);
          } catch (err) {
            console.error('Media upload failed:', err);
          }
        }
      }
    },
    [homeId, taskPanel.task, setTasks]
  );

  const handleTaskStatusChange = useCallback(
    async (taskId: string, newStatus: string) => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
      try {
        await api.homeProfile.updateHomeTask(homeId, taskId, { status: newStatus });
      } catch (err: unknown) {
        console.error('Failed to update task status:', err);
        refresh();
      }
    },
    [homeId, refresh, setTasks]
  );

  const handleTaskDelete = useCallback(
    async (taskId: string) => {
      const yes = await confirmStore.open({ title: 'Delete this task?', confirmLabel: 'Delete', variant: 'destructive' });
      if (!yes) return;
      try {
        await api.homeProfile.deleteHomeTask(homeId, taskId);
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } catch (err: unknown) {
        console.error('Failed to delete task:', err);
      }
    },
    [homeId, setTasks]
  );

  // ── Member / Invite handler ──

  const handleInvite = useCallback(
    async (data: { email?: string; user_id?: string; username?: string; relationship: string; preset_key?: string; message?: string; start_at?: string; end_at?: string }) => {
      await api.homes.inviteToHome(homeId, data);
      try {
        const membersData = await api.homes.getHomeOccupants(homeId);
        const activeMembers = (membersData as Record<string, any>).occupants as Record<string, any>[] || [];
        const pending = (membersData as Record<string, any>).pendingInvites as Record<string, any>[] || [];
        setMembers(() => [...activeMembers, ...pending]);
      } catch {
        // occupants may not reflect invite immediately
      }
    },
    [homeId, setMembers]
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

  const activeTasks = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
  const openIssues = issues.filter((i) => i.status !== 'resolved' && i.status !== 'canceled').length;
  const unpaidBills = bills.filter((b) => b.status === 'due' || b.status === 'overdue');
  const totalDue = unpaidBills.reduce((s, b) => s + Number(b.amount || 0), 0);
  const pendingPkgs = packages.filter((p) => p.status !== 'picked_up' && p.status !== 'returned').length;

  // ── Tab navigation ──

  const setHighLevelTab = (t: string) => {
    if (t === 'dashboard') {
      router.push(`/app/homes/${homeId}/dashboard`);
    } else {
      router.push(`/app/homes/${homeId}/dashboard?tab=${t}`);
    }
    setExpandedCard(null);
  };

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
          <p className="mt-4 text-app-secondary">Loading home dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mb-3 flex justify-center"><AlertCircle className="w-10 h-10 text-red-500" /></div>
          <p className="text-red-600 font-medium">{error}</p>
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
    return <VerificationCenter homeId={homeId} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Slide-over Panels */}
      <TaskSlidePanel
        open={taskPanel.open}
        onClose={closeTaskPanel}
        onSave={handleTaskSave}
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
        homeName={home?.name || home?.address_line1 || 'Home Dashboard'}
        homeAddress={home?.address_line1 && home?.name ? home.address_line1 : undefined}
        roleBadge={myAccess.role_base}
        isOwner={myAccess.isOwner || home?.owner_id === currentUserId}
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
          totalDue={totalDue}
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
            { key: 'add-task', icon: QuickCreateIcons.task, label: 'Add Task', iconColor: 'text-emerald-600', onAction: () => openTaskPanel() },
            { key: 'report-issue', icon: QuickCreateIcons.issue, label: 'Report Issue', iconColor: 'text-amber-600', onAction: () => openIssuePanel() },
            { key: 'track-bill', icon: QuickCreateIcons.bill, label: 'Track Bill', iconColor: 'text-red-600', onAction: () => openBillPanel() },
            { key: 'track-package', icon: QuickCreateIcons.package, label: 'Track Package', iconColor: 'text-violet-600', onAction: () => openPackagePanel() },
            { key: 'invite-member', icon: QuickCreateIcons.member, label: 'Invite Member', iconColor: 'text-orange-600', onAction: openInviteModal },
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
  totalDue,
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
}: {
  home: Record<string, any>;
  homeId: string;
  activeTasks: number;
  openIssues: number;
  totalDue: number;
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
}) {
  const router = useRouter();
  const onBack = () => onExpandCard(null);

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
            highlightBillId={linkedType === 'bill' ? linkedId : undefined}
          />
        )}
        {expandedCard === 'calendar' && (
          <CalendarCard
            tasks={can('tasks.view') ? tasks : []}
            bills={can('finance.view') ? bills : []}
            events={events}
            packages={can('mailbox.view') ? packages : []}
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
    packages.length === 0 && documents.length === 0 && homeGigs.length === 0;

  return (
    <div className="space-y-4">
      {/* Today Card — at-a-glance summary */}
      <TodayCard
        activeTasks={activeTasks}
        openIssues={openIssues}
        totalDue={totalDue}
        pendingPkgs={pendingPkgs}
        memberCount={members.length}
        events={events}
        onNavigateTab={(t) => onExpandCard(t)}
      />

      {/* Home Intelligence Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col items-center">
          <HealthScoreRing
            score={intelligence.healthScore?.score ?? 0}
            topIssue={intelligence.healthScore?.topIssue ?? null}
            topAction={intelligence.healthScore?.topAction ?? null}
            loading={intelligence.healthLoading}
            isNewHome={!intelligence.healthLoading && intelligence.healthScore == null}
            homeId={homeId}
            onActionPress={(route) => router.push(route)}
          />
        </div>
        <SeasonalChecklist
          checklist={intelligence.checklist}
          loading={intelligence.checklistLoading}
          onComplete={(itemId) => intelligence.completeChecklistItem(itemId)}
          onSkip={(itemId) => intelligence.skipChecklistItem(itemId)}
          onHireHelp={(item) =>
            router.push(`/app/gigs/new?initialText=${encodeURIComponent(item.gig_title_suggestion || item.title)}`)
          }
          onGenerate={() => intelligence.generateChecklist()}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PropertyValueCard
          data={intelligence.propertyValue}
          loading={intelligence.propertyValueLoading}
        />
        <BillTrendChart
          data={intelligence.billTrends}
          selectedType={selectedBillType}
          onTypeChange={onBillTypeChange}
          loading={intelligence.billTrendsLoading}
          onAddBill={onAddBill}
          onOptInChange={(optedIn) => intelligence.setBillBenchmarkOptIn(optedIn)}
        />
      </div>

      {/* Timeline */}
      <HomeTimeline
        items={intelligence.timeline}
        loading={intelligence.timelineLoading}
        hasMore={intelligence.timelineHasMore}
        onLoadMore={intelligence.loadMoreTimeline}
      />

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

          {(homeGigs.length > 0 || nearbyGigs.length > 0) && (
            <HomeHelpCardPreview homeGigs={homeGigs} nearbyGigs={nearbyGigs} onExpand={() => onExpandCard('homehelp')} />
          )}

          {can('finance.view') && (
            <BillsBudgetCardPreview bills={bills} totalDue={totalDue} onExpand={() => onExpandCard('bills')} />
          )}

          <CalendarCardPreview events={events} onExpand={() => onExpandCard('calendar')} />

          {can('mailbox.view') && (
            <DeliveriesCardPreview packages={packages} pendingPkgs={pendingPkgs} onExpand={() => onExpandCard('deliveries')} />
          )}

          {can('maintenance.view') && (
            <MaintenanceCardPreview issues={issues} onExpand={() => onExpandCard('maintenance')} />
          )}

          {can('mailbox.view') && (
            <DocsCardPreview documents={documents} onExpand={() => onExpandCard('documents')} />
          )}

          {(can('access.view_wifi') || can('access.view_codes')) && (
            <AccessCardPreview secrets={secrets} onExpand={() => onExpandCard('access')} />
          )}

          <EmergencyCardPreview emergencies={emergencies} onExpand={() => onExpandCard('emergency')} />

          <PetsCardPreview pets={pets} onExpand={() => onExpandCard('pets')} />

          <PollsCardPreview polls={polls} onExpand={() => onExpandCard('polls')} />
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-app p-8 text-center">
          <div className="mb-3 flex justify-center"><Home className="w-12 h-12 text-app-muted" /></div>
          <div className="text-lg font-semibold text-app mb-1">Welcome to your home dashboard!</div>
          <p className="text-sm text-app-secondary max-w-sm mx-auto">
            This is your household command center. Start by adding tasks, tracking bills, or inviting household
            members to collaborate.
          </p>
          <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
            <ActionPill icon={<Building2 className="w-4 h-4" />} label="Property Details" onClick={() => router.push(`/app/homes/${homeId}/property-details`)} />
            <ActionPill icon={<ClipboardList className="w-4 h-4" />} label="Add Task" onClick={onAddTask} />
            <ActionPill icon={<AlertTriangle className="w-4 h-4" />} label="Report Issue" onClick={onAddIssue} />
            <ActionPill icon={<Wallet className="w-4 h-4" />} label="Track Bill" onClick={onAddBill} />
            <ActionPill icon={<Package className="w-4 h-4" />} label="Track Package" onClick={onAddPackage} />
            <ActionPill icon={<Users className="w-4 h-4" />} label="Invite Member" onClick={onInviteMember} />
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
