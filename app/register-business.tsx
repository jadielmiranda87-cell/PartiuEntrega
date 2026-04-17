import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useAlert } from '@/template';
import { createBusinessProfile, syncBusinessCoordinates } from '@/services/businessService';
import { getMotoboyByReferralCode } from '@/services/cashbackService';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { geocodeAddress, reverseGeocode, type GeoLocation } from '@/services/mapsService';
import { requestLocationPermission } from '@/services/permissionsService';
import { addressFormFromGeocode } from '@/utils/addressFromGeocode';
import { consumeCheckoutMapPickerResult } from '@/services/checkoutMapPickerResult';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

type Step = 'form' | 'otp';

export default function RegisterBusinessScreen() {
  const [step, setStep] = useState<Step>('form');
  const [pendingUserId, setPendingUserId] = useState('');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  // Localização "cravada"
  const [businessCoords, setBusinessCoords] = useState<GeoLocation | null>(null);
  const [loadingGps, setLoadingGps] = useState(false);

  // OTP field
  const [otp, setOtp] = useState('');

  const [loading, setLoading] = useState(false);

  const { signUpAndSendOTP, resendSignupOTP, verifyRegistrationOTP } = useAppAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Validate referral code ─────────────────────────────────────────────────

  const handleReferralCodeChange = async (code: string) => {
    setReferralCode(code.toUpperCase());
    setReferrerName(null);
    if (code.length === 8) {
      setCheckingCode(true);
      const motoboy = await getMotoboyByReferralCode(code);
      setCheckingCode(false);
      if (motoboy) setReferrerName(motoboy.name);
    }
  };

  // ── Step 1: submit form → create account + send OTP ───────────────────────

  const handleRegister = async () => {
    if (!email || !password || !name || !phone || !address || !addressNumber || !neighborhood || !city || !state || !cep) {
      showAlert('Campos obrigatórios', 'Preencha todos os campos obrigatórios.');
      return;
    }
    if (password.length < 6) {
      showAlert('Senha fraca', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error, userId } = await signUpAndSendOTP(email.trim(), password, 'business');
    setLoading(false);
    if (error || !userId) {
      showAlert('Erro no cadastro', error ?? 'Tente novamente.');
      return;
    }
    setPendingUserId(userId);
    setStep('otp');
  };

  // ── Seletor de Mapa ────────────────────────────────────────────────────────

  const fillFromGeocode = (geo: any, pin: GeoLocation | null) => {
    const f = addressFormFromGeocode(geo);
    setAddress(f.customerAddress);
    setAddressNumber(f.customerNumber);
    setNeighborhood(f.customerNeighborhood);
    setCity(f.customerCity);
    setState(f.customerState);
    setCep(f.customerCep);
    setBusinessCoords(pin);
  };

  const useCurrentLocation = async () => {
    const perm = await requestLocationPermission();
    if (!perm.granted) {
      showAlert('Localização', perm.reason);
      return;
    }
    setLoadingGps(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      router.push({
        pathname: '/(customer)/delivery-map-picker',
        params: { lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) },
      });
    } finally {
      setLoadingGps(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const r = consumeCheckoutMapPickerResult();
      if (!r) return;
      if (r.geocode) {
        fillFromGeocode(r.geocode, { lat: r.lat, lng: r.lng });
      } else {
        setBusinessCoords({ lat: r.lat, lng: r.lng });
        reverseGeocode(r.lat, r.lng).then((g) => {
          if (g) fillFromGeocode(g, { lat: r.lat, lng: r.lng });
        });
      }
    }, [])
  );

  // ── Step 2: verify OTP → session active → create business profile ──────────

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      showAlert('Digite o código enviado para o seu e-mail.');
      return;
    }
    setLoading(true);
    const { error: otpError, userId } = await verifyRegistrationOTP(email.trim(), otp.trim(), 'business');
    if (otpError || !userId) {
      setLoading(false);
      showAlert('Código inválido', otpError ?? 'Verifique o código e tente novamente.');
      return;
    }

    let referredByMotoboyId: string | undefined;
    if (referralCode.trim().length === 8) {
      const motoboy = await getMotoboyByReferralCode(referralCode);
      referredByMotoboyId = motoboy?.id;
    }

    const { error: bizError, data: createdBiz } = await createBusinessProfile(userId, {
      name, cnpj, phone, address, address_number: addressNumber,
      complement, neighborhood, city, state, cep,
      latitude: businessCoords?.lat,
      longitude: businessCoords?.lng,
      ...(referredByMotoboyId ? { referred_by_motoboy_id: referredByMotoboyId } : {}),
    });

    setLoading(false);
    if (bizError) {
      showAlert('Erro ao salvar dados', bizError);
      return;
    }

    // Se já temos as coordenadas do mapa, não precisa rodar o sync de novo
    if (createdBiz?.id && !businessCoords) {
      void syncBusinessCoordinates(createdBiz.id);
    }
    router.replace('/');
  };

  const handleResendOTP = async () => {
    setLoading(true);
    const { error } = await resendSignupOTP(email.trim());
    setLoading(false);
    if (error) showAlert('Erro ao reenviar', error);
    else showAlert('Código reenviado', 'Verifique sua caixa de entrada.');
  };

  // ── OTP Screen ─────────────────────────────────────────────────────────────

  if (step === 'otp') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setStep('form')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Verificar e-mail</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.otpCard}>
            <MaterialIcons name="mark-email-unread" size={56} color={Colors.primary} style={{ alignSelf: 'center', marginBottom: Spacing.md }} />
            <Text style={styles.otpTitle}>Confirme seu e-mail</Text>
            <Text style={styles.otpSubtitle}>
              Enviamos um código de {4} dígitos para{'\n'}
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>{email}</Text>
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Código de verificação</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="0000"
                placeholderTextColor={Colors.textMuted}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
                textAlign="center"
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleVerifyOTP}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Confirmar e finalizar cadastro</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resendBtn} onPress={handleResendOTP} disabled={loading} activeOpacity={0.7}>
              <Text style={styles.resendText}>Reenviar código</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Form Screen ────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cadastro de Comércio</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}><MaterialIcons name="lock" size={16} color={Colors.primary} /> Acesso</Text>
          <InputField label="E-mail *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="comercio@email.com" />
          <InputField label="Senha *" value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 6 caracteres" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}><MaterialIcons name="store" size={16} color={Colors.primary} /> Dados do Comércio</Text>
          <InputField label="Nome do Comércio *" value={name} onChangeText={setName} placeholder="Ex: Pizzaria Bela Vista" />
          <InputField label="CNPJ" value={cnpj} onChangeText={setCnpj} placeholder="00.000.000/0000-00" keyboardType="numeric" />
          <InputField label="Telefone / WhatsApp *" value={phone} onChangeText={setPhone} placeholder="(11) 99999-9999" keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}><MaterialIcons name="location-on" size={16} color={Colors.primary} /> Endereço</Text>

          <TouchableOpacity
            style={styles.mapBtn}
            onPress={useCurrentLocation}
            disabled={loadingGps}
          >
            {loadingGps ? <ActivityIndicator size="small" color={Colors.white} /> : (
              <>
                <MaterialIcons name="my-location" size={18} color={Colors.white} />
                <Text style={styles.mapBtnText}>Marcar localização no mapa</Text>
              </>
            )}
          </TouchableOpacity>

          <InputField label="CEP *" value={cep} onChangeText={setCep} placeholder="00000-000" keyboardType="numeric" />
          <InputField label="Endereço *" value={address} onChangeText={setAddress} placeholder="Rua, Avenida..." />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <InputField label="Número *" value={addressNumber} onChangeText={setAddressNumber} placeholder="123" keyboardType="numeric" />
            </View>
            <View style={{ width: Spacing.sm }} />
            <View style={{ flex: 2 }}>
              <InputField label="Complemento" value={complement} onChangeText={setComplement} placeholder="Apto, Sala..." />
            </View>
          </View>
          <InputField label="Bairro *" value={neighborhood} onChangeText={setNeighborhood} placeholder="Bairro" />
          <View style={styles.row}>
            <View style={{ flex: 2 }}>
              <InputField label="Cidade *" value={city} onChangeText={setCity} placeholder="Cidade" />
            </View>
            <View style={{ width: Spacing.sm }} />
            <View style={{ flex: 1 }}>
              <InputField label="UF *" value={state} onChangeText={setState} placeholder="SP" autoCapitalize="characters" maxLength={2} />
            </View>
          </View>
        </View>

        {/* Referral Code */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><MaterialIcons name="card-giftcard" size={16} color={Colors.primary} /> Indicação (opcional)</Text>
          <Text style={styles.referralHint}>Tem o código de um motoboy que te indicou? Cole aqui e ele ganha cashback!</Text>
          <View style={styles.referralInputRow}>
            <TextInput
              style={[styles.referralInput, referrerName ? { borderColor: Colors.success } : null]}
              value={referralCode}
              onChangeText={handleReferralCodeChange}
              placeholder="Ex: AB1C2D3E"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              maxLength={8}
            />
            {checkingCode && <ActivityIndicator size="small" color={Colors.primary} style={{ position: 'absolute', right: 14 }} />}
          </View>
          {referrerName ? (
            <View style={styles.referralValid}>
              <MaterialIcons name="check-circle" size={16} color={Colors.success} />
              <Text style={styles.referralValidText}>Código válido — indicado por <Text style={{ fontWeight: '700' }}>{referrerName}</Text></Text>
            </View>
          ) : referralCode.length === 8 && !checkingCode ? (
            <View style={styles.referralInvalid}>
              <MaterialIcons name="error-outline" size={16} color={Colors.error} />
              <Text style={styles.referralInvalidText}>Código não encontrado</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Cadastrar Comércio</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InputField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={inputStyles.group}>
      <Text style={inputStyles.label}>{label}</Text>
      <TextInput style={inputStyles.input} placeholderTextColor={Colors.textMuted} {...props} />
    </View>
  );
}

const inputStyles = StyleSheet.create({
  group: { marginBottom: Spacing.sm },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 48, color: Colors.text,
    fontSize: FontSize.md, borderWidth: 1, borderColor: Colors.border,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 0 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.md },
  row: { flexDirection: 'row' },
  mapBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    gap: 8,
    marginBottom: Spacing.md,
  },
  mapBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
  referralHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm, lineHeight: 18 },
  referralInputRow: { position: 'relative' },
  referralInput: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 48, color: Colors.text,
    fontSize: FontSize.md, borderWidth: 1, borderColor: Colors.border,
    letterSpacing: 2, fontWeight: '700',
  },
  referralValid: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  referralValidText: { fontSize: FontSize.sm, color: Colors.success },
  referralInvalid: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  referralInvalidText: { fontSize: FontSize.sm, color: Colors.error },
  btn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    height: 54, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  // OTP screen
  otpCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, gap: Spacing.md,
  },
  otpTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  otpSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  inputGroup: { gap: 6 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  otpInput: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    height: 64, color: Colors.text, fontSize: 32, fontWeight: '800',
    borderWidth: 2, borderColor: Colors.primary, letterSpacing: 12,
  },
  resendBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  resendText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
});
