import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 'form' | 'otp';

export default function RegisterCustomerScreen() {
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const { signUpAndSendOTP, resendSignupOTP, verifyRegistrationOTP } = useAppAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || !name.trim() || !phone.trim()) {
      showAlert('Preencha todos os campos', 'Nome, telefone, e-mail e senha são obrigatórios.');
      return;
    }
    if (password.length < 6) {
      showAlert('Senha curta', 'Use pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error } = await signUpAndSendOTP(email.trim(), password, 'customer');
    setLoading(false);
    if (error) {
      showAlert('Erro', error);
      return;
    }
    setStep('otp');
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      showAlert('Código', 'Digite o código enviado ao seu e-mail.');
      return;
    }
    setLoading(true);
    const { error, userId } = await verifyRegistrationOTP(email.trim(), otp.trim(), 'customer');
    if (error || !userId) {
      setLoading(false);
      showAlert('Código inválido', error ?? 'Tente novamente.');
      return;
    }
    const supabase = getSupabaseClient();
    const { error: upErr } = await supabase
      .from('user_profiles')
      .update({
        username: name.trim(),
        phone: phone.replace(/\D/g, ''),
      })
      .eq('id', userId);
    setLoading(false);
    if (upErr) {
      showAlert('Aviso', 'Conta criada, mas não foi possível salvar nome/telefone. Atualize no perfil.');
    }
    router.replace('/');
  };

  const handleResendOTP = async () => {
    setLoading(true);
    const { error } = await resendSignupOTP(email.trim());
    setLoading(false);
    if (error) showAlert('Erro', error);
    else showAlert('Código reenviado', 'Verifique sua caixa de entrada.');
  };

  if (step === 'otp') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
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
            <Text style={styles.otpTitle}>Confirme seu e-mail</Text>
            <Text style={styles.otpSubtitle}>Código de 4 dígitos enviado para{'\n'}{email}</Text>
            <TextInput
              style={styles.otpInput}
              placeholder="0000"
              placeholderTextColor={Colors.textMuted}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={4}
              textAlign="center"
            />
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleVerifyOTP} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Confirmar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.resendBtn} onPress={handleResendOTP} disabled={loading}>
              <Text style={styles.resendText}>Reenviar código</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Criar conta — Cliente</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.section}>
          <Input label="Nome *" value={name} onChangeText={setName} placeholder="Seu nome" />
          <Input label="Telefone *" value={phone} onChangeText={setPhone} placeholder="11999999999" keyboardType="phone-pad" />
          <Input label="E-mail *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="voce@email.com" />
          <Input label="Senha *" value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 6 caracteres" />
        </View>

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Continuar</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Input({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 48, color: Colors.text, fontSize: FontSize.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md, height: 54,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  otpCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.md },
  otpTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  otpSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  otpInput: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, height: 64,
    fontSize: 32, fontWeight: '800', borderWidth: 2, borderColor: Colors.primary, color: Colors.text,
  },
  resendBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  resendText: { color: Colors.primary, fontWeight: '600' },
});
