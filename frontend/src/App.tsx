import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@chakra-ui/react';
import { Layout } from '@/components/Layout';
import { NewExercisePage } from './pages/NewExercisePage';
import { ExerciseDetailPage } from './pages/ExerciseDetailPage';
import { StudentExercisesPage } from './pages/StudentExercisesPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { StudentsPage } from './pages/StudentsPage';
import { StudentDetailPage } from './pages/StudentDetailPage';

function App() {
  return (
    <Box minH="100vh" bg="gray.50">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/exercises" replace />} />
          <Route path="exercises" element={<ExercisesPage />} />          <Route path="exercises/new" element={<NewExercisePage />} />
          <Route path="exercises/:exerciseId" element={<ExerciseDetailPage />} />
          <Route path="student-exercises" element={<StudentExercisesPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:studentId" element={<StudentDetailPage />} />
        </Route>
      </Routes>
    </Box>
  );
}

export default App;
