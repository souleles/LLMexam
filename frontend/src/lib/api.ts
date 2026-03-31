import { httpClient } from './httpClient';

export enum ExerciseStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
}

export interface Exercise {
  id: string;
  title: string;
  originalPdfPath: string;
  extractedText?: string;
  status: ExerciseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Checkpoint {
  id: string;
  exerciseId: string;
  description: string;
  pattern: string;
  caseSensitive: boolean;
  order: number;
}

export interface ConversationMessage {
  id: string;
  exerciseId: string;
  role: 'professor' | 'assistant';
  content: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  exerciseId: string;
  studentIdentifier: string;
  studentName?: string;
  originalFilePath: string;
  extractedText?: string;
  createdAt: string;
}

export interface GradingResult {
  id: string;
  submissionId: string;
  checkpointId: string;
  checkpointDescription: string;
  matched: boolean;
  confidence: number;
  matchedPatterns: string[];
  matchedSnippets: Array<{
    line: number;
    snippet: string;
  }>;
}

// API client
export const api = {
  exercises: {
    list: async (): Promise<Exercise[]> => {
      const { data } = await httpClient.get('/api/exercises');
      return data;
    },
    get: async (id: string): Promise<Exercise> => {
      const { data } = await httpClient.get(`/api/exercises/${id}`);
      return data;
    },
    create: async (file: File, title: string): Promise<Exercise> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      const { data } = await httpClient.post('/api/exercises/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    delete: async (id: string): Promise<void> => {
      await httpClient.delete(`/api/exercises/${id}`);
    },
    approve: async (id: string): Promise<Exercise> => {
      const { data } = await httpClient.patch(`/api/exercises/${id}/approve`);
      return data;
    },
  },
  checkpoints: {
    list: async (exerciseId: string): Promise<Checkpoint[]> => {
      const { data } = await httpClient.get(`/api/checkpoints?exerciseId=${exerciseId}`);
      return data;
    },
    approve: async (exerciseId: string): Promise<void> => {
      await httpClient.post(`/api/checkpoints/approve`, { exerciseId });
    },
    bulkReplace: async (
      exerciseId: string,
      checkpoints: Pick<Checkpoint, 'order' | 'description' | 'pattern' | 'caseSensitive'>[],
    ): Promise<Checkpoint[]> => {
      const { data } = await httpClient.post(`/api/checkpoints/bulk/${exerciseId}`, checkpoints);
      return data;
    },
    bulkUpdatePatterns: async (
      exerciseId: string,
      patterns: { order: number; pattern: string }[],
    ): Promise<Checkpoint[]> => {
      const { data } = await httpClient.patch(`/api/checkpoints/bulk-patterns/${exerciseId}`, patterns);
      return data;
    },
  },
  conversations: {
    list: async (exerciseId: string): Promise<ConversationMessage[]> => {
      const { data } = await httpClient.get(`/api/conversations?exerciseId=${exerciseId}`);
      return data;
    },
    listByType: async (exerciseId: string, type: 'CHECKPOINT' | 'PATTERN'): Promise<ConversationMessage[]> => {
      const { data } = await httpClient.get(`/api/conversations?exerciseId=${exerciseId}&type=${type}`);
      return data;
    },
  },
  submissions: {
    upload: async (exerciseId: string, files: File[]): Promise<Submission[]> => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      formData.append('exerciseId', exerciseId);
      const { data } = await httpClient.post('/api/submissions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    uploadSingle: async (
      exerciseId: string,
      file: File,
      studentId: string,
      studentName: string
    ): Promise<Submission> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('exerciseId', exerciseId);
      formData.append('studentIdentifier', studentId);
      formData.append('studentName', studentName);
      const { data } = await httpClient.post('/api/submissions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    list: async (exerciseId: string): Promise<Submission[]> => {
      const { data } = await httpClient.get(`/api/submissions?exerciseId=${exerciseId}`);
      return data;
    },
  },  grading: {
    grade: async (submissionId: string): Promise<GradingResult[]> => {
      const { data } = await httpClient.post(`/api/grading/${submissionId}`);
      return data;
    },
    gradeSubmission: async (submissionId: string): Promise<GradingResult[]> => {
      const { data } = await httpClient.post(`/api/grading/submission/${submissionId}`);
      return data;
    },
    getResults: async (exerciseId: string): Promise<GradingResult[]> => {
      const { data } = await httpClient.get(`/api/grading/results?exerciseId=${exerciseId}`);
      return data;
    },
    saveResults: async (results: GradingResult[]): Promise<void> => {
      await httpClient.post('/api/grading/results', results);
    },
  },
};
