'use client';

import { useCallback, useState } from 'react';

export type PanelType = 'task' | 'issue' | 'bill' | 'package' | null;

export interface UseHomePanelsReturn {
  taskPanel: { open: boolean; task?: Record<string, any> };
  issuePanel: { open: boolean; issue?: Record<string, any> };
  billPanel: { open: boolean; bill?: Record<string, any> };
  packagePanel: { open: boolean; pkg?: Record<string, any> };
  inviteModal: boolean;
  expandedCard: string | null;
  // Panel openers
  openTaskPanel: (task?: Record<string, any>) => void;
  closeTaskPanel: () => void;
  openIssuePanel: (issue?: Record<string, any>) => void;
  closeIssuePanel: () => void;
  openBillPanel: (bill?: Record<string, any>) => void;
  closeBillPanel: () => void;
  openPackagePanel: (pkg?: Record<string, any>) => void;
  closePackagePanel: () => void;
  // Modal
  openInviteModal: () => void;
  closeInviteModal: () => void;
  // Card expansion
  setExpandedCard: (card: string | null) => void;
}

export function useHomePanels(): UseHomePanelsReturn {
  const [taskPanel, setTaskPanel] = useState<{ open: boolean; task?: Record<string, any> }>({ open: false });
  const [issuePanel, setIssuePanel] = useState<{ open: boolean; issue?: Record<string, any> }>({ open: false });
  const [billPanel, setBillPanel] = useState<{ open: boolean; bill?: Record<string, any> }>({ open: false });
  const [packagePanel, setPackagePanel] = useState<{ open: boolean; pkg?: Record<string, any> }>({ open: false });
  const [inviteModal, setInviteModal] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const openTaskPanel = useCallback((task?: Record<string, any>) => setTaskPanel({ open: true, task }), []);
  const closeTaskPanel = useCallback(() => setTaskPanel({ open: false }), []);
  const openIssuePanel = useCallback((issue?: Record<string, any>) => setIssuePanel({ open: true, issue }), []);
  const closeIssuePanel = useCallback(() => setIssuePanel({ open: false }), []);
  const openBillPanel = useCallback((bill?: Record<string, any>) => setBillPanel({ open: true, bill }), []);
  const closeBillPanel = useCallback(() => setBillPanel({ open: false }), []);
  const openPackagePanel = useCallback((pkg?: Record<string, any>) => setPackagePanel({ open: true, pkg }), []);
  const closePackagePanel = useCallback(() => setPackagePanel({ open: false }), []);

  const openInviteModal = useCallback(() => setInviteModal(true), []);
  const closeInviteModal = useCallback(() => setInviteModal(false), []);

  return {
    taskPanel,
    issuePanel,
    billPanel,
    packagePanel,
    inviteModal,
    expandedCard,
    openTaskPanel,
    closeTaskPanel,
    openIssuePanel,
    closeIssuePanel,
    openBillPanel,
    closeBillPanel,
    openPackagePanel,
    closePackagePanel,
    openInviteModal,
    closeInviteModal,
    setExpandedCard,
  };
}
