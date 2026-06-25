import { Submission } from './api';
import { CheckpointAccordionItem, SnippetMatch } from '@/components/GradingAccordion';

function parseSnippets(
  raw: Array<{ file?: string; line: number; snippet: string } | string>,
): SnippetMatch[] {
  return raw.map((s) => (typeof s === 'string' ? JSON.parse(s) : s));
}

export function mapCheckpointResultsToAccordionItems(
  gradingResult: NonNullable<Submission['gradingResult']>,
): CheckpointAccordionItem[] {
  const hasRegex = gradingResult.passedCheckpoints != null;
  return (gradingResult.checkpointResults ?? []).map((cr) => ({
    checkpointId: cr.checkpointId,
    checkpointResultId: cr.id,
    checkpointDescription: cr.checkpointDescription,
    teacherAccepted: cr.teacherAccepted,
    ...(hasRegex && {
      regexMatched: cr.matched,
      regexSnippets: parseSnippets(cr.matchedSnippets),
      regexFailureExplanation: cr.regexFailureExplanation,
    }),
    ...(cr.llmMatched !== undefined && {
      llmMatched: cr.llmMatched,
      llmSnippets: parseSnippets(cr.llmMatchedSnippets ?? []),
      llmFailureExplanation: cr.llmFailureExplanation,
    }),
  }));
}

export const darkSelectStyles = {
  control: (base: any) => ({
    ...base,
    backgroundColor: '#2D3748',
    borderColor: '#4A5568',
    color: '#E2E8F0',
    '&:hover': { borderColor: '#718096' },
    boxShadow: 'none',
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: '#2D3748',
    border: '1px solid #4A5568',
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isFocused ? '#4A5568' : '#2D3748',
    color: '#E2E8F0',
    '&:active': { backgroundColor: '#4A5568' },
  }),
  singleValue: (base: any) => ({ ...base, color: '#E2E8F0' }),
  multiValue: (base: any) => ({ ...base, backgroundColor: '#4A5568' }),
  multiValueLabel: (base: any) => ({ ...base, color: '#E2E8F0' }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: '#A0AEC0',
    '&:hover': { backgroundColor: '#718096', color: 'white' },
  }),
  placeholder: (base: any) => ({ ...base, color: '#718096' }),
  input: (base: any) => ({ ...base, color: '#E2E8F0' }),
  noOptionsMessage: (base: any) => ({ ...base, color: '#718096' }),
  clearIndicator: (base: any) => ({ ...base, color: '#A0AEC0', '&:hover': { color: '#E2E8F0' } }),
  dropdownIndicator: (base: any) => ({ ...base, color: '#A0AEC0', '&:hover': { color: '#E2E8F0' } }),
  indicatorSeparator: (base: any) => ({ ...base, backgroundColor: '#4A5568' }),
};