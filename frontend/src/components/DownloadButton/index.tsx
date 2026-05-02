import { Button, ButtonProps, Link } from '@chakra-ui/react';
import { FiDownload } from 'react-icons/fi';

interface DownloadButtonProps extends Omit<ButtonProps, 'leftIcon'> {
  url: string;
  label?: string;
}

export function DownloadButton({ url, label = 'Λήψη', ...rest }: DownloadButtonProps) {
  return (
    <Link href={url} download>
      <Button leftIcon={<FiDownload />} size="sm" variant="outline" {...rest}>
        {label}
      </Button>
    </Link>
  );
}
