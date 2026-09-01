'use client';

import { useReducer, useCallback } from 'react';
import type { PostType, PostVisibility } from '@pantopus/api';
import type { PostLocation } from '../PostLocationPicker';

export type ProfileVisibilityScope = 'public' | 'connections' | 'local_context' | 'hidden';

export interface PostFormState {
  expanded: boolean;
  selectedIntent: PostType | null;
  content: string;
  title: string;
  visibility: PostVisibility;
  showVisibility: boolean;
  location: PostLocation | null;
  profileVisibilityScope: ProfileVisibilityScope;
  precheckSuggestions: Array<{ type: string; message: string }>;

  // Type-specific fields
  eventVenue: string;
  eventDate: string;
  eventEndDate: string;
  safetyKind: string;
  behaviorDesc: string;
  dealExpires: string;
  dealBusinessName: string;
  lostFoundType: 'lost' | 'found';
  contactPref: string;
  serviceCategory: string;
  tags: string;
  crossPostConnections: boolean;

  // Media
  mediaFiles: File[];
}

const INITIAL_STATE: PostFormState = {
  expanded: false,
  selectedIntent: null,
  content: '',
  title: '',
  visibility: 'neighborhood',
  showVisibility: false,
  location: null,
  profileVisibilityScope: 'local_context',
  precheckSuggestions: [],
  eventVenue: '',
  eventDate: '',
  eventEndDate: '',
  safetyKind: 'other',
  behaviorDesc: '',
  dealExpires: '',
  dealBusinessName: '',
  lostFoundType: 'lost',
  contactPref: '',
  serviceCategory: '',
  tags: '',
  crossPostConnections: false,
  mediaFiles: [],
};

type PostFormAction =
  | { type: 'SET_FIELD'; field: keyof PostFormState; value: PostFormState[keyof PostFormState] }
  | { type: 'SELECT_INTENT'; intent: PostType }
  | { type: 'RESET' }
  | { type: 'ADD_MEDIA'; files: File[] }
  | { type: 'REMOVE_MEDIA'; index: number }
  | { type: 'DISMISS_PRECHECK'; index: number };

function postFormReducer(state: PostFormState, action: PostFormAction): PostFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SELECT_INTENT':
      return { ...state, selectedIntent: action.intent, expanded: true };
    case 'RESET':
      return INITIAL_STATE;
    case 'ADD_MEDIA':
      return { ...state, mediaFiles: [...state.mediaFiles, ...action.files].slice(0, 10) };
    case 'REMOVE_MEDIA':
      return { ...state, mediaFiles: state.mediaFiles.filter((_, i) => i !== action.index) };
    case 'DISMISS_PRECHECK':
      return { ...state, precheckSuggestions: state.precheckSuggestions.filter((_, i) => i !== action.index) };
    default:
      return state;
  }
}

export function usePostForm() {
  const [state, dispatch] = useReducer(postFormReducer, INITIAL_STATE);

  const setField = useCallback(<K extends keyof PostFormState>(field: K, value: PostFormState[K]) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  const selectIntent = useCallback((intent: PostType) => {
    dispatch({ type: 'SELECT_INTENT', intent });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const addMedia = useCallback((files: File[]) => {
    dispatch({ type: 'ADD_MEDIA', files });
  }, []);

  const removeMedia = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_MEDIA', index });
  }, []);

  const dismissPrecheck = useCallback((index: number) => {
    dispatch({ type: 'DISMISS_PRECHECK', index });
  }, []);

  return { state, setField, selectIntent, reset, addMedia, removeMedia, dismissPrecheck };
}
