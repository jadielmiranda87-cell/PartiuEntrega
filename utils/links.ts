import { Alert, Linking } from 'react-native';

/** Dados para montar uma busca precisa no Waze (evita confundir com outro endereço parecido). */
export type WazeDestination = {
  /** Nome do local (ex.: comércio) — ajuda o Waze a achar o POI certo */
  placeName?: string;
  address: string;
  number?: string;
  neighborhood?: string;
  city: string;
  state: string;
  cep?: string;
};

export function openEmail(email: string, subject?: string, body?: string) {
  let url = `mailto:${email}`;
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  if (params.length) url += `?${params.join('&')}`;
  Linking.openURL(url);
}

function buildWazeQuery(dest: WazeDestination): string {
  const parts: string[] = [];
  const name = dest.placeName?.trim();
  if (name) parts.push(name);

  const street = [dest.address?.trim(), dest.number?.trim()].filter(Boolean).join(', ');
  if (street) parts.push(street);

  const nb = dest.neighborhood?.trim();
  if (nb) parts.push(nb);

  const city = dest.city?.trim();
  const state = dest.state?.trim();
  if (city && state) parts.push(`${city} - ${state}`);
  else if (city) parts.push(city);
  else if (state) parts.push(state);

  const cep = dest.cep?.replace(/\D/g, '');
  if (cep && cep.length >= 8) parts.push(`CEP ${cep}`);

  return parts.join(', ');
}

export function openWaze(dest: WazeDestination) {
  const q = buildWazeQuery(dest);
  if (!q.trim()) {
    Alert.alert('Endereço incompleto', 'Não há dados suficientes para abrir o Waze.');
    return;
  }
  const url = `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
  Linking.openURL(url);
}

export function openWhatsApp(phone: string, message?: string) {
  const cleaned = phone.replace(/\D/g, '');
  const withCountry = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  const msg = message ? encodeURIComponent(message) : '';
  const url = `https://wa.me/${withCountry}${msg ? `?text=${msg}` : ''}`;
  Linking.openURL(url);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}
