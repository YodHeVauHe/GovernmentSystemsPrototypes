import { MDAS_LIST, type MDA } from '@/context/UserContext';

export function getMdaById(mdaId?: string | null): MDA | undefined {
  return MDAS_LIST.find(mda => mda.id === mdaId);
}

export function getMdaShortName(mdaId?: string | null): string {
  return getMdaById(mdaId)?.shortName || 'MDA';
}

export function getMdaDisplayName(mdaId?: string | null): string {
  const mda = getMdaById(mdaId);
  return mda ? `${mda.name} (${mda.shortName})` : 'Unknown MDA';
}
