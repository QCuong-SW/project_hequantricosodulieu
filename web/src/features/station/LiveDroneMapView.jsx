import React, { useState, useEffect } from "react";
import { API_ORIGIN } from "../../config/apiConfig";

const START_POINT = { lat: 10.7769, lng: 106.7009, label: "Trạm Quận 1 (STN-Q1)" };
const END_POINT = { lat: 10.8015, lng: 106.7145, label: "Trạm Thủ Đức (STN-TD)" };
const TOTAL_STEPS = 30;
const API_BASE_URL = API_ORIGIN;

export default function LiveDroneMapView({ initialOrderId = "ORD-2026-0001" }) {
  const [orderId, setOrderId] = useState(initialOrderId);
  const [step, setStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(true);
  const [orderStatus, setOrderStatus] = useState("IN_TRANSIT");

  const [serverTelemetry, setServerTelemetry] = useState(null);
  const [signalrConnected, setSignalrConnected] = useState(false);

  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpMessage, setOtpMessage] = useState("");

  useEffect(() => {
    let ws = null;
    try {
      const wsBaseUrl = API_BASE_URL.replace(/^http/, "ws");
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
          } catch {}
        }
      };
      ws.onclose = () => setSignalrConnected(false);
    } catch {
      setSignalrConnected(false);
    }
    return () => ws && ws.close();
  }, [orderId]);

  useEffect(() => {
    if (!isSimulating || orderStatus === "DELIVERED") return;

    const timer = setInterval(() => {
      setStep((prev) => (prev < TOTAL_STEPS ? prev + 1 : prev));
    }, 2000);

    return () => clearInterval(timer);
  }, [isSimulating, orderStatus]);

  const progress =
    serverTelemetry?.progressPercent != null
      ? serverTelemetry.progressPercent / 100
      : step / TOTAL_STEPS;

  const currentLat =
    serverTelemetry?.latitude != null
      ? serverTelemetry.latitude
      : (START_POINT.lat + (END_POINT.lat - START_POINT.lat) * progress).toFixed(6);

  const currentLng =
    serverTelemetry?.longitude != null
      ? serverTelemetry.longitude
      : (START_POINT.lng + (END_POINT.lng - START_POINT.lng) * progress).toFixed(6);

  const altitude =
    orderStatus === "DELIVERED"
      ? 0
      : serverTelemetry?.altitudeMeters ??
        (progress > 0.1 && progress < 0.9 ? 65 : progress >= 1 ? 5 : 20);

  const speed =
    orderStatus === "DELIVERED" || progress >= 1
      ? 0
      : serverTelemetry?.speedKmh ?? 42.5;

  const battery =
    serverTelemetry?.batteryPercent ?? Math.max(20, (98 - progress * 25).toFixed(1));

  const handleGenerateOtp = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery-confirmations/generate-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedOtp(data.demoOtp);
        setOtpInput(data.demoOtp);
        setOtpMessage(`Đã sinh mã OTP 6 số (băm SHA-256 trên Server): ${data.demoOtp}`);
        return;
      }
    } catch {}

    const fallbackOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(fallbackOtp);
    setOtpInput(fallbackOtp);
    setOtpMessage(`Mã OTP 6 số (Demo): ${fallbackOtp}`);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpInput.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery-confirmations/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, otpCode: otpInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrderStatus(data.orderStatus || "DELIVERED");
        setOtpMessage(data.message);
        return;
      }
    } catch {}

    if (otpInput.trim() === generatedOtp && generatedOtp !== "") {
      setOrderStatus("DELIVERED");
      setOtpMessage("Xác thực OTP thành công! Đơn hàng đã chuyển sang trạng thái DELIVERED.");
    } else {
      setOtpMessage("Mã OTP không khớp! Vui lòng kiểm tra lại.");
    }
  };

  const markerX = 90 + progress * 520;
  const markerY = 250 - progress * 165;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-blue-600 mb-1.5">
            REALTIME TELEMETRY / SIGNALR & PROOF OF DELIVERY
          </p>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Radar Giám Sát Hành Trình Drone Trực Tuyến
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cập nhật tọa độ GPS chu kỳ 2s/lần qua WebSocket SignalR (`/hubs/tracking`) và xác nhận giao hàng bằng OTP 6 số.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Mã vận đơn:</span>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 focus:outline-none focus:border-blue-500 w-44"
            />
          </div>

          <span
            className={`px-3 py-2 rounded-xl text-xs font-extrabold border ${
              orderStatus === "DELIVERED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}
          >
            {orderStatus}
          </span>

          <span
            className={`px-3 py-2 rounded-xl text-xs font-bold border ${
              signalrConnected
                ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                : "bg-slate-900 text-sky-400 border-slate-800"
            }`}
          >
            {signalrConnected
              ? "SignalR Connected (2s Live)"
              : "Simulator Active (2s GPS)"}
          </span>
        </div>
      </div>

      {/* Radar Map & Telemetry Panel */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl space-y-5">
        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
          <svg viewBox="0 0 700 320" className="w-full h-80 block">
            <defs>
              <pattern id="radarGrid" width="35" height="35" patternUnits="userSpaceOnUse">
                <path
                  d="M 35 0 L 0 0 0 35"
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.08)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="700" height="320" fill="url(#radarGrid)" />

            {/* Route Line */}
            <line
              x1="90"
              y1="250"
              x2="610"
              y2="85"
              stroke="#334155"
              strokeWidth="4"
            />
            <line
              x1="90"
              y1="250"
              x2={markerX}
              y2={markerY}
              stroke="#38bdf8"
              strokeWidth="4"
            />
            <line
              x1={markerX}
              y1={markerY}
              x2="610"
              y2="85"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeDasharray="8 6"
            />

            {/* Origin Station */}
            <circle cx="90" cy="250" r="14" fill="rgba(34, 197, 94, 0.2)" />
            <circle cx="90" cy="250" r="7" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
            <text x="45" y="282" fill="#e2e8f0" fontSize="12" fontWeight="bold">
              {START_POINT.label}
            </text>

            {/* Destination Station */}
            <circle cx="610" cy="85" r="14" fill="rgba(239, 68, 68, 0.2)" />
            <circle cx="610" cy="85" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
            <text x="495" y="55" fill="#e2e8f0" fontSize="12" fontWeight="bold">
              {END_POINT.label}
            </text>

            {/* Live Drone Marker */}
            <g transform={`translate(${markerX}, ${markerY})`}>
              <circle cx="0" cy="0" r="22" fill="rgba(56, 189, 248, 0.18)" />
              <circle cx="0" cy="0" r="9" fill="#38bdf8" stroke="#ffffff" strokeWidth="2.5" />
              <rect
                x="-62"
                y="-42"
                width="124"
                height="24"
                rx="6"
                fill="#0f172a"
                stroke="#38bdf8"
                strokeWidth="1.2"
              />
              <text
                x="0"
                y="-26"
                textAnchor="middle"
                fill="#38bdf8"
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
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tọa độ GPS (Lat, Lng)
            </div>
            <div className="mt-1.5 font-mono text-base font-bold text-white tabular-nums">
              {currentLat}, {currentLng}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Độ cao / Tốc độ bay
            </div>
            <div className="mt-1.5 font-mono text-base font-bold text-sky-400 tabular-nums">
              {altitude} m <span className="text-slate-600">|</span> {speed} km/h
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Dung lượng Pin Drone
            </div>
            <div className="mt-1.5 font-mono text-base font-bold text-emerald-400 tabular-nums">
              {battery}%
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsSimulating(!isSimulating)}
              className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer"
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
              className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
            >
              Bay lại
            </button>
          </div>
        </div>
      </div>

      {/* OTP Proof of Delivery Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Xác Nhận Giao Hàng Bằng Mã OTP 6 Số (SHA-256)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Phát hành mã OTP cho đơn <strong>{orderId}</strong> và xác thực chữ ký băm SHA-256 để hoàn tất giao hàng (`DELIVERED`).
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleGenerateOtp}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              1. Phát hành mã OTP
            </button>

            <form onSubmit={handleVerifyOtp} className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                placeholder="Nhập OTP 6 số..."
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                className="w-40 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white font-mono text-sm font-bold tracking-widest text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
              >
                2. Xác nhận nhận hàng
              </button>
            </form>
          </div>
        </div>

        {otpMessage && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs font-bold ${
              orderStatus === "DELIVERED"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            {otpMessage}
          </div>
        )}
      </div>
    </div>
  );
}
