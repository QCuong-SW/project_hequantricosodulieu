import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  getGoogleMapsExternalLink,
  getGoogleMapsApiKey,
  setGoogleMapsApiKey,
} from '../../services/googleMapsService';

/**
 * Web Mercator Projection Helpers (256x256 Google Maps Tiles)
 */
function lngToWorldX(lng, zoom) {
  return ((Number(lng) + 180) / 360) * 256 * Math.pow(2, zoom);
}

function latToWorldY(lat, zoom) {
  const rad = (Number(lat) * Math.PI) / 180;
  const n = Math.PI - Math.log(Math.tan(Math.PI / 4 + rad / 2));
  return (n / (2 * Math.PI)) * 256 * Math.pow(2, zoom);
}

/**
 * RealGoogleMapView - Bản đồ Google Maps thực tế trực quan (60 FPS Smooth Gliding Drone)
 * Sử dụng trực tiếp hệ thống Tile bản đồ thật của Google Maps (mt1.google.com/vt/lyrs=m / y / s)
 * kết hợp lớp Vector Route + Drone Marker bay mượt theo thời gian thực đồng bộ 1:1 với App Mobile!
 */
export default function RealGoogleMapView({
  origin = { lat: 10.771595, lng: 106.70475, label: 'Trạm Trung Tâm Quận 1' },
  destination = { lat: 10.841128, lng: 106.809883, label: 'Khu Công Nghệ Cao TP. Thủ Đức' },
  droneCurrent = null, // { lat, lng, altitude, speed, battery, progress }
  droneCode = 'DRN-VN-04',
  heightClass = 'h-96 md:h-[480px]',
  showControls = true,
  showTelemetryOverlay = true,
}) {
  const [mapType, setMapType] = useState('m'); // m: đường phố, k: vệ tinh, h: hỗn hợp
  const [viewTarget, setViewTarget] = useState('ROUTE'); // 'DRONE' | 'ROUTE' | 'ORIGIN' | 'DESTINATION'
  const [zoom, setZoom] = useState(13);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const [viewport, setViewport] = useState({ width: 900, height: 480 });

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getGoogleMapsApiKey());
  const [keySavedMessage, setKeySavedMessage] = useState('');

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setViewport({ width, height });
        }
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const progress = Number(droneCurrent?.progress ?? 0.5);
  const oLat = Number(origin.lat) || 10.771595;
  const oLng = Number(origin.lng) || 106.70475;
  const dLat = Number(destination.lat) || 10.841128;
  const dLng = Number(destination.lng) || 106.809883;

  const droneLat = Number(droneCurrent?.lat) || oLat + (dLat - oLat) * progress;
  const droneLng = Number(droneCurrent?.lng) || oLng + (dLng - oLng) * progress;

  // Tọa độ tâm bản đồ theo chế độ Camera
  const centerCoord = useMemo(() => {
    switch (viewTarget) {
      case 'ORIGIN':
        return { lat: oLat, lng: oLng };
      case 'DESTINATION':
        return { lat: dLat, lng: dLng };
      case 'DRONE':
        return { lat: droneLat, lng: droneLng };
      case 'ROUTE':
      default:
        return {
          lat: (oLat + dLat) / 2,
          lng: (oLng + dLng) / 2,
        };
    }
  }, [viewTarget, oLat, oLng, dLat, dLng, droneLat, droneLng]);

  const centerWorldX = lngToWorldX(centerCoord.lng, zoom) - panOffset.x;
  const centerWorldY = latToWorldY(centerCoord.lat, zoom) - panOffset.y;

  // Chuyển đổi (lat, lng) sang tọa độ pixel trên khung bản đồ
  const projectToScreen = (lat, lng) => {
    const wx = lngToWorldX(lng, zoom);
    const wy = latToWorldY(lat, zoom);
    return {
      x: viewport.width / 2 + (wx - centerWorldX),
      y: viewport.height / 2 + (wy - centerWorldY),
    };
  };

  const originPt = projectToScreen(oLat, oLng);
  const destPt = projectToScreen(dLat, dLng);
  const dronePt = projectToScreen(droneLat, droneLng);

  // Tính danh sách các ô Tile Google Maps thật phủ kín khung nhìn
  const tiles = useMemo(() => {
    const maxTile = Math.pow(2, zoom);
    const minWorldX = centerWorldX - viewport.width / 2 - 256;
    const maxWorldX = centerWorldX + viewport.width / 2 + 256;
    const minWorldY = centerWorldY - viewport.height / 2 - 256;
    const maxWorldY = centerWorldY + viewport.height / 2 + 256;

    const startTx = Math.floor(minWorldX / 256);
    const endTx = Math.floor(maxWorldX / 256);
    const startTy = Math.max(0, Math.floor(minWorldY / 256));
    const endTy = Math.min(maxTile - 1, Math.floor(maxWorldY / 256));

    const lyrs = mapType === 'k' ? 's' : mapType === 'h' ? 'y' : 'm';
    const list = [];

    for (let tx = startTx; tx <= endTx; tx++) {
      for (let ty = startTy; ty <= endTy; ty++) {
        const wrappedTx = ((tx % maxTile) + maxTile) % maxTile;
        const left = viewport.width / 2 + (tx * 256 - centerWorldX);
        const top = viewport.height / 2 + (ty * 256 - centerWorldY);
        const serverIdx = Math.abs(tx + ty) % 4;
        list.push({
          key: `${zoom}-${lyrs}-${tx}-${ty}`,
          url: `https://mt${serverIdx}.google.com/vt/lyrs=${lyrs}&hl=vi&x=${wrappedTx}&y=${ty}&z=${zoom}`,
          left,
          top,
        });
      }
    }
    return list;
  }, [zoom, mapType, centerWorldX, centerWorldY, viewport.width, viewport.height]);

  const externalMapLink = getGoogleMapsExternalLink({
    originLat: oLat,
    originLng: oLng,
    destLat: dLat,
    destLng: dLng,
    originLabel: origin.label,
    destLabel: destination.label,
  });

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    setGoogleMapsApiKey(apiKeyInput);
    setKeySavedMessage('Đã cập nhật cấu hình Google Maps API Key thành công!');
    setTimeout(() => {
      setKeySavedMessage('');
      setShowKeyModal(false);
    }, 1200);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative rounded-2xl overflow-hidden border border-emerald-200/90 bg-emerald-50/40 shadow-xs select-none ${heightClass} ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* 1. REAL GOOGLE MAPS TILES LAYER */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {tiles.map((t) => (
          <img
            key={t.key}
            src={t.url}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: `${Math.round(t.left)}px`,
              top: `${Math.round(t.top)}px`,
              width: '256px',
              height: '256px',
              maxWidth: 'none',
            }}
            className="select-none pointer-events-none"
          />
        ))}
      </div>

      {/* 2. VECTOR FLIGHT ROUTE & SMOOTH 60FPS DRONE OVERLAY */}
      <svg
        width={viewport.width}
        height={viewport.height}
        className="absolute inset-0 pointer-events-none z-[5]"
      >
        <defs>
          <filter id="droneShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#064e3b" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Full flight corridor (dashed white + emerald) */}
        <line
          x1={originPt.x}
          y1={originPt.y}
          x2={destPt.x}
          y2={destPt.y}
          stroke="#ffffff"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.85"
        />
        <line
          x1={originPt.x}
          y1={originPt.y}
          x2={destPt.x}
          y2={destPt.y}
          stroke="#6ee7b7"
          strokeWidth="4"
          strokeDasharray="10 7"
          strokeLinecap="round"
        />

        {/* Flown path from Origin to current Drone GPS position */}
        <line
          x1={originPt.x}
          y1={originPt.y}
          x2={dronePt.x}
          y2={dronePt.y}
          stroke="#059669"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Origin Station Pin */}
        <g transform={`translate(${originPt.x}, ${originPt.y})`}>
          <circle cx="0" cy="0" r="16" fill="rgba(5, 150, 105, 0.22)" />
          <circle cx="0" cy="0" r="8" fill="#059669" stroke="#ffffff" strokeWidth="2.5" />
          <rect
            x="-70"
            y="12"
            width="140"
            height="22"
            rx="6"
            fill="rgba(255,255,255,0.95)"
            stroke="#059669"
            strokeWidth="1.2"
          />
          <text
            x="0"
            y="26"
            textAnchor="middle"
            fill="#065f46"
            fontSize="10.5"
            fontWeight="bold"
          >
            🛫 {(origin.label || 'Trạm xuất phát').slice(0, 20)}
          </text>
        </g>

        {/* Destination Landing Pin */}
        <g transform={`translate(${destPt.x}, ${destPt.y})`}>
          <circle cx="0" cy="0" r="22" fill="rgba(244, 63, 94, 0.20)" />
          <circle cx="0" cy="0" r="8" fill="#e11d48" stroke="#ffffff" strokeWidth="2.5" />
          <rect
            x="-75"
            y="-36"
            width="150"
            height="22"
            rx="6"
            fill="rgba(255,255,255,0.95)"
            stroke="#e11d48"
            strokeWidth="1.2"
          />
          <text
            x="0"
            y="-21"
            textAnchor="middle"
            fill="#9f1239"
            fontSize="10.5"
            fontWeight="bold"
          >
            🛬 {(destination.label || 'Điểm giao hàng').slice(0, 20)}
          </text>
        </g>

        {/* Live Moving Quadcopter Drone Marker */}
        <g transform={`translate(${dronePt.x}, ${dronePt.y})`} filter="url(#droneShadow)">
          <circle cx="0" cy="0" r="26" fill="rgba(16, 185, 129, 0.25)" />
          {/* 4 Drone Arms */}
          <line x1="-12" y1="-12" x2="12" y2="12" stroke="#065f46" strokeWidth="3" />
          <line x1="12" y1="-12" x2="-12" y2="12" stroke="#065f46" strokeWidth="3" />
          {/* 4 Rotors */}
          <circle cx="-12" cy="-12" r="5.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="12" cy="-12" r="5.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="-12" cy="12" r="5.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="5.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
          {/* Drone Core */}
          <circle cx="0" cy="0" r="8" fill="#059669" stroke="#ffffff" strokeWidth="2.5" />
          <circle cx="0" cy="0" r="3" fill="#ffffff" />

          {/* Floating Tag above Drone */}
          <rect
            x="-68"
            y="-44"
            width="136"
            height="24"
            rx="7"
            fill="#ffffff"
            stroke="#059669"
            strokeWidth="1.5"
          />
          <text
            x="0"
            y="-28"
            textAnchor="middle"
            fill="#065f46"
            fontSize="11"
            fontWeight="bold"
            fontFamily="JetBrains Mono, monospace"
          >
            {droneCode} • {Math.round(progress * 100)}%
          </text>
        </g>
      </svg>

      {/* 3. TOP MAP TOOLBAR */}
      {showControls && (
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-xl border border-emerald-200/80 shadow-xs text-xs font-semibold">
            <span className="text-slate-400 px-1 text-[11px] uppercase font-bold">Ống kính:</span>
            <button
              type="button"
              onClick={() => {
                setViewTarget('ROUTE');
                setZoom(13);
                setPanOffset({ x: 0, y: 0 });
              }}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewTarget === 'ROUTE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-emerald-50'
              }`}
            >
              📐 Toàn Tuyến
            </button>
            <button
              type="button"
              onClick={() => {
                setViewTarget('DRONE');
                setZoom(15);
                setPanOffset({ x: 0, y: 0 });
              }}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewTarget === 'DRONE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-emerald-50'
              }`}
            >
              🛸 Bám Drone
            </button>
            <button
              type="button"
              onClick={() => {
                setViewTarget('ORIGIN');
                setZoom(15);
                setPanOffset({ x: 0, y: 0 });
              }}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewTarget === 'ORIGIN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-emerald-50'
              }`}
            >
              🛫 Trạm Xuất Phát
            </button>
            <button
              type="button"
              onClick={() => {
                setViewTarget('DESTINATION');
                setZoom(15);
                setPanOffset({ x: 0, y: 0 });
              }}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewTarget === 'DESTINATION'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-emerald-50'
              }`}
            >
              🛬 Điểm Nhận
            </button>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl border border-emerald-200/80 shadow-xs text-xs">
              <button
                type="button"
                onClick={() => setMapType('m')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  mapType === 'm'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-emerald-50'
                }`}
              >
                Đường phố
              </button>
              <button
                type="button"
                onClick={() => setMapType('k')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  mapType === 'k'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-emerald-50'
                }`}
              >
                Vệ tinh
              </button>
              <button
                type="button"
                onClick={() => setMapType('h')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  mapType === 'h'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-emerald-50'
                }`}
              >
                Hỗn hợp
              </button>
            </div>

            <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl border border-emerald-200/80 shadow-xs text-xs font-bold">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(18, z + 1))}
                className="px-2 py-0.5 text-slate-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
              >
                +
              </button>
              <span className="px-1.5 text-[11px] font-mono text-emerald-700">Z{zoom}</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(10, z - 1))}
                className="px-2 py-0.5 text-slate-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
              >
                -
              </button>
            </div>

            <a
              href={externalMapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/95 backdrop-blur-md hover:bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-xs text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Mở Google Maps</span>
            </a>

            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              title="Cấu hình Google Maps API Key"
              className="bg-white/95 backdrop-blur-md p-2 rounded-xl border border-emerald-200/80 shadow-xs text-slate-600 hover:text-emerald-600 transition cursor-pointer"
            >
              ⚙
            </button>
          </div>
        </div>
      )}

      {/* 4. TELEMETRY OVERLAY HUD */}
      {showTelemetryOverlay && (
        <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md rounded-xl p-3.5 border border-emerald-200 shadow-lg text-slate-900 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 font-mono font-bold text-xs animate-pulse">
                GPS
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 tracking-wide">
                    {droneCode}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    REALTIME SYNC (WEB &amp; MOBILE)
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                  Tọa độ thật: <strong className="text-emerald-700">{Number(droneLat).toFixed(6)}, {Number(droneLng).toFixed(6)}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 text-[10px] block uppercase">Độ cao</span>
                <span className="text-emerald-700 font-bold">{droneCurrent?.altitude ?? 65} m</span>
              </div>
              <div className="h-6 w-px bg-emerald-100"></div>
              <div>
                <span className="text-slate-400 text-[10px] block uppercase">Tốc độ</span>
                <span className="text-emerald-700 font-bold">{droneCurrent?.speed ?? 48.5} km/h</span>
              </div>
              <div className="h-6 w-px bg-emerald-100"></div>
              <div>
                <span className="text-slate-400 text-[10px] block uppercase">Dung lượng Pin</span>
                <span className="text-emerald-700 font-bold">{droneCurrent?.battery ?? 88}%</span>
              </div>
              <div className="h-6 w-px bg-emerald-100"></div>
              <div>
                <span className="text-slate-400 text-[10px] block uppercase">Tiến trình</span>
                <span className="text-emerald-700 font-bold">
                  {Math.round(progress * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Google Maps API Key Config */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveApiKey}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-slate-800"
          >
            <div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider">
                GOOGLE MAPS PLATFORM INTEGRATION
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                Cấu Hình Google Maps API Key
              </h3>
            </div>
            {keySavedMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                {keySavedMessage}
              </div>
            )}
            <div>
              <input
                type="text"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
              >
                Lưu Cấu Hình
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
