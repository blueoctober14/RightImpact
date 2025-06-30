import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

export interface IdQuestion {
  id: number;
  title: string;
  question_text: string;
  response_type: 'MC_SINGLE' | 'MC_MULTI' | 'SLIDER' | 'TEXT';
  possible_choices: string[];
  notes_enabled: boolean;
}

export interface IdAnswerCreate {
  shared_contact_id: number;
  selected_choices?: string[];
  slider_answer?: number;
  text_answer?: string;
  notes?: string;
}

export const fetchIdentificationQuestions = async (): Promise<IdQuestion[]> => {
  const token = await AsyncStorage.getItem('token');
  const response = await api.get('/api/identification/questions?is_active=true', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const submitIdentificationAnswer = async (
  questionId: number,
  data: IdAnswerCreate,
): Promise<void> => {
  const token = await AsyncStorage.getItem('token');
  await api.post(`/api/identification/questions/${questionId}/answers`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export interface ContactIdentificationStatus {
  contact_id: number;
  shared_contact_id: number;
  total_questions: number;
  answered_questions: number;
}

export const fetchIdentificationStatus = async (): Promise<ContactIdentificationStatus[]> => {
  const token = await AsyncStorage.getItem('token');
  const response = await api.get('/api/identification/status', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export interface ContactAnswer {
  question_id: number;
  selected_choices?: string[];
  slider_answer?: number;
  text_answer?: string;
  notes?: string;
}

export const fetchContactAnswers = async (contactId: number): Promise<ContactAnswer[]> => {
  const token = await AsyncStorage.getItem('token');
  const response = await api.get(`/api/identification/contacts/${contactId}/answers`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};
