export interface TargetList {
  id: number;
  name: string;
  description?: string;
  total_contacts: number;
  imported_contacts: number;
  failed_contacts: number;
  status: string;
  created_at: string;
  updated_at: string;
  contactCount?: number; // For backward compatibility
  file?: File; // For file uploads
}

export interface User {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role?: string;
  created_at: string;
  updated_at: string;
}

export type MessageType = 'friend_to_friend' | 'neighbor_to_neighbor' | 'social_media';

export interface MessageTemplate {
  sent_count?: number;
  id: number;
  name: string;
  message_type: MessageType;
  content: string;
  media_url?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
  lists: Array<{ id: number; name: string }>;
  users: Array<{ id: number; name?: string }>;
  groups: Array<{ id: number; name: string }>;
  listIds?: number[];
  userIds?: number[];
  groupIds?: number[];
}

export interface MessageTemplateFormProps {
  open: boolean;
  onClose: () => void;
  template?: MessageTemplate;
  onSave: (template: MessageTemplate) => void;
  onDelete?: () => void;
}
