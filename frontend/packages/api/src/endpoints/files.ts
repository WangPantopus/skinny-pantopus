// ============================================================
// FILE ENDPOINTS
// File uploads, portfolio, storage management
// ============================================================

import { uploadFile, get, del } from '../client';
import type { FileUpload, PortfolioItem, ApiResponse } from '@pantopus/types';

/**
 * Upload profile picture
 */
export async function uploadProfilePicture(
  file: File,
  description?: string
): Promise<{ 
  message: string;
  file: {
    id: string;
    url: string;
    thumbnails: Record<string, string>;
  };
}> {
  return uploadFile('/api/files/profile-picture', file, { description });
}

/**
 * Upload portfolio item (image, video, or document)
 */
export async function uploadPortfolio(
  file: File,
  data?: {
    category?: string;
    title?: string;
    description?: string;
    tags?: string[];
    displayOrder?: number;
  }
): Promise<{ 
  message: string;
  file: {
    id: string;
    url: string;
    type: string;
    thumbnails?: Record<string, string>;
    metadata?: any;
  };
}> {
  return uploadFile('/api/files/portfolio', file, data);
}

/**
 * Get user's portfolio items
 */
export async function getPortfolio(userId?: string, category?: string): Promise<{ 
  files: PortfolioItem[];
}> {
  const endpoint = userId ? `/api/files/portfolio/${userId}` : '/api/files/portfolio';
  return get<{ files: PortfolioItem[] }>(endpoint, category ? { category } : undefined);
}

/**
 * Upload file to home
 */
export async function uploadHomeFile(
  homeId: string,
  file: File,
  data: {
    fileType: 'home_photo' | 'home_video' | 'home_document';
    visibility: 'public' | 'private';
    title?: string;
    description?: string;
    category?: string;
  }
): Promise<{ 
  message: string;
  file: {
    id: string;
    url: string;
    type: string;
    visibility: string;
    thumbnails?: Record<string, string>;
  };
}> {
  return uploadFile(`/api/files/home/${homeId}`, file, data);
}

/**
 * Get home's files
 */
export async function getHomeFiles(
  homeId: string, 
  visibility?: 'public' | 'private'
): Promise<{ 
  files: FileUpload[];
}> {
  return get<{ files: FileUpload[] }>(`/api/files/home/${homeId}`, 
    visibility ? { visibility } : undefined
  );
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: string): Promise<{ message: string }> {
  return del<{ message: string }>(`/api/files/${fileId}`);
}

/**
 * Get user's storage quota information
 */
export async function getStorageQuota(): Promise<{ 
  quota: {
    user_id: string;
    total_storage_bytes: number;
    used_storage_bytes: number;
    available_storage_bytes: number;
    file_count: number;
    max_file_size_bytes: number;
  };
}> {
  return get<{ quota: any }>('/api/files/quota');
}

/**
 * Upload multiple files at once
 */
export async function uploadMultipleFiles(
  files: File[],
  endpoint: string,
  additionalData?: Record<string, any>
): Promise<{ 
  files: Array<{
    id: string;
    url: string;
    filename: string;
  }>;
}> {
  const uploadPromises = files.map(file => uploadFile(endpoint, file, additionalData));
  const results = await Promise.all(uploadPromises);
  
  return {
    files: results.map((r: any) => r.file)
  };
}

/**
 * Update file metadata
 */
export async function updateFileMetadata(
  fileId: string,
  data: {
    title?: string;
    description?: string;
    tags?: string[];
    category?: string;
    display_order?: number;
  }
): Promise<{ file: FileUpload }> {
  return uploadFile(`/api/files/${fileId}/metadata`, new File([], ''), data) as any;
}

/**
 * Get file details
 */
export async function getFile(fileId: string): Promise<{ file: FileUpload }> {
  return get<{ file: FileUpload }>(`/api/files/${fileId}`);
}

/**
 * Reorder portfolio items
 */
export async function reorderPortfolio(fileIds: string[]): Promise<ApiResponse> {
  return uploadFile('/api/files/portfolio/reorder', new File([], ''), { 
    fileIds 
  }) as any;
}
