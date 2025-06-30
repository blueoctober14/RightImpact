export interface Group {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  city?: string;
  state?: string;
  zip_code?: string;
  created_at: string;
  updated_at: string;
  role?: 'admin' | 'user';
  is_active?: boolean;
  has_shared_contacts?: boolean;
  max_neighbor_messages?: number | null;
  groups?: Group[];
}
