export interface MapTaskListItem {
  id: string;
  title: string;
  description?: string;
  price: number | null;
  category: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  user_id: string;
  poster_display_name?: string | null;
  poster_username?: string | null;
  poster_profile_picture_url?: string | null;
  poster_account_type?: string | null;
  exact_city?: string | null;
  exact_state?: string | null;
  location_precision?: string | null;
  visibility_scope?: string | null;
  is_urgent?: boolean;
  tags?: string[];
  items?: unknown[];
  scheduled_start?: string | null;
  attachments?: string[];
  first_image?: string | null;
  is_remote?: boolean;
}
