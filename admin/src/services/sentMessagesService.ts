import api from './api';

export interface SentMessageEnriched {
  id: number;
  message_template_id: string;
  message_template_name: string;
  shared_contact_id?: string | null;  // Made optional to match backend
  contact_first_name?: string;
  contact_last_name?: string;
  contact_phone?: string;
  user_id: number;
  username: string;
  sent_at: string;
}

interface GetSentMessagesParams {
  contact_id?: string;
  user_id?: number;
}

export async function getSentMessages(params?: GetSentMessagesParams): Promise<SentMessageEnriched[]> {
  try {
    const response = await api.get<SentMessageEnriched[]>('/sent_messages/', { 
      params,
      headers: {
        'Access-Control-Allow-Origin': window.location.origin,
        'Access-Control-Allow-Credentials': 'true'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch sent messages:', error);
    throw error;
  }
}
