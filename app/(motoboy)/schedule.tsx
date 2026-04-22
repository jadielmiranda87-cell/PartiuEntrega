import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMotoboySchedules, createSchedule, Shift } from '@/services/motoboyScheduleService';
import { format, addDays, startOfDay, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DAYS_TO_SHOW = 14;

export default function MotoboyScheduleScreen() {
  const { motoboyProfile } = useAppAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [updatingShift, setUpdatingShift] = useState<string | null>(null);

  // Agendamento permitido apenas a partir de amanhã
  const dates = Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(startOfDay(new Date()), i + 1));

  const loadSchedules = useCallback(async () => {
    if (!motoboyProfile?.id) {
      // Se não tem ID, aguarda um pouco e tenta novamente (pode estar carregando o Auth)
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const start = format(dates[0], 'yyyy-MM-dd');
      const end = format(dates[dates.length - 1], 'yyyy-MM-dd');
      const data = await getMotoboySchedules(motoboyProfile.id, start, end);
      setSchedules(data || []);
    } catch (e) {
      console.error('[Schedule] Erro ao carregar agenda:', e);
    } finally {
      setLoading(false);
    }
  }, [motoboyProfile?.id]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleCreateSchedule = async (date: Date, shift: Shift, label: string) => {
    if (!motoboyProfile?.id) return;

    const dateStr = format(date, 'yyyy-MM-dd');
    const dateFormatted = format(date, "dd/MM/yyyy");

    Alert.alert(
      'Confirmar Agendamento',
      `Você deseja agendar o turno ${label} para o dia ${dateFormatted}?\n\nIMPORTANTE: Uma vez confirmado, o agendamento não poderá ser alterado ou cancelado.`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            const key = `${dateStr}-${shift}`;
            setUpdatingShift(key);
            const { error } = await createSchedule(motoboyProfile.id, dateStr, shift);
            setUpdatingShift(null);

            if (error) {
              Alert.alert('Erro', error);
            } else {
              Alert.alert('Sucesso', 'Turno agendado com sucesso!');
              loadSchedules();
            }
          }
        }
      ]
    );
  };

  const isShiftSelected = (date: Date, shift: Shift) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return schedules.some(s => s.work_date === dateStr && s.shift === shift);
  };

  const renderShiftButton = (date: Date, shift: Shift, label: string, hours: string, icon: string) => {
    const selected = isShiftSelected(date, shift);
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${dateStr}-${shift}`;
    const updating = updatingShift === key;

    return (
      <TouchableOpacity
        style={[
          styles.shiftBtn,
          selected && styles.shiftBtnSelected,
        ]}
        onPress={() => !selected && handleCreateSchedule(date, shift, label)}
        disabled={!!updatingShift || selected}
      >
        <View style={styles.shiftContent}>
          <MaterialIcons
            name={icon as any}
            size={20}
            color={selected ? Colors.white : Colors.textMuted}
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[styles.shiftLabel, selected && styles.textWhite]}>{label}</Text>
            <Text style={[styles.shiftHours, selected && styles.textWhiteMuted]}>{hours}</Text>
          </View>
          {updating ? (
            <ActivityIndicator size="small" color={selected ? Colors.white : Colors.primary} />
          ) : (
            <MaterialIcons
              name={selected ? "lock" : "add-circle-outline"}
              size={20}
              color={selected ? Colors.white : Colors.border}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && schedules.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Minha Agenda</Text>
        <Text style={styles.subtitle}>Agende sua disponibilidade para os próximos dias</Text>
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={16} color={Colors.info} />
          <Text style={styles.infoText}>Agendamentos devem ser feitos até o dia anterior e são imutáveis.</Text>
        </View>
      </View>

      <FlatList
        data={dates}
        keyExtractor={(item) => item.toISOString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: date }) => (
          <View style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>
                {format(date, "EEEE", { locale: ptBR })}
              </Text>
              <Text style={styles.dayDate}>
                {format(date, "dd 'de' MMMM", { locale: ptBR })}
              </Text>
            </View>

            <View style={styles.shiftsContainer}>
              {renderShiftButton(date, 'matutino', 'Matutino', '08h às 12h', 'wb-sunny')}
              {renderShiftButton(date, 'vespertino', 'Vespertino', '12h às 18h', 'light-mode')}
              {renderShiftButton(date, 'noturno', 'Noturno', '18h às 00h', 'bedtime')}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { padding: Spacing.md, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.info + '15',
    padding: 10,
    borderRadius: BorderRadius.sm,
    marginTop: 12,
    gap: 8
  },
  infoText: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  listContent: { padding: Spacing.md, paddingBottom: 40 },
  dayCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayHeader: {
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
  },
  dayName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, textTransform: 'capitalize' },
  dayDate: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  shiftsContainer: { gap: Spacing.sm },
  shiftBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shiftBtnSelected: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  shiftContent: { flexDirection: 'row', alignItems: 'center' },
  shiftLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  shiftHours: { fontSize: FontSize.xs, color: Colors.textSecondary },
  textWhite: { color: Colors.white },
  textWhiteMuted: { color: 'rgba(255,255,255,0.7)' },
});
