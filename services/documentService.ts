import { getSupabaseClient } from '@/template';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { VerificationStatus } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  url: string | null;
  error: string | null;
}

// ─── Camera / Image Picker ────────────────────────────────────────────────────

export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

export async function requestMediaPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function pickImageFromCamera(): Promise<{ uri: string; type: string } | null> {
  const granted = await requestCameraPermission();
  if (!granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg' };
}

export async function pickImageFromGallery(): Promise<{ uri: string; type: string } | null> {
  const granted = await requestMediaPermission();
  if (!granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? 'image/jpeg';

  // Only accept jpg/png
  if (!['image/jpeg', 'image/jpg', 'image/png'].includes(mimeType.toLowerCase())) {
    return null;
  }
  return { uri: asset.uri, type: mimeType };
}

export async function pickPdfDocument(): Promise<{ uri: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  // Validate it's actually a PDF by checking MIME type and extension
  const mimeType = asset.mimeType ?? '';
  const name = asset.name ?? '';
  const isPdf =
    mimeType === 'application/pdf' ||
    name.toLowerCase().endsWith('.pdf');

  if (!isPdf) return null;

  return { uri: asset.uri, name: asset.name ?? 'cnh_digital.pdf' };
}

// ─── Upload to Supabase Storage ───────────────────────────────────────────────

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
  // Mobile: fetch file:// or content:// URI
  const response = await fetch(uri);
  return response.arrayBuffer();
}

export async function uploadDocument(
  userId: string,
  fileUri: string,
  fileName: string,
  contentType: string
): Promise<UploadResult> {
  const supabase = getSupabaseClient();
  const path = `${userId}/${fileName}`;

  try {
    const arrayBuffer = await uriToArrayBuffer(fileUri);

    const { data, error } = await supabase.storage
      .from('motoboy-documents')
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (error) return { url: null, error: error.message };

    // Get signed URL valid for 1 year (for admin view)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('motoboy-documents')
      .createSignedUrl(data.path, 60 * 60 * 24 * 365);

    if (signedError) return { url: null, error: signedError.message };
    return { url: signedData.signedUrl, error: null };
  } catch (e: any) {
    return { url: null, error: e?.message ?? 'Erro ao enviar arquivo' };
  }
}

// ─── Signed URL for admin viewing ────────────────────────────────────────────

export async function getDocumentSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = getSupabaseClient();

  // If already a full URL (signed URL), return as-is
  if (storagePath.startsWith('http')) return storagePath;

  const { data, error } = await supabase.storage
    .from('motoboy-documents')
    .createSignedUrl(storagePath, 60 * 60); // 1 hour

  if (error) return null;
  return data.signedUrl;
}

// ─── Update motoboy document fields ──────────────────────────────────────────

export async function saveMotoboyCnhPhysical(
  motoboyId: string,
  frontUrl: string,
  backUrl: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('motoboys')
    .update({
      cnh_type: 'physical',
      cnh_front_url: frontUrl,
      cnh_back_url: backUrl,
      cnh_pdf_url: null,
      verification_status: 'under_review',
    })
    .eq('id', motoboyId);
  return { error: error ? error.message : null };
}

export async function saveMotoboyCnhDigital(
  motoboyId: string,
  pdfUrl: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('motoboys')
    .update({
      cnh_type: 'digital',
      cnh_pdf_url: pdfUrl,
      cnh_front_url: null,
      cnh_back_url: null,
      verification_status: 'under_review',
    })
    .eq('id', motoboyId);
  return { error: error ? error.message : null };
}

export async function saveMotoboySelfie(
  motoboyId: string,
  selfieUrl: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('motoboys')
    .update({ selfie_url: selfieUrl })
    .eq('id', motoboyId);
  return { error: error ? error.message : null };
}

export async function saveLgpdConsent(
  motoboyId: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('motoboys')
    .update({ lgpd_consent: true, lgpd_consent_at: new Date().toISOString() })
    .eq('id', motoboyId);
  return { error: error ? error.message : null };
}

// ─── Admin: approve / reject ──────────────────────────────────────────────────

export async function adminApproveVerification(
  motoboyId: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('motoboys')
    .update({ verification_status: 'approved', rejection_reason: null })
    .eq('id', motoboyId);
  return { error: error ? error.message : null };
}

export async function adminRejectVerification(
  motoboyId: string,
  reason: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('motoboys')
    .update({ verification_status: 'rejected', rejection_reason: reason })
    .eq('id', motoboyId);
  return { error: error ? error.message : null };
}

// ─── Account deletion request ─────────────────────────────────────────────────

export async function requestAccountDeletion(
  motoboyId: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('motoboys')
    .update({ delete_requested: true, delete_requested_at: new Date().toISOString() })
    .eq('id', motoboyId);
  return { error: error ? error.message : null };
}

// ─── Verification status helpers ──────────────────────────────────────────────

export const VERIFICATION_STATUS_LABEL: Record<VerificationStatus, string> = {
  pending_documents: 'Documentos Pendentes',
  under_review: 'Em Análise',
  approved: 'Aprovado',
  rejected: 'Reprovado',
};

export const VERIFICATION_STATUS_COLOR: Record<VerificationStatus, string> = {
  pending_documents: '#F59E0B',
  under_review: '#3B82F6',
  approved: '#22C55E',
  rejected: '#EF4444',
};
