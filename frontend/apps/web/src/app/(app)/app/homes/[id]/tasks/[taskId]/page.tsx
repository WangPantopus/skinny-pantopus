'use client';

import { useParams } from 'next/navigation';
import HomeTaskNotificationDetail from '@/components/home/HomeTaskNotificationDetail';

export default function HomeTaskPage() {
  const params = useParams<{ id: string; taskId: string }>();
  const homeId = typeof params.id === 'string' ? params.id.toLowerCase() : '';
  const taskId = typeof params.taskId === 'string' ? params.taskId.toLowerCase() : '';
  return <HomeTaskNotificationDetail homeId={homeId} taskId={taskId} />;
}
