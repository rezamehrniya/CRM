import { Navigate, useParams } from 'react-router-dom';

export default function Members() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  if (!tenantSlug) return <Navigate to="/" replace />;
  return <Navigate to={`/t/${tenantSlug}/app/settings/users`} replace />;
}
