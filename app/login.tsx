import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useAlert } from '@/template';
import { getAppConfig } from '@/services/configService';
import { openWhatsApp, openEmail } from '@/utils/links';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_DISPLAY_NAME, APP_VARIANT } from '@/constants/branding';

type Screen = 'login' | 'forgot_email' | 'forgot_otp';

// Número de fallback quando admin não configurou ou app_config inacessível na tela de login
const FALLBACK_WHATSAPP = '';

export default function LoginScreen() {
  const [screen, setScreen] = useState<Screen>('login');

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetOTP, setResetOTP] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [contactWhatsApp, setContactWhatsApp] = useState('');

  const { signIn, sendPasswordResetOTP, resetPasswordWithOTP } = useAppAuth();

  const loadContactConfig = () => {
    getAppConfig()
      .then((c) => {
        const phone = (c.contact_whatsapp_phone ?? '').trim();
        setContactWhatsApp(phone || FALLBACK_WHATSAPP);
      })
      .catch(() => setContactWhatsApp(FALLBACK_WHATSAPP));
  };
  useEffect(() => loadContactConfig(), []);
  useFocusEffect(React.useCallback(() => { loadContactConfig(); }, []));
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Login ──────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Preencha todos os campos', 'Digite email e senha para entrar.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      showAlert('Erro ao entrar', error);
      return;
    }
    router.replace('/');
  };

  // ── Forgot — step 1: send OTP ──────────────────────────────────────────────

  const handleSendOTP = async () => {
    if (!resetEmail.trim()) {
      showAlert('Digite o e-mail cadastrado.');
      return;
    }
    setLoading(true);
    const { error } = await sendPasswordResetOTP(resetEmail.trim());
    setLoading(false);
    if (error) {
      showAlert('Erro', 'E-mail não encontrado ou inválido.');
      return;
    }
    setScreen('forgot_otp');
  };

  // ── Forgot — step 2: verify OTP + set new password ─────────────────────────

  const handleResetPassword = async () => {
    if (!resetOTP.trim() || !newPassword.trim()) {
      showAlert('Preencha todos os campos.');
      return;
    }
    if (newPassword.length < 6) {
      showAlert('Senha muito curta', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error } = await resetPasswordWithOTP(resetEmail.trim(), resetOTP.trim(), newPassword);
    setLoading(false);
    if (error) {
      showAlert('Erro', error);
      return;
    }
    showAlert('Senha alterada!', 'Sua senha foi redefinida com sucesso. Faça login.');
    setScreen('login');
    setResetOTP('');
    setNewPassword('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <MaterialIcons name="delivery-dining" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>
            {APP_VARIANT === 'client' ? 'Partiu Entrega' : APP_DISPLAY_NAME}
          </Text>
          <Text style={styles.tagline}>Pedidos rápidos entre comércios e entregadores</Text>
        </View>

        {/* ── Login Screen ── */}
        {screen === 'login' && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Entrar</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>E-mail</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="email" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Sua senha"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialIcons name={showPass ? 'visibility-off' : 'visibility'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.loginBtnText}>Entrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => { setResetEmail(email); setScreen('forgot_email'); }}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Esqueci minha senha</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Forgot — Step 1: Email ── */}
        {screen === 'forgot_email' && (
          <View style={styles.form}>
            <TouchableOpacity style={styles.backRow} onPress={() => setScreen('login')} activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={20} color={Colors.primary} />
              <Text style={styles.backText}>Voltar ao login</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>Recuperar senha</Text>
            <Text style={styles.formSubtitle}>
              Digite o e-mail cadastrado. Enviaremos um código de verificação.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>E-mail</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="email" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  placeholderTextColor={Colors.textMuted}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={handleSendOTP}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.loginBtnText}>Enviar código</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Forgot — Step 2: OTP + New Password ── */}
        {screen === 'forgot_otp' && (
          <View style={styles.form}>
            <TouchableOpacity style={styles.backRow} onPress={() => setScreen('forgot_email')} activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={20} color={Colors.primary} />
              <Text style={styles.backText}>Alterar e-mail</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>Redefinir senha</Text>
            <Text style={styles.formSubtitle}>
              Código enviado para <Text style={{ color: Colors.primary }}>{resetEmail}</Text>. Verifique sua caixa de entrada.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Código de verificação</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="pin" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Digite o código"
                  placeholderTextColor={Colors.textMuted}
                  value={resetOTP}
                  onChangeText={setResetOTP}
                  keyboardType="number-pad"
                  autoFocus
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nova senha</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock-reset" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={Colors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialIcons name={showNewPass ? 'visibility-off' : 'visibility'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.loginBtnText}>Redefinir senha</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={handleSendOTP}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Reenviar código</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Register Options — Ainda não tem conta? */}
        {screen === 'login' && (
          <View style={styles.registerSection}>
            <Text style={styles.registerTitle}>Ainda não tem conta?</Text>

            {/* Opção principal de cadastro por variante */}
            {APP_VARIANT === 'business' && (
              <TouchableOpacity
                style={styles.registerBtn}
                onPress={() => router.push('/register-business')}
                activeOpacity={0.8}
              >
                <MaterialIcons name="store" size={22} color={Colors.primary} />
                <View style={styles.registerBtnText}>
                  <Text style={styles.registerBtnTitle}>Criar conta comércio</Text>
                  <Text style={styles.registerBtnSub}>Cadastro grátis — solicite entregas</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            )}

            {APP_VARIANT === 'motoboy' && (
              <TouchableOpacity
                style={styles.registerBtn}
                onPress={() => router.push('/register-motoboy')}
                activeOpacity={0.8}
              >
                <MaterialIcons name="two-wheeler" size={22} color={Colors.secondary} />
                <View style={styles.registerBtnText}>
                  <Text style={styles.registerBtnTitle}>Criar conta de entregador</Text>
                  <Text style={styles.registerBtnSub}>Assinatura mensal — faça entregas</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            )}

            {APP_VARIANT === 'client' && (
              <TouchableOpacity
                style={styles.registerBtn}
                onPress={() => router.push('/register-customer')}
                activeOpacity={0.8}
              >
                <MaterialIcons name="restaurant" size={22} color={Colors.warning} />
                <View style={styles.registerBtnText}>
                  <Text style={styles.registerBtnTitle}>Criar conta cliente</Text>
                  <Text style={styles.registerBtnSub}>Peça de restaurantes cadastrados</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            )}

            {/* Opções de redirecionamento para suporte se não for o perfil do app */}
            {APP_VARIANT === 'client' && (
              <TouchableOpacity
                style={styles.registerBtn}
                onPress={() => openWhatsApp(contactWhatsApp)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="help-outline" size={22} color={Colors.textMuted} />
                <View style={styles.registerBtnText}>
                  <Text style={styles.registerBtnTitle}>Não sou cliente</Text>
                  <Text style={styles.registerBtnSub}>Dúvidas ou outros perfis? Fale conosco</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            )}

            {APP_VARIANT === 'motoboy' && (
              <TouchableOpacity
                style={styles.registerBtn}
                onPress={() => openWhatsApp(contactWhatsApp)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="help-outline" size={22} color={Colors.textMuted} />
                <View style={styles.registerBtnText}>
                  <Text style={styles.registerBtnTitle}>Não sou entregador</Text>
                  <Text style={styles.registerBtnSub}>Dúvidas sobre o cadastro? Fale conosco</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* E-mail suporte + WhatsApp — parte inferior da tela de login */}
        {screen === 'login' && (
          <View style={styles.contactSection}>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => openEmail('partiuentregasuporte@gmail.com')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="email" size={22} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.contactBtnText}>E-mail para suporte</Text>
                <Text style={styles.contactBtnSub}>partiuentregasuporte@gmail.com</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
            {contactWhatsApp.length > 0 ? (
              <TouchableOpacity
                style={[styles.contactBtn, styles.contactBtnWhatsApp]}
                onPress={() => openWhatsApp(contactWhatsApp)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="whatsapp" size={24} color={Colors.success} />
                <Text style={styles.contactBtnText}>WhatsApp para suporte</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md },
  logoContainer: { alignItems: 'center', marginBottom: Spacing.xl },
  logoIcon: {
    width: 96, height: 96, borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  appName: { fontSize: 32, fontWeight: '700', color: Colors.text, letterSpacing: 1 },
  tagline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  form: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  formTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  formSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 52,
    borderWidth: 1, borderColor: Colors.border,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, color: Colors.text, fontSize: FontSize.md },
  loginBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    height: 52, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm,
    ...Shadows.button,
  },
  btnDisabled: { opacity: 0.6 },
  loginBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  forgotBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  forgotText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
  backText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  registerSection: { gap: Spacing.sm },
  registerTitle: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '600', marginBottom: 4 },
  registerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  registerBtnText: { flex: 1 },
  registerBtnTitle: { color: Colors.text, fontWeight: '600', fontSize: FontSize.md },
  registerBtnSub: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  contactSection: { gap: Spacing.sm, marginBottom: Spacing.lg },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  contactBtnWhatsApp: { borderColor: Colors.success + '55', backgroundColor: Colors.success + '10' },
  contactBtnText: { color: Colors.text, fontWeight: '600', fontSize: FontSize.md },
  contactBtnSub: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
});
