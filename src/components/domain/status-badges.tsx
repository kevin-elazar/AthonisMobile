import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  ROUTE_STATUS_LABELS,
  stopStatusLabel,
  type DriverStop,
  type RouteStatus,
} from '@/features/routes/model';

const ROUTE_APPEARANCE: Record<RouteStatus, Pick<BadgeProps, 'tone' | 'icon'>> = {
  planned: { tone: 'info', icon: 'time-outline' },
  active: { tone: 'primary', icon: 'navigate' },
  completed: { tone: 'success', icon: 'checkmark-circle' },
  cancelled: { tone: 'neutral', icon: 'close-circle-outline' },
};

export function RouteStatusBadge({ status }: { status: RouteStatus }) {
  return <Badge label={ROUTE_STATUS_LABELS[status]} {...ROUTE_APPEARANCE[status]} />;
}

function stopAppearance(stop: DriverStop): Pick<BadgeProps, 'tone' | 'icon'> {
  if (stop.status === 'delivered') return { tone: 'success', icon: 'checkmark-circle' };
  if (stop.status === 'failed') return { tone: 'danger', icon: 'alert-circle' };
  if (stop.arrived_at) return { tone: 'warning', icon: 'location' };
  if (stop.status === 'in_route') return { tone: 'primary', icon: 'navigate-outline' };
  return { tone: 'neutral', icon: 'time-outline' };
}

export function StopStatusBadge({ stop }: { stop: DriverStop }) {
  return <Badge label={stopStatusLabel(stop)} {...stopAppearance(stop)} />;
}
