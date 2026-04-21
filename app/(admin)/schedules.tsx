import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { adminGetAllSchedules, adminApplyBonus, Shift } from '@/services/motoboyScheduleService';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/utils/links';

const SHIFT_HOURS: Record<Shift, number> = {
  matutino: 4 * 60, // 240 min (08h - 12h)
  vespertino: 6 * 60, // 360 min (12h - 18h)
  noturno: 6 * 60, // 360 min (18h - 00h)
};

export default function AdminSchedulesScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingBonus, setApplyingBonus] = useState<string | null>(null);
  const [bonusValue, setBonusValue] = useState('10.00');
  const insets = useSafeAreaInsets();

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const data = await adminGetAllSchedules(dateStr);
    setSchedules(data);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleApplyBonus = async (scheduleId: string, motoboyName: string) => {
    const value = parseFloat(bonusValue.replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      Alert.alert('Erro', 'Informe um valor de bônus válido.');
      return;
    }

    Alert.alert(
      'Confirmar Bônus',
      `Deseja aplicar um bônus de ${formatCurrency(value)} para ${motoboyName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setApplyingBonus(scheduleId);
            const { error } = await adminApplyBonus(scheduleId, value);
            setApplyingBonus(null);
            if (error) Alert.alert('Erro', error);
            else loadSchedules();
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const totalMinutes = SHIFT_HOURS[item.shift as Shift] || 360;
    const onlineMinutes = item.online_minutes_count || 0;
    const progress = Math.min(1, onlineMinutes / totalMinutes);
    const isComplete = progress >= 0.95; // Considera completo com 95% de presença

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.motoboyName}>{item.motoboys?.name}</Text>
            <Text style={styles.shiftLabel}>Turno: {item.shift.toUpperCase()}</Text>
          </View>
          {item.bonus_paid ? (
            <View style={styles.paidBadge}>
              <Text style={styles.paidText}>Bônus Pago: {formatCurrency(item.bonus_value)}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.bonusBtn, !isComplete && styles.bonusBtnDisabled]}
              onPress={() => handleApplyBonus(item.id, item.motoboys?.name)}
              disabled={applyingBonus === item.id}
            >
              {applyingBonus === item.id ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.bonusBtnText}>Bonificar</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Presença Online</Text>
            <Text style={[styles.progressValue, isComplete && { color: Colors.success }]}>
              {onlineMinutes} / {totalMinutes} min ({Math.round(progress * 100)}%)
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: isComplete ? Colors.success : Colors.primary }]} />
          </View>
          {!isComplete && (
            <Text style={styles.warningText}>
              <MaterialIcons name="warning" size={12} color={Colors.warning} /> Turno incompleto para bônus automático
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestão de Agenda</Text>
        <View style={styles.dateSelector}>
          <TouchableOpacity onPress={() => setSelectedDate(subDays(selectedDate, 1))}>
            <MaterialIcons name="chevron-left" size={32} color={Colors.primary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.dateText}>{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</Text>
            <Text style={styles.yearText}>{format(selectedDate, "yyyy")}</Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedDate(addDays(selectedDate, 1))}>
            <MaterialIcons name="chevron-right" size={32} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.bonusInputContainer}>
          <Text style={styles.inputLabel}>Valor padrão do bônus (R$):</Text>
          <TextInput
            style={styles.input}
            value={bonusValue}
            onChangeText={setBonusValue}
            keyboardType="numeric"
            placeholder="0.00"
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={schedules}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="event-busy" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum agendamento para esta data.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  dateText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  yearText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  bonusInputContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inputLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: 12, paddingVertical: 4, width: 80, fontWeight: '700' },
  list: { padding: Spacing.md, gap: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  motoboyName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  shiftLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  bonusBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.md },
  bonusBtnDisabled: { backgroundColor: Colors.textMuted },
  bonusBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
  paidBadge: { backgroundColor: Colors.success + '22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full },
  paidText: { color: Colors.success, fontWeight: '800', fontSize: FontSize.xs },
  progressSection: { gap: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTitle: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  progressValue: { fontSize: FontSize.xs, fontWeight: '700' },
  progressBarBg: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  warningText: { fontSize: 10, color: Colors.warning, marginTop: 4 },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm },
});
