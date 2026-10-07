import { Card, Stack, Text } from './ui';

/** A holding page while the screens land. Replaced by the app shell. */
export function App() {
  return (
    <Stack gap="lg" align="center">
      <Card>
        <Stack gap="sm">
          <Text variant="display">Tagwise</Text>
          <Text variant="body" tone="secondary">
            A shared register for an organisation&apos;s assets and stock. The prototype is being built.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
