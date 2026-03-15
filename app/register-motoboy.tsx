import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useAlert } from '@/template';
import { createMotoboyProfile } from '@/services/motoboyService';
import { getMotoboyByReferralCode } from '@/services/cashbackService';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 'form' | 'otp';

function InputField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} {...props} />
    </View>
  );
}

export default function RegisterMotoboyScreen() {
  const [step, setStep] = useState<Step>('form');
  const [pendingUserId, setPendingUserId] = useState('');
  const [otp, setOtp] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnhNumber, setCnhNumber] = useState('');
  const [cnhCategory, setCnhCategory] = useState('A');
  const [motoBrand, setMotoBrand] = useState('');
  const [motoModel, setMotoModel] = useState('');
  const [motoPlate, setMotoPlate] = useState('');
  const [motoYear, setMotoYear] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
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
    if (!email || !password || !name || !phone || !cpf || !cnhNumber || !motoBrand || !motoModel || !motoPlate || !motoYear || !city || !state) {
      showAlert('Campos obrigatórios', 'Preencha todos os campos para continuar.');
      return;
    }
    if (password.length < 6) {
      showAlert('Senha fraca', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error, userId } = await signUpAndSendOTP(email.trim(), password, 'motoboy');
    setLoading(false);
    if (error || !userId) {
      showAlert('Erro no cadastro', error ?? 'Tente novamente.');
      return;
    }
    setPendingUserId(userId);
    setStep('otp');
  };

  // ── Step 2: verify OTP → session active → create motoboy profile ──────────

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      showAlert('Digite o código enviado para o seu e-mail.');
      return;
    }
    setLoading(true);
    // Passa 'motoboy' para garantir que user_type seja gravado com sessão ativa
    const { error: otpError, userId } = await verifyRegistrationOTP(email.trim(), otp.trim(), 'motoboy');
    if (otpError || !userId) {
      setLoading(false);
      showAlert('Código inválido', otpError ?? 'Verifique o código e tente novamente.');
      return;
    }

    // Resolve referral code
    let referredByMotoboyId: string | undefined;
    if (referralCode.trim().length === 8) {
      const motoboy = await getMotoboyByReferralCode(referralCode);
      referredByMotoboyId = motoboy?.id;
    }

    const { error: mbError } = await createMotoboyProfile(userId, {
      name, phone, email: email.trim(), cpf,
      cnh_number: cnhNumber, cnh_category: cnhCategory,
      moto_brand: motoBrand, moto_model: motoModel,
      moto_plate: motoPlate.toUpperCase(), moto_year: motoYear,
      city, state,
      ...(referredByMotoboyId ? { referred_by_motoboy_id: referredByMotoboyId } : {}),
    });

    setLoading(false);
    if (mbError) {
      showAlert('Erro ao salvar dados', mbError);
      return;
    }
    router.replace('/payment');
  };

  const handleResendOTP = async () => {
    setLoading(true);
    await resendSignupOTP(email.trim());
    setLoading(false);
    showAlert('Código reenviado', 'Verifique sua caixa de entrada.');
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
              Enviamos um código de 4 dígitos para{'\n'}
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>{email}</Text>
            </Text>

            <View style={{ gap: 6 }}>
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
              {loading ? <ActivityIndicator color={Colors.white} /> : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="arrow-forward" size={20} color={Colors.white} />
                  <Text style={styles.btnText}>Confirmar e ir para pagamento</Text>
                </View>
              )}
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
          <Text style={styles.headerTitle}>Cadastro de Motoboy</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.infoCard}>
          <MaterialIcons name="info" size={18} color={Colors.info} />
          <Text style={styles.infoText}>Após o cadastro, você será direcionado ao pagamento da assinatura mensal. Após o pagamento, o ADM irá verificar seus dados.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}><MaterialIcons name="lock" size={16} color={Colors.primary} /> Acesso</Text>
          <InputField label="E-mail *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="motoboy@email.com" />
          <InputField label="Senha *" value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 6 caracteres" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}><MaterialIcons name="person" size={16} color={Colors.primary} /> Dados Pessoais</Text>
          <InputField label="Nome completo *" value={name} onChangeText={setName} placeholder="Seu nome completo" />
          <InputField label="Telefone / WhatsApp *" value={phone} onChangeText={setPhone} placeholder="(11) 99999-9999" keyboardType="phone-pad" />
          <InputField label="CPF *" value={cpf} onChangeText={setCpf} placeholder="000.000.000-00" keyboardType="numeric" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}><MaterialIcons name="credit-card" size={16} color={Colors.primary} /> CNH</Text>
          <InputField label="Número da CNH *" value={cnhNumber} onChangeText={setCnhNumber} placeholder="Número da CNH" keyboardType="numeric" />
          <View style={{ marginBottom: Spacing.sm }}>
            <Text style={styles.label}>Categoria *</Text>
            <View style={styles.categoryRow}>
              {['A', 'AB', 'B'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryBtn, cnhCategory === cat && styles.categoryBtnActive]}
                  onPress={() => setCnhCategory(cat)}
                >
                  <Text style={[styles.categoryBtnText, cnhCategory === cat && styles.categoryBtnTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}><MaterialIcons name="two-wheeler" size={16} color={Colors.primary} /> Moto</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <InputField label="Marca *" value={motoBrand} onChangeText={setMotoBrand} placeholder="Honda" />
            </View>
            <View style={{ width: Spacing.sm }} />
            <View style={{ flex: 2 }}>
              <InputField label="Modelo *" value={motoModel} onChangeText={setMotoModel} placeholder="CG 160" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <InputField label="Ano *" value={motoYear} onChangeText={setMotoYear} placeholder="2022" keyboardType="numeric" maxLength={4} />
            </View>
            <View style={{ width: Spacing.sm }} />
            <View style={{ flex: 1 }}>
              <InputField label="Placa *" value={motoPlate} onChangeText={setMotoPlate} placeholder="ABC1D23" autoCapitalize="characters" maxLength={7} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}><MaterialIcons name="location-on" size={16} color={Colors.primary} /> Localização</Text>
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
          <Text style={styles.referralHint}>Outro motoboy te indicou? Cole o código dele e ele ganha cashback na próxima renovação!</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[styles.referralInput, referrerName ? { borderColor: Colors.success } : undefined]}
              value={referralCode}
              onChangeText={handleReferralCodeChange}
              placeholder="Ex: AB1C2D3E"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              maxLength={8}
            />
            {checkingCode && <ActivityIndicator size="small" color={Colors.primary} style={{ position: 'absolute', right: 14, top: 14 }} />}
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
          {loading ? <ActivityIndicator color={Colors.white} /> : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="arrow-forward" size={20} color={Colors.white} />
              <Text style={styles.btnText}>Continuar para Pagamento</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  infoCard: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: '#1a2a3a',
    borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'flex-start',
    borderWidth: 1, borderColor: Colors.info,
  },
  infoText: { flex: 1, color: Colors.info, fontSize: FontSize.sm, lineHeight: 20 },
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 48, color: Colors.text,
    fontSize: FontSize.md, borderWidth: 1, borderColor: Colors.border,
  },
  row: { flexDirection: 'row' },
  categoryRow: { flexDirection: 'row', gap: Spacing.sm },
  categoryBtn: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  categoryBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  categoryBtnTextActive: { color: Colors.white },
  referralHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm, lineHeight: 18 },
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
  otpInput: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    height: 64, color: Colors.text, fontSize: 32, fontWeight: '800',
    borderWidth: 2, borderColor: Colors.primary, letterSpacing: 12,
  },
  resendBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  resendText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
});
