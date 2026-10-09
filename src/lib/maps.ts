import { Linking } from 'react-native';
import type { DriverStop } from '@/features/routes/model';

export function formatAddress(stop: DriverStop): string {
  const { street, number, complement, district, city, state } = stop.address;
  const linha = [`${street}, ${number}`, complement].filter(Boolean).join(' — ');
  return `${linha} · ${district}, ${city}/${state}`;
}

/**
 * Link universal do Google Maps para navegar até a parada.
 *
 * No Android e no iOS abre o aplicativo do Google Maps quando instalado, e o
 * navegador quando não. Usa a coordenada resolvida na roteirização; sem ela,
 * cai no endereço por extenso.
 */
export function navigationUrl(stop: DriverStop): string {
  const destination =
    stop.latitude != null && stop.longitude != null
      ? `${stop.latitude},${stop.longitude}`
      : `${stop.address.street}, ${stop.address.number}, ${stop.address.district}, ${stop.address.city} - ${stop.address.state}`;

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export async function openNavigation(stop: DriverStop): Promise<void> {
  await Linking.openURL(navigationUrl(stop));
}

export async function openPhone(phone: string): Promise<void> {
  await Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
}
