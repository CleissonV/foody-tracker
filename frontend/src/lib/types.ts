export type Status = 'RECEBIDO' | 'EM_PREPARO' | 'SAIU_PARA_ENTREGA' | 'ENTREGUE' | 'CANCELADO';

export interface User {
  id: string;
  name: string;
  email: string;
}
export interface Address {
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
}
export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}
export interface OrderSummary {
  id: string;
  customerName: string;
  deliveryAddress: Address;
  status: Status;
  itemCount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  version: number;
  allowedNextStatuses: Status[];
}
export interface Order extends Omit<OrderSummary, 'itemCount'> {
  items: OrderItem[];
  history: { status: Status; changedAt: string; changedBy: string }[];
}
export interface CreateOrder {
  customerName: string;
  deliveryAddress: Address;
  items: { name: string; quantity: number; unitPrice: number }[];
}
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface Stats {
  counts: Record<Status, number>;
  total: number;
}
export interface Problem {
  status: number;
  code: string;
  detail: string;
  errors?: Record<string, string>;
}

export const statusLabels: Record<Status, string> = {
  RECEBIDO: 'Recebido',
  EM_PREPARO: 'Em preparo',
  SAIU_PARA_ENTREGA: 'Saiu para entrega',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
};
export const statuses = Object.keys(statusLabels) as Status[];
export const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const shortId = (id: string) => '#' + id.slice(0, 8).toUpperCase();
