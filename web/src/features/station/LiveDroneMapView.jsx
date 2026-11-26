import React, { useState, useEffect, useMemo, useRef } from "react";
import { API_ORIGIN, API_V1_URL } from "../../config/apiConfig";
import { getAccessToken } from "../dashboard/authBridge";
import RealGoogleMapView from "../../components/common/RealGoogleMapView";

const COMPLETED_STATUSES = new Set([
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
  "DELIVERY_FAILED",
]);

const ACTIVE_FLYING_PRIORITY = {
  IN_TRANSIT: 0,
  DELIVERING: 0,
  APPROACHING: 0,
  ARRIVED: 1,
  SCHEDULED: 2,
  APPROVED: 3,
  PENDING_APPROVAL: 4,
};

function filterAndPrioritizeActiveOrders(list) {
  return (Array.isArray(list) ? list : [])
    .filter((o) => !COMPLETED_STATUSES.has(String(o?.status || "").toUpperCase()))
    .sort((a, b) => {
      const pA = ACTIVE_FLYING_PRIORITY[String(a?.status || "").toUpperCase()] ?? 5;
      const pB = ACTIVE_FLYING_PRIORITY[String(b?.status || "").toUpperCase()] ?? 5;
      if (pA !== pB) return pA - pB;
      const tA = new Date(a?.createdAt || 0).getTime();
      const tB = new Date(b?.createdAt || 0).getTime();
      return tB - tA;
    });
}

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
  const [aiEta, setAiEta] = useState(null);
  const [aiWindSpeed, setAiWindSpeed] = useState(10);
  const [loadingAiEta, setLoadingAiEta] = useState(false);
  const knownActiveIdsRef = useRef(new Set());
  const currentOrderIdRef = useRef(null);

  useEffect(() => {
    currentOrderIdRef.current = currentOrder?.id || null;
  }, [currentOrder]);

  // Gọi AI ETA Prediction (/api/v1/ai/eta/{orderKey}) khi đổi đơn hoặc tốc độ gió
  useEffect(() => {
    let active = true;
    if (!currentOrder || COMPLETED_STATUSES.has(String(currentOrder.status || "").toUpperCase())) {
      setAiEta(null);
      return;
    }
    const key = currentOrder.id || orderId;
    if (!key) return;
    setLoadingAiEta(true);
    const token = getAccessToken();
    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    fetch(`${API_V1_URL}/ai/eta/${encodeURIComponent(key)}?windSpeedKmh=${aiWindSpeed}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) {
          setAiEta(data.data || data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingAiEta(false);
      });

    return () => {
      active = false;
    };
  }, [currentOrder, orderId, aiWindSpeed]);

  // Tự động tải & đồng bộ danh sách các chuyến bay ĐANG DIỄN RA (loại bỏ chuyến đã giao/đã hủy, ưu tiên đơn mới đặt!)
  useEffect(() => {
    let active = true;
    let firstLoad = true;

    async function loadActiveFlights() {
      try {
        const res = await fetch(`${API_V1_URL}/delivery-orders`);
        if (!res.ok) return;
        const payload = await res.json();
        if (!active) return;

        const rawList = Array.isArray(payload) ? payload : payload?.data || [];
        const activeList = filterAndPrioritizeActiveOrders(rawList);
        setRecentOrders(activeList);

        if (activeList.length === 0) {
          setCurrentOrder(null);
          setOrderStatus("IDLE");
          setServerTelemetry(null);
          knownActiveIdsRef.current = new Set();
          firstLoad = false;
          return;
        }

        if (firstLoad) {
          knownActiveIdsRef.current = new Set(activeList.map((o) => o.id));
          const initialMatch =
            activeList.find(
              (o) =>
                (o.trackingNumber === initialOrderId || o.id === initialOrderId) &&
                !COMPLETED_STATUSES.has(String(o.status || "").toUpperCase())
            ) || activeList[0];
          setCurrentOrder(initialMatch);
          setOrderId(initialMatch.trackingNumber || initialMatch.id);
          setOrderStatus(initialMatch.status || "IN_TRANSIT");
          firstLoad = false;
          return;
        }

        // Phát hiện đơn hàng mới đặt (VD: khách hàng vừa đặt trên Mobile App) -> Ưu tiên tự động bám theo đơn mới!
        const brandNewOrder = activeList.find(
          (o) => !knownActiveIdsRef.current.has(o.id)
        );
        knownActiveIdsRef.current = new Set(activeList.map((o) => o.id));

        if (brandNewOrder) {
          setCurrentOrder(brandNewOrder);
          setOrderId(brandNewOrder.trackingNumber || brandNewOrder.id);
          setOrderStatus(brandNewOrder.status || "IN_TRANSIT");
          setServerTelemetry(null);
          setSmoothProgress(0.02);
          return;
        }

        // Kiểm tra đơn hiện đang chọn: nếu đã chuyển sang DELIVERED thì tự động bỏ khỏi map và chuyển sang đơn đang bay khác
        const currentId = currentOrderIdRef.current;
        const stillActive = activeList.find((o) => o.id === currentId);
        if (!stillActive) {
          const next = activeList[0];
          setCurrentOrder(next);
          setOrderId(next.trackingNumber || next.id);
          setOrderStatus(next.status || "IN_TRANSIT");
          setServerTelemetry(null);
        } else {
          setCurrentOrder(stillActive);
          setOrderStatus(stillActive.status || "IN_TRANSIT");
        }
      } catch {
        // Bỏ qua lỗi mạng tạm thời
      }
    }

    loadActiveFlights();
    const orderPoll = setInterval(loadActiveFlights, 3000);
    return () => {
      active = false;
      clearInterval(orderPoll);
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

  // Đồng bộ điều khiển bay (Tạm dừng / Tiếp tục / Bay lại từ đầu) lên Backend để Mobile & Web khớp 1:1
  async function syncTelemetryControl(nextProgress, paused) {
    if (!orderId) return;
    setSmoothProgress(nextProgress);
    setIsSimulating(!paused);
    try {
      const res = await fetch(
        `${API_V1_URL}/delivery-orders/telemetry/${encodeURIComponent(orderId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress: nextProgress, paused }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          setServerTelemetry({
            ...json.data,
            clientReceivedMs: Date.now(),
          });
          setSmoothProgress(Number(json.data.progress ?? nextProgress));
        }
      }
    } catch { }
  }

  // Derive origin & destination from active order snapshot (ưu tiên tọa độ thực từ serverTelemetry / addressSnapshot)
  const routePoints = useMemo(() => {
    const snap = currentOrder?.addressSnapshot;
    const origin = {
      lat:
        Number(serverTelemetry?.originLat) ||
        Number(snap?.senderLatitude) ||
        DEFAULT_ORIGIN.lat,
      lng:
        Number(serverTelemetry?.originLng) ||
        Number(snap?.senderLongitude) ||
        DEFAULT_ORIGIN.lng,
      label:
        serverTelemetry?.originLabel ||
        snap?.senderAddressText ||
        DEFAULT_ORIGIN.label,
    };
    const destination = {
      lat:
        Number(serverTelemetry?.destLat) ||
        Number(snap?.recipientLatitude) ||
        DEFAULT_DESTINATION.lat,
      lng:
        Number(serverTelemetry?.destLng) ||
        Number(snap?.recipientLongitude) ||
        DEFAULT_DESTINATION.lng,
      label:
        serverTelemetry?.destLabel ||
        snap?.recipientAddressText ||
        DEFAULT_DESTINATION.label,
    };
    const distKm = calculateDistanceKm(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng
    );
    return { origin, destination, distKm };
  }, [currentOrder, serverTelemetry]);

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

  // Synchronized 1.5s Telemetry Polling with Backend (1:1 Sync between Web & Flutter Mobile)
  useEffect(() => {
    let active = true;
    if (!currentOrder || COMPLETED_STATUSES.has(String(currentOrder.status || "").toUpperCase())) {
      return;
    }

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
          setSmoothProgress(Number(json.data.progress ?? 0.05));
          setIsSimulating(!json.data.paused);
          setSignalrConnected(true);
          if (COMPLETED_STATUSES.has(String(json.data.orderStatus || "").toUpperCase())) {
            setOrderStatus(json.data.orderStatus);
          }
        }
      } catch {
        // Fallback to local clock
      }
    }

    fetchSyncedTelemetry();
    const pollTimer = setInterval(fetchSyncedTelemetry, 1500);

    return () => {
      active = false;
      clearInterval(pollTimer);
    };
  }, [orderId, currentOrder]);

  // 60 FPS Smooth Interpolation Loop between server sync ticks (matches Flutter Mobile 1:1)
  useEffect(() => {
    if (!currentOrder || COMPLETED_STATUSES.has(String(orderStatus || "").toUpperCase())) return;

    const frameTimer = setInterval(() => {
      if (serverTelemetry?.baseProgress != null) {
        if (serverTelemetry.paused) {
          setSmoothProgress(Number(serverTelemetry.baseProgress));
          return;
        }
        const elapsedSec = (Date.now() - (serverTelemetry.clientReceivedMs || Date.now())) / 1000.0;
        const speedPerSec = Number(serverTelemetry.speedPerSecond ?? 1.0 / 60.0);
        const raw = Number(serverTelemetry.baseProgress) + elapsedSec * speedPerSec;
        setSmoothProgress(Math.max(0, Math.min(1, raw)));
      }
    }, 50);

    return () => clearInterval(frameTimer);
  }, [currentOrder, orderStatus, serverTelemetry]);

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
        </div>
      </div>

      {/* Quick Select Active Flight Row (Chỉ hiển thị chuyến đang diễn ra / mới đặt, ẩn hoàn toàn chuyến đã giao) */}
      {recentOrders.length === 0 || !currentOrder || COMPLETED_STATUSES.has(String(orderStatus || "").toUpperCase()) ? (
        <div className="bg-white rounded-2xl border border-emerald-200/90 p-10 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-2xl">
            🛸
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Hiện Không Có Chuyến Bay Drone Nào Đang Diễn Ra
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Các chuyến hàng đã giao hoàn tất (<strong>DELIVERED</strong>) hoặc đã hủy sẽ tự động được gỡ khỏi bản đồ theo dõi trực tuyến. Ngay khi khách hàng đặt đơn mới trên App Mobile, đường bay thực tế và vị trí Drone sẽ tự động hiển thị đồng bộ tại đây!
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3 overflow-x-auto text-xs">
            <span className="text-emerald-800 font-bold shrink-0 uppercase tracking-wider text-[11px] whitespace-nowrap">
              Chuyến Đang Bay / Mới Đặt ({recentOrders.length}):
            </span>
            <div className="flex gap-2">
              {recentOrders.slice(0, 8).map((o, idx) => {
                const code = o.trackingNumber || String(o.id).slice(0, 8);
                const isSelected =
                  orderId === o.trackingNumber || orderId === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => selectOrder(o)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer whitespace-nowrap ${isSelected
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700"
                      }`}
                  >
                    {idx === 0 && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-extrabold ${isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"}`}>
                        MỚI NHẤT
                      </span>
                    )}
                    <span>{code}</span>
                    <span className="opacity-80">({o.status || "IN_TRANSIT"})</span>
                  </button>
                );
              })}
            </div>
          </div>

      {/* Map Mode Selector Bar */}
      {aiEta && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-mono font-extrabold text-[11px] whitespace-nowrap">
              AI Dự Báo ({aiEta.source})
            </span>
            <div>
              <div className="font-bold text-slate-900">
                Thời gian dự kiến đến nơi: <span className="text-emerald-700 font-mono text-sm">{aiEta.estimatedMinutes} phút</span> ({aiEta.distanceKm} km)
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                {aiEta.note || "Dự đoán bằng mô hình AI LLM."}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-semibold">Gió ngược:</span>
            <select
              value={aiWindSpeed}
              onChange={(e) => setAiWindSpeed(Number(e.target.value))}
              className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-white font-mono font-bold text-emerald-900"
            >
              <option value={0}>0 km/h (Trời lặng gió)</option>
              <option value={10}>10 km/h (Gió nhẹ)</option>
              <option value={20}>20 km/h (Gió vừa)</option>
              <option value={35}>35 km/h (Gió mạnh)</option>
            </select>
            {loadingAiEta && <span className="text-emerald-700 font-mono">Đang tính...</span>}
          </div>
        </div>
      )}

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

          {/* 3 Telemetry Readout Cards in Modern Light Green Theme */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* 3 Telemetry Readout Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
