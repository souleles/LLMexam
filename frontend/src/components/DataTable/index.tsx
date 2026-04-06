import {
  Card,
  CardBody,
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

export interface Column {
  label: string;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column[];
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  isLoading?: boolean;
  skeletonRows?: number;
  emptyText: string;
  emptySubtext?: string;
}

export function DataTable<T>({
  columns,
  data,
  renderRow,
  isLoading = false,
  skeletonRows = 3,
  emptyText,
  emptySubtext,
}: DataTableProps<T>) {
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
            {data.map((item, index) => renderRow(item, index))}
          </Tbody>
        </Table>
      </CardBody>
    </Card>
  );
}
