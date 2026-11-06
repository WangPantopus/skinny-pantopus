'use client';

import { useId } from 'react';
import AddressAutocomplete from '@/components/AddressAutocomplete';

type Picked = { city: string; state: string; zipcode: string };

interface AddressFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** A picked suggestion: fill the location's city, state and ZIP from it. */
  onPick: (picked: Picked) => void;
  labelClassName?: string;
  inputClassName?: string;
}

/** The street address of a business location, with address suggestions; looks like `Field`. */
export default function AddressField({
  label,
  value,
  onChange,
  onPick,
  labelClassName = 'block text-sm font-medium text-app-strong mb-1',
  inputClassName = 'w-full rounded-lg border border-app-strong px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500',
}: AddressFieldProps) {
  const id = useId();
  const labelId = `${id}-label`;
  return (
    <div>
      <label id={labelId} htmlFor={id} className={labelClassName}>{label}</label>
      <AddressAutocomplete
        id={id}
        labelId={labelId}
        value={value}
        onChange={onChange}
        onSelectNormalized={onPick}
        placeholder=""
        hintText={null}
        inputClassName={inputClassName}
        streetOnly
      />
    </div>
  );
}
