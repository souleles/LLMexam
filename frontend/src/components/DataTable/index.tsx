import {
  Box,
  Button,
  Card,
  CardBody,
  HStack,
  IconButton,
  Select,
  Skeleton,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react';
import { useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export interface Column {
  label: string;
  width?: string;
}

interface PaginationOptions {
  defaultPageSize?: number;
  pageSizeOptions?: number[];
}

interface DataTableProps<T> {
  columns: Column[];
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  isLoading?: boolean;
  skeletonRows?: number;
  emptyText: string;
  emptySubtext?: string;
  pagination?: PaginationOptions;
}

export function DataTable<T>({
  columns,
  data,
  renderRow,
  isLoading = false,
  skeletonRows = 3,
  emptyText,
  emptySubtext,
  pagination,
}: DataTableProps<T>) {
  const defaultPageSize = pagination?.defaultPageSize ?? 10;
  const pageSizeOptions = pagination?.pageSizeOptions ?? [10, 25, 50];

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = pagination
    ? data.slice((page - 1) * pageSize, page * pageSize)
    : data;

  if (isLoading) {
    return (
      <Card>
        <CardBody p={0}>
          <Table variant="simple">
            <Thead>
              <Tr>
                {columns.map((col, i) => (
                  <Th key={i} width={col.width}>{col.label}</Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <Tr key={rowIndex}>
                  {columns.map((_, colIndex) => (
                    <Td key={colIndex}>
                      <Skeleton height="20px" />
                    </Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardBody>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardBody textAlign="center" py={12}>
          <VStack spacing={2}>
            <Text fontSize="lg" color="gray.400">{emptyText}</Text>
            {emptySubtext && <Text color="gray.500">{emptySubtext}</Text>}
          </VStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody p={0}>
        <Table variant="simple">
          <Thead>
            <Tr>
              {columns.map((col, i) => (
                <Th key={i} width={col.width}>{col.label}</Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {paginatedData.map((item, index) =>
              renderRow(item, (page - 1) * pageSize + index)
            )}
          </Tbody>
        </Table>

        {pagination && totalPages > 1 && (
          <Box px={4} py={3} borderTopWidth="1px" borderColor="gray.700">
            <HStack justify="space-between" align="center">
              <HStack spacing={2}>
                <Text fontSize="sm" color="gray.400">Ανά σελίδα:</Text>
                <Select
                  size="sm"
                  width="70px"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </Select>
              </HStack>

              <HStack spacing={2}>
                <Text fontSize="sm" color="gray.400">
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.length)} από {data.length}
                </Text>
                <IconButton
                  aria-label="Προηγούμενη σελίδα"
                  icon={<FiChevronLeft />}
                  size="sm"
                  variant="ghost"
                  isDisabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                />
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <Text key={`ellipsis-${i}`} fontSize="sm" color="gray.500" px={1}>…</Text>
                    ) : (
                      <Button
                        key={p}
                        size="sm"
                        variant={page === p ? 'solid' : 'ghost'}
                        colorScheme={page === p ? 'brand' : undefined}
                        onClick={() => setPage(p as number)}
                        minW="32px"
                      >
                        {p}
                      </Button>
                    )
                  )}
                <IconButton
                  aria-label="Επόμενη σελίδα"
                  icon={<FiChevronRight />}
                  size="sm"
                  variant="ghost"
                  isDisabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                />
              </HStack>
            </HStack>
          </Box>
        )}
      </CardBody>
    </Card>
  );
}
