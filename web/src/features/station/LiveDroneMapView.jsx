import React, { useState, useEffect, useMemo } from "react";
import { API_ORIGIN, API_V1_URL } from "../../config/apiConfig";
import RealGoogleMapView from "../../components/common/RealGoogleMapView";

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 12.5;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const DEFAULT_ORIGIN = {
  lat: 10.771595,
  lng: 106.70475,
  label: "Trạm Trung Tâm Quận 1 (Bitexco)",
};
const DEFAULT_DESTINATION = {
  lat: 10.841128,
  lng: 106.809883,
  label: "Khu Công Nghệ Cao (TP. Thủ Đức)",
};
const TOTAL_STEPS = 30;

export default function LiveDroneMapView({ initialOrderId = "ORD-2026-0001" }) {
  const [orderId, setOrderId] = useState(initialOrderId);
  const [recentOrders, setRecentOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [step, setStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(true);
  const [orderStatus, setOrderStatus] = useState("IN_TRANSIT");

  const [serverTelemetry, setServerTelemetry] = useState(null);
  const [smoothProgress, setSmoothProgress] = useState(0.35);
  const [signalrConnected, setSignalrConnected] = useState(false);

  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [displayEngine, setDisplayEngine] = useState("GOOGLE_MAPS"); // 'GOOGLE_MAPS' | 'RADAR'

  // Load recent orders from Backend API
  useEffect(() => {
    let active = true;
    fetch(`${API_V1_URL}/delivery-orders`)
      .then((res) => (res.ok ? res.json() : []))
      .then((payload) => {
        if (!active) return;
        const list = Array.isArray(payload) ? payload : payload?.data || [];
        setRecentOrders(list);
        if (list.length > 0) {
          const match =
            list.find(
              (o) =>
                o.trackingNumber === initialOrderId ||
                o.id === initialOrderId
            ) || list[0];
          if (match) {
            setCurrentOrder(match);
            setOrderId(match.trackingNumber || match.id);
            if (match.status) setOrderStatus(match.status);
          }
        }
      })
      .catch(() => { });

    return () => {
      active = false;
    };
  }, [initialOrderId]);

  // Handle switching order
  function selectOrder(targetOrder) {
    setCurrentOrder(targetOrder);
    setOrderId(targetOrder.trackingNumber || targetOrder.id);
    setOrderStatus(targetOrder.status || "IN_TRANSIT");
    setStep(0);
    setServerTelemetry(null);
    setGeneratedOtp("");
    setOtpInput("");
    setOtpMessage("");
  }

  // Derive origin & destination from active order snapshot
  const routePoints = useMemo(() => {
    const snap = currentOrder?.addressSnapshot;
    const origin = {
      lat: Number(snap?.senderLatitude) || DEFAULT_ORIGIN.lat,
      lng: Number(snap?.senderLongitude) || DEFAULT_ORIGIN.lng,
      label: snap?.senderAddressText || DEFAULT_ORIGIN.label,
    };
    const destination = {
      lat: Number(snap?.recipientLatitude) || DEFAULT_DESTINATION.lat,
      lng: Number(snap?.recipientLongitude) || DEFAULT_DESTINATION.lng,
      label: snap?.recipientAddressText || DEFAULT_DESTINATION.label,
    };
    const distKm = calculateDistanceKm(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng
    );
    return { origin, destination, distKm };
  }, [currentOrder]);

  // SignalR WebSocket connection
  useEffect(() => {
    let ws = null;
    try {
      const wsBaseUrl = API_ORIGIN.replace(/^http/, "ws");
      ws = new WebSocket(`${wsBaseUrl}/hubs/tracking`);
      ws.onopen = () => {
        ws.send(JSON.stringify({ protocol: "json", version: 1 }) + "\x1e");
        ws.send(
          JSON.stringify({
            type: 1,
            target: "JoinOrderTrackingGroup",
            arguments: [orderId],
          }) + "\x1e"
        );
        setSignalrConnected(true);
      };
      ws.onmessage = (event) => {
        const frames = String(event.data).split("\x1e").filter(Boolean);
        for (const frame of frames) {
          try {
            const msg = JSON.parse(frame);
            if (msg.target === "ReceiveDronePosition" && msg.arguments?.[0]) {
              setServerTelemetry(msg.arguments[0]);
            }
          } catch { }
        }
      };
      ws.onclose = () => setSignalrConnected(false);
    } catch {
      setSignalrConnected(false);
    }
    return () => ws && ws.close();
  }, [orderId]);

  // Synchronized 2s Telemetry Polling with Backend (1:1 Sync between Web & Flutter Mobile)
  useEffect(() => {
    let active = true;

    async function fetchSyncedTelemetry() {
      if (!orderId) return;
      try {
        const res = await fetch(`${API_V1_URL}/delivery-orders/telemetry/${encodeURIComponent(orderId)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (active && json?.data) {
          setServerTelemetry({
            ...json.data,
            clientReceivedMs: Date.now(),
          });
          setSmoothProgress(Number(json.data.progress ?? 0.35));
          setSignalrConnected(true);
          if (json.data.orderStatus === "DELIVERED") {
            setOrderStatus("DELIVERED");
          }
        }
      } catch {
        // Fallback to local clock
      }
    }

    fetchSyncedTelemetry();
    const pollTimer = setInterval(() => {
      if (isSimulating) {
        fetchSyncedTelemetry();
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(pollTimer);
    };
  }, [orderId, isSimulating]);

  // 60 FPS Smooth Interpolation Loop between server sync ticks (matches Flutter Mobile 1:1)
  useEffect(() => {
    if (!isSimulating || orderStatus === "DELIVERED") return;

    const frameTimer = setInterval(() => {
      if (serverTelemetry?.baseProgress != null) {
        if (serverTelemetry.paused) {
          setSmoothProgress(Number(serverTelemetry.baseProgress));
          return;
        }
        const elapsedSec = (Date.now() - (serverTelemetry.clientReceivedMs || Date.now())) / 1000.0;
        const speedPerSec = Number(serverTelemetry.speedPerSecond ?? 0.02);
        const raw = Number(serverTelemetry.baseProgress) + elapsedSec * speedPerSec;
        const nextP = raw >= 0.98 ? 0.15 + ((raw - 0.15) % 0.83) : raw;
        setSmoothProgress(Math.max(0, Math.min(1, nextP)));
      } else {
        setSmoothProgress((prev) => (prev >= 0.98 ? 0.15 : prev + 0.001));
      }
    }, 50);

    return () => clearInterval(frameTimer);
  }, [isSimulating, orderStatus, serverTelemetry]);

  const progress = orderStatus === "DELIVERED" ? 1.0 : smoothProgress;

  const currentLat = (
    routePoints.origin.lat +
    (routePoints.destination.lat - routePoints.origin.lat) * progress
  ).toFixed(6);

  const currentLng = (
    routePoints.origin.lng +
    (routePoints.destination.lng - routePoints.origin.lng) * progress
  ).toFixed(6);

  const altitude =
    orderStatus === "DELIVERED"
      ? 0
      : serverTelemetry?.altitudeMeters ??
      (progress > 0.1 && progress < 0.9 ? 65 : progress >= 1 ? 5 : 20);

  const speed =
    orderStatus === "DELIVERED" || progress >= 1
      ? 0
      : serverTelemetry?.speedKmh ?? 45.0;

  const battery =
    serverTelemetry?.batteryPercent ??
    Math.max(20, (98 - progress * 22).toFixed(1));

  const handleGenerateOtp = async () => {
    try {
      const res = await fetch(
        `${API_ORIGIN}/api/v1/delivery-confirmations/generate-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setGeneratedOtp(data.demoOtp);
        setOtpInput(data.demoOtp);
        setOtpMessage(
          `Đã phát hành mã OTP 6 số (mã hóa băm SHA-256): ${data.demoOtp}`
        );
        return;
      }
    } catch { }

    const fallbackOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(fallbackOtp);
    setOtpInput(fallbackOtp);
    setOtpMessage(`Mã OTP 6 số (Giả lập): ${fallbackOtp}`);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpInput.trim()) return;

    try {
      const res = await fetch(
        `${API_ORIGIN}/api/v1/delivery-confirmations/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, otpCode: otpInput }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setOrderStatus(data.orderStatus || "DELIVERED");
        setOtpMessage(
          `Xác nhận thành công: ${data.message || "Đơn hàng đã hoàn tất giao hàng (DELIVERED)."}`
        );
        return;
      }
    } catch { }

    if (otpInput.trim() === generatedOtp && generatedOtp !== "") {
      setOrderStatus("DELIVERED");
      setOtpMessage(
        "Xác thực OTP thành công! Đơn hàng đã chuyển sang trạng thái DELIVERED."
      );
    } else {
      setOtpMessage("Mã OTP không chính xác hoặc đã hết hạn! Vui lòng thử lại.");
    }
  };

  const markerX = 90 + progress * 520;
  const markerY = 250 - progress * 165;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-emerald-900/10">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Radar Giám Sát Hành Trình Drone Trực Tuyến
          </h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-emerald-200/80 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Mã đơn:</span>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 focus:outline-none focus:border-emerald-600 w-44"
            />
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border ${orderStatus === "DELIVERED"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : orderStatus === "IN_TRANSIT"
                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${orderStatus === "DELIVERED"
                ? "bg-emerald-500"
                : orderStatus === "IN_TRANSIT"
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-amber-500"
                }`}
            ></span>
            {orderStatus}
          </span>

          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${signalrConnected
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-teal-50 text-teal-800 border-teal-200"
              }`}
          >
            {signalrConnected
              ? "SignalR Connected (2s Telemetry)"
              : "Simulator Fallback (2s GPS)"}
          </span>
        </div>
      </div>

      {/* Quick Select Order Row */}
      {recentOrders.length > 0 && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3 overflow-x-auto text-xs">
          <span className="text-slate-500 font-bold shrink-0 uppercase tracking-wider text-[11px]">
            Chọn Đơn Bay Nhanh:
          </span>
          <div className="flex gap-2">
            {recentOrders.slice(0, 5).map((o) => {
              const code = o.trackingNumber || String(o.id).slice(0, 8);
              const isSelected =
                orderId === o.trackingNumber || orderId === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => selectOrder(o)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer whitespace-nowrap ${isSelected
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700"
                    }`}
                >
                  {code} ({o.status || "PENDING"})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Map Mode Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">
            Chế độ Bản đồ:
          </span>
          <button
            type="button"
            onClick={() => setDisplayEngine("GOOGLE_MAPS")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${displayEngine === "GOOGLE_MAPS"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
          >
            <span>🗺️ Bản Đồ Google Maps Thật</span>
            <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-mono font-bold">
              CALL API GOOGLE
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDisplayEngine("RADAR")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${displayEngine === "RADAR"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
          >
            <span>📡 Radar HUD Chiến Thuật</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Google Maps Platform Engine • GPS 2s Polling</span>
        </div>
      </div>

      {/* Main Map View & Telemetry Panel */}
      {displayEngine === "GOOGLE_MAPS" ? (
        <div className="space-y-4">
          <RealGoogleMapView
            origin={routePoints.origin}
            destination={routePoints.destination}
            droneCurrent={{
              lat: currentLat,
              lng: currentLng,
              altitude,
              speed,
              battery,
              progress,
            }}
            droneCode={currentOrder?.droneCode || "DRN-VN-04"}
            heightClass="h-[420px] md:h-[500px]"
            showControls={true}
            showTelemetryOverlay={true}
          />

          {/* 4 Telemetry Readout Cards in Modern Light Green Theme */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Tọa độ GPS Hiện Tại (Real-time)
              </div>
              <div className="mt-1.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                {currentLat}, {currentLng}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium mt-1">
                Khu vực: TP. Hồ Chí Minh
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Độ Cao &amp; Tốc Độ Bay
              </div>
              <div className="mt-1.5 font-mono text-base font-bold text-emerald-700 tabular-nums">
                {altitude} m <span className="text-slate-300">|</span> {speed} km/h
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Khoảng cách: ~{routePoints.distKm} km
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Dung Lượng Pin Drone
              </div>
              <div className="mt-1.5 font-mono text-base font-bold text-emerald-700 tabular-nums flex items-center justify-between">
                <span>{battery}%</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-sans font-bold">
                  Khỏe mạnh
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, battery))}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsSimulating(!isSimulating)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                {isSimulating ? "Tạm dừng bay" : "Tiếp tục bay"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(0);
                  setOrderStatus("IN_TRANSIT");
                  setServerTelemetry(null);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition cursor-pointer"
              >
                Bay lại từ đầu
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Radar Map & Telemetry Panel (Light Theme HUD) */
        <div className="bg-white border border-emerald-200/90 rounded-2xl p-6 text-slate-900 shadow-md shadow-emerald-900/5 space-y-5">
          <div className="relative rounded-xl overflow-hidden border border-emerald-200/80 bg-emerald-50/40">
            <svg viewBox="0 0 700 320" className="w-full h-80 block">
              <defs>
                <pattern
                  id="radarGrid"
                  width="35"
                  height="35"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 35 0 L 0 0 0 35"
                    fill="none"
                    stroke="rgba(16, 185, 129, 0.16)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="700" height="320" fill="url(#radarGrid)" />

              {/* Route Lines */}
              <line
                x1="90"
                y1="250"
                x2="610"
                y2="85"
                stroke="#d1fae5"
                strokeWidth="4"
              />
              <line
                x1="90"
                y1="250"
                x2={markerX}
                y2={markerY}
                stroke="#059669"
                strokeWidth="4"
              />
              <line
                x1={markerX}
                y1={markerY}
                x2="610"
                y2="85"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeDasharray="8 6"
              />

              {/* Origin Station */}
              <circle cx="90" cy="250" r="14" fill="rgba(16, 185, 129, 0.2)" />
              <circle
                cx="90"
                cy="250"
                r="7"
                fill="#059669"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <text x="35" y="282" fill="#0f172a" fontSize="11" fontWeight="bold">
                {routePoints.origin.label.length > 32
                  ? `${routePoints.origin.label.slice(0, 32)}...`
                  : routePoints.origin.label}
              </text>

              {/* Destination Point */}
              <circle cx="610" cy="85" r="14" fill="rgba(244, 63, 94, 0.2)" />
              <circle
                cx="610"
                cy="85"
                r="7"
                fill="#f43f5e"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <text
                x="460"
                y="55"
                fill="#0f172a"
                fontSize="11"
                fontWeight="bold"
              >
                {routePoints.destination.label.length > 32
                  ? `${routePoints.destination.label.slice(0, 32)}...`
                  : routePoints.destination.label}
              </text>

              {/* Live Drone Marker */}
              <g transform={`translate(${markerX}, ${markerY})`}>
                <circle cx="0" cy="0" r="22" fill="rgba(16, 185, 129, 0.22)" />
                <circle
                  cx="0"
                  cy="0"
                  r="9"
                  fill="#059669"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <rect
                  x="-62"
                  y="-42"
                  width="124"
                  height="24"
                  rx="6"
                  fill="#ffffff"
                  stroke="#059669"
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="-26"
                  textAnchor="middle"
                  fill="#047857"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="JetBrains Mono, monospace"
                >
                  DRN-VN-04 • {Math.round(progress * 100)}%
                </text>
              </g>
            </svg>
          </div>

          {/* 4 Telemetry Readout Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Tọa độ GPS Hiện Tại
              </div>
              <div className="mt-1.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                {currentLat}, {currentLng}
              </div>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Độ Cao / Tốc Độ Bay
              </div>
              <div className="mt-1.5 font-mono text-base font-bold text-emerald-700 tabular-nums">
                {altitude} m <span className="text-slate-300">|</span> {speed}{" "}
                km/h
              </div>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Dung Lượng Pin Drone
              </div>
              <div className="mt-1.5 font-mono text-base font-bold text-emerald-700 tabular-nums">
                {battery}%
              </div>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsSimulating(!isSimulating)}
                className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                {isSimulating ? "Tạm dừng" : "Tiếp tục"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(0);
                  setOrderStatus("IN_TRANSIT");
                  setServerTelemetry(null);
                }}
                className="flex-1 py-2 px-3 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 transition cursor-pointer"
              >
                Bay lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Proof of Delivery Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Xác Nhận Nhận Hàng An Toàn Bằng Mã OTP 6 Số (SHA-256)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Phát hành mã OTP cho đơn hàng <strong>{orderId}</strong> và xác
              thực chữ ký băm mật mã để chuyển đổi trạng thái sang{" "}
              <strong className="text-emerald-700 font-mono">DELIVERED</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleGenerateOtp}
              className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition cursor-pointer shadow-2xs"
            >
              Phát hành mã OTP
            </button>

            <form onSubmit={handleVerifyOtp} className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                placeholder="Nhập OTP 6 số..."
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                className="w-40 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white font-mono text-sm font-bold tracking-widest text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/20 transition cursor-pointer"
              >
                Xác thực giao hàng
              </button>
            </form>
          </div>
        </div>

        {otpMessage && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs font-bold ${orderStatus === "DELIVERED"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-emerald-50/70 border-emerald-200 text-emerald-900"
              }`}
          >
            {otpMessage}
          </div>
        )}
      </div>
    </div>
  );
}
