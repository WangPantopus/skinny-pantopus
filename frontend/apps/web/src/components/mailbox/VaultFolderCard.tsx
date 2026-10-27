'use client';

import type { VaultFolder } from '@/types/mailbox';

type VaultFolderCardProps = {
  folder: VaultFolder;
  onClick?: () => void;
};

/** A Vault folder drawn as a manila folder with its tab (Mail tab drawings, R10-Vault). */
export default function VaultFolderCard({ folder, onClick }: VaultFolderCardProps) {
  const count = folder.item_count ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${folder.label}, ${count === 0 ? 'nothing filed' : `${count} ${count === 1 ? 'piece' : 'pieces'}`}`}
      className="group block w-full rounded-[10px] text-left text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <div aria-hidden="true" className="h-3 w-[46%] rounded-t-[7px] bg-[#e6cf92]" />
      <div className="flex h-[76px] flex-col justify-between rounded-b-[10px] rounded-tr-[10px] bg-[#f3e3b5] px-3 py-2.5 shadow-sm transition group-hover:brightness-[0.97]">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold leading-5">{folder.label}</span>
          <span aria-hidden="true" className="flex-shrink-0 text-[13px] leading-[18px] text-[#5c4410]">{count}</span>
        </div>
        <span aria-hidden="true" className="truncate text-xs leading-4 text-[#5c4410]">
          {count === 0 ? 'Nothing filed yet' : folder.last_item_preview || `${count} ${count === 1 ? 'piece' : 'pieces'}`}
        </span>
      </div>
    </button>
  );
}
