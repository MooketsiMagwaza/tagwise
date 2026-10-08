import { ButtonLink, Stack, Text } from '../ui';
import { Logo } from '../app/bits';

/** Interim landing page; the full one arrives with TW-12. */
export default function Landing() {
  return (
    <Stack gap="lg" align="start">
      <Logo />
      <Text variant="display">A shared register for your assets and stock.</Text>
      <ButtonLink href="/app">Open the demo workspace</ButtonLink>
    </Stack>
  );
}
