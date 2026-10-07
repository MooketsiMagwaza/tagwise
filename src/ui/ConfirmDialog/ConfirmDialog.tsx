import { useState, type ReactNode } from 'react';
import { Button } from '../Button/Button';
import { TextField } from '../Field/Field';
import { Form, Row } from '../Layout/Layout';
import { Modal } from '../Modal/Modal';
import { Text } from '../Text/Text';

/** The confirmation every destructive action goes through. For the most
 *  serious ones, `requireText` makes the user type a word before the
 *  confirm button enables. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = 'default',
  requireText,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  requireText?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const ready = !requireText || typed.trim().toLowerCase() === requireText.toLowerCase();
  return (
    <Modal title={title} size="sm" onClose={onCancel}>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) onConfirm();
        }}
      >
        <Text tone="secondary">{message}</Text>
        {requireText && (
          <TextField
            label={`Type "${requireText}" to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        )}
        <Row justify="end">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant={tone === 'danger' ? 'danger' : 'primary'} disabled={!ready || busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </Row>
      </Form>
    </Modal>
  );
}
