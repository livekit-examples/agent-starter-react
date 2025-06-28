'use client';

import { ReactNode } from 'react';
import { toast as sonnerToast } from 'sonner';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface ToastProps {
  id: string | number;
  title: ReactNode;
  description: ReactNode;
}

export function toastAlert(toast: Omit<ToastProps, 'id'>) {
  return sonnerToast.custom(
    (id) => <AlertToast id={id} title={toast.title} description={toast.description} />,
    { duration: 10_000 }
  );
}

function AlertToast(props: ToastProps) {
  const { title, description, id } = props;

  return (
    <Alert onClick={() => sonnerToast.dismiss(id)} className="bg-accent">
      <WarningIcon weight="bold" />
      <AlertTitle>{title}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
    </Alert>
  );
}
