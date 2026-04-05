import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@chakra-ui/react';
import { Layout } from '@/components/Layout';
import { NewExercisePage } from './pages/NewExercisePage';
import { ExerciseDetailPage } from './pages/ExerciseDetailPage';
import { StudentExercisesPage } from './pages/StudentExercisesPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { StudentsPage } from './pages/StudentsPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { StudentSubmissionDetailPage } from './pages/StudentSubmissionDetailPage';
import { LoginPage } from './pages/LoginPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import UnprotectedRoute from './components/Auth/UnprotectedRoute';

function App() {
  return (
    <Box minH="100vh" bg="gray.50">
      <Routes>
        <Route path="login" element={<UnprotectedRoute><LoginPage /></UnprotectedRoute>} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/exercises" replace />} />
          <Route path="exercises" element={<ProtectedRoute><ExercisesPage /></ProtectedRoute>} />
          <Route path="exercises/new" element={<ProtectedRoute><NewExercisePage /></ProtectedRoute>} />
          <Route path="exercises/:exerciseId" element={<ProtectedRoute><ExerciseDetailPage /></ProtectedRoute>} />
          <Route path="student-exercises" element={<ProtectedRoute><StudentExercisesPage /></ProtectedRoute>} />
          <Route path="student-exercises/:submissionId" element={<ProtectedRoute><StudentSubmissionDetailPage /></ProtectedRoute>} />
          <Route path="students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
          <Route path="students/:studentId" element={<ProtectedRoute><StudentDetailPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </Box>
  );
}

export default App;
