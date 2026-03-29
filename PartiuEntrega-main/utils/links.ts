import { Linking } from 'react-native';

export function openWaze(address: string, number: string, city: string, state: string) {
  const query = encodeURIComponent(`${address}, ${number}, ${city}, ${state}`);
  const url = `https://waze.com/ul?q=${query}&navigate=yes`;
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
