import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useAlert } from '@/template';
import { useRides } from '@/contexts/RidesContext';
import { getPendingDeliveries, acceptDelivery } from '@/services/deliveryService';
import {
  setAcceptCooldown,
  setRefuseCooldown,
  isInAcceptCooldown,
  parseRefuseCooldownRules,
  formatCooldownRemaining,
  getActiveCooldowns,
  ActiveCooldown,
} from '@/services/cooldownService';
import { getAppConfig } from '@/services/configService';
import { Delivery } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency, formatDate, openWhatsApp } from '@/utils/links';

const EXPIRY_WARN_DAYS = 5;

function getDaysUntilExpiry(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days;
}

const POLL_INTERVAL = 10_000;

export default function AvailableRidesScreen() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [cooldownInfo, setCooldownInfo] = useState<ActiveCooldown[]>([]);
  const { motoboyProfile } = useAppAuth();
  const router = useRouter();
  const daysLeft = getDaysUntilExpiry(motoboyProfile?.subscription_expires_at);
  const showExpiryBanner = daysLeft !== null && daysLeft > 0 && daysLeft <= EXPIRY_WARN_DAYS;
  const { showAlert } = useAlert();
  const { setNewRidesCount, clearBadge, isSoundPlaying, startAlertSound, stopAlertSound } = useRides();
  const insets = useSafeAreaInsets();

  // Keep previous IDs to detect new arrivals between polls
  const knownIdsRef = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFocusedRef = useRef(true);

  // Config cache
  const configRef = useRef<{ acceptMinutes: number; refuseRules: ReturnType<typeof parseRefuseCooldownRules> } | null>(null);

  // Load config once
  const ensureConfig = useCallback(async () => {
    if (configRef.current) return configRef.current;
    const cfg = await getAppConfig();
    configRef.current = {
      acceptMinutes: parseFloat(cfg.accept_cooldown_minutes) || 30,
      refuseRules: parseRefuseCooldownRules(cfg.refuse_cooldown_rules),
    };
    return configRef.current;
  }, []);

  // Stop sound when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        stopAlertSound();
      };
    }, [stopAlertSound])
  );

  // ── Load deliveries ──────────────────────────────────────────────────────
  const loadDeliveries = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    if (!motoboyProfile?.id) { setLoading(false); setRefreshing(false); return; }

    const motoboyId = motoboyProfile.id;
    const [data, activeCooldowns] = await Promise.all([
      getPendingDeliveries(motoboyId),
      getActiveCooldowns(motoboyId),
    ]);

    setCooldownInfo(activeCooldowns);

    const incomingIds = new Set(data.map((d) => d.id));

    // Detect truly new rides (not seen in previous fetch)
    if (knownIdsRef.current.size > 0) {
      const newItems = data.filter((d) => !knownIdsRef.current.has(d.id));
      if (newItems.length > 0) {
        setNewRidesCount((prev) => prev + newItems.length);

        // Haptic bursts
        const bursts = Math.min(newItems.length, 3);
        for (let i = 0; i < bursts; i++) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          if (i < bursts - 1) await new Promise((r) => setTimeout(r, 150));
        }

        // Start continuous alert sound
        startAlertSound();
      }
    }

    // If list becomes empty, stop sound
    if (data.length === 0) {
      stopAlertSound();
    }

    knownIdsRef.current = incomingIds;
    setDeliveries(data);
    setLoading(false);
    setRefreshing(false);
  }, [motoboyProfile?.id, setNewRidesCount, startAlertSound, stopAlertSound]);

  // Clear badge and start polling when screen gains focus
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      clearBadge();
      loadDeliveries(false);

      pollTimerRef.current = setInterval(() => {
        if (isFocusedRef.current) {
          loadDeliveries(true);
        }
      }, POLL_INTERVAL);

      return () => {
        isFocusedRef.current = false;
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      };
    }, [loadDeliveries, clearBadge])
  );

  // ── Accept ride ────────────────────────────────────────────────────────
  const handleAccept = async (delivery: Delivery) => {
    if (!motoboyProfile) return;
    stopAlertSound();
    setAccepting(delivery.id);

    const { error } = await acceptDelivery(delivery.id, motoboyProfile.id);
    if (error) {
      setAccepting(null);
      showAlert('Corrida indisponível', 'Esta corrida já foi aceita por outro motoboy.');
      loadDeliveries(false);
      return;
    }

    // Apply accept cooldown
    const cfg = await ensureConfig();
    await setAcceptCooldown(motoboyProfile.id, cfg.acceptMinutes);

    setAccepting(null);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push(`/ride/${delivery.id}`);
  };

  // ── Refuse ride ──────────────────────────────────────────────────────────
  const handleRefuse = useCallback((delivery: Delivery) => {
    showAlert(
      'Recusar corrida?',
      'Esta corrida voltará para a fila. Você ficará sem receber corridas deste comércio por um período.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Recusar',
          style: 'destructive',
          onPress: async () => {
            if (!motoboyProfile?.id) return;
            const cfg = await ensureConfig();

            const { refusalCount, cooldownMinutes } = await setRefuseCooldown(
              motoboyProfile.id,
              delivery.business_id,
              cfg.refuseRules
            );

            setDeliveries((prev) => {
              const updated = prev.filter((d) => d.id !== delivery.id);
              knownIdsRef.current.delete(delivery.id);
              if (updated.length === 0) stopAlertSound();
              return updated;
            });

            // Reload cooldowns to update UI
            const activeCooldowns = await getActiveCooldowns(motoboyProfile.id);
            setCooldownInfo(activeCooldowns);

            const bizName = (delivery as any).businesses?.name ?? 'este comércio';
            showAlert(
              'Corrida recusada',
              `${refusalCount}ª recusa — você não receberá corridas de ${bizName} por ${cooldownMinutes < 60 ? cooldownMinutes + ' minutos' : Math.round(cooldownMinutes / 60) + ' hora(s)'}.`
            );
          },
        },
      ]
    );
  }, [showAlert, stopAlertSound, motoboyProfile, ensureConfig]);

  const handleManualRefresh = () => {
    clearBadge();
    loadDeliveries(false);
  };

  // ── Cooldown banner helper ─────────────────────────────────────────────────
  const globalCooldown = cooldownInfo.find((c) => c.type === 'accept');
  const refuseCooldowns = cooldownInfo.filter((c) => c.type === 'refuse');

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.secondary} /></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {showExpiryBanner ? (
        <TouchableOpacity
          style={styles.expiryBanner}
          onPress={() => router.push('/renew-subscription')}
          activeOpacity={0.85}
        >
          <MaterialIcons name="event" size={20} color={Colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.expiryBannerTitle}>
              Assinatura vence em {daysLeft} dia{daysLeft !== 1 ? 's' : ''}!
            </Text>
            <Text style={styles.expiryBannerSub}>Toque para renovar e não perder acesso às corridas</Text>
          </View>
          <View style={styles.renewBadge}>
            <Text style={styles.renewBadgeText}>Renovar</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Global accept cooldown banner */}
      {globalCooldown ? (
        <View style={styles.cooldownBanner}>
          <MaterialIcons name="timer" size={20} color={Colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cooldownBannerTitle}>Aguardando nova corrida</Text>
            <Text style={styles.cooldownBannerSub}>
              Disponível em {formatCooldownRemaining(globalCooldown.cooldownUntil)}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Per-business refuse cooldowns */}
      {refuseCooldowns.length > 0 && !globalCooldown ? (
        <View style={styles.refuseCooldownBox}>
          <MaterialIcons name="block" size={16} color={Colors.warning} />
          <Text style={styles.refuseCooldownText}>
            {refuseCooldowns.length} comércio{refuseCooldowns.length > 1 ? 's' : ''} bloqueado{refuseCooldowns.length > 1 ? 's' : ''} por recusa
          </Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Corridas Disponíveis</Text>
          <Text style={styles.pollLabel}>Atualiza a cada 10 s</Text>
        </View>
        <View style={styles.headerActions}>
          {/* Mute button — only visible when sound is playing */}
          {isSoundPlaying ? (
            <TouchableOpacity
              onPress={() => stopAlertSound()}
              style={styles.muteBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="volume-off" size={20} color={Colors.warning} />
              <Text style={styles.muteBtnText}>Silenciar</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={handleManualRefresh}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="refresh" size={24} color={Colors.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 16, gap: Spacing.sm }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleManualRefresh}
            tintColor={Colors.secondary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons
              name={globalCooldown ? 'timer' : 'motorcycle'}
              size={64}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyText}>
              {globalCooldown
                ? 'Em cooldown após aceite'
                : 'Nenhuma corrida disponível'}
            </Text>
            <Text style={styles.emptySubText}>
              {globalCooldown
                ? `Disponível em ${formatCooldownRemaining(globalCooldown.cooldownUntil)}`
                : 'Verificando automaticamente a cada 10 segundos'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const biz = (item as any).businesses;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{formatCurrency(item.price)}</Text>
                </View>
                <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
              </View>

              <View style={styles.routeSection}>
                <View style={styles.routePoint}>
                  <MaterialIcons name="store" size={16} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>Origem (Comércio)</Text>
                    <Text style={styles.routeAddress}>{biz?.name}</Text>
                    <Text style={styles.routeAddressSub}>
                      {biz?.address}, {biz?.address_number} — {biz?.neighborhood}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeDivider} />

                <View style={styles.routePoint}>
                  <MaterialIcons name="location-on" size={16} color={Colors.error} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>Destino (Cliente)</Text>
                    <Text style={styles.routeAddress}>{item.customer_name}</Text>
                    <Text style={styles.routeAddressSub}>
                      {item.customer_address}, {item.customer_address_number} — {item.customer_neighborhood}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <MaterialIcons name="straighten" size={14} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{item.distance_km} km</Text>
                </View>
                {item.notes ? (
                  <View style={styles.metaItem}>
                    <MaterialIcons name="notes" size={14} color={Colors.textMuted} />
                    <Text style={styles.metaText} numberOfLines={1}>{item.notes}</Text>
                  </View>
                ) : null}
              </View>

              {/* Actions: WhatsApp | Recusar | Aceitar */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() =>
                    openWhatsApp(
                      biz?.phone ?? '',
                      `Olá! Sou motoboy do PartiuEntrega e quero confirmar a entrega para ${item.customer_name}.`
                    )
                  }
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="chat" size={18} color={Colors.white} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.refuseBtn}
                  onPress={() => handleRefuse(item)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="close" size={18} color={Colors.error} />
                  <Text style={styles.refuseBtnText}>Recusar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.acceptBtn, accepting === item.id && styles.btnDisabled]}
                  onPress={() => handleAccept(item)}
                  disabled={accepting === item.id}
                  activeOpacity={0.8}
                >
                  {accepting === item.id ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="check" size={18} color={Colors.white} />
                      <Text style={styles.acceptBtnText}>Aceitar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text },
  pollLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  muteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.warning + '22', borderRadius: BorderRadius.md,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.warning + '55',
  },
  muteBtnText: { color: Colors.warning, fontSize: FontSize.xs, fontWeight: '700' },

  // Cooldown banners
  cooldownBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.error + '18', borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.error + '55',
  },
  cooldownBannerTitle: { color: Colors.error, fontWeight: '700', fontSize: FontSize.sm },
  cooldownBannerSub: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  refuseCooldownBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.warning + '15', borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    marginHorizontal: Spacing.md, marginBottom: 4,
    borderWidth: 1, borderColor: Colors.warning + '40',
  },
  refuseCooldownText: { color: Colors.warning, fontSize: FontSize.xs, fontWeight: '600' },

  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.md,
  },
  badge: {
    backgroundColor: Colors.primary + '22', borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  badgeText: { color: Colors.primary, fontWeight: '800', fontSize: FontSize.md },
  cardDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  routeSection: { gap: 4, marginBottom: Spacing.md },
  routePoint: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  routeLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },
  routeAddress: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  routeAddressSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  routeDivider: {
    height: 12, width: 1, backgroundColor: Colors.border,
    marginLeft: 7, marginVertical: 2,
  },
  metaRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  cardActions: { flexDirection: 'row', gap: Spacing.sm },
  contactBtn: {
    backgroundColor: '#25D366', borderRadius: BorderRadius.md,
    width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
  },
  refuseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: Colors.error, borderRadius: BorderRadius.md,
    paddingHorizontal: 14, height: 48,
  },
  refuseBtnText: { color: Colors.error, fontWeight: '700', fontSize: FontSize.sm },
  acceptBtn: {
    flex: 1, flexDirection: 'row', gap: 8, backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.md, height: 48, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  acceptBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  expiryBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: '#2a1f00', borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.warning,
  },
  expiryBannerTitle: { color: Colors.warning, fontWeight: '700', fontSize: FontSize.sm },
  expiryBannerSub: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  renewBadge: {
    backgroundColor: Colors.warning, borderRadius: BorderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  renewBadgeText: { color: '#000', fontSize: FontSize.xs, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textSecondary },
  emptySubText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
