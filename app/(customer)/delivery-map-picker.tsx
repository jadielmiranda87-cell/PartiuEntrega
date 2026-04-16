/**
 * Fallback exigido pelo Expo Router (rota com specificity 0) quando existem
 * `delivery-map-picker.web.tsx` e `delivery-map-picker.native.tsx`.
 * O Metro resolve `.web` / `.native` antes deste arquivo; não importe react-native-maps aqui.
 */
export { default } from './delivery-map-picker.web';
