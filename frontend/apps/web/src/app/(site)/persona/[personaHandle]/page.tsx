import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  buildPersonaAppUrl,
  buildPersonaPath,
  buildPersonaShareUrl,
} from '@pantopus/utils';
import {
  buildShareMetadata,
  fetchPublicPersona,
  getStoreDownloadCta,
  summarizeText,
} from '@/lib/publicShare';
import AudienceProfileClient from './AudienceProfileClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ personaHandle: string }>;
}): Promise<Metadata> {
  const { personaHandle } = await params;
  const result = await fetchPublicPersona(personaHandle);
  const persona = result.data?.persona;

  if (!persona) {
    return {
      title: 'Beacon Not Found | Pantopus',
      description: 'This Pantopus Beacon could not be found.',
    };
  }

  return buildShareMetadata({
    title: persona.displayName,
    description: summarizeText(persona.bio, 160, `${persona.displayName} on Pantopus.`),
    path: buildPersonaPath(persona.handle),
    appArgument: buildPersonaAppUrl(persona.handle),
    images: persona.avatarUrl ? [persona.avatarUrl] : null,
  });
}

export default async function AudienceProfilePage({
  params,
}: {
  params: Promise<{ personaHandle: string }>;
}) {
  const { personaHandle } = await params;
  const result = await fetchPublicPersona(personaHandle);

  if (!result.data) {
    notFound();
  }

  const userAgent = (await headers()).get('user-agent') || '';
  const storeCta = getStoreDownloadCta(userAgent);
  const handle = result.data.persona.handle;

  return (
    <AudienceProfileClient
      initialPersona={result.data.persona}
      initialChannel={result.data.channel}
      appUrl={buildPersonaAppUrl(handle)}
      linkHref={buildPersonaShareUrl(handle)}
      fallbackUrl={storeCta?.href ?? null}
      storeCta={storeCta}
    />
  );
}
