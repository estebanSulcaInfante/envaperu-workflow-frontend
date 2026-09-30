import { Navigate, useLocation } from 'react-router-dom';

// Compatibility URLs only. The destination retains its own capability gate.
export default function ControlConsolidationRedirect() {
  const location = useLocation();
  const inventory = location.pathname.replace(/\/+$/, '').toLowerCase() === '/control/inventario';
  const search = new URLSearchParams(location.search);
  if (inventory && !search.has('vista')) search.set('vista', 'almacenes');
  return <Navigate replace to={{
    pathname: inventory ? '/almacen/kardex' : '/produccion/ordenes-fabricacion',
    search: search.size ? `?${search.toString()}` : '',
    hash: location.hash,
  }} />;
}
