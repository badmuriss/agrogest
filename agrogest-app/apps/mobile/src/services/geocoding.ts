import { Platform } from 'react-native';

import type { Position } from '@/domain/geo';

export interface Place {
  id: string;
  /** Nome curto (cidade, fazenda, rodovia...). */
  name: string;
  /** Resto do endereço, para diferenciar resultados parecidos. */
  detail: string;
  position: Position;
  /** [oeste, sul, leste, norte], quando o lugar tem extensão (município, distrito). */
  bounds: [number, number, number, number] | null;
}

/** Retângulo do Brasil para o Photon priorizar resultados daqui: [oeste, sul, leste, norte]. */
const BRAZIL_BBOX = '-74,-34,-34,6';

/**
 * Nominatim exige um User-Agent que identifique o app. No Android o padrão ("okhttp/...") é
 * recusado com 403; no navegador o cabeçalho é proibido e quem identifica é o Referer.
 */
const NOMINATIM_HEADERS: Record<string, string> =
  Platform.OS === 'web' ? { Accept: 'application/json' } : { Accept: 'application/json', 'User-Agent': 'AgroGest/0.1 (app de gestão pecuária)' };

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id: number;
    osm_type: string;
    name?: string;
    city?: string;
    county?: string;
    district?: string;
    state?: string;
    countrycode?: string;
    /** [oeste, norte, leste, sul] */
    extent?: [number, number, number, number];
  };
}

interface NominatimHit {
  place_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
}

/** Photon (Komoot, dados do OpenStreetMap): grátis, sem chave e feito para busca em apps. */
async function searchPhoton(query: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, limit: '8', lang: 'default', bbox: BRAZIL_BBOX });
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(`photon ${response.status}`);
  const { features } = (await response.json()) as { features: PhotonFeature[] };
  return features
    .filter((f) => (f.properties.countrycode ?? 'BR').toUpperCase() === 'BR' && f.properties.name)
    .slice(0, 6)
    .map((f) => {
      const { name, city, county, district, state, extent } = f.properties;
      const local = [district, city ?? county].filter((part) => part && part !== name);
      return {
        id: `${f.properties.osm_type}${f.properties.osm_id}`,
        name: name!,
        detail: [...new Set([...local, state])].filter(Boolean).join(', '),
        position: f.geometry.coordinates,
        bounds: extent ? [extent[0], extent[3], extent[2], extent[1]] : null,
      };
    });
}

/** Nominatim (OpenStreetMap): reserva quando o Photon falha. */
async function searchNominatim(query: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '6', countrycodes: 'br', 'accept-language': 'pt-BR' });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: NOMINATIM_HEADERS, signal });
  if (!response.ok) throw new Error(`nominatim ${response.status}`);
  const hits = (await response.json()) as NominatimHit[];
  return hits.map((hit) => {
    // "Região Sudeste" e "Brasil" não ajudam a escolher entre resultados.
    const [first, ...rest] = hit.display_name.split(', ').filter((part) => part !== 'Brasil' && !part.startsWith('Região '));
    const box = hit.boundingbox?.map(Number);
    return {
      id: String(hit.place_id),
      name: hit.name || first,
      detail: (hit.name && hit.name !== first ? [first, ...rest] : rest).filter((part) => !/^\d{5}-?\d{3}$/.test(part)).slice(0, 3).join(', '),
      position: [Number(hit.lon), Number(hit.lat)],
      // Nominatim devolve [sul, norte, oeste, leste].
      bounds: box && box.every(Number.isFinite) ? [box[2], box[0], box[3], box[1]] : null,
    };
  });
}

/** Busca de lugares no Brasil. Só ao confirmar: nenhum dos serviços grátis quer busca a cada letra. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  if (!LOCAL_MAP_SEARCH) throw new Error('Busca de lugares remota desativada nesta versão local. Informe a cidade manualmente.');
  const text = query.trim();
  try {
    const places = await searchPhoton(text, signal);
    if (places.length > 0) return places;
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  try {
    return await searchNominatim(text, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('A busca de lugares não respondeu. Confira a internet e tente de novo.');
  }
}

const LOCAL_MAP_SEARCH = false;
