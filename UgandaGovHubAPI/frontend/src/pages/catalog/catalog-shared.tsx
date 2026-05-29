import { useCallback, useState } from 'react';
import {
  IconBuildingBank,
  IconCar,
  IconCashBanknote,
  IconCertificate,
  IconHeartbeat,
  IconId,
  IconNetwork,
  IconShoppingCart,
} from '@tabler/icons-react';
import {
  readCatalogViewModePreference,
  writeCatalogViewModePreference,
  type CatalogViewMode,
} from '../catalog-view-helpers';

export function SectorBadge({ sector }: { sector: string }) {
  const value = sector || 'MDA API';
  const normalized = value.toLowerCase();
  const Icon =
    normalized.includes('identity') ? IconId :
    normalized.includes('transport') ? IconCar :
    normalized.includes('finance') || normalized.includes('tax') ? IconCashBanknote :
    normalized.includes('commerce') || normalized.includes('business') ? IconCertificate :
    normalized.includes('health') ? IconHeartbeat :
    normalized.includes('procurement') ? IconShoppingCart :
    normalized.includes('integration') ? IconNetwork :
    IconBuildingBank;

  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[11px] font-medium text-[#b5b5b5]">
      <Icon className="size-3.5 text-[#3ecf8e]" />
      {value}
    </span>
  );
}

export function sensitivityBadgeClass(value?: string | null) {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('high')) return 'border-red-400/25 bg-red-400/5 text-red-300';
  if (normalized.includes('medium')) return 'border-amber-400/25 bg-amber-400/5 text-amber-300';
  if (normalized.includes('low')) return 'border-[#3ecf8e]/25 bg-[#3ecf8e]/5 text-[#3ecf8e]';
  return 'border-[#2e2e2e] bg-[#141414] text-[#b5b5b5]';
}

const APPEALABLE_API_KEY_STATUSES = new Set(['REVOKED', 'DELETED']);

function isAppealableAccessRequest(request: any) {
  return request.status === 'APPROVED' && APPEALABLE_API_KEY_STATUSES.has(String(request.api_key_status || '').toUpperCase());
}

function getCatalogViewModeStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readInitialCatalogViewMode() {
  const storage = getCatalogViewModeStorage();
  return storage ? readCatalogViewModePreference(storage) : 'list';
}

export function useCatalogViewModePreference() {
  const [viewMode, setViewMode] = useState<CatalogViewMode>(() => readInitialCatalogViewMode());

  const setPreferredViewMode = useCallback((nextViewMode: CatalogViewMode) => {
    setViewMode(nextViewMode);

    const storage = getCatalogViewModeStorage();
    if (storage) {
      writeCatalogViewModePreference(storage, nextViewMode);
    }
  }, []);

  return [viewMode, setPreferredViewMode] as const;
}

function isBlockingAccessRequest(request: any) {
  if (request.status === 'PENDING') return true;
  if (request.status !== 'APPROVED') return false;
  return !isAppealableAccessRequest(request);
}

export function isAccessRequestForConsumer(request: any, apiId: string, mdaId: string, userId?: string) {
  if (request.api_id !== apiId) return false;
  if (mdaId) return request.consumer_mda_id === mdaId;
  return Boolean(userId && request.consumer_user_id === userId);
}

export function getRequestAccessButtonState(requests: any[]) {
  const blockingRequest = requests.find(isBlockingAccessRequest);
  if (blockingRequest) {
    return {
      disabled: true,
      label: blockingRequest.status === 'PENDING' ? 'Request pending review' : 'Access approved',
      title: blockingRequest.status === 'PENDING'
        ? 'You already have a pending request for this API.'
        : 'You already have approved access for this API.',
    };
  }

  if (requests.some(isAppealableAccessRequest)) {
    return {
      disabled: false,
      label: 'Appeal request',
      title: 'Submit a new request after an administrator revoked or deleted prior access.',
    };
  }

  return {
    disabled: false,
    label: 'Request Access',
    title: 'Request governed sandbox access for this API.',
  };
}
