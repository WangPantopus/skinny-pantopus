'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { ProfileFormData, User } from '@pantopus/types';
import { extractApiError, extractFieldErrors } from '@pantopus/ui-utils';
import { toast } from '@/components/ui/toast-store';

/** Server messages for rejected fields, keyed like the form. */
export type FieldErrors = Partial<Record<keyof ProfileFormData, string>>;

// ── Helpers ──

function normalizePhoneToE164(input: string): string {
  const raw = (input || '').trim();
  if (!raw) return '';
  if (/^\+[1-9]\d{1,14}$/.test(raw)) return raw;
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return raw;
}

function toDateInputValue(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') {
    if (v.includes('T')) return v.split('T')[0];
    return v;
  }
  return '';
}

// ── Reducer ──

const INITIAL_FORM: ProfileFormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  bio: '',
  tagline: '',
  dateOfBirth: '',
  phoneNumber: '',
  address: '',
  city: '',
  state: '',
  zipcode: '',
  website: '',
  linkedin: '',
  twitter: '',
  instagram: '',
  facebook: '',
};

type FormAction =
  | { type: 'SET_FIELD'; field: keyof ProfileFormData; value: string }
  | { type: 'SET_FIELDS'; fields: Partial<ProfileFormData> }
  | { type: 'RESET'; data: ProfileFormData };

function formReducer(state: ProfileFormData, action: FormAction): ProfileFormData {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_FIELDS':
      return { ...state, ...action.fields };
    case 'RESET':
      return action.data;
  }
}

// ── Hook ──

export interface UseProfileFormReturn {
  form: ProfileFormData;
  setField: (field: keyof ProfileFormData, value: string) => void;
  setFields: (fields: Partial<ProfileFormData>) => void;
  isDirty: boolean;
  reset: (data?: Partial<ProfileFormData>) => void;
  loading: boolean;
  /** Why the profile could not load; null when it loaded (or is loading). */
  loadError: string | null;
  saving: boolean;
  /** Server messages for the fields a save rejected, keyed like the form. */
  fieldErrors: FieldErrors;
  user: User | null;
  skills: string[];
  setSkills: React.Dispatch<React.SetStateAction<string[]>>;
  newSkill: string;
  setNewSkill: React.Dispatch<React.SetStateAction<string>>;
  addSkill: () => void;
  removeSkill: (skill: string) => void;
  addressVerified: boolean;
  setAddressVerified: React.Dispatch<React.SetStateAction<boolean>>;
  profilePictureUrl: string | null;
  setProfilePictureUrl: React.Dispatch<React.SetStateAction<string | null>>;
  loadProfile: () => Promise<void>;
  saveProfile: (e?: React.FormEvent) => Promise<void>;
}

export function useProfileForm(): UseProfileFormReturn {
  const router = useRouter();
  const [form, dispatch] = useReducer(formReducer, INITIAL_FORM);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Non-form-field state that still lives here
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [addressVerified, setAddressVerified] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  // Track initial form snapshot for isDirty
  const initialSnapshot = useRef<ProfileFormData>(INITIAL_FORM);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialSnapshot.current);

  const setField = useCallback((field: keyof ProfileFormData, value: string) => {
    dispatch({ type: 'SET_FIELD', field, value });
    // Editing a field the server rejected clears that field's message.
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }, []);

  const setFields = useCallback((fields: Partial<ProfileFormData>) => {
    dispatch({ type: 'SET_FIELDS', fields });
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(fields) as (keyof ProfileFormData)[]) delete next[key];
      return next;
    });
  }, []);

  const reset = useCallback((data?: Partial<ProfileFormData>) => {
    const next = { ...INITIAL_FORM, ...data };
    dispatch({ type: 'RESET', data: next });
    initialSnapshot.current = next;
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const userData = await api.users.getMyProfile();
      setUser(userData);

      const sl = userData.socialLinks || userData.social_links || {};
      const loaded: ProfileFormData = {
        firstName: userData.firstName || '',
        middleName: userData.middleName || userData.middle_name || '',
        lastName: userData.lastName || '',
        bio: userData.bio || '',
        tagline: userData.tagline || '',
        dateOfBirth: toDateInputValue(userData.dateOfBirth || userData.date_of_birth),
        phoneNumber: userData.phoneNumber || userData.phone_number || '',
        address: userData.address || '',
        city: userData.city || '',
        state: (userData.state || '').toUpperCase(),
        zipcode: userData.zipcode || '',
        website: sl.website || userData.website || '',
        linkedin: sl.linkedin || userData.linkedin || '',
        twitter: sl.twitter || userData.twitter || '',
        instagram: sl.instagram || userData.instagram || '',
        facebook: sl.facebook || userData.facebook || '',
      };

      dispatch({ type: 'RESET', data: loaded });
      initialSnapshot.current = loaded;

      setSkills(userData.skills || []);
      setAddressVerified(!!userData.address_verified);
      setProfilePictureUrl(userData.profilePicture || userData.profile_picture_url || null);
    } catch (err) {
      console.error('Failed to load profile:', err);
      // Only an expired session belongs on /login (which sends signed-in users
      // back to Place); a network or server failure gets a retry here.
      if ((err as { statusCode?: number } | null)?.statusCode === 401) {
        router.push('/login');
      } else {
        setLoadError(err instanceof Error && err.message ? err.message : "We couldn't load your profile.");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfile = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    setFieldErrors({});
    let profileSaved = false;

    try {
      const updates: Record<string, unknown> = {};

      if (form.firstName !== undefined) updates.firstName = form.firstName.trim();
      if (form.middleName !== undefined) updates.middleName = form.middleName.trim();
      if (form.lastName !== undefined) updates.lastName = form.lastName.trim();

      if (form.bio !== undefined) updates.bio = form.bio.trim();
      if (form.tagline !== undefined) updates.tagline = form.tagline.trim();

      updates.dateOfBirth = form.dateOfBirth ? form.dateOfBirth : '';

      if (form.phoneNumber.trim()) updates.phoneNumber = normalizePhoneToE164(form.phoneNumber);

      if (form.address.trim()) updates.address = form.address.trim();
      if (form.city.trim()) updates.city = form.city.trim();
      if (form.state.trim()) updates.state = form.state.trim();
      if (form.zipcode.trim()) updates.zipcode = form.zipcode.trim();

      updates.website = form.website.trim();
      updates.linkedin = form.linkedin.trim();
      updates.twitter = form.twitter.trim();
      updates.instagram = form.instagram.trim();
      updates.facebook = form.facebook.trim();

      const keepEvenIfEmpty = new Set([
        'website', 'linkedin', 'twitter', 'instagram', 'facebook',
        'middleName', 'bio', 'tagline', 'dateOfBirth',
      ]);

      for (const [k, v] of Object.entries(updates)) {
        if (!keepEvenIfEmpty.has(k)) {
          if (v === '' || v === null || v === undefined) delete updates[k];
        }
      }

      if (Object.keys(updates).length === 0) {
        toast.info('No changes to save.');
        return;
      }

      await api.users.updateProfile(updates as Record<string, unknown>);
      profileSaved = true;
      initialSnapshot.current = { ...form };
      await api.users.updateSkills(skills);
      toast.success('Profile updated successfully');
      router.push('/app/profile');
    } catch (err: unknown) {
      console.error('Failed to update profile:', err);
      if (profileSaved) {
        // The profile is saved; only the skills are not. Say so, and stay so
        // Save can retry the skills.
        toast.error("Your profile was saved, but your skills weren't. Try saving again.");
        return;
      }
      const fields = extractFieldErrors(err) as FieldErrors;
      const message = extractApiError(err, 'Failed to update profile. Please try again.');
      // The phone conflict comes back without field details; it is the phone field.
      if (message === 'Phone number already in use') fields.phoneNumber = message;
      setFieldErrors(fields);
      // One rejected field: its own message. Several: point at the highlighted fields.
      const rejected = Object.values(fields).filter((m): m is string => Boolean(m));
      toast.error(rejected.length === 1 ? rejected[0] : rejected.length > 1 ? 'Please correct the highlighted fields.' : message);
    } finally {
      setSaving(false);
    }
  }, [form, skills, router]);

  const addSkill = useCallback(() => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills((prev) => [...prev, newSkill.trim()]);
      setNewSkill('');
    }
  }, [newSkill, skills]);

  const removeSkill = useCallback((skillToRemove: string) => {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove));
  }, []);

  return {
    form,
    setField,
    setFields,
    isDirty,
    reset,
    loading,
    loadError,
    saving,
    fieldErrors,
    user,
    skills,
    setSkills,
    newSkill,
    setNewSkill,
    addSkill,
    removeSkill,
    addressVerified,
    setAddressVerified,
    profilePictureUrl,
    setProfilePictureUrl,
    loadProfile,
    saveProfile,
  };
}
