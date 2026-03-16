import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useAlert } from '@/template';
import { createMotoboyProfile } from '@/services/motoboyService';
import { getMotoboyByReferralCode } from '@/services/cashbackService';
import {
  pickImageFromCamera,
  pickImageFromGallery,
  pickPdfDocument,
  uploadDocument,
} from '@/services/documentService';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const APP_NAME = 'PartiuEntrega';

type Step = 'form' | 'otp' | 'documents' | 'lgpd';
type CnhType = 'physical' | 'digital';

function InputField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} {...props} />
    </View>
  );
}

// ── Document Picker Button ─────────────────────────────────────────────────────
function DocPickerBtn({
  label, onCamera, onGallery, onPdf, preview, accept,
}: {
  label: string;
  accept: 'image' | 'pdf';
  onCamera?: () => void;
  onGallery?: () => void;
  onPdf?: () => void;
  preview?: string | null;
}) {
  return (
    <View style={docStyles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      {preview ? (
        <View style={docStyles.previewBox}>
          {accept === 'image' ? (
            <Image source={{ uri: preview }} style={docStyles.previewImage} resizeMode="cover" />
          ) : (
            <View style={docStyles.pdfPreview}>
              <MaterialIcons name="picture-as-pdf" size={40} color={Colors.error} />
              <Text style={docStyles.pdfText}>PDF selecionado</Text>
            </View>
          )}
          <View style={docStyles.previewOverlay}>
            <MaterialIcons name="check-circle" size={28} color={Colors.success} />
          </View>
        </View>
      ) : (
        <View style={docStyles.placeholder}>
          <MaterialIcons name={accept === 'pdf' ? 'picture-as-pdf' : 'photo-camera'} size={32} color={Colors.textMuted} />
          <Text style={docStyles.placeholderText}>Nenhum arquivo selecionado</Text>
        </View>
      )}
      <View style={docStyles.btnRow}>
        {accept === 'image' && onCamera && (
          <TouchableOpacity style={docStyles.btn} onPress={onCamera} activeOpacity={0.8}>
            <MaterialIcons name="camera-alt" size={16} color={Colors.primary} />
            <Text style={docStyles.btnText}>Câmera</Text>
          </TouchableOpacity>
        )}
        {accept === 'image' && onGallery && (
          <TouchableOpacity style={docStyles.btn} onPress={onGallery} activeOpacity={0.8}>
            <MaterialIcons name="photo-library" size={16} color={Colors.primary} />
            <Text style={docStyles.btnText}>Galeria</Text>
          </TouchableOpacity>
        )}
        {accept === 'pdf' && onPdf && (
          <TouchableOpacity style={[docStyles.btn, { flex: 1 }]} onPress={onPdf} activeOpacity={0.8}>
            <MaterialIcons name="attach-file" size={16} color={Colors.primary} />
            <Text style={docStyles.btnText}>Selecionar PDF</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function RegisterMotoboyScreen() {
  const [step, setStep] = useState<Step>('form');
  const [otp, setOtp] = useState('');
  const [savedUserId, setSavedUserId] = useState('');
  const [savedMotoboyId, setSavedMotoboyId] = useState('');

  // Form fields
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

  // Document step
  const [cnhType, setCnhType] = useState<CnhType>('physical');
  const [cnhFront, setCnhFront] = useState<{ uri: string; type: string } | null>(null);
  const [cnhBack, setCnhBack] = useState<{ uri: string; type: string } | null>(null);
  const [cnhPdf, setCnhPdf] = useState<{ uri: string; name: string } | null>(null);
  const [selfie, setSelfie] = useState<{ uri: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // LGPD step
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const { signUpAndSendOTP, resendSignupOTP, verifyRegistrationOTP } = useAppAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Referral code validation ──────────────────────────────────────────────

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

  // ── Step 1: form submit ──────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!email || !password || !name || !phone || !cpf || !cnhNumber ||
        !motoBrand || !motoModel || !motoPlate || !motoYear || !city || !state) {
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
    setSavedUserId(userId);
    setStep('otp');
  };

  // ── Step 2: OTP verify ───────────────────────────────────────────────────

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      showAlert('Digite o código enviado para o seu e-mail.');
      return;
    }
    setLoading(true);
    const { error: otpError, userId } = await verifyRegistrationOTP(email.trim(), otp.trim(), 'motoboy');
    if (otpError || !userId) {
      setLoading(false);
      showAlert('Código inválido', otpError ?? 'Verifique o código e tente novamente.');
      return;
    }

    let referredByMotoboyId: string | undefined;
    if (referralCode.trim().length === 8) {
      const mb = await getMotoboyByReferralCode(referralCode);
      referredByMotoboyId = mb?.id;
    }

    const { data: mbData, error: mbError } = await createMotoboyProfile(userId, {
      name, phone, email: email.trim(), cpf,
      cnh_number: cnhNumber, cnh_category: cnhCategory,
      moto_brand: motoBrand, moto_model: motoModel,
      moto_plate: motoPlate.toUpperCase(), moto_year: motoYear,
      city, state,
      verification_status: 'pending_documents',
      ...(referredByMotoboyId ? { referred_by_motoboy_id: referredByMotoboyId } : {}),
    });

    setLoading(false);
    if (mbError || !mbData) {
      showAlert('Erro ao salvar dados', mbError ?? 'Tente novamente.');
      return;
    }
    setSavedMotoboyId(mbData.id);
    // Go to LGPD consent before documents
    setStep('lgpd');
  };

  const handleResendOTP = async () => {
    setLoading(true);
    await resendSignupOTP(email.trim());
    setLoading(false);
    showAlert('Código reenviado', 'Verifique sua caixa de entrada.');
  };

  // ── Step 3: LGPD consent ─────────────────────────────────────────────────

  const handleLgpdContinue = () => {
    if (!lgpdAccepted || !privacyAccepted) {
      showAlert('Consentimento obrigatório', 'Você precisa aceitar os termos para continuar.');
      return;
    }
    setStep('documents');
  };

  // ── Step 4: Document upload ──────────────────────────────────────────────

  const handlePickCnhFrontCamera = async () => {
    const result = await pickImageFromCamera();
    if (result) setCnhFront(result);
  };
  const handlePickCnhFrontGallery = async () => {
    const result = await pickImageFromGallery();
    if (!result) { showAlert('Formato inválido', 'Somente JPG ou PNG são aceitos.'); return; }
    setCnhFront(result);
  };
  const handlePickCnhBackCamera = async () => {
    const result = await pickImageFromCamera();
    if (result) setCnhBack(result);
  };
  const handlePickCnhBackGallery = async () => {
    const result = await pickImageFromGallery();
    if (!result) { showAlert('Formato inválido', 'Somente JPG ou PNG são aceitos.'); return; }
    setCnhBack(result);
  };
  const handlePickCnhPdf = async () => {
    const result = await pickPdfDocument();
    if (!result) { showAlert('Formato inválido', 'Somente arquivos PDF são aceitos.'); return; }
    setCnhPdf(result);
  };
  const handlePickSelfieCamera = async () => {
    const result = await pickImageFromCamera();
    if (result) setSelfie(result);
  };
  const handlePickSelfieGallery = async () => {
    const result = await pickImageFromGallery();
    if (!result) { showAlert('Formato inválido', 'Somente JPG ou PNG são aceitos.'); return; }
    setSelfie(result);
  };

  const handleSubmitDocuments = async () => {
    // Validate
    if (cnhType === 'physical') {
      if (!cnhFront) { showAlert('CNH frente obrigatória', 'Envie a foto da frente da CNH.'); return; }
      if (!cnhBack) { showAlert('CNH verso obrigatório', 'Envie a foto do verso da CNH.'); return; }
    } else {
      if (!cnhPdf) { showAlert('CNH digital obrigatória', 'Envie o arquivo PDF da CNH digital.'); return; }
    }
    if (!selfie) { showAlert('Selfie obrigatória', 'Envie uma selfie para verificação de identidade.'); return; }

    setUploading(true);
    const uid = savedUserId;
    let cnhFrontUrl = '';
    let cnhBackUrl = '';
    let cnhPdfUrl = '';
    let selfieUrl = '';

    try {
      // Upload CNH
      if (cnhType === 'physical') {
        setUploadProgress('Enviando CNH frente…');
        const ext1 = cnhFront!.type.includes('png') ? 'png' : 'jpg';
        const r1 = await uploadDocument(uid, cnhFront!.uri, `cnh_front.${ext1}`, cnhFront!.type);
        if (r1.error || !r1.url) throw new Error(r1.error ?? 'Falha ao enviar CNH frente');
        cnhFrontUrl = r1.url;

        setUploadProgress('Enviando CNH verso…');
        const ext2 = cnhBack!.type.includes('png') ? 'png' : 'jpg';
        const r2 = await uploadDocument(uid, cnhBack!.uri, `cnh_back.${ext2}`, cnhBack!.type);
        if (r2.error || !r2.url) throw new Error(r2.error ?? 'Falha ao enviar CNH verso');
        cnhBackUrl = r2.url;
      } else {
        setUploadProgress('Enviando CNH digital…');
        const r3 = await uploadDocument(uid, cnhPdf!.uri, 'cnh_digital.pdf', 'application/pdf');
        if (r3.error || !r3.url) throw new Error(r3.error ?? 'Falha ao enviar CNH digital');
        cnhPdfUrl = r3.url;
      }

      // Upload selfie
      setUploadProgress('Enviando selfie…');
      const extS = selfie!.type.includes('png') ? 'png' : 'jpg';
      const r4 = await uploadDocument(uid, selfie!.uri, `selfie.${extS}`, selfie!.type);
      if (r4.error || !r4.url) throw new Error(r4.error ?? 'Falha ao enviar selfie');
      selfieUrl = r4.url;

      // Update motoboy record
      setUploadProgress('Salvando documentos…');
      const { getSupabaseClient } = await import('@/template');
      const supabase = getSupabaseClient();
      await supabase.from('motoboys').update({
        cnh_type: cnhType,
        cnh_front_url: cnhFrontUrl || null,
        cnh_back_url: cnhBackUrl || null,
        cnh_pdf_url: cnhPdfUrl || null,
        selfie_url: selfieUrl,
        lgpd_consent: true,
        lgpd_consent_at: new Date().toISOString(),
        verification_status: 'under_review',
      }).eq('id', savedMotoboyId);

      setUploading(false);
      router.replace('/payment');
    } catch (e: any) {
      setUploading(false);
      showAlert('Erro no envio', e?.message ?? 'Tente novamente.');
    }
  };

  // ── OTP Screen ────────────────────────────────────────────────────────────

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
          <View style={styles.section}>
            <MaterialIcons name="mark-email-unread" size={56} color={Colors.primary} style={{ alignSelf: 'center', marginBottom: Spacing.md }} />
            <Text style={styles.sectionTitle2}>Confirme seu e-mail</Text>
            <Text style={styles.subtitle}>
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
                  <Text style={styles.btnText}>Verificar e continuar</Text>
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

  // ── LGPD Consent Screen ───────────────────────────────────────────────────

  if (step === 'lgpd') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setStep('otp')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Consentimento LGPD</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.section}>
            <View style={styles.lgpdIconRow}>
              <MaterialIcons name="security" size={40} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Proteção dos seus dados</Text>
                <Text style={styles.lgpdSubtitle}>
                  Antes de enviar seus documentos, precisamos do seu consentimento conforme a LGPD.
                </Text>
              </View>
            </View>
          </View>

          {/* Term */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Termo de Consentimento de Dados</Text>
            <View style={styles.termBox}>
              <Text style={styles.termText}>
                {'"'}Autorizo o aplicativo {APP_NAME} a coletar, armazenar e utilizar meus dados pessoais e documentos enviados,
                incluindo CNH, selfie e dados de cadastro, para verificação de identidade, segurança da plataforma e
                cumprimento de obrigações legais, conforme a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).{'"'}
              </Text>
            </View>

            {/* Checkboxes */}
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setLgpdAccepted(!lgpdAccepted)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, lgpdAccepted && styles.checkboxChecked]}>
                {lgpdAccepted ? <MaterialIcons name="check" size={14} color={Colors.white} /> : null}
              </View>
              <Text style={styles.checkLabel}>
                Li e concordo com o tratamento dos meus dados pessoais conforme descrito acima.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setPrivacyAccepted(!privacyAccepted)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, privacyAccepted && styles.checkboxChecked]}>
                {privacyAccepted ? <MaterialIcons name="check" size={14} color={Colors.white} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkLabel}>
                  Li e aceito a{' '}
                  <Text
                    style={styles.linkText}
                    onPress={() => router.push('/privacy-policy')}
                  >
                    Política de Privacidade
                  </Text>
                  {' '}do {APP_NAME}.
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Info about permissions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Permissões necessárias</Text>
            <PermissionRow icon="camera-alt" title="Câmera" desc="Para capturar fotos da CNH e selfie" />
            <PermissionRow icon="photo-library" title="Armazenamento" desc="Para upload de documentos" />
            <PermissionRow icon="location-on" title="Localização" desc="Para calcular rotas de entrega" />
          </View>

          <TouchableOpacity
            style={[styles.btn, (!lgpdAccepted || !privacyAccepted) && styles.btnDisabled]}
            onPress={handleLgpdContinue}
            activeOpacity={0.8}
          >
            <MaterialIcons name="arrow-forward" size={20} color={Colors.white} />
            <Text style={styles.btnText}>Aceitar e enviar documentos</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Document Upload Screen ────────────────────────────────────────────────

  if (step === 'documents') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setStep('lgpd')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Documentos</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.infoCard}>
            <MaterialIcons name="info" size={18} color={Colors.info} />
            <Text style={styles.infoText}>
              Seus documentos são armazenados com criptografia. Somente administradores autorizados têm acesso.
            </Text>
          </View>

          {/* CNH Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <MaterialIcons name="credit-card" size={16} color={Colors.primary} /> Tipo de CNH
            </Text>
            <View style={styles.cnhTypeRow}>
              <TouchableOpacity
                style={[styles.cnhTypeBtn, cnhType === 'physical' && styles.cnhTypeBtnActive]}
                onPress={() => setCnhType('physical')}
                activeOpacity={0.8}
              >
                <MaterialIcons name="credit-card" size={20} color={cnhType === 'physical' ? Colors.white : Colors.textMuted} />
                <Text style={[styles.cnhTypeBtnText, cnhType === 'physical' && styles.cnhTypeBtnTextActive]}>
                  CNH Física
                </Text>
                <Text style={[styles.cnhTypeBtnSub, cnhType === 'physical' && { color: Colors.white + 'AA' }]}>
                  Frente + Verso (JPG/PNG)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cnhTypeBtn, cnhType === 'digital' && styles.cnhTypeBtnActive]}
                onPress={() => setCnhType('digital')}
                activeOpacity={0.8}
              >
                <MaterialIcons name="picture-as-pdf" size={20} color={cnhType === 'digital' ? Colors.white : Colors.textMuted} />
                <Text style={[styles.cnhTypeBtnText, cnhType === 'digital' && styles.cnhTypeBtnTextActive]}>
                  CNH Digital
                </Text>
                <Text style={[styles.cnhTypeBtnSub, cnhType === 'digital' && { color: Colors.white + 'AA' }]}>
                  Arquivo oficial PDF
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Physical CNH */}
          {cnhType === 'physical' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Fotos da CNH</Text>
              <DocPickerBtn
                label="Frente da CNH *"
                accept="image"
                preview={cnhFront?.uri}
                onCamera={handlePickCnhFrontCamera}
                onGallery={handlePickCnhFrontGallery}
              />
              <View style={{ height: Spacing.md }} />
              <DocPickerBtn
                label="Verso da CNH *"
                accept="image"
                preview={cnhBack?.uri}
                onCamera={handlePickCnhBackCamera}
                onGallery={handlePickCnhBackGallery}
              />
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CNH Digital</Text>
              <View style={styles.pdfNote}>
                <MaterialIcons name="info" size={16} color={Colors.warning} />
                <Text style={styles.pdfNoteText}>
                  Somente o arquivo PDF oficial da CNH digital é aceito. Prints de tela e imagens não são permitidos.
                </Text>
              </View>
              <DocPickerBtn
                label="Arquivo PDF da CNH Digital *"
                accept="pdf"
                preview={cnhPdf ? 'pdf' : null}
                onPdf={handlePickCnhPdf}
              />
            </View>
          )}

          {/* Selfie */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <MaterialIcons name="face" size={16} color={Colors.primary} /> Selfie
            </Text>
            <View style={styles.pdfNote}>
              <MaterialIcons name="info" size={16} color={Colors.info} />
              <Text style={styles.pdfNoteText}>
                A selfie é usada para comparar com o documento enviado e confirmar sua identidade.
              </Text>
            </View>
            <DocPickerBtn
              label="Selfie *"
              accept="image"
              preview={selfie?.uri}
              onCamera={handlePickSelfieCamera}
              onGallery={handlePickSelfieGallery}
            />
          </View>

          {uploading ? (
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.uploadingText}>{uploadProgress}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.btn} onPress={handleSubmitDocuments} activeOpacity={0.8}>
              <MaterialIcons name="cloud-upload" size={20} color={Colors.white} />
              <Text style={styles.btnText}>Enviar documentos</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Main Registration Form ────────────────────────────────────────────────

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
          <Text style={styles.infoText}>
            Após o cadastro você enviará seus documentos (CNH + selfie) e será direcionado ao pagamento da assinatura.
          </Text>
        </View>

        {/* Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="lock" size={16} color={Colors.primary} /> Acesso
          </Text>
          <InputField label="E-mail *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="motoboy@email.com" />
          <InputField label="Senha *" value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 6 caracteres" />
        </View>

        {/* Personal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="person" size={16} color={Colors.primary} /> Dados Pessoais
          </Text>
          <InputField label="Nome completo *" value={name} onChangeText={setName} placeholder="Seu nome completo" />
          <InputField label="Telefone / WhatsApp *" value={phone} onChangeText={setPhone} placeholder="(11) 99999-9999" keyboardType="phone-pad" />
          <InputField label="CPF *" value={cpf} onChangeText={setCpf} placeholder="000.000.000-00" keyboardType="numeric" />
        </View>

        {/* CNH */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="credit-card" size={16} color={Colors.primary} /> CNH
          </Text>
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

        {/* Moto */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="two-wheeler" size={16} color={Colors.primary} /> Moto
          </Text>
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

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="location-on" size={16} color={Colors.primary} /> Localização
          </Text>
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

        {/* Referral */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <MaterialIcons name="card-giftcard" size={16} color={Colors.primary} /> Indicação (opcional)
          </Text>
          <Text style={styles.referralHint}>
            Outro motoboy te indicou? Cole o código dele e ele ganha cashback na próxima renovação!
          </Text>
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
            {checkingCode ? <ActivityIndicator size="small" color={Colors.primary} style={{ position: 'absolute', right: 14, top: 14 }} /> : null}
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
              <Text style={styles.btnText}>Continuar</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PermissionRow({ icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <View style={permStyles.row}>
      <View style={permStyles.iconBox}>
        <MaterialIcons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={permStyles.title}>{title}</Text>
        <Text style={permStyles.desc}>{desc}</Text>
      </View>
    </View>
  );
}
const permStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 8 },
  iconBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  desc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
});

const docStyles = StyleSheet.create({
  wrapper: { gap: 6 },
  placeholder: {
    height: 120, backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', gap: 8,
  },
  placeholderText: { fontSize: FontSize.xs, color: Colors.textMuted },
  previewBox: {
    height: 140, borderRadius: BorderRadius.md, overflow: 'hidden',
    position: 'relative',
  },
  previewImage: { width: '100%', height: '100%' },
  previewOverlay: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    padding: 2,
  },
  pdfPreview: {
    height: 140, backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.error + '44', gap: 8,
  },
  pdfText: { fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: Spacing.sm },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 40, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  btnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  infoCard: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: '#1a2a3a',
    borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'flex-start',
    borderWidth: 1, borderColor: Colors.info,
  },
  infoText: { flex: 1, color: Colors.info, fontSize: FontSize.sm, lineHeight: 20 },
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.md },
  sectionTitle2: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
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
  cnhTypeRow: { flexDirection: 'row', gap: Spacing.sm },
  cnhTypeBtn: {
    flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  cnhTypeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cnhTypeBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  cnhTypeBtnTextActive: { color: Colors.white },
  cnhTypeBtnSub: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  pdfNote: {
    flexDirection: 'row', gap: 8, backgroundColor: Colors.warning + '15',
    borderRadius: BorderRadius.sm, padding: Spacing.sm, alignItems: 'flex-start',
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.warning + '44',
  },
  pdfNoteText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 18 },
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
    flexDirection: 'row', gap: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  otpInput: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    height: 64, color: Colors.text, fontSize: 32, fontWeight: '800',
    borderWidth: 2, borderColor: Colors.primary, letterSpacing: 12,
  },
  resendBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  resendText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  lgpdIconRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  lgpdSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },
  termBox: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  termText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22, fontStyle: 'italic' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm },
  checkbox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  linkText: { color: Colors.primary, fontWeight: '600' },
  uploadingBox: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  uploadingText: { fontSize: FontSize.sm, color: Colors.textMuted },
});
