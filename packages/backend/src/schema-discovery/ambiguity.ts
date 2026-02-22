const CLEAR_SUFFIXES = [
  '_id', '_at', '_name', '_date', '_count', '_total', '_email',
  '_url', '_type', '_status', '_code', '_number', '_address',
  '_description', '_title', '_phone', '_price', '_amount',
  '_quantity', '_rate', '_percentage', '_ratio', '_weight',
  '_height', '_width', '_length', '_size', '_color', '_key',
  '_value', '_path', '_label', '_text', '_note', '_comment',
  '_reason', '_source', '_target', '_level', '_score',
];

const CLEAR_EXACT = new Set([
  'id', 'uuid', 'email', 'name', 'title', 'description',
  'created_at', 'updated_at', 'deleted_at', 'timestamp',
  'username', 'password', 'phone', 'address', 'city',
  'state', 'country', 'zip', 'latitude', 'longitude',
  'first_name', 'last_name', 'full_name', 'display_name',
  'is_active', 'is_deleted', 'is_verified', 'is_admin',
  'order_total', 'subtotal', 'total', 'quantity', 'price',
  'amount', 'balance', 'discount', 'tax', 'fee',
  'start_date', 'end_date', 'due_date', 'birth_date',
  'created_by', 'updated_by', 'deleted_by', 'assigned_to',
  'status', 'type', 'role', 'category', 'priority', 'version',
  'url', 'image_url', 'avatar_url', 'website',
]);

export function isAmbiguousColumnName(name: string): boolean {
  const lower = name.toLowerCase();

  if (CLEAR_EXACT.has(lower)) return false;
  if (CLEAR_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return false;

  return true;
}
