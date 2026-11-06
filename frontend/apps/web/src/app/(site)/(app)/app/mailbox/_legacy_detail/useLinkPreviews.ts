/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import type { MailItem, LinkedTargetPreview } from './legacy-detail-types';
import { TARGET_TYPE_META, TARGET_TYPE_HOME_TAB } from './legacy-detail-constants';
import { asString, formatMoney, formatDateLabel, shortenId, getLinkPreviewKey } from './legacy-detail-utils';

export function useLinkPreviews(mail: MailItem | null) {
  const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkedTargetPreview>>({});
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const hydrateLinkPreviews = async () => {
      const links = mail?.links || [];
      if (!mail || links.length === 0) {
        setLinkPreviews({});
        setLinkPreviewLoading(false);
        return;
      }

      const routingHomeId = mail.address_home_id || mail.address_id || mail.recipient_home_id;
        const base: Record<string, LinkedTargetPreview> = {};
        links.forEach((link) => {
          const meta = TARGET_TYPE_META[link.target_type];
          const tab = TARGET_TYPE_HOME_TAB[link.target_type];
          const href = routingHomeId
            ? `/app/homes/${routingHomeId}/dashboard?tab=${tab}&linkedType=${link.target_type}&linkedId=${link.target_id}`
            : undefined;
          base[getLinkPreviewKey(link)] = {
            title: `${meta?.label || 'Linked'} target`,
            subtitle: `ID ${shortenId(link.target_id)}`,
            href
          };
        });

      if (!routingHomeId) {
        setLinkPreviews(base);
        setLinkPreviewLoading(false);
        return;
      }

      setLinkPreviewLoading(true);

      const needs = {
        bills: links.some((link) => link.target_type === 'bill'),
        issues: links.some((link) => link.target_type === 'issue'),
        packages: links.some((link) => link.target_type === 'package'),
        documents: links.some((link) => link.target_type === 'document')
      };

      try {
        const [billsRes, issuesRes, packagesRes, documentsRes] = await Promise.allSettled([
          needs.bills ? api.homeProfile.getHomeBills(routingHomeId) : Promise.resolve({ bills: [] }),
          needs.issues ? api.homeProfile.getHomeIssues(routingHomeId) : Promise.resolve({ issues: [] }),
          needs.packages ? api.homeProfile.getHomePackages(routingHomeId) : Promise.resolve({ packages: [] }),
          needs.documents ? api.homeProfile.getHomeDocuments(routingHomeId) : Promise.resolve({ documents: [] })
        ]);

        if (cancelled) return;

        const bills = billsRes.status === 'fulfilled' ? ((billsRes.value as any)?.bills || []) : [];
        const issues = issuesRes.status === 'fulfilled' ? ((issuesRes.value as any)?.issues || []) : [];
        const packages = packagesRes.status === 'fulfilled' ? ((packagesRes.value as any)?.packages || []) : [];
        const documents = documentsRes.status === 'fulfilled' ? ((documentsRes.value as any)?.documents || []) : [];

        const billsById = new Map<string, any>(bills.map((entry: any) => [entry.id, entry]));
        const issuesById = new Map<string, any>(issues.map((entry: any) => [entry.id, entry]));
        const packagesById = new Map<string, any>(packages.map((entry: any) => [entry.id, entry]));
        const documentsById = new Map<string, any>(documents.map((entry: any) => [entry.id, entry]));

        const next = { ...base };
        links.forEach((link) => {
          const key = getLinkPreviewKey(link);

          if (link.target_type === 'bill') {
            const bill = billsById.get(link.target_id);
            if (!bill) return;
            const provider = asString(bill.provider_name) || 'Bill';
            const amount = formatMoney(bill.amount, bill.currency);
            const dueDate = formatDateLabel(bill.due_date);
            const status = asString(bill.status);
            next[key] = {
              ...next[key],
              title: provider,
              subtitle: [amount, dueDate ? `Due ${dueDate}` : null, status ? `Status: ${status}` : null]
                .filter(Boolean)
                .join(' • ')
            };
            return;
          }

          if (link.target_type === 'issue') {
            const issue = issuesById.get(link.target_id);
            if (!issue) return;
            const title = asString(issue.title) || 'Issue';
            const severity = asString(issue.severity);
            const status = asString(issue.status);
            next[key] = {
              ...next[key],
              title,
              subtitle: [severity, status].filter(Boolean).join(' • ')
            };
            return;
          }

          if (link.target_type === 'package') {
            const pkg = packagesById.get(link.target_id);
            if (!pkg) return;
            const title =
              asString(pkg.vendor_name) ||
              asString(pkg.carrier) ||
              asString(pkg.description) ||
              'Package';
            const tracking = asString(pkg.tracking_number);
            const status = asString(pkg.status);
            const expectedAt = formatDateLabel(pkg.expected_at);
            next[key] = {
              ...next[key],
              title,
              subtitle: [tracking ? `Tracking ${tracking}` : null, status, expectedAt ? `ETA ${expectedAt}` : null]
                .filter(Boolean)
                .join(' • ')
            };
            return;
          }

          if (link.target_type === 'document') {
            const document = documentsById.get(link.target_id);
            if (!document) return;
            const title = asString(document.title) || 'Document';
            const docType = asString(document.doc_type);
            const visibility = asString(document.visibility);
            next[key] = {
              ...next[key],
              title,
              subtitle: [docType, visibility].filter(Boolean).join(' • ')
            };
          }
        });

        setLinkPreviews(next);
      } catch {
        if (!cancelled) {
          setLinkPreviews(base);
        }
      } finally {
        if (!cancelled) {
          setLinkPreviewLoading(false);
        }
      }
    };

    hydrateLinkPreviews();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- individual mail properties are intentionally listed instead of `mail` to avoid re-running on unrelated mail field changes
  }, [
    mail?.id,
    mail?.links,
    mail?.address_home_id,
    mail?.address_id,
    mail?.recipient_home_id
  ]);

  return { linkPreviews, linkPreviewLoading };
}
