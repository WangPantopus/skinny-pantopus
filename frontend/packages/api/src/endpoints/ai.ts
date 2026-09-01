// ============================================================
// AI AGENT ENDPOINTS
// Chat agent, draft generation, mail summarization, place brief
// ============================================================

import apiClient, { get, post, del, getAuthToken, getApiBaseUrl } from '../client';
import type {
  AIDraftGigRequest,
  AIDraftGigResponse,
  AIDraftListingRequest,
  AIDraftListingResponse,
  ListingDraft,
  AIDraftPostRequest,
  AIDraftPostResponse,
  AISummarizeMailRequest,
  MailSummary,
  PlaceBrief,
  NeighborhoodPulse,
  AIConversation,
  AIChatRequest,
} from '@pantopus/types';

// ─── Streaming Chat ──────────────────────────────────────────

/**
 * Stream a chat message to the AI agent via SSE.
 * Returns an object with methods to subscribe to events and abort.
 */
export function streamChat(
  data: AIChatRequest,
  handlers: {
    onConversation?: (data: { conversationId: string; isNew: boolean }) => void;
    onTextDelta?: (delta: string) => void;
    onDraft?: (data: { type: string; draft: unknown; valid: boolean }) => void;
    onError?: (data: { error: string; message: string }) => void;
    onDone?: (data: { conversationId: string; usage: { inputTokens: number; outputTokens: number }; toolCalls: number }) => void;
  }
) {
  const controller = new AbortController();

  const dispatchSseEvent = (eventName: string, payload: string) => {
    try {
      const parsed = JSON.parse(payload);
      switch (eventName) {
        case 'conversation':
          handlers.onConversation?.(parsed);
          break;
        case 'text_delta':
          handlers.onTextDelta?.(parsed.delta);
          break;
        case 'draft':
          handlers.onDraft?.(parsed);
          break;
        case 'error':
          handlers.onError?.(parsed);
          break;
        case 'done':
          handlers.onDone?.(parsed);
          break;
        case 'close':
          break;
      }
    } catch {
      // Skip malformed JSON payloads.
    }
  };

  const parseSseChunk = (chunk: string) => {
    const blocks = chunk.split('\n\n');
    for (const block of blocks) {
      if (!block.trim()) continue;
      let eventName = '';
      let payload = '';
      const lines = block.split('\n');
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventName = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          payload = line.slice(6);
        }
      }
      if (eventName && payload) dispatchSseEvent(eventName, payload);
    }
  };

  const run = async () => {
    const token = getAuthToken();
    const response = await fetch(`${getApiBaseUrl()}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: 'NETWORK_ERROR' }));
      handlers.onError?.({
        error: errorBody.error || 'NETWORK_ERROR',
        message: errorBody.message || 'Failed to connect to AI.',
      });
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      // React Native/Expo fetch may not expose ReadableStream.
      // Fallback: consume the full SSE payload and replay events after completion.
      const fullText = await response.text().catch(() => '');
      if (!fullText) {
        handlers.onError?.({ error: 'NO_STREAM', message: 'Streaming not supported.' });
        return;
      }
      parseSseChunk(fullText);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete last line in buffer

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);
          } else if (line === '' && currentEvent && currentData) {
            // End of event — dispatch
            dispatchSseEvent(currentEvent, currentData);
            currentEvent = '';
            currentData = '';
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handlers.onError?.({ error: 'STREAM_ERROR', message: 'Connection lost.' });
      }
    }
  };

  run().catch((err) => {
    if (err.name !== 'AbortError') {
      handlers.onError?.({ error: 'NETWORK_ERROR', message: 'Failed to connect to AI.' });
    }
  });

  return {
    abort: () => controller.abort(),
  };
}

// ─── Single-turn Drafts ──────────────────────────────────────

/**
 * Generate a gig/task draft from free text.
 */
export async function draftGig(data: AIDraftGigRequest): Promise<AIDraftGigResponse> {
  return post<AIDraftGigResponse>('/api/ai/draft/gig', data);
}

/**
 * Generate a listing draft from free text.
 */
export async function draftListing(data: AIDraftListingRequest): Promise<AIDraftListingResponse> {
  return post<AIDraftListingResponse>('/api/ai/draft/listing', data);
}

/**
 * Generate a listing draft from images (Snap & Sell).
 */
export async function draftListingFromImages(data: {
  images: string[];
  text?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{
  draft: ListingDraft;
  confidence: number;
  priceSuggestion?: { low: number; median: number; high: number; basis: string; comparable_count: number } | null;
}> {
  return post('/api/ai/draft/listing-vision', data);
}

/**
 * Generate a post draft from free text.
 */
export async function draftPost(data: AIDraftPostRequest): Promise<AIDraftPostResponse> {
  return post<AIDraftPostResponse>('/api/ai/draft/post', data);
}

// ─── Mail Summarization ──────────────────────────────────────

/**
 * Summarize a mail item with action extraction.
 */
export async function summarizeMail(data: AISummarizeMailRequest): Promise<MailSummary> {
  return post<MailSummary>('/api/ai/summarize/mail', data);
}

// ─── Place Brief ─────────────────────────────────────────────

/**
 * Get a place brief with external data synthesis.
 */
export async function getPlaceBrief(placeId: string): Promise<PlaceBrief> {
  return get<PlaceBrief>('/api/ai/place-brief', { placeId });
}

// ─── Neighborhood Pulse ─────────────────────────────────────

/**
 * Get a neighborhood pulse for a home (cold-start intelligence).
 */
export async function getNeighborhoodPulse(homeId: string): Promise<NeighborhoodPulse> {
  return get<NeighborhoodPulse>('/api/ai/pulse', { homeId });
}

// ─── Conversation Management ─────────────────────────────────

/**
 * List the user's AI conversations.
 */
export async function getConversations(): Promise<{ conversations: AIConversation[] }> {
  return get<{ conversations: AIConversation[] }>('/api/ai/conversations');
}

/**
 * Delete an AI conversation.
 */
export async function deleteConversation(id: string): Promise<{ message: string }> {
  return del<{ message: string }>(`/api/ai/conversations/${id}`);
}

// ─── Audio Transcription ─────────────────────────────────────

export interface TranscriptionResult {
  text: string;
  duration_seconds: number | null;
}

/**
 * Transcribe an audio file via Whisper.
 * Accepts a file URI (React Native) or File object (web).
 */
export async function transcribeAudio(
  audio: string | File,
  filename?: string,
): Promise<TranscriptionResult> {
  const formData = new FormData();

  if (typeof audio === 'string') {
    // React Native: audio is a file URI
    formData.append('audio', {
      uri: audio,
      name: filename || 'recording.m4a',
      type: 'audio/m4a',
    } as any);
  } else {
    // Web: audio is a File object
    formData.append('audio', audio);
  }

  const response = await apiClient.post<TranscriptionResult>(
    '/api/ai/transcribe',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );

  return response.data;
}