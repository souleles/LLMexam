import { Button, ButtonProps } from '@chakra-ui/react';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps extends Omit<ButtonProps, 'onClick' | 'leftIcon' | 'variant'> {
  buttonText: string;
  navigationUrl: string;
}

export function BackButton({ buttonText, navigationUrl, ...rest }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (navigationUrl === '-1') {
      navigate(-1);
    } else {
      navigate(navigationUrl);
    }
  };

  return (
    <Button leftIcon={<FiArrowLeft />} variant="outline" onClick={handleClick} {...rest}>
      {buttonText}
    </Button>
  );
}
