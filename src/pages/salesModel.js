export const upper = value => String(value || '').toUpperCase();
export const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export const settled = row => ['PAID','SUCCESS','SUCCEEDED','COMPLETED','PAYMENT_SUCCESS'].includes(upper(row.status || row.payment_status));
export const inactive = row => ['CANCELLED','CANCELED','FORFEITED','VOID'].includes(upper(row.order_status));
export const money = value => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(number(value));
export const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila'}) : '—';
export const day = value => value && !Number.isNaN(new Date(value).getTime()) ? new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Manila'}).format(new Date(value)) : '';
export const uniquePayments = rows => [...new Map(rows.filter(row => row.payment_id).map(row => [row.payment_id,row])).values()];
export const orderPayments = (order,payments) => payments.filter(row => row.order_id === order.order_id && !row.order_group_id);
export const groupPayments = (group,payments) => payments.filter(row => row.order_group_id === group.order_group_id);
export const paidAmount = rows => uniquePayments(rows).filter(settled).reduce((sum,row) => sum + number(row.amount),0);
export function csvCell(value) { let text=String(value??''); if (/^[\s]*[=+@-]/.test(text)) text="'"+text; return '"'+text.replaceAll('"','""')+'"'; }
export function filterOrders(rows,f) { return rows.filter(row => (!f.search || [row.order_number,row.buyer_name,row.item_label,row.sku,row.order_group_id].join(' ').toLowerCase().includes(f.search.toLowerCase())) && (f.channel==='ALL'||upper(row.source_type)===f.channel) && (f.status==='ALL'||upper(row.order_status)===f.status) && (!f.from||day(row.created_at)>=f.from) && (!f.to||day(row.created_at)<=f.to)); }
