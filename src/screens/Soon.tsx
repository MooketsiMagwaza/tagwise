import { Hammer } from 'lucide-react';
import { Card, EmptyState } from '../ui';
import { navigate } from '../lib/router';

/** Shown for a page that is not built yet, so a link never dead-ends. */
export default function Soon() {
  return (
    <Card>
      <EmptyState
        icon={<Hammer size={28} />}
        title="This page is not built yet"
        hint="It is on the work-order list. Everything on the home page works with the sample data."
        action={{ label: 'Back to home', onClick: () => navigate('/app') }}
      />
    </Card>
  );
}
