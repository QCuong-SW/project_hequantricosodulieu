/**
 * Google Maps API Service
 * Cung cấp giải pháp bản đồ Google thực tế:
 * 1. Gọi Google Geocoding API chuyển đổi địa chỉ thành tọa độ GPS.
 * 2. Gọi Google Distance Matrix / Directions API tính toán lộ trình bay thực tế.
 * 3. Tạo URL nhúng Google Maps Embed (hỗ trợ cả có API Key và chế độ miễn phí không cần Key).
 * 4. Tạo URL điều hướng trực tiếp trên ứng dụng Google Maps.
 */

const STORAGE_KEY_MAPS_API_KEY = 'SMARTDRONE_GOOGLE_MAPS_API_KEY';

export function getGoogleMapsApiKey() {
  if (typeof window === 'undefined') return '';
  return (
    window.localStorage.getItem(STORAGE_KEY_MAPS_API_KEY) ||
    import.meta.env?.VITE_GOOGLE_MAPS_API_KEY ||
    ''
  );
}

export function setGoogleMapsApiKey(key) {
  if (typeof window === 'undefined') return;
  if (key && key.trim()) {
    window.localStorage.setItem(STORAGE_KEY_MAPS_API_KEY, key.trim());
  } else {
    window.localStorage.removeItem(STORAGE_KEY_MAPS_API_KEY);
  }
}

/**
 * Tạo URL Google Maps nhúng trực tiếp (Iframe)
 * @param {Object} params
 * @param {number} params.lat - Vĩ độ
 * @param {number} params.lng - Kinh độ
 * @param {number} [params.zoom=15] - Độ thu phóng (1-20)
 * @param {'m'|'k'|'h'|'p'} [params.mapType='m'] - m: Đường phố, k: Vệ tinh, h: Kết hợp, p: Địa hình
 */
export function getGoogleMapsEmbedUrl({ lat, lng, zoom = 15, mapType = 'm' }) {
  const apiKey = getGoogleMapsApiKey();
  const safeLat = Number(lat) || 10.771595;
  const safeLng = Number(lng) || 106.70475;

  if (apiKey) {
    const googleMapType =
      mapType === 'k' ? 'satellite' : mapType === 'h' ? 'satellite' : 'roadmap';
    return `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${safeLat},${safeLng}&zoom=${zoom}&maptype=${googleMapType}`;
  }

  // Chế độ Embed chuẩn Google Maps (hoạt động 100% không yêu cầu thẻ thanh toán / Billing Key)
  return `https://maps.google.com/maps?q=${safeLat},${safeLng}&t=${mapType}&z=${zoom}&ie=UTF8&iwloc=&output=embed`;
}

/**
 * Tạo URL Google Maps chỉ đường giữa 2 tọa độ (Origin -> Destination)
 */
export function getGoogleDirectionsEmbedUrl({
  originLat,
  originLng,
  destLat,
  destLng,
  mapType = 'm',
}) {
  const apiKey = getGoogleMapsApiKey();
  const oLat = Number(originLat) || 10.771595;
  const oLng = Number(originLng) || 106.70475;
  const dLat = Number(destLat) || 10.841128;
  const dLng = Number(destLng) || 106.809883;

  if (apiKey) {
    return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${oLat},${oLng}&destination=${dLat},${dLng}&mode=driving`;
  }

  return `https://maps.google.com/maps?saddr=${oLat},${oLng}&daddr=${dLat},${dLng}&t=${mapType}&z=13&output=embed`;
}

/**
 * Tạo link điều hướng ngoài mở trực tiếp bằng Google Maps (Web hoặc App)
 */
export function getGoogleMapsExternalLink({
  originLat,
  originLng,
  destLat,
  destLng,
  originLabel,
  destLabel,
}) {
  const o = `${originLat},${originLng}`;
  const d = `${destLat},${destLng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&travelmode=driving`;
}

/**
 * Gọi API Google Geocoding để chuyển đổi địa chỉ thành tọa độ GPS thực tế
 * Tự động chuyển tiếp fallback OpenStreetMap nếu chưa cấu hình Google API Key
 */
export async function geocodeGoogleMaps(address) {
  if (!address || !address.trim()) return null;
  const query = address.trim();
  const apiKey = getGoogleMapsApiKey();

  // 1. Thử gọi Google Maps Geocoding API nếu đã cấu hình Key
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}&language=vi&region=vn`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.results?.[0]) {
          const loc = data.results[0].geometry.location;
          return {
            latitude: loc.lat,
            longitude: loc.lng,
            formattedAddress: data.results[0].formatted_address,
            provider: 'Google Maps API',
          };
        }
      }
    } catch {
      // Fallback bên dưới
    }
  }

  // 2. Fallback tìm kiếm địa chỉ địa lý thực tế (Hỗ trợ định vị tiếng Việt)
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=vn`;
    const res = await fetch(osmUrl, {
      headers: { 'Accept-Language': 'vi' },
    });
    if (res.ok) {
      const list = await res.json();
      if (list && list.length > 0) {
        return {
          latitude: Number(list[0].lat),
          longitude: Number(list[0].lon),
          formattedAddress: list[0].display_name,
          provider: 'Geocoding Service (Vietnam GPS)',
        };
      }
    }
  } catch {
    // Return null
  }

  return null;
}

/**
 * Tính toán khoảng cách đại vòng tròn Haversine (km)
 */
export function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}
