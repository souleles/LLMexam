import { Box, VStack, Text, Icon, useToast } from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { FiUpload, FiFile } from 'react-icons/fi';

interface FileUploaderProps {
  accept?: string;
  maxFiles?: number;
  onFilesSelected: (files: File[]) => void;
}

export function FileUploader({ accept = '*', maxFiles = 10, onFilesSelected }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const toast = useToast();

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;

      const filesArray = Array.from(newFiles);
      if (filesArray.length > maxFiles) {
        toast({
          title: 'Πάρα πολλά αρχεία',
          description: `Επιτρέπονται μέχρι ${maxFiles} αρχεί${maxFiles > 1 ? 'α' : 'ο'}`,
          status: 'warning',
          duration: 3000,
        });
        return;
      }

      // Validate file types
      if (accept !== '*') {
        const allowedTypes = accept.split(',').map((t) => t.trim());
        const invalidFiles = filesArray.filter(
          (file) => !allowedTypes.some((type) => file.name.endsWith(type.replace('*', '')))
        );
        if (invalidFiles.length > 0) {
          toast({
            title: 'Μη έγκυρος τύπος αρχείου',
            description: `Επιτρέπονται μόνο αρχεία ${accept}`,
            status: 'warning',
            duration: 3000,
          });
          return;
        }
      }

      setFiles(filesArray);
      onFilesSelected(filesArray);
    },
    [accept, maxFiles, onFilesSelected, toast]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <Box>
      <label htmlFor="file-upload">
        <Box
          border="2px dashed"
          borderColor={dragActive ? 'brand.400' : 'gray.600'}
          borderRadius="lg"
          p={8}
          textAlign="center"
          cursor="pointer"
          bg={dragActive ? 'gray.700' : 'gray.750'}
          transition="all 0.2s"
          _hover={{ borderColor: 'brand.400', bg: 'gray.700' }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <VStack spacing={3}>
            <Icon as={FiUpload} boxSize={10} color="gray.500" />
            <Text fontWeight="medium">
              Σύρετε αρχεία εδώ ή κάντε κλικ για αναζήτηση
            </Text>
            <Text fontSize="sm" color="gray.500">
              {accept !== '*' ? `Αποδεκτά: ${accept}` : 'Όλοι οι τύποι αρχείων γίνονται δεκτοί'}
              {maxFiles > 1 && ` • Μέχρι ${maxFiles} αρχεία`}
            </Text>
          </VStack>
        </Box>
      </label>
      <input
        id="file-upload"
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.currentTarget.value = '';
        }}
        style={{ display: 'none' }}
      />

      {files.length > 0 && (
        <VStack align="start" mt={4} spacing={2}>
          {files.map((file, idx) => (
            <Box
              key={idx}
              p={3}
              bg="gray.700"
              borderRadius="md"
              w="full"
              display="flex"
              alignItems="center"
            >
              <Icon as={FiFile} mr={2} />
              <Text fontSize="sm" flex={1}>
                {file.name}
              </Text>
              <Text fontSize="xs" color="gray.400">
                {(file.size / 1024).toFixed(1)} KB
              </Text>
            </Box>
          ))}
        </VStack>
      )}
    </Box>
  );
}
