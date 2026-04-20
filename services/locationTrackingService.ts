import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getSupabaseClient } from '@/template';

export const LOCATION_TRACKING_TASK = 'LOCATION_TRACKING_TASK';

/**
 * Define a tarefa de rastreamento em segundo plano.
 * DEVE ser chamada no escopo global (ex: no app/_layout.tsx ou services/locationTrackingService.ts importado no root).
 */
export function defineLocationTask() {
  if (TaskManager.isTaskDefined(LOCATION_TRACKING_TASK)) return;

  TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }: any) => {
    if (error) {
      console.error('[LocationTask] Erro na tarefa:', error);
      return;
    }
    if (data) {
      const { locations } = data;
      const [location] = locations;
      if (location) {
        const { latitude, longitude } = location.coords;

        // Recupera o ID do usuário/motoboy logado via Supabase Session
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user?.id) {
          // 1. Atualiza a localização global do motoboy
          await supabase
            .from('motoboys')
            .update({
              last_lat: latitude,
              last_lng: longitude,
              last_location_at: new Date().toISOString(),
            })
            .eq('user_id', session.user.id);

          // 2. Atualiza a localização na entrega ATIVA (para o cliente ver em tempo real no track-delivery)
          // Buscamos a entrega que está com esse motoboy e não foi finalizada nem cancelada
          const { data: activeDelivery } = await supabase
            .from('deliveries')
            .select('id')
            .eq('motoboy_id', session.user.id)
            .in('status', ['assigned', 'collected'])
            .single();

          if (activeDelivery) {
            await supabase
              .from('deliveries')
              .update({
                motoboy_lat: latitude,
                motoboy_lng: longitude,
              })
              .eq('id', activeDelivery.id);
          }

          console.log(`[LocationTask] Localização atualizada: ${latitude}, ${longitude}`);
        }
      }
    }
  });
}

/**
 * Inicia o rastreamento em segundo plano.
 */
export async function startLocationTracking() {
  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') return;

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  if (background !== 'granted') return;

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  if (hasStarted) return;

  await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15000, // 15 segundos
    distanceInterval: 20, // 20 metros
    foregroundService: {
      notificationTitle: 'Rastreamento Ativo',
      notificationBody: 'Sua localização está sendo compartilhada para a entrega.',
      notificationColor: '#EA580C',
    },
    pausesLocationUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
}

/**
 * Para o rastreamento.
 */
export async function stopLocationTracking() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    console.log('[LocationTask] Rastreamento parado.');
  }
}
