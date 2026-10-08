import { Card, Text } from '../ui';
import { Link, navigate } from '../lib/router';
import { useToast } from '../lib/toast';
import { repo, useLookups, useMe } from '../data/hooks';
import { ScreenHeader } from '../app/bits';
import { AssetForm } from '../app/AssetForm';

export default function AssetNew() {
  const { me, can } = useMe();
  const l = useLookups();
  const toast = useToast();
  const firstSite = Array.from(l.sites.keys())[0];

  if (!can('asset.create')) {
    return (
      <Card>
        <Text>Your role cannot add assets. Ask an editor or an admin.</Text>
      </Card>
    );
  }

  return (
    <>
      <ScreenHeader
        eyebrow={
          <>
            <Link href="/app/assets">Assets</Link> / <span>New</span>
          </>
        }
        title="Add an asset"
        subtitle="It gets the next free tag. Print its label from the next page."
      />
      <Card>
        {firstSite && (
          <AssetForm
            initial={{ name: '', category: '', siteId: firstSite, status: 'available' }}
            submitLabel="Add asset"
            onCancel={() => navigate('/app/assets')}
            onSubmit={async (d) => {
              if (!me) return;
              const created = await repo().createAsset({ ...d }, me.id);
              toast.push(`Added ${created.tag}`);
              navigate(`/app/assets/${created.tag}`, { replace: true });
            }}
          />
        )}
      </Card>
    </>
  );
}
