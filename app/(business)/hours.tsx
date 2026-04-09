import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useAlert } from '@/template';
import { updateBusinessProfile } from '@/services/businessService';
import type { DayCode, DaySchedule, WeeklyOpeningHours } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const UI_DAYS: { key: DayCode; label: string }[] = [
  { key: 'mon', label: 'Segunda-feira' },
  { key: 'tue', label: 'Terça-feira' },
  { key: 'wed', label: 'Quarta-feira' },
  { key: 'thu', label: 'Quinta-feira' },
  { key: 'fri', label: 'Sexta-feira' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

function defaultDay(): DaySchedule {
  return { closed: false, open: '09:00', close: '22:00' };
}

function mergeWeekly(raw: WeeklyOpeningHours | null | undefined): Record<DayCode, DaySchedule> {
  const base: Record<DayCode, DaySchedule> = {
    sun: { ...defaultDay() },
    mon: { ...defaultDay() },
    tue: { ...defaultDay() },
    wed: { ...defaultDay() },
    thu: { ...defaultDay() },
    fri: { ...defaultDay() },
    sat: { ...defaultDay() },
  };
  if (!raw) return base;
  for (const k of Object.keys(base) as DayCode[]) {
    const incoming = raw[k];
    if (incoming && typeof incoming === 'object') {
      base[k] = {
        closed: !!incoming.closed,
        open: typeof incoming.open === 'string' ? incoming.open : '09:00',
        close: typeof incoming.close === 'string' ? incoming.close : '22:00',
      };
    }
  }
  return base;
}

export default function BusinessHoursScreen() {
  const { businessProfile, loading: authLoading, refreshProfile } = useAppAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [weekly, setWeekly] = useState<Record<DayCode, DaySchedule> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!businessProfile) {
      setWeekly(null);
      return;
    }
    setWeekly(mergeWeekly(businessProfile.opening_hours));
  }, [businessProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const setDay = (key: DayCode, patch: Partial<DaySchedule>) => {
    setWeekly((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: { ...prev[key], ...patch } };
    });
  };

  const handleSave = async () => {
    if (!businessProfile || !weekly) return;
    setSaving(true);
    const payload: WeeklyOpeningHours = { ...weekly };
    const { error } = await updateBusinessProfile(businessProfile.id, { opening_hours: payload });
    setSaving(false);
    if (error) {
      showAlert('Erro', error);
      return;
    }
    await refreshProfile();
    showAlert('Salvo', 'Horários atualizados.');
  };

  if (authLoading || !businessProfile) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!weekly) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ color: Colors.textSecondary }}>Carregando…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: Spacing.md,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Horário de funcionamento</Text>
        <Text style={styles.sub}>Esses horários aparecem para o cliente (aberto/fechado e lista).</Text>

        {UI_DAYS.map(({ key, label }) => {
          const d = weekly[key];
          return (
            <View key={key} style={styles.card}>
              <View style={styles.rowTop}>
                <Text style={styles.dayLabel}>{label}</Text>
                <View style={styles.closedRow}>
                  <Text style={styles.closedText}>Aberto</Text>
                  <Switch
                    value={!d.closed}
                    onValueChange={(v) => setDay(key, { closed: !v })}
                    trackColor={{ false: Colors.border, true: Colors.primary + '88' }}
                    thumbColor={!d.closed ? Colors.primary : Colors.textMuted}
                  />
                </View>
              </View>
              {!d.closed ? (
                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={styles.timeHint}>Abre</Text>
                    <TextInput
                      style={styles.input}
                      value={d.open}
                      onChangeText={(t) => setDay(key, { open: t })}
                      placeholder="09:00"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <View style={styles.timeField}>
                    <Text style={styles.timeHint}>Fecha</Text>
                    <TextInput
                      style={styles.input}
                      value={d.close}
                      onChangeText={(t) => setDay(key, { close: t })}
                      placeholder="22:00"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.9}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <MaterialIcons name="save" size={22} color={Colors.white} />
              <Text style={styles.saveBtnText}>Salvar horários</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, flex: 1 },
  closedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  closedText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  timeRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  timeField: { flex: 1 },
  timeHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 44,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  saveBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  saveBtnText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.md },
});
