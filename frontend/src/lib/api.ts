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
  studentId: string;
  student: {
    studentIdentifier: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
  fileName: string;
  fileUrl: string;
  fileType: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  gradingResult?: {
    id: string;
    score: number;
    passed: boolean;
    totalCheckpoints: number;
    passedCheckpoints: number;
  };
}

export interface Student {
  id: string;
  studentIdentifier: string;
  firstName: string;
  lastName: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentSubmission {
  id: string;
  exerciseId: string;
  exerciseTitle: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  createdAt: string;
  students: Array<{
    id: string;
    studentIdentifier: string;
    firstName: string;
    lastName: string;
    email: string | null;
  }>;
  gradingResult: {
    id: string;
    totalCheckpoints: number;
    passedCheckpoints: number;
    score: number;
    teacherScore?: number;
    passed: boolean;
    gradedAt: string;
    checkpointResults: Array<{
      id: string;
      checkpointId: string;
      checkpointDescription: string;
      checkpointOrder: number;
      matched: boolean;
      matchedSnippets: string[];
    }>;
  } | null;
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
    file?: string;
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
    listByType: async (exerciseId: string, type: 'CHECKPOINT' | 'PATTERN'): Promise<ConversationMessage[]> => {
      const { data } = await httpClient.get(`/api/conversations?exerciseId=${exerciseId}&type=${type}`);
      return data;
    },
  },  
  submissions: {
    uploadAndGrade: async (
      exerciseId: string,
      studentIds: string[],
      file: File,
    ): Promise<GradingResult[]> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('exerciseId', exerciseId);
      studentIds.forEach((id) => formData.append('studentId', id));
      const { data } = await httpClient.post('/api/submissions/upload-and-grade', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    list: async (exerciseId: string): Promise<Submission[]> => {
      const { data } = await httpClient.get(`/api/submissions?exerciseId=${exerciseId}`);
      return data;
    },
  },  
  students: {
    list: async (): Promise<Student[]> => {
      const { data } = await httpClient.get('/api/students');
      return data;
    },
    get: async (id: string): Promise<Student> => {
      const { data } = await httpClient.get(`/api/students/${id}`);
      return data;
    },
    getSubmissions: async (id: string): Promise<StudentSubmission[]> => {
      const { data } = await httpClient.get(`/api/students/${id}/submissions`);
      return data;
    },
    upload: async (file: File): Promise<Student[]> => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await httpClient.post('/api/students/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
  },
  grading: {
    getResults: async (exerciseId: string): Promise<GradingResult[]> => {
      const { data } = await httpClient.get(`/api/grading/results?exerciseId=${exerciseId}`);
      return data;
    },
    saveResults: async (results: GradingResult[]): Promise<void> => {
      await httpClient.post('/api/grading/results', results);
    },
    updateTeacherScore: async (submissionId: string, teacherScore: number): Promise<void> => {
      await httpClient.patch(`/api/grading/submission/${submissionId}/teacher-score`, {
        teacherScore,
      });
    },
  },
};
