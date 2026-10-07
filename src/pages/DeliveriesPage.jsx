import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";


function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function statusLabel(value) {
  return String(value || "-").replaceAll("_", " ");
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();
  let className = "status-badge";

  if (
    ["ACTIVE", "PAID", "READY_FOR_DELIVERY", "READY_FOR_BOOKING", "DELIVERED", "COMPLETED", "VALID"].includes(normalized)
  ) {
    className += " status-active";
  } else if (normalized === "COMPLETED_WITH_WINNER") {
    className += " status-success";
  } else if (
    ["PAYMENT_PENDING", "PAYMENT_REOPENED", "PENDING", "AWAITING_FINALIZER", "BOOKED", "PICKED_UP", "DROPPED_OFF", "IN_TRANSIT", "SHIPPED"].includes(normalized)
  ) {
    className += " status-warning";
  } else if (
    ["CANCELLED", "PAYMENT_EXPIRED", "FAILED", "EXPIRED", "REFUNDED", "INVALID"].includes(normalized)
  ) {
    className += " status-danger";
  } else {
    className += " status-muted";
  }

  return <span className={className}>{statusLabel(normalized)}</span>;
}

function MetricCard({ title, value, subtitle, onClick }) {
  return (
    <button type="button" className="metric-card metric-button" onClick={onClick}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-subtitle">{subtitle}</div>
    </button>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

export default function DeliveriesPage({ client, detailRequest, goToDeliveries, page, setErrorMessage, setPage, navigationFilter }) {
  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("ALL");
  useEffect(() => { if (navigationFilter?.page === "deliveries") { setDeliveryStatusFilter(navigationFilter.value); setDeliverySearch(""); } }, [navigationFilter]);
  const [deliveries, setDeliveries] = useState([]);

  const [detailLoading, setDetailLoading] = useState(false);

  const [deliveryDetail, setDeliveryDetail] = useState(null);

  const [bookingReference, setBookingReference] = useState("");

  const [trackingNumber, setTrackingNumber] = useState("");

  const [trackingUrl, setTrackingUrl] = useState("");

  const [deliveryActionLoading, setDeliveryActionLoading] = useState(false);

  const [deliveryActionMessage, setDeliveryActionMessage] = useState("");

  async function loadDeliveryDetail(deliveryId) {
    const { data, error } = await supabase
      .from("client_delivery_detail")
      .select("*")
      .eq("delivery_id", deliveryId)
      .maybeSingle();

    if (error) throw error;

    setDeliveryDetail(data);
    setBookingReference(data?.booking_reference || "");
    setTrackingNumber(data?.tracking_number || "");
    setTrackingUrl(data?.tracking_url || "");

    return data;
  }

  async function openDelivery(deliveryId) {
    setPage("delivery-detail");
    setDetailLoading(true);
    setDeliveryDetail(null);
    setDeliveryActionMessage("");
    setErrorMessage("");

    try {
      await loadDeliveryDetail(deliveryId);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load delivery detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function prepareDeliveryBooking() {
    if (!deliveryDetail?.delivery_id) return;

    setDeliveryActionLoading(true);
    setDeliveryActionMessage("");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-delivery-booking",
        {
          body: {
            delivery_id: deliveryDetail.delivery_id,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Unable to prepare courier booking.");

      await loadDeliveryDetail(deliveryDetail.delivery_id);

      if (data?.manual_booking_required) {
        setDeliveryActionMessage(
          data?.message || "Manual courier booking is ready for confirmation.",
        );
      } else {
        setDeliveryActionMessage("Courier booking prepared successfully.");
      }
    } catch (error) {
      setErrorMessage(error.message || "Unable to prepare courier booking.");
    } finally {
      setDeliveryActionLoading(false);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('\"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function printParcelLabel() {
    if (!deliveryDetail?.tracking_number) {
      setErrorMessage("A tracking number is required before printing a parcel label.");
      return;
    }

    const popup = window.open("", "_blank", "width=650,height=900");

    if (!popup) {
      setErrorMessage("The print window was blocked by the browser. Allow pop-ups and try again.");
      return;
    }

    const reference =
      deliveryDetail.group_number ||
      deliveryDetail.order_number ||
      deliveryDetail.delivery_id;

    const shipmentType =
      deliveryDetail.fulfillment_method === "CLIENT_DROP_OFF"
        ? "CLIENT DROP-OFF"
        : "COURIER PICKUP";

    const recipientAddress = [
      deliveryDetail.address_line1,
      deliveryDetail.address_line2,
      [deliveryDetail.city, deliveryDetail.province, deliveryDetail.postal_code]
        .filter(Boolean)
        .join(", "),
      deliveryDetail.country,
    ]
      .filter(Boolean)
      .join("<br>");

    const dropoffBlock =
      deliveryDetail.fulfillment_method === "CLIENT_DROP_OFF"
        ? `
          <div class="section">
            <div class="label">DROP-OFF LOCATION</div>
            <div class="strong">${escapeHtml(deliveryDetail.dropoff_location_name || "-")}</div>
            <div>${escapeHtml(deliveryDetail.dropoff_address || "-")}</div>
          </div>
        `
        : "";

    popup.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Parcel Label - ${escapeHtml(reference)}</title>
  <style>
    @page { size: 4in 6in; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
    .label-sheet { width: 4in; min-height: 6in; padding: 0.18in; border: 2px solid #000; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .courier { font-size: 22px; font-weight: 900; }
    .mode { font-size: 11px; font-weight: 700; border: 1px solid #000; padding: 4px 6px; }
    .tracking-label { font-size: 10px; font-weight: 700; margin-top: 12px; letter-spacing: .08em; }
    .tracking { font-size: 22px; font-weight: 900; letter-spacing: .04em; padding: 8px 0 12px; border-bottom: 2px solid #000; word-break: break-all; }
    .section { padding: 10px 0; border-bottom: 1px solid #000; font-size: 12px; line-height: 1.4; }
    .label { font-size: 9px; font-weight: 800; letter-spacing: .08em; margin-bottom: 4px; }
    .strong { font-size: 15px; font-weight: 800; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 12px; padding-top: 10px; font-size: 10px; }
    .meta b { display: block; font-size: 8px; letter-spacing: .06em; margin-bottom: 2px; }
    .notice { margin-top: 12px; padding-top: 8px; border-top: 1px dashed #000; font-size: 8px; line-height: 1.35; }
    @media print { body { width: 4in; height: 6in; } .label-sheet { border: 0; } }
  </style>
</head>
<body>
  <div class="label-sheet">
    <div class="top">
      <div>
        <div class="courier">${escapeHtml(deliveryDetail.courier_name || deliveryDetail.courier_code || "COURIER")}</div>
        <div style="font-size:10px">INTERNAL PARCEL LABEL</div>
      </div>
      <div class="mode">${escapeHtml(shipmentType)}</div>
    </div>

    <div class="tracking-label">TRACKING NUMBER</div>
    <div class="tracking">${escapeHtml(deliveryDetail.tracking_number)}</div>

    <div class="section">
      <div class="label">SHIP TO</div>
      <div class="strong">${escapeHtml(deliveryDetail.recipient_name || "-")}</div>
      <div>${escapeHtml(deliveryDetail.recipient_phone || "-")}</div>
      <div>${recipientAddress}</div>
    </div>

    ${dropoffBlock}

    <div class="section">
      <div class="label">SHIPMENT REFERENCE</div>
      <div class="strong">${escapeHtml(reference)}</div>
      <div>${escapeHtml(deliveryDetail.item_label || (deliveryDetail.order_group_id ? "Consolidated shipment" : "Shipment"))}</div>
    </div>

    <div class="meta">
      <div><b>BOOKING REFERENCE</b>${escapeHtml(deliveryDetail.booking_reference || "-")}</div>
      <div><b>DELIVERY STATUS</b>${escapeHtml(statusLabel(deliveryDetail.delivery_status))}</div>
      <div><b>COURIER CODE</b>${escapeHtml(deliveryDetail.courier_code || "-")}</div>
      <div><b>SHIPPING FEE</b>${escapeHtml(formatCurrency(deliveryDetail.shipping_fee))}</div>
    </div>

    <div class="notice">
      Internal system-generated parcel label. If the courier supplies an official waybill/label, use the official courier document for carrier acceptance and scanning.
    </div>
  </div>
  <script>
    window.onload = () => {
      setTimeout(() => window.print(), 150);
    };
  <\/script>
</body>
</html>`);

    popup.document.close();
    popup.focus();
  }

  async function confirmManualBooking(event) {
    event.preventDefault();
    if (!deliveryDetail?.delivery_id) return;

    setDeliveryActionLoading(true);
    setDeliveryActionMessage("");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "confirm-manual-delivery-booking",
        {
          body: {
            delivery_id: deliveryDetail.delivery_id,
            booking_reference: bookingReference.trim() || null,
            tracking_number: trackingNumber.trim(),
            tracking_url: trackingUrl.trim() || null,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Unable to confirm booking.");

      await loadDeliveryDetail(deliveryDetail.delivery_id);
      setDeliveryActionMessage("Booking confirmed successfully.");
    } catch (error) {
      setErrorMessage(error.message || "Unable to confirm booking.");
    } finally {
      setDeliveryActionLoading(false);
    }
  }

  async function updateDeliveryStatus(nextStatus) {
    if (!deliveryDetail?.delivery_id) return;

    setDeliveryActionLoading(true);
    setDeliveryActionMessage("");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "update-delivery-status",
        {
          body: {
            delivery_id: deliveryDetail.delivery_id,
            delivery_status: nextStatus,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Unable to update delivery status.");

      await loadDeliveryDetail(deliveryDetail.delivery_id);
      setDeliveryActionMessage(`Delivery moved to ${statusLabel(nextStatus)}.`);
    } catch (error) {
      setErrorMessage(error.message || "Unable to update delivery status.");
    } finally {
      setDeliveryActionLoading(false);
    }
  }

  const deliveryMetrics = useMemo(() => ({
    ready: deliveries.filter((d) => d.delivery_status === "READY_FOR_BOOKING").length,
    inTransit: deliveries.filter((d) => d.delivery_status === "IN_TRANSIT").length,
    delivered: deliveries.filter((d) => d.delivery_status === "DELIVERED").length,
  }), [deliveries]);

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      const matchesStatus =
        deliveryStatusFilter === "ALL" ||
        delivery.delivery_status === deliveryStatusFilter;

      const haystack = [
        delivery.order_number,
        delivery.item_label,
        delivery.buyer_name,
        delivery.recipient_name,
        delivery.courier_name,
        delivery.tracking_number,
        delivery.booking_reference,
        delivery.city,
        delivery.province,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !deliverySearch.trim() ||
        haystack.includes(deliverySearch.trim().toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [deliveries, deliveryStatusFilter, deliverySearch]);


  const [pageDataLoading, setPageDataLoading] = useState(true);
  const pageLoadVersion = useRef(0);
  async function loadPortal() {
    if (!client?.client_id) return;
    const version = ++pageLoadVersion.current;
    setPageDataLoading(true);
    setErrorMessage("");
    try {
      const results = await Promise.all([
        supabase.from("client_delivery_list").select("*").eq("client_id", client.client_id).order("created_at", { ascending: false })
      ]);
      if (version !== pageLoadVersion.current) return;
      for (const result of results) if (result.error) throw result.error;
      setDeliveries(results[0].data || []);
    } catch (error) {
      if (version === pageLoadVersion.current) setErrorMessage(error.message || "Unable to load this page.");
    } finally {
      if (version === pageLoadVersion.current) setPageDataLoading(false);
    }
  }
  useEffect(() => { loadPortal(); return () => { pageLoadVersion.current++; }; }, [client?.client_id]);

  useEffect(() => { if (detailRequest?.kind === "delivery" && page === "delivery-detail") openDelivery(detailRequest.id); }, [detailRequest]);
  if (pageDataLoading) return <div className="loading-card"><h2>Loading page</h2></div>;
  return (<>
    {page === "deliveries" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">DELIVERY MANAGEMENT</p>
                <h1>Delivery</h1>
                <p>Track paid orders from booking to successful delivery.</p>
              </div>
              <button className="icon-button refresh-icon-button" onClick={loadPortal} title="Refresh" aria-label="Refresh">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" />
            <path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" />
          </svg>
        </button>
            </header>

            <section className="metrics-grid compact-metrics">
              <MetricCard title="Ready for booking" value={deliveryMetrics.ready} subtitle="Paid orders" onClick={() => goToDeliveries("READY_FOR_BOOKING")} />
              <MetricCard title="In transit" value={deliveryMetrics.inTransit} subtitle="On the way" onClick={() => goToDeliveries("IN_TRANSIT")} />
              <MetricCard title="Delivered" value={deliveryMetrics.delivered} subtitle="Completed" onClick={() => goToDeliveries("DELIVERED")} />
            </section>

            <section className="toolbar-card">
              <input className="search-input" value={deliverySearch} onChange={(e) => setDeliverySearch(e.target.value)} placeholder="Search order, recipient, courier or tracking..." />
              <select className="filter-select" value={deliveryStatusFilter} onChange={(e) => setDeliveryStatusFilter(e.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="READY_FOR_BOOKING">Ready for booking</option>
                <option value="BOOKED">Booked</option>
                <option value="PICKED_UP">Picked up</option>
                <option value="DROPPED_OFF">Dropped off</option>
                <option value="IN_TRANSIT">In transit</option>
                <option value="DELIVERED">Delivered</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </section>

            <section className="dashboard-panel">
              <div className="panel-header"><div><h2>Delivery list</h2><p>{filteredDeliveries.length} record(s)</p></div></div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Order</th><th>Item</th><th>Recipient</th><th>Courier</th><th>Tracking</th><th>Status</th><th>Shipping fee</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {filteredDeliveries.map((delivery) => (
                      <tr key={delivery.delivery_id} className="clickable-row" onClick={() => openDelivery(delivery.delivery_id)}>
                        <td>{delivery.order_number}</td>
                        <td>{delivery.item_label}</td>
                        <td>{delivery.recipient_name || delivery.buyer_name || "-"}</td>
                        <td>{delivery.courier_name || "-"}</td>
                        <td>{delivery.tracking_number || "-"}</td>
                        <td><StatusBadge status={delivery.delivery_status} /></td>
                        <td>{formatCurrency(delivery.shipping_fee)}</td>
                        <td>{formatDateTime(delivery.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
    {page === "delivery-detail" && (
          <>
            <button className="back-button" onClick={() => setPage("deliveries")}>← Back to delivery</button>

            {detailLoading ? (
              <div className="loading-card detail-loading"><h2>Loading delivery</h2></div>
            ) : deliveryDetail ? (
              <>
                <header className="dashboard-header">
                  <div>
                    <p className="eyebrow">DELIVERY DETAIL</p>
                    <h1>{deliveryDetail.group_number || deliveryDetail.order_number || deliveryDetail.delivery_id}</h1>
                    <p>{deliveryDetail.item_label || (deliveryDetail.order_group_id ? "Consolidated shipment" : "Shipment")}</p>
                  </div>
                  <div className="header-actions">
                    {deliveryDetail.tracking_number && (
                      <button className="secondary-button" type="button" onClick={printParcelLabel}>
                        Print Parcel Label
                      </button>
                    )}
                    <StatusBadge status={deliveryDetail.delivery_status} />
                  </div>
                </header>

                <section className="detail-grid">
                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Courier & Fulfillment</h2></div>
                    <DetailRow label="Courier code" value={deliveryDetail.courier_code || "-"} />
                    <DetailRow label="Courier name" value={deliveryDetail.courier_name || "-"} />
                    <DetailRow label="Fulfillment method" value={statusLabel(deliveryDetail.fulfillment_method || "PICKUP_BY_COURIER")} />
                    <DetailRow label="Courier status" value={deliveryDetail.courier_status || "-"} />
                    <DetailRow label="Booking reference" value={deliveryDetail.booking_reference || "-"} />
                    <DetailRow label="Tracking number" value={deliveryDetail.tracking_number || "-"} />
                    <DetailRow label="Tracking URL" value={deliveryDetail.tracking_url || "-"} />
                    <DetailRow label="Shipping fee" value={formatCurrency(deliveryDetail.shipping_fee)} />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Recipient</h2></div>
                    <DetailRow label="Name" value={deliveryDetail.recipient_name || "-"} />
                    <DetailRow label="Phone" value={deliveryDetail.recipient_phone || "-"} />
                    <DetailRow label="Address 1" value={deliveryDetail.address_line1 || "-"} />
                    <DetailRow label="Address 2" value={deliveryDetail.address_line2 || "-"} />
                    <DetailRow label="City" value={deliveryDetail.city || "-"} />
                    <DetailRow label="Province" value={deliveryDetail.province || "-"} />
                    <DetailRow label="Postal code" value={deliveryDetail.postal_code || "-"} />
                    <DetailRow label="Country" value={deliveryDetail.country || "-"} />
                  </div>

                  {deliveryDetail.fulfillment_method === "CLIENT_DROP_OFF" && (
                    <div className="detail-card">
                      <div className="detail-card-header"><h2>Drop-off Location</h2></div>
                      <DetailRow label="Branch" value={deliveryDetail.dropoff_location_name || "-"} />
                      <DetailRow label="Address" value={deliveryDetail.dropoff_address || "-"} />
                      <DetailRow label="Latitude" value={deliveryDetail.dropoff_lat ?? "-"} />
                      <DetailRow label="Longitude" value={deliveryDetail.dropoff_lng ?? "-"} />
                    </div>
                  )}

                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Timeline</h2></div>
                    <DetailRow label="Booked at" value={formatDateTime(deliveryDetail.booked_at)} />
                    <DetailRow label="Picked up at" value={formatDateTime(deliveryDetail.picked_up_at)} />
                    <DetailRow label="Dropped off at" value={formatDateTime(deliveryDetail.dropped_off_at)} />
                    <DetailRow label="In transit at" value={formatDateTime(deliveryDetail.shipped_at)} />
                    <DetailRow label="Delivered at" value={formatDateTime(deliveryDetail.delivered_at)} />
                    <DetailRow label="Failed at" value={formatDateTime(deliveryDetail.failed_at)} />
                    <DetailRow label="Cancelled at" value={formatDateTime(deliveryDetail.cancelled_at)} />
                  </div>
                </section>

                {deliveryDetail.delivery_status === "READY_FOR_BOOKING" && (
                  <section className="form-card">
                    <div className="form-card-header">
                      <div>
                        <h2>Confirm Manual Courier Booking</h2>
                        <p>Prepare the shipment first, then enter the real booking and tracking details from the courier.</p>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={deliveryActionLoading}
                        onClick={prepareDeliveryBooking}
                      >
                        Prepare Booking
                      </button>
                    </div>

                    <form className="inline-form-grid" onSubmit={confirmManualBooking}>
                      <label>
                        Booking Reference
                        <input type="text" value={bookingReference} onChange={(e) => setBookingReference(e.target.value)} placeholder="Optional" />
                      </label>

                      <label>
                        Tracking Number
                        <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Required" required />
                      </label>

                      <label className="wide-field">
                        Tracking URL
                        <input type="url" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="Optional" />
                      </label>

                      <div className="wide-field form-actions">
                        <button className="primary-button" type="submit" disabled={deliveryActionLoading}>
                          {deliveryActionLoading ? "Saving..." : "Confirm Booking"}
                        </button>
                      </div>
                    </form>
                  </section>
                )}

                {deliveryDetail.delivery_status === "BOOKED" && deliveryDetail.fulfillment_method === "CLIENT_DROP_OFF" && (
                  <section className="action-card">
                    <div>
                      <h2>Confirm Parcel Drop-off</h2>
                      <p>Use this after the client has handed the parcel to the selected courier branch.</p>
                    </div>
                    <button className="primary-button" disabled={deliveryActionLoading} onClick={() => updateDeliveryStatus("DROPPED_OFF")}>
                      Mark Dropped Off
                    </button>
                  </section>
                )}

                {deliveryDetail.delivery_status === "BOOKED" && deliveryDetail.fulfillment_method !== "CLIENT_DROP_OFF" && (
                  <section className="action-card">
                    <div>
                      <h2>Parcel Pickup</h2>
                      <p>Use this when the courier has physically received the parcel from the pickup location.</p>
                    </div>
                    <button className="primary-button" disabled={deliveryActionLoading} onClick={() => updateDeliveryStatus("PICKED_UP")}>
                      Mark Picked Up
                    </button>
                  </section>
                )}

                {["PICKED_UP", "DROPPED_OFF"].includes(deliveryDetail.delivery_status) && (
                  <section className="action-card">
                    <div><h2>Shipment In Transit</h2><p>Use this when the parcel is moving through the courier network.</p></div>
                    <button className="primary-button" disabled={deliveryActionLoading} onClick={() => updateDeliveryStatus("IN_TRANSIT")}>Mark In Transit</button>
                  </section>
                )}

                {deliveryDetail.delivery_status === "IN_TRANSIT" && (
                  <section className="action-card">
                    <div><h2>Delivery Completion</h2><p>Use this only after the parcel reaches the recipient.</p></div>
                    <button className="primary-button" disabled={deliveryActionLoading} onClick={() => updateDeliveryStatus("DELIVERED")}>Mark Delivered</button>
                  </section>
                )}

                {deliveryDetail.delivery_status === "DELIVERED" && (
                  <section className="completion-card">
                    <strong>Delivery completed</strong>
                    <span>{formatDateTime(deliveryDetail.delivered_at)}</span>
                  </section>
                )}
              </>
            ) : null}
          </>
        )}
  </>);
}
