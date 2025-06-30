import { apiGet } from './api';
import api from './api';

export interface IdQuestion {
  id: number;
  title: string;
  question_text: string;
  response_type: 'MC_SINGLE' | 'MC_MULTI' | 'SLIDER' | 'TEXT';
  possible_choices: string[];
  notes_enabled: boolean;
  is_active: boolean;
  answers_count: number;
  assigned_user_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface IdQuestionCreate {
  title: string;
  question_text: string;
  response_type: 'MC_SINGLE' | 'MC_MULTI' | 'SLIDER' | 'TEXT';
  possible_choices?: string[];
  notes_enabled?: boolean;
  is_active?: boolean;
  assigned_user_ids?: number[];
}

export const getQuestions = async (): Promise<IdQuestion[]> => {
  const response = await api.get<IdQuestion[]>('/identification/questions');
  return response.data;
};

export const createQuestion = async (data: IdQuestionCreate): Promise<IdQuestion> => {
  const response = await api.post<IdQuestion>('/identification/questions', data);
  return response.data;
};

export const updateQuestion = async (id: number, data: Partial<IdQuestionCreate>): Promise<IdQuestion> => {
  const response = await api.put<IdQuestion>(`/identification/questions/${id}`, data);
  return response.data;
};

export const deleteQuestion = async (id: number): Promise<void> => {
  await api.delete(`/identification/questions/${id}`);
};

export const toggleQuestionActive = async (id: number, is_active: boolean): Promise<IdQuestion> => {
  const response = await api.put<IdQuestion>(`/identification/questions/${id}`, { is_active });
  return response.data;
};

export interface IdAnswer {
  id: number;
  question_id: number;
  user_id: number;
  shared_contact_id: number;
  selected_choices: string[];
  slider_answer?: number;
  text_answer?: string;
  notes?: string;
  created_at: string;
}

export const getAnswers = async (questionId: number): Promise<IdAnswer[]> => {
  return apiGet<IdAnswer[]>(`/identification/questions/${questionId}/answers`);
};

export interface AnswerWithDetails extends IdAnswer {
  question_title: string;
  question_text: string;
  response_type: string;
  contact_first_name: string;
  contact_last_name: string;
  contact_phone: string;
  user_name: string;
  user_email: string;
}

export interface AnswersFilter {
  user_id?: string;
  contact_id?: string;
  question_id?: string;
  response_type?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export const getAllAnswers = async (filters: AnswersFilter = {}): Promise<{ data: AnswerWithDetails[], total: number }> => {
  const params = new URLSearchParams();
  
  // Add all filters to params
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value.toString());
    }
  });
  
  const response = await api.get<{ data: AnswerWithDetails[], total: number }>(
    `/identification/answers?${params.toString()}`
  );
  return response.data;
};
