import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../core/session_manager.dart';
import '../auth/auth_service.dart';
import '../auth/login_page.dart';

class CustomerHomePage extends StatefulWidget {
  const CustomerHomePage({super.key});

  @override
  State<CustomerHomePage> createState() => _CustomerHomePageState();
}

class _CustomerHomePageState extends State<CustomerHomePage> {
  // 0: Mua hàng, 1: Giỏ & Đặt hàng, 2: Trạng thái đơn (Shopee style + Live Drone Map), 3: Nhận hàng & Đánh giá
  int _currentTab = 0;

  Map<String, dynamic>? _user;
  bool _loadingUser = true;

  // --- SHOP, SEARCH & FILTER ---
  List<Map<String, dynamic>> _products = [];
  bool _loadingProducts = true;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedCategory = 'Tất cả';
  String _sortBy = 'DEFAULT';

  // --- CART & CHECKOUT ---
  final Map<String, int> _cart = {};
  final TextEditingController _recipientNameCtrl = TextEditingController();
  final TextEditingController _recipientPhoneCtrl = TextEditingController(text: '0909123456');
  final TextEditingController _recipientAddressCtrl = TextEditingController(
    text: 'Khu Công Nghệ Cao, P. Long Thạnh Mỹ, TP. Thủ Đức, TP.HCM',
  );
  final TextEditingController _deliveryNoteCtrl = TextEditingController(
    text: 'Hạ cánh tại bãi đáp sảnh chính tòa nhà',
  );
  double _destLat = 10.841128;
  double _destLng = 106.809883;
  String _paymentMethod = 'PAY_NOW';
  bool _placingOrder = false;

  // --- SHOPEE-STYLE ORDER STATUS & LIVE SYNCED DRONE TELEMETRY ---
  List<Map<String, dynamic>> _orders = [];
  bool _loadingOrders = true;
  String _orderStatusTab = 'ALL'; // ALL | PENDING | SHIPPING | DELIVERED | CANCELLED
  Map<String, dynamic>? _activeTrackingOrder;
  Map<String, dynamic>? _syncedTelemetry;
  int _clientReceivedTelemetryMs = DateTime.now().millisecondsSinceEpoch;
  double _droneProgress = 0.35;
  Timer? _telemetrySyncTimer;
  Timer? _smoothFrameTimer;

  // --- OTP & FEEDBACK ---
  final _otpController = TextEditingController();
  String? _issuedOtpHint;
  bool _verifyingOtp = false;
  int _feedbackRating = 5;
  final _feedbackCommentController = TextEditingController();
  bool _submittingFeedback = false;
  List<Map<String, dynamic>> _myFeedbacks = [];

  @override
  void initState() {
    super.initState();
    _initAll();
    // 1. Poll synchronized telemetry from Backend every 1.5 seconds (100% synced with Web Portal!)
    _telemetrySyncTimer = Timer.periodic(const Duration(milliseconds: 1500), (_) {
      _fetchSyncedTelemetry();
    });
    // 2. 60 FPS (50ms) Smooth Interpolation Loop between server ticks so Drone glides smoothly across Real Google Map!
    _smoothFrameTimer = Timer.periodic(const Duration(milliseconds: 50), (_) {
      if (!mounted) return;
      final status = _activeTrackingOrder?['status']?.toString() ?? 'IN_TRANSIT';
      if (status == 'DELIVERED') {
        if (_droneProgress != 1.0) setState(() => _droneProgress = 1.0);
        return;
      }
      if (_syncedTelemetry != null && _syncedTelemetry!['baseProgress'] != null) {
        final paused = _syncedTelemetry!['paused'] == true;
        final baseP = double.tryParse(_syncedTelemetry!['baseProgress'].toString()) ?? _droneProgress;
        if (paused) {
          if (_droneProgress != baseP) setState(() => _droneProgress = baseP);
          return;
        }
        final speedPerSec = double.tryParse(_syncedTelemetry!['speedPerSecond']?.toString() ?? '') ?? 0.02;
        final elapsedSec = (DateTime.now().millisecondsSinceEpoch - _clientReceivedTelemetryMs) / 1000.0;
        final raw = baseP + elapsedSec * speedPerSec;
        final nextP = raw.clamp(0.0, 1.0);
        setState(() {
          _droneProgress = nextP;
        });
      } else {
        setState(() {
          _droneProgress = (_droneProgress + 0.001).clamp(0.0, 1.0);
        });
      }
    });
  }

  @override
  void dispose() {
    _telemetrySyncTimer?.cancel();
    _smoothFrameTimer?.cancel();
    _searchController.dispose();
    _recipientNameCtrl.dispose();
    _recipientPhoneCtrl.dispose();
    _recipientAddressCtrl.dispose();
    _deliveryNoteCtrl.dispose();
    _otpController.dispose();
    _feedbackCommentController.dispose();
    super.dispose();
  }

  Future<void> _initAll() async {
    final user = await SessionManager.getCurrentUser();
    if (!mounted) return;
    setState(() {
      _user = user;
      _recipientNameCtrl.text = user?['fullName']?.toString() ?? 'Khách hàng SmartDrone';
      _loadingUser = false;
    });
    await Future.wait([
      _fetchProducts(),
      _fetchMyOrders(),
      _fetchFeedbacks(),
    ]);
    await _fetchSyncedTelemetry();
  }

  String get _customerId =>
      _user?['userId']?.toString() ??
      _user?['id']?.toString() ??
      '11111111-1111-1111-1111-111111111005';

  String get _customerName =>
      _user?['fullName']?.toString() ?? 'Khách hàng SmartDrone';

  String get _customerEmail =>
      _user?['email']?.toString() ?? 'customer@smartdrone.vn';

  Future<void> _fetchProducts() async {
    setState(() => _loadingProducts = true);
    try {
      final res = await http.get(
        Uri.parse('${AuthService.baseUrl}/api/v1/products?activeOnly=true'),
      );
      final decoded = jsonDecode(res.body);
      final list = decoded is Map ? decoded['data'] : decoded;
      if (list is List && mounted) {
        setState(() {
          _products = list.map((e) => Map<String, dynamic>.from(e)).toList();
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingProducts = false);
    }
  }

  Future<void> _fetchMyOrders() async {
    setState(() => _loadingOrders = true);
    try {
      final token = await SessionManager.getAccessToken();
      final res = await http.get(
        Uri.parse('${AuthService.baseUrl}/api/v1/delivery-orders/customer/$_customerId'),
        headers: {
          'Accept': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
      );
      final decoded = jsonDecode(res.body);
      final list = decoded is Map ? decoded['data'] : decoded;
      if (list is List && mounted) {
        final parsed = list.map((e) => Map<String, dynamic>.from(e)).toList();
        setState(() {
          _orders = parsed;
          if (_activeTrackingOrder == null && parsed.isNotEmpty) {
            _activeTrackingOrder = parsed.first;
          } else if (_activeTrackingOrder != null) {
            final updated = parsed.where((o) => o['id'] == _activeTrackingOrder!['id']).toList();
            if (updated.isNotEmpty) {
              _activeTrackingOrder = updated.first;
            }
          }
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingOrders = false);
    }
  }

  // Gọi API Telemetry đồng bộ 1:1 với Web Portal
  Future<void> _fetchSyncedTelemetry() async {
    final order = _activeTrackingOrder ?? (_orders.isNotEmpty ? _orders.first : null);
    final key = order?['trackingNumber']?.toString() ?? 'SDD-20261108-482910';
    try {
      final res = await http.get(
        Uri.parse('${AuthService.baseUrl}/api/v1/delivery-orders/telemetry/$key'),
      );
      if (res.statusCode == 200) {
        final decoded = jsonDecode(res.body);
        final data = decoded is Map ? decoded['data'] : null;
        if (data is Map && mounted) {
          final mapData = Map<String, dynamic>.from(data);
          final p = double.tryParse(mapData['progress']?.toString() ?? '') ?? _droneProgress;
          setState(() {
            _syncedTelemetry = mapData;
            _clientReceivedTelemetryMs = DateTime.now().millisecondsSinceEpoch;
            _droneProgress = p.clamp(0.0, 1.0);
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _setSyncedProgress(double newProgress, {bool paused = false}) async {
    final order = _activeTrackingOrder ?? (_orders.isNotEmpty ? _orders.first : null);
    final key = order?['trackingNumber']?.toString() ?? 'SDD-20261108-482910';
    setState(() => _droneProgress = newProgress.clamp(0.0, 1.0));
    try {
      final res = await http.post(
        Uri.parse('${AuthService.baseUrl}/api/v1/delivery-orders/telemetry/$key'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'progress': _droneProgress,
          'paused': paused,
        }),
      );
      if (res.statusCode == 200) {
        final decoded = jsonDecode(res.body);
        final data = decoded is Map ? decoded['data'] : null;
        if (data is Map && mounted) {
          setState(() {
            _syncedTelemetry = Map<String, dynamic>.from(data);
            _clientReceivedTelemetryMs = DateTime.now().millisecondsSinceEpoch;
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _fetchFeedbacks() async {
    try {
      final res = await http.get(
        Uri.parse('${AuthService.baseUrl}/api/v1/feedbacks?customerId=$_customerId'),
      );
      final decoded = jsonDecode(res.body);
      final list = decoded is Map ? decoded['data'] : decoded;
      if (list is List && mounted) {
        setState(() {
          _myFeedbacks = list.map((e) => Map<String, dynamic>.from(e)).toList();
        });
      }
    } catch (_) {}
  }

  Future<void> _logout() async {
    await SessionManager.clearSession();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginPage()),
      (route) => false,
    );
  }

  // --- CART HELPERS ---
  int get _cartItemCount => _cart.values.fold(0, (a, b) => a + b);

  List<Map<String, dynamic>> get _cartDetailedItems {
    final result = <Map<String, dynamic>>[];
    _cart.forEach((productId, qty) {
      final p = _products.where((x) => x['id'] == productId).firstOrNull;
      if (p != null && qty > 0) {
        result.add({'product': p, 'quantity': qty});
      }
    });
    return result;
  }

  double get _cartTotalWeight {
    double total = 0;
    _cart.forEach((productId, qty) {
      final p = _products.where((x) => x['id'] == productId).firstOrNull;
      if (p != null) {
        total += (double.tryParse(p['weightKg'].toString()) ?? 0.5) * qty;
      }
    });
    return double.parse(total.toStringAsFixed(2));
  }

  double get _cartProductTotal {
    double total = 0;
    _cart.forEach((productId, qty) {
      final p = _products.where((x) => x['id'] == productId).firstOrNull;
      if (p != null) {
        total += (double.tryParse(p['price'].toString()) ?? 0) * qty;
      }
    });
    return total;
  }

  double get _droneShippingFee {
    if (_cartItemCount == 0) return 0;
    return 25000 + (_cartTotalWeight * 10000);
  }

  void _addToCart(Map<String, dynamic> product) {
    final id = product['id'].toString();
    final weight = double.tryParse(product['weightKg'].toString()) ?? 0.5;
    if (_cartTotalWeight + weight > 5.0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tải trọng khoang Drone tối đa là 5.0 kg cho mỗi chuyến bay!'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }
    setState(() {
      _cart[id] = (_cart[id] ?? 0) + 1;
    });
  }

  void _removeFromCart(String productId) {
    setState(() {
      final current = _cart[productId] ?? 0;
      if (current <= 1) {
        _cart.remove(productId);
      } else {
        _cart[productId] = current - 1;
      }
    });
  }

  void _deleteCartItem(String productId) {
    setState(() => _cart.remove(productId));
  }

  String _formatVnd(num amount) {
    final s = amount.round().toString();
    final buffer = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buffer.write('.');
      buffer.write(s[i]);
    }
    return '${buffer.toString()} đ';
  }

  IconData _getCategoryIcon(String category) {
    if (category.contains('Ẩm thực')) return Icons.restaurant_menu_rounded;
    if (category.contains('Y tế')) return Icons.medical_services_outlined;
    if (category.contains('Công nghệ')) return Icons.headphones_outlined;
    if (category.contains('Tài liệu')) return Icons.folder_special_outlined;
    return Icons.card_giftcard_outlined;
  }

  // --- SUBMIT ORDER & IMMEDIATELY START DRONE DELIVERY ---
  Future<void> _placeOrderFromCart() async {
    if (_cartItemCount == 0) return;

    setState(() => _placingOrder = true);
    try {
      final token = await SessionManager.getAccessToken();
      final itemDescriptions = <String>[];
      bool anyFragile = false;

      _cart.forEach((productId, qty) {
        final p = _products.where((x) => x['id'] == productId).firstOrNull;
        if (p != null) {
          itemDescriptions.add('${p['name']} (x$qty)');
          if (p['isFragile'] == true) anyFragile = true;
        }
      });

      final note = _deliveryNoteCtrl.text.trim();
      final fullDescription = note.isNotEmpty
          ? '${itemDescriptions.join(', ')} • Ghi chú: $note'
          : itemDescriptions.join(', ');

      final body = {
        'customerId': _customerId,
        'pickupMethod': 'STATION_DROP',
        'deliveryMethod': 'CUSTOMER_ADDRESS',
        'sender': {
          'name': 'Trạm Drone Hub Trung Tâm Q1',
          'phone': '0901234567',
          'addressText': 'Trạm Drone Hub Trung Tâm Quận 1, TP.HCM',
          'latitude': 10.771595,
          'longitude': 106.704750,
        },
        'recipient': {
          'name': _recipientNameCtrl.text.trim().isEmpty
              ? _customerName
              : _recipientNameCtrl.text.trim(),
          'phone': _recipientPhoneCtrl.text.trim().isEmpty
              ? '0909123456'
              : _recipientPhoneCtrl.text.trim(),
          'addressText': _recipientAddressCtrl.text.trim().isEmpty
              ? 'Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM'
              : _recipientAddressCtrl.text.trim(),
          'latitude': _destLat,
          'longitude': _destLng,
        },
        'packages': [
          {
            'description': fullDescription,
            'weightKg': math.max(0.2, _cartTotalWeight),
            'lengthCm': 25,
            'widthCm': 20,
            'heightCm': 15,
            'declaredValue': _cartProductTotal,
            'isFragile': anyFragile,
            'isHazardous': false,
          }
        ],
      };

      final res = await http.post(
        Uri.parse('${AuthService.baseUrl}/api/v1/delivery-orders'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );

      final decoded = jsonDecode(res.body);
      if (res.statusCode == 201 || res.statusCode == 200) {
        final createdOrder = Map<String, dynamic>.from(decoded['data'] ?? decoded);
        final orderId = createdOrder['id']?.toString();

        if (_paymentMethod == 'PAY_NOW' && orderId != null) {
          await http.post(
            Uri.parse('${AuthService.baseUrl}/api/v1/delivery-orders/$orderId/pay'),
            headers: {
              'Accept': 'application/json',
              if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
            },
          );
          createdOrder['paymentStatus'] = 'PAID';
        }
        createdOrder['status'] = 'IN_TRANSIT';

        await _fetchMyOrders();

        if (!mounted) return;
        setState(() {
          _cart.clear();
          _activeTrackingOrder = createdOrder;
          _orderStatusTab = 'SHIPPING';
          _currentTab = 2; // Đặt xong chuyển thẳng sang màn hình Trạng thái đơn & Bản đồ Drone!
        });

        await _setSyncedProgress(0.75); // Đặt Drone vào trạng thái đang bay gần tới để hiển thị bản đồ trực quan ngay

        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Đặt hàng thành công (${createdOrder['trackingNumber']})! Drone đang bay giao tới bạn!',
            ),
            backgroundColor: const Color(0xFF059669),
          ),
        );
      } else {
        throw Exception(decoded['message'] ?? 'Không thể tạo đơn hàng.');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi đặt hàng: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _placingOrder = false);
    }
  }

  Future<void> _payOrder(Map<String, dynamic> order) async {
    final orderId = order['id']?.toString();
    if (orderId == null) return;
    try {
      final token = await SessionManager.getAccessToken();
      final res = await http.post(
        Uri.parse('${AuthService.baseUrl}/api/v1/delivery-orders/$orderId/pay'),
        headers: {
          'Accept': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
      );
      if (res.statusCode == 200) {
        await _fetchMyOrders();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã thanh toán đơn ${order['trackingNumber']} thành công!'),
            backgroundColor: const Color(0xFF059669),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi thanh toán: $e'), backgroundColor: Colors.red),
      );
    }
  }

  // --- OTP & FEEDBACK (Chỉ khi Drone giao đến nơi >= 98% mới cho phép xác nhận nhận hàng!) ---
  bool get _hasDroneArrived {
    final order = _activeTrackingOrder ?? (_orders.isNotEmpty ? _orders.first : null);
    final status = order?['status']?.toString() ?? 'IN_TRANSIT';
    return status == 'DELIVERED' || status == 'ARRIVED' || _droneProgress >= 0.98;
  }

  String _getProductImageUrl(Map<String, dynamic> p) {
    final url = p['imageUrl']?.toString() ?? '';
    if (url.isNotEmpty) return url;
    final name = (p['name']?.toString() ?? '').toLowerCase();
    final cat = (p['category']?.toString() ?? '').toLowerCase();
    if (name.contains('cà phê') || name.contains('croissant')) {
      return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80';
    }
    if (name.contains('bento') || name.contains('cá hồi')) {
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
    }
    if (name.contains('trà sữa') || name.contains('oolong')) {
      return 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=600&q=80';
    }
    if (name.contains('pizza')) {
      return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80';
    }
    if (name.contains('trái cây') || name.contains('cherry')) {
      return 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80';
    }
    if (name.contains('gà rán')) {
      return 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80';
    }
    if (name.contains('burger')) {
      return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80';
    }
    if (name.contains('sushi') || name.contains('sashimi')) {
      return 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80';
    }
    if (name.contains('phở')) {
      return 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=600&q=80';
    }
    if (name.contains('tiramisu') || name.contains('bánh')) {
      return 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80';
    }
    if (cat.contains('ẩm thực')) {
      return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80';
    }
    if (cat.contains('y tế')) {
      return 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=600&q=80';
    }
    if (cat.contains('công nghệ')) {
      return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80';
    }
    return 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80';
  }

  Widget _buildProductThumbnail(Map<String, dynamic> p, {double size = 84, double radius = 16}) {
    final imageUrl = _getProductImageUrl(p);
    final category = p['category']?.toString() ?? '';
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFFECFDF5), Color(0xFFD1FAE5)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Image.network(
          imageUrl,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => Center(
            child: Icon(
              _getCategoryIcon(category),
              color: const Color(0xFF059669),
              size: size * 0.42,
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _issueOtpForActiveOrder() async {
    if (!_hasDroneArrived) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Drone đang trên đường bay (${(_droneProgress * 100).round()}%). Vui lòng đợi Drone giao đến nơi (100%) mới lấy mã nhận hàng!',
          ),
          backgroundColor: const Color(0xFFD97706),
        ),
      );
      return;
    }
    final order = _activeTrackingOrder ?? (_orders.isNotEmpty ? _orders.first : null);
    final code = order?['trackingNumber']?.toString() ?? 'SDD-20261108-482910';
    setState(() => _verifyingOtp = true);
    try {
      final token = await SessionManager.getAccessToken();
      final res = await http.post(
        Uri.parse('${AuthService.baseUrl}/api/v1/delivery-confirmations/generate-otp'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'orderId': code}),
      );
      final decoded = jsonDecode(res.body);
      final otp = (decoded is Map ? decoded['demoOtp'] : null)?.toString() ?? '123456';
      setState(() {
        _issuedOtpHint = 'Mã OTP nhận hàng của đơn $code là: $otp';
        _otpController.text = otp;
      });
    } catch (_) {
      setState(() {
        _issuedOtpHint = 'Mã OTP nhận hàng: 123456';
        _otpController.text = '123456';
      });
    } finally {
      if (mounted) setState(() => _verifyingOtp = false);
    }
  }

  Future<void> _confirmDeliveryOtp() async {
    if (!_hasDroneArrived) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Chưa thể xác nhận! Drone mới bay được ${(_droneProgress * 100).round()}% quãng đường. Khi Drone giao đến (100%) bạn mới xác nhận nhận hàng được nhé!',
          ),
          backgroundColor: const Color(0xFFD97706),
        ),
      );
      return;
    }
    final order = _activeTrackingOrder ?? (_orders.isNotEmpty ? _orders.first : null);
    final code = order?['trackingNumber']?.toString() ?? 'SDD-20261108-482910';
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập đủ 6 chữ số OTP.')),
      );
      return;
    }

    setState(() => _verifyingOtp = true);
    try {
      final token = await SessionManager.getAccessToken();
      final res = await http.post(
        Uri.parse('${AuthService.baseUrl}/api/v1/delivery-confirmations/verify-otp'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'orderId': code, 'otpCode': otp}),
      );
      final decoded = jsonDecode(res.body);
      final msg = (decoded is Map ? decoded['message'] : null)?.toString() ??
          'Xác nhận nhận hàng thành công!';
      await _setSyncedProgress(1.0, paused: true);
      await _fetchMyOrders();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: const Color(0xFF059669)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi xác thực OTP: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _verifyingOtp = false);
    }
  }

  Future<void> _submitCustomerFeedback() async {
    final comment = _feedbackCommentController.text.trim();
    if (comment.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập nội dung đánh giá của bạn.')),
      );
      return;
    }

    final order = _activeTrackingOrder ?? (_orders.isNotEmpty ? _orders.first : null);
    setState(() => _submittingFeedback = true);
    try {
      final token = await SessionManager.getAccessToken();
      final res = await http.post(
        Uri.parse('${AuthService.baseUrl}/api/v1/feedbacks'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'orderId': order?['id']?.toString() ?? '',
          'trackingNumber': order?['trackingNumber']?.toString() ?? 'SDD-20261108-482910',
          'customerId': _customerId,
          'customerName': _customerName,
          'customerEmail': _customerEmail,
          'rating': _feedbackRating,
          'comment': comment,
        }),
      );
      if (res.statusCode == 200) {
        _feedbackCommentController.clear();
        await _fetchFeedbacks();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã gửi đánh giá tới Admin thành công! Cảm ơn bạn.'),
            backgroundColor: Color(0xFF059669),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi gửi đánh giá: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _submittingFeedback = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingUser) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF6F8F7),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        surfaceTintColor: Colors.white,
        title: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF10B981), Color(0xFF0F766E)],
                ),
                borderRadius: BorderRadius.circular(11),
              ),
              child: const Icon(Icons.flight_takeoff_rounded, color: Colors.white, size: 21),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'SmartDrone Mart',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                  Text(
                    '$_customerName • Giao hỏa tốc 15 phút',
                    style: const TextStyle(fontSize: 11, color: Colors.black54),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: TextButton.icon(
              onPressed: () => setState(() => _currentTab = 1),
              style: TextButton.styleFrom(
                backgroundColor: _cartItemCount > 0
                    ? const Color(0xFF059669)
                    : const Color(0xFFECFDF5),
                foregroundColor: _cartItemCount > 0
                    ? Colors.white
                    : const Color(0xFF065F46),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: const Icon(Icons.shopping_cart_outlined, size: 17),
              label: Text(
                'Giỏ ($_cartItemCount)',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
              ),
            ),
          ),
          IconButton(
            onPressed: () {
              _fetchProducts();
              _fetchMyOrders();
              _fetchFeedbacks();
              _fetchSyncedTelemetry();
            },
            tooltip: 'Làm mới',
            icon: const Icon(Icons.refresh, color: Color(0xFF059669)),
          ),
          IconButton(
            onPressed: _logout,
            tooltip: 'Đăng xuất',
            icon: const Icon(Icons.logout, color: Colors.redAccent),
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentTab,
        children: [
          _buildShopTab(),
          _buildCartAndCheckoutTab(),
          _buildShopeeOrderStatusAndDroneMapTab(),
          _buildConfirmAndFeedbackTab(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentTab,
        onDestinationSelected: (idx) => setState(() => _currentTab = idx),
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFD1FAE5),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront, color: Color(0xFF059669)),
            label: 'Khám Phá',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: _cartItemCount > 0,
              label: Text('$_cartItemCount'),
              backgroundColor: const Color(0xFF059669),
              child: const Icon(Icons.shopping_cart_outlined),
            ),
            selectedIcon: const Icon(Icons.shopping_cart, color: Color(0xFF059669)),
            label: 'Giỏ & Đặt Hàng',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: _orders.isNotEmpty,
              label: Text('${_orders.length}'),
              backgroundColor: const Color(0xFF059669),
              child: const Icon(Icons.local_shipping_outlined),
            ),
            selectedIcon: const Icon(Icons.local_shipping, color: Color(0xFF059669)),
            label: 'Đơn & Bản Đồ',
          ),
          const NavigationDestination(
            icon: Icon(Icons.verified_user_outlined),
            selectedIcon: Icon(Icons.verified_user, color: Color(0xFF059669)),
            label: 'Nhận & Đánh Giá',
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 0: KHÁM PHÁ & TÌM KIẾM SẢN PHẨM ĐA DẠNG
  // ===========================================================================
  Widget _buildShopTab() {
    final categories = [
      'Tất cả',
      'Ẩm thực & Đồ uống',
      'Y tế & Sức khỏe',
      'Thiết bị & Công nghệ',
      'Tài liệu & Văn phòng',
      'Hàng tiêu dùng',
    ];

    var filtered = _products.where((p) {
      final matchCat = _selectedCategory == 'Tất cả' || p['category'] == _selectedCategory;
      final q = _searchQuery.trim().toLowerCase();
      final matchSearch = q.isEmpty ||
          (p['name']?.toString().toLowerCase().contains(q) ?? false) ||
          (p['description']?.toString().toLowerCase().contains(q) ?? false) ||
          (p['category']?.toString().toLowerCase().contains(q) ?? false) ||
          (p['sku']?.toString().toLowerCase().contains(q) ?? false);
      return matchCat && matchSearch;
    }).toList();

    if (_sortBy == 'PRICE_ASC') {
      filtered.sort((a, b) => (num.tryParse(a['price'].toString()) ?? 0)
          .compareTo(num.tryParse(b['price'].toString()) ?? 0));
    } else if (_sortBy == 'PRICE_DESC') {
      filtered.sort((a, b) => (num.tryParse(b['price'].toString()) ?? 0)
          .compareTo(num.tryParse(a['price'].toString()) ?? 0));
    } else if (_sortBy == 'LIGHTEST') {
      filtered.sort((a, b) => (num.tryParse(a['weightKg'].toString()) ?? 0)
          .compareTo(num.tryParse(b['weightKg'].toString()) ?? 0));
    }

    return Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      onChanged: (v) => setState(() => _searchQuery = v),
                      decoration: InputDecoration(
                        hintText: 'Tìm đồ ăn, thuốc, tai nghe, SSD, quà tặng...',
                        hintStyle: const TextStyle(fontSize: 13, color: Colors.black45),
                        prefixIcon: const Icon(Icons.search, color: Color(0xFF059669)),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                                icon: const Icon(Icons.clear, size: 18),
                              )
                            : null,
                        filled: true,
                        fillColor: const Color(0xFFF6F8F7),
                        contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 14),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFD1FAE5)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFD1FAE5)),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  PopupMenuButton<String>(
                    initialValue: _sortBy,
                    onSelected: (val) => setState(() => _sortBy = val),
                    tooltip: 'Sắp xếp sản phẩm',
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.sort_rounded, size: 18, color: Color(0xFF059669)),
                          SizedBox(width: 4),
                          Text(
                            'Lọc',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF065F46)),
                          ),
                        ],
                      ),
                    ),
                    itemBuilder: (_) => const [
                      PopupMenuItem(value: 'DEFAULT', child: Text('Mặc định (Mới nhất)')),
                      PopupMenuItem(value: 'PRICE_ASC', child: Text('Giá: Thấp → Cao')),
                      PopupMenuItem(value: 'PRICE_DESC', child: Text('Giá: Cao → Thấp')),
                      PopupMenuItem(value: 'LIGHTEST', child: Text('Trọng lượng: Siêu nhẹ trước')),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: PopupMenuButton<String>(
                      initialValue: _selectedCategory,
                      onSelected: (cat) => setState(() => _selectedCategory = cat),
                      position: PopupMenuPosition.under,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      itemBuilder: (_) => categories.map((cat) {
                        final isSelected = _selectedCategory == cat;
                        return PopupMenuItem<String>(
                          value: cat,
                          child: Row(
                            children: [
                              Icon(
                                cat == 'Tất cả' ? Icons.apps_rounded : _getCategoryIcon(cat),
                                size: 18,
                                color: isSelected ? const Color(0xFF059669) : Colors.black54,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  cat,
                                  style: TextStyle(
                                    fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                                    fontSize: 13,
                                    color: isSelected ? const Color(0xFF059669) : const Color(0xFF0F172A),
                                  ),
                                ),
                              ),
                              if (isSelected)
                                const Icon(Icons.check_circle_rounded, size: 18, color: Color(0xFF059669)),
                            ],
                          ),
                        );
                      }).toList(),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF6F8F7),
                          borderRadius: BorderRadius.circular(13),
                          border: Border.all(color: const Color(0xFF6EE7B7), width: 1.2),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _selectedCategory == 'Tất cả'
                                  ? Icons.apps_rounded
                                  : _getCategoryIcon(_selectedCategory),
                              size: 18,
                              color: const Color(0xFF059669),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'Danh mục:',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.black54,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                _selectedCategory,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF065F46),
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const Icon(
                              Icons.keyboard_arrow_down_rounded,
                              color: Color(0xFF059669),
                              size: 20,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (_selectedCategory != 'Tất cả') ...[
                    const SizedBox(width: 8),
                    InkWell(
                      onTap: () => setState(() => _selectedCategory = 'Tất cả'),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFA7F3D0)),
                        ),
                        child: const Text(
                          'Tất cả',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF059669),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Hiển thị ${filtered.length} sản phẩm giao nhanh',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.black54),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Tải trọng giỏ: $_cartTotalWeight / 5.0 kg',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF059669)),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: _loadingProducts
              ? const Center(child: CircularProgressIndicator())
              : filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.search_off_rounded, size: 52, color: Colors.black38),
                          const SizedBox(height: 8),
                          Text(
                            'Không tìm thấy sản phẩm nào cho "$_searchQuery"',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black54),
                          ),
                          TextButton(
                            onPressed: () {
                              _searchController.clear();
                              setState(() {
                                _searchQuery = '';
                                _selectedCategory = 'Tất cả';
                              });
                            },
                            child: const Text('Xóa bộ lọc tìm kiếm'),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
                      itemCount: filtered.length,
                      itemBuilder: (_, idx) {
                        final p = filtered[idx];
                        final id = p['id'].toString();
                        final qty = _cart[id] ?? 0;
                        final price = num.tryParse(p['price'].toString()) ?? 0;
                        final category = p['category']?.toString() ?? '';
                        final isFragile = p['isFragile'] == true;

                        return Card(
                          elevation: 0,
                          color: Colors.white,
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                            side: BorderSide(
                              color: qty > 0 ? const Color(0xFF10B981) : Colors.grey.shade200,
                              width: qty > 0 ? 1.5 : 1,
                            ),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Stack(
                                  children: [
                                    _buildProductThumbnail(p, size: 88, radius: 16),
                                    if (category.contains('Ẩm thực'))
                                      Positioned(
                                        bottom: 4,
                                        left: 4,
                                        right: 4,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF065F46).withValues(alpha: 0.88),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: const Text(
                                            '🔥 Giao nóng',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 9,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Wrap(
                                        spacing: 6,
                                        runSpacing: 4,
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFF1F5F9),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              category,
                                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFECFDF5),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              '${p['weightKg']} kg • ~12 phút',
                                              style: const TextStyle(
                                                fontSize: 10,
                                                color: Color(0xFF065F46),
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                          ),
                                          if (isFragile)
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFFEF3C7),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: const Text(
                                                'Chống sốc',
                                                style: TextStyle(fontSize: 10, color: Color(0xFF92400E), fontWeight: FontWeight.bold),
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        p['name']?.toString() ?? '',
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800,
                                          color: Color(0xFF0F172A),
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        p['description']?.toString() ?? '',
                                        style: const TextStyle(fontSize: 12, color: Colors.black54),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 10),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            _formatVnd(price),
                                            style: const TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.w900,
                                              color: Color(0xFF059669),
                                            ),
                                          ),
                                          qty == 0
                                              ? ElevatedButton.icon(
                                                  onPressed: () => _addToCart(p),
                                                  style: ElevatedButton.styleFrom(
                                                    backgroundColor: const Color(0xFF059669),
                                                    foregroundColor: Colors.white,
                                                    elevation: 0,
                                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                                    shape: RoundedRectangleBorder(
                                                      borderRadius: BorderRadius.circular(11),
                                                    ),
                                                  ),
                                                  icon: const Icon(Icons.add_shopping_cart_rounded, size: 16),
                                                  label: const Text(
                                                    'Thêm giỏ',
                                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                                  ),
                                                )
                                              : Container(
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFFECFDF5),
                                                    borderRadius: BorderRadius.circular(12),
                                                    border: Border.all(color: const Color(0xFF6EE7B7)),
                                                  ),
                                                  child: Row(
                                                    children: [
                                                      IconButton(
                                                        visualDensity: VisualDensity.compact,
                                                        onPressed: () => _removeFromCart(id),
                                                        icon: const Icon(Icons.remove, size: 18, color: Color(0xFF059669)),
                                                      ),
                                                      Text(
                                                        '$qty',
                                                        style: const TextStyle(
                                                          fontWeight: FontWeight.w900,
                                                          fontSize: 14,
                                                          color: Color(0xFF065F46),
                                                        ),
                                                      ),
                                                      IconButton(
                                                        visualDensity: VisualDensity.compact,
                                                        onPressed: () => _addToCart(p),
                                                        icon: const Icon(Icons.add, size: 18, color: Color(0xFF059669)),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
        ),
        if (_cartItemCount > 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              border: const Border(top: BorderSide(color: Color(0xFFD1FAE5))),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 12,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Giỏ hàng: $_cartItemCount sản phẩm ($_cartTotalWeight kg)',
                        style: const TextStyle(fontSize: 12, color: Colors.black54, fontWeight: FontWeight.w600),
                      ),
                      Text(
                        'Tạm tính: ${_formatVnd(_cartProductTotal)}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF059669)),
                      ),
                    ],
                  ),
                ),
                ElevatedButton.icon(
                  onPressed: () => setState(() => _currentTab = 1),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: const Icon(Icons.shopping_cart_checkout_rounded),
                  label: const Text('Xem Giỏ & Đặt Hàng', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
      ],
    );
  }

  // ===========================================================================
  // TAB 1: GIỎ HÀNG & ĐẶT GIAO DRONE CỤ THỂ
  // ===========================================================================
  Widget _buildCartAndCheckoutTab() {
    final cartItems = _cartDetailedItems;
    final presetLocations = [
      {
        'name': 'Khu Công Nghệ Cao Thủ Đức',
        'addr': 'Lô E2a-7, Đường D1, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM',
        'lat': 10.841128,
        'lng': 106.809883,
      },
      {
        'name': 'Tòa Bitexco Quận 1',
        'addr': 'Số 2 Hải Triều, Phường Bến Nghé, Quận 1, TP.HCM',
        'lat': 10.771595,
        'lng': 106.704750,
      },
      {
        'name': 'Landmark 81 Bình Thạnh',
        'addr': '720A Điện Biên Phủ, Phường 22, Quận Bình Thạnh, TP.HCM',
        'lat': 10.795000,
        'lng': 106.721800,
      },
      {
        'name': 'Phú Mỹ Hưng Quận 7',
        'addr': '101 Tôn Dật Tiên, Khu đô thị Phú Mỹ Hưng, Quận 7, TP.HCM',
        'lat': 10.729560,
        'lng': 106.721750,
      },
    ];

    if (cartItems.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: const Icon(Icons.shopping_cart_outlined, size: 42, color: Color(0xFF059669)),
              ),
              const SizedBox(height: 16),
              const Text(
                'Giỏ hàng của bạn đang trống',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              const Text(
                'Hãy chọn các món ăn, thuốc y tế hoặc thiết bị công nghệ ở mục Khám Phá để đặt Drone giao ngay!',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54, fontSize: 13),
              ),
              const SizedBox(height: 18),
              ElevatedButton.icon(
                onPressed: () => setState(() => _currentTab = 0),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                icon: const Icon(Icons.add_shopping_cart_rounded),
                label: const Text('Chọn Sản Phẩm Ngay', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFD1FAE5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '1. Giỏ Hàng Của Bạn ($_cartItemCount món)',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                    ),
                    TextButton.icon(
                      onPressed: () => setState(() => _cart.clear()),
                      icon: const Icon(Icons.delete_outline, size: 16, color: Colors.redAccent),
                      label: const Text('Xóa hết', style: TextStyle(color: Colors.redAccent, fontSize: 12)),
                    ),
                  ],
                ),
                const Divider(),
                ...cartItems.map((entry) {
                  final p = entry['product'] as Map<String, dynamic>;
                  final qty = entry['quantity'] as int;
                  final id = p['id'].toString();
                  final unitPrice = num.tryParse(p['price'].toString()) ?? 0;

                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        _buildProductThumbnail(p, size: 54, radius: 12),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p['name']?.toString() ?? '',
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${_formatVnd(unitPrice)} • ${p['weightKg']} kg/món',
                                style: const TextStyle(fontSize: 11, color: Colors.black54),
                              ),
                            ],
                          ),
                        ),
                        Row(
                          children: [
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: () => _removeFromCart(id),
                              icon: const Icon(Icons.remove_circle_outline, color: Color(0xFF059669), size: 20),
                            ),
                            Text('$qty', style: const TextStyle(fontWeight: FontWeight.w900)),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: () => _addToCart(p),
                              icon: const Icon(Icons.add_circle, color: Color(0xFF059669), size: 20),
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: () => _deleteCartItem(id),
                              icon: const Icon(Icons.close, color: Colors.black38, size: 18),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Tải trọng khoang bay Drone:',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF065F46)),
                          ),
                          Text(
                            '$_cartTotalWeight / 5.00 kg',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF059669)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: LinearProgressIndicator(
                          value: (_cartTotalWeight / 5.0).clamp(0.0, 1.0),
                          minHeight: 7,
                          backgroundColor: const Color(0xFFD1FAE5),
                          color: const Color(0xFF059669),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFD1FAE5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '2. Điểm Hạ Cánh & Thông Tin Nhận Hàng',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: presetLocations.map((loc) {
                    return ActionChip(
                      backgroundColor: const Color(0xFFECFDF5),
                      side: const BorderSide(color: Color(0xFFA7F3D0)),
                      avatar: const Icon(Icons.location_on, size: 15, color: Color(0xFF059669)),
                      label: Text(
                        loc['name'].toString(),
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF065F46)),
                      ),
                      onPressed: () {
                        setState(() {
                          _recipientAddressCtrl.text = loc['addr'].toString();
                          _destLat = loc['lat'] as double;
                          _destLng = loc['lng'] as double;
                        });
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _recipientNameCtrl,
                        decoration: InputDecoration(
                          labelText: 'Người nhận *',
                          prefixIcon: const Icon(Icons.person_outline, size: 18),
                          isDense: true,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _recipientPhoneCtrl,
                        keyboardType: TextInputType.phone,
                        decoration: InputDecoration(
                          labelText: 'Số điện thoại *',
                          prefixIcon: const Icon(Icons.phone_outlined, size: 18),
                          isDense: true,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _recipientAddressCtrl,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'Địa chỉ giao hàng chi tiết *',
                    prefixIcon: const Icon(Icons.place_outlined),
                    isDense: true,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _deliveryNoteCtrl,
                  decoration: InputDecoration(
                    labelText: 'Ghi chú điểm đáp Drone (Sảnh, Sân thượng, Bãi cỏ...)',
                    prefixIcon: const Icon(Icons.note_alt_outlined, size: 18),
                    isDense: true,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFD1FAE5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '3. Thanh Toán & Xác Nhận Đặt Giao',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () => setState(() => _paymentMethod = 'PAY_NOW'),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: _paymentMethod == 'PAY_NOW'
                                ? const Color(0xFFECFDF5)
                                : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: _paymentMethod == 'PAY_NOW'
                                  ? const Color(0xFF059669)
                                  : Colors.grey.shade300,
                              width: 1.5,
                            ),
                          ),
                          child: const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Ví MoMo / QR Ngân hàng',
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF065F46)),
                              ),
                              SizedBox(height: 2),
                              Text('Thanh toán tự động ngay', style: TextStyle(fontSize: 11, color: Colors.black54)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: InkWell(
                        onTap: () => setState(() => _paymentMethod = 'COD'),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: _paymentMethod == 'COD'
                                ? const Color(0xFFECFDF5)
                                : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: _paymentMethod == 'COD'
                                  ? const Color(0xFF059669)
                                  : Colors.grey.shade300,
                              width: 1.5,
                            ),
                          ),
                          child: const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Thanh toán sau',
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF065F46)),
                              ),
                              SizedBox(height: 2),
                              Text('Thanh toán khi Drone tới', style: TextStyle(fontSize: 11, color: Colors.black54)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF6F8F7),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFD1FAE5)),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Tổng tiền hàng ($_cartItemCount món):', style: const TextStyle(fontSize: 13)),
                          Text(_formatVnd(_cartProductTotal), style: const TextStyle(fontWeight: FontWeight.w700)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Phí bay Drone hỏa tốc ($_cartTotalWeight kg):', style: const TextStyle(fontSize: 13)),
                          Text(_formatVnd(_droneShippingFee), style: const TextStyle(fontWeight: FontWeight.w700)),
                        ],
                      ),
                      const Divider(height: 18),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Tổng thanh toán:', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
                          Text(
                            _formatVnd(_cartProductTotal + _droneShippingFee),
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF059669),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: _placingOrder ? null : _placeOrderFromCart,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF059669),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    icon: const Icon(Icons.flight_takeoff_rounded),
                    label: Text(
                      _placingOrder
                          ? 'ĐANG CẤT CÁNH DRONE...'
                          : 'ĐẶT HÀNG & CHO DRONE GIAO NGAY',
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 2: GIAO DIỆN TRẠNG THÁI ĐƠN GIỐNG SHOPEE + BẢN ĐỒ DRONE ĐỒNG BỘ 1:1 WEB
  // ===========================================================================
  Widget _buildShopeeOrderStatusAndDroneMapTab() {
    final order = _activeTrackingOrder ?? (_orders.isNotEmpty ? _orders.first : null);
    final trackingCode = order?['trackingNumber']?.toString() ?? 'SDD-20261108-482910';
    final status = order?['status']?.toString() ?? 'IN_TRANSIT';
    final paymentStatus = order?['paymentStatus']?.toString() ?? 'PAID';
    final isPaid = paymentStatus == 'PAID';
    final snapshot = order?['addressSnapshot'] as Map?;
    final originLabel = _syncedTelemetry?['originLabel']?.toString() ??
        snapshot?['senderAddressText']?.toString() ??
        'Trạm Drone Hub Trung Tâm Quận 1';
    final destLabel = _syncedTelemetry?['destLabel']?.toString() ??
        snapshot?['recipientAddressText']?.toString() ??
        'Khu Công Nghệ Cao TP. Thủ Đức';
    final pkgs = order?['packages'] as List?;
    final firstPkg = (pkgs != null && pkgs.isNotEmpty) ? pkgs.first as Map : null;
    final pkgDesc = firstPkg?['description']?.toString() ?? 'Kiện hàng giao bằng Drone';

    final startLat = double.tryParse(_syncedTelemetry?['originLat']?.toString() ??
            snapshot?['senderLatitude']?.toString() ??
            '') ??
        10.771595;
    final startLng = double.tryParse(_syncedTelemetry?['originLng']?.toString() ??
            snapshot?['senderLongitude']?.toString() ??
            '') ??
        106.704750;
    final endLat = double.tryParse(_syncedTelemetry?['destLat']?.toString() ??
            snapshot?['recipientLatitude']?.toString() ??
            '') ??
        10.841128;
    final endLng = double.tryParse(_syncedTelemetry?['destLng']?.toString() ??
            snapshot?['recipientLongitude']?.toString() ??
            '') ??
        106.809883;

    final currentLat = (startLat + (endLat - startLat) * _droneProgress).toStringAsFixed(6);
    final currentLng = (startLng + (endLng - startLng) * _droneProgress).toStringAsFixed(6);

    final totalDistKm = double.tryParse(_syncedTelemetry?['totalDistanceKm']?.toString() ?? '') ?? 13.8;
    final remainingDistKm = (totalDistKm * (1.0 - _droneProgress)).toStringAsFixed(2);
    final etaMinutes = math.max(1, ((totalDistKm * (1.0 - _droneProgress) / 48.0) * 60.0).ceil()).toString();
    final batteryPct = (96.0 - (_droneProgress * 18.0)).toStringAsFixed(1);
    final altitudeM = _droneProgress >= 1.0 ? '0' : (_droneProgress > 0.85 ? '28' : '65');
    final speedKmh = _droneProgress >= 1.0 ? '0' : '48.5';

    final isDelivered = status == 'DELIVERED';
    final hasArrived = isDelivered || status == 'ARRIVED' || _droneProgress >= 0.98;
    final isApproaching = !hasArrived && _droneProgress >= 0.70;

    // Filter orders by Shopee status tabs
    final filteredOrders = _orders.where((o) {
      final st = o['status']?.toString() ?? 'IN_TRANSIT';
      if (_orderStatusTab == 'ALL') return true;
      if (_orderStatusTab == 'PENDING') return st == 'PENDING_APPROVAL' || st == 'DRAFT';
      if (_orderStatusTab == 'PICKUP') return st == 'APPROVED' || st == 'SCHEDULED';
      if (_orderStatusTab == 'SHIPPING') return st == 'IN_TRANSIT' || st == 'APPROACHING' || st == 'ARRIVED';
      if (_orderStatusTab == 'DELIVERED') return st == 'DELIVERED';
      if (_orderStatusTab == 'CANCELLED') return st == 'CANCELLED' || st == 'REJECTED';
      return true;
    }).toList();

    return Column(
      children: [
        // 1. SHOPEE-STYLE ORDER STATUS TABS BAR
        Container(
          color: Colors.white,
          height: 46,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            children: [
              _buildShopeeStatusTabChip('ALL', 'Tất cả (${_orders.length})'),
              _buildShopeeStatusTabChip('PENDING', 'Chờ xác nhận'),
              _buildShopeeStatusTabChip('PICKUP', 'Chờ lấy hàng'),
              _buildShopeeStatusTabChip('SHIPPING', 'Đang giao hàng'),
              _buildShopeeStatusTabChip('DELIVERED', 'Đã giao'),
              _buildShopeeStatusTabChip('CANCELLED', 'Đã hủy'),
            ],
          ),
        ),

        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Order Selector Horizontal Pills
                if (filteredOrders.isNotEmpty) ...[
                  SizedBox(
                    height: 36,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: filteredOrders.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 8),
                      itemBuilder: (_, i) {
                        final o = filteredOrders[i];
                        final selected = o['id'] == order?['id'];
                        return ChoiceChip(
                          label: Text(o['trackingNumber']?.toString() ?? ''),
                          selected: selected,
                          selectedColor: const Color(0xFF059669),
                          labelStyle: TextStyle(
                            color: selected ? Colors.white : const Color(0xFF0F172A),
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                          onSelected: (_) {
                            setState(() => _activeTrackingOrder = o);
                            _fetchSyncedTelemetry();
                          },
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // 2. SHOPEE-STYLE DELIVERY HEADER BANNER
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: isApproaching
                          ? [const Color(0xFF059669), const Color(0xFF0D9488)]
                          : [const Color(0xFF047857), const Color(0xFF0F766E)],
                    ),
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isDelivered
                                  ? 'Đơn hàng đã giao thành công'
                                  : hasArrived
                                      ? '🛸 Drone đã hạ cánh tại điểm giao! Hãy xác nhận nhận hàng'
                                      : isApproaching
                                          ? '🔔 Đơn hàng gần giao tới bạn! (Cách ~$remainingDistKm km)'
                                          : 'Đơn hàng đang trên đường giao đến bạn',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              isDelivered
                                  ? 'Kiện hàng đã được bàn giao an toàn qua xác thực OTP 6 số.'
                                  : hasArrived
                                      ? 'Drone DRN-VN-04 đã tới điểm hẹn (100% hành trình). Bấm Xác nhận nhận hàng để mở khoang lấy đồ ăn!'
                                      : 'Drone DRN-VN-04 dự kiến hạ cánh trong ~$etaMinutes phút nữa • Đồng bộ GPS thời gian thực với Web.',
                              style: const TextStyle(color: Color(0xFFD1FAE5), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.flight_takeoff_rounded, color: Colors.white, size: 28),
                      ),
                    ],
                  ),
                ),

                // 3. SHOPEE-STYLE 5-STEP HORIZONTAL PROGRESS STEPPER
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(
                      left: BorderSide(color: Color(0xFFD1FAE5)),
                      right: BorderSide(color: Color(0xFFD1FAE5)),
                      bottom: BorderSide(color: Color(0xFFD1FAE5)),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildShopeeStepIcon(Icons.receipt_long_rounded, 'Đã đặt đơn', true),
                      _buildShopeeStepLine(true),
                      _buildShopeeStepIcon(Icons.paid_outlined, 'Đã thanh toán', isPaid),
                      _buildShopeeStepLine(_droneProgress > 0.1),
                      _buildShopeeStepIcon(Icons.flight_takeoff_rounded, 'Đang bay giao', _droneProgress > 0.1),
                      _buildShopeeStepLine(isApproaching || isDelivered),
                      _buildShopeeStepIcon(Icons.near_me_rounded, 'Gần giao tới', isApproaching || isDelivered),
                      _buildShopeeStepLine(isDelivered),
                      _buildShopeeStepIcon(Icons.star_rounded, 'Đã nhận', isDelivered),
                    ],
                  ),
                ),

                const SizedBox(height: 14),

                // 4. LIVE DRONE MAP SYNCED 1:1 WITH WEB (Nổi bật khi đơn đang giao / gần giao tới!)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isApproaching ? const Color(0xFF10B981) : const Color(0xFFD1FAE5),
                      width: isApproaching ? 2 : 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF059669).withValues(alpha: 0.08),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Map Top Status Row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                Container(
                                  width: 10,
                                  height: 10,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF10B981),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    isApproaching
                                        ? 'BẢN ĐỒ DRONE SẮP GIAO TỚI (SYNCED WEB)'
                                        : 'BẢN ĐỒ VỊ TRÍ DRONE THỜI GIAN THỰC',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF065F46),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF5),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFF6EE7B7)),
                            ),
                            child: Text(
                              'DRN-VN-04 • ${(_droneProgress * 100).round()}%',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF059669),
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 6),
                      Text(
                        'Tọa độ GPS đồng bộ Web: ($currentLat, $currentLng) • Cách điểm nhận ~$remainingDistKm km',
                        style: const TextStyle(fontSize: 11, color: Colors.black54, fontWeight: FontWeight.w600),
                      ),

                      const SizedBox(height: 12),

                      // Real Google Maps Street & Satellite Tile Engine + 60 FPS Smooth Gliding Drone
                      _RealGoogleMapsDroneWidget(
                        originLat: startLat,
                        originLng: startLng,
                        originLabel: originLabel,
                        destLat: endLat,
                        destLng: endLng,
                        destLabel: destLabel,
                        progress: _droneProgress,
                        droneLat: double.tryParse(currentLat) ?? startLat,
                        droneLng: double.tryParse(currentLng) ?? startLng,
                        isApproaching: isApproaching,
                      ),

                      const SizedBox(height: 12),

                      // Quick Simulation Stage Buttons (Syncs both Mobile & Web!)
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          ActionChip(
                            backgroundColor: const Color(0xFFECFDF5),
                            label: const Text('Vừa cất cánh (25%)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF065F46))),
                            onPressed: () => _setSyncedProgress(0.25),
                          ),
                          ActionChip(
                            backgroundColor: const Color(0xFFD1FAE5),
                            side: const BorderSide(color: Color(0xFF059669)),
                            label: const Text('🔔 Gần giao tới (82%)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF065F46))),
                            onPressed: () => _setSyncedProgress(0.82),
                          ),
                          ActionChip(
                            backgroundColor: const Color(0xFFFEF3C7),
                            label: const Text('Drone đã hạ cánh (100%)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF92400E))),
                            onPressed: () => _setSyncedProgress(1.0, paused: true),
                          ),
                        ],
                      ),

                      const SizedBox(height: 10),

                      Row(
                        children: [
                          _buildTelemetryTile('Độ cao & Tốc độ', '$altitudeM m • $speedKmh km/h'),
                          const SizedBox(width: 8),
                          _buildTelemetryTile('Khoảng cách còn', '~$remainingDistKm km (~$etaMinutes phút)'),
                          const SizedBox(width: 8),
                          _buildTelemetryTile('Pin Drone', '$batteryPct% • Ổn định'),
                        ],
                      ),

                      const SizedBox(height: 12),

                      Row(
                        children: [
                          if (!isPaid && order != null) ...[
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: () => _payOrder(order),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFD97706),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                icon: const Icon(Icons.qr_code_2, size: 18),
                                label: const Text('Thanh Toán Ngay', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                              ),
                            ),
                            const SizedBox(width: 8),
                          ],
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: hasArrived
                                  ? () => setState(() => _currentTab = 3)
                                  : () {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text(
                                            'Drone đang bay (${(_droneProgress * 100).round()}% quãng đường). Khi Drone giao đến nơi (100%) bạn mới xác nhận nhận hàng được nhé!',
                                          ),
                                          backgroundColor: const Color(0xFFD97706),
                                        ),
                                      );
                                    },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: hasArrived
                                    ? const Color(0xFF059669)
                                    : const Color(0xFF94A3B8),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              icon: Icon(
                                hasArrived ? Icons.verified_user_outlined : Icons.lock_clock_outlined,
                                size: 18,
                              ),
                              label: Text(
                                isDelivered
                                    ? 'Đã Nhận Hàng • Gửi Đánh Giá'
                                    : hasArrived
                                        ? 'Drone Đã Giao Đến • Xác Nhận Nhận Hàng'
                                        : 'Đang Bay (${(_droneProgress * 100).round()}%) • Chờ Giao Đến Để Nhận',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // 5. SHOPEE-STYLE VERTICAL TIMESTAMPED LOGS ("Thông tin vận chuyển chi tiết")
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFD1FAE5)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Thông Tin Vận Chuyển Chi Tiết',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
                          ),
                          Text(
                            'Mã vận đơn: $trackingCode',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Kiện hàng: $pkgDesc',
                        style: const TextStyle(fontSize: 12, color: Colors.black54, fontWeight: FontWeight.w600),
                      ),
                      const Divider(height: 22),
                      if (isDelivered)
                        _buildShopeeVerticalLogItem(
                          time: 'Vừa xong',
                          title: 'Giao hàng thành công (DELIVERED)',
                          desc: 'Khách hàng đã xác thực mã OTP 6 số và nhận kiện hàng từ khoang Drone DRN-VN-04.',
                          isLatest: true,
                          isDone: true,
                        ),
                      if (isApproaching || isDelivered)
                        _buildShopeeVerticalLogItem(
                          time: '1 phút trước',
                          title: 'Đơn hàng gần giao tới bạn! (Approaching Destination)',
                          desc: 'Drone DRN-VN-04 đang giảm độ cao tiếp cận điểm đáp tại $destLabel (Cách ~$remainingDistKm km • Tọa độ: $currentLat, $currentLng).',
                          isLatest: !isDelivered && isApproaching,
                          isDone: true,
                        ),
                      _buildShopeeVerticalLogItem(
                        time: '5 phút trước',
                        title: 'Đang bay trên hành lang không phận TP.HCM',
                        desc: 'Drone bay ổn định ở độ cao $altitudeM m, vận tốc $speedKmh km/h, pin $batteryPct%. Vị trí trực tuyến: ($currentLat, $currentLng).',
                        isLatest: !isDelivered && !isApproaching,
                        isDone: _droneProgress >= 0.25,
                      ),
                      _buildShopeeVerticalLogItem(
                        time: '10 phút trước',
                        title: 'Drone đã cất cánh rời Trạm Xuất Phát',
                        desc: 'Kiện hàng đã được khóa ngàm an toàn lên Drone DRN-VN-04 và cất cánh từ $originLabel.',
                        isLatest: false,
                        isDone: true,
                      ),
                      _buildShopeeVerticalLogItem(
                        time: '14 phút trước',
                        title: 'Đơn hàng đã được khởi tạo & chuẩn bị hàng',
                        desc: 'Hệ thống SmartDrone Mart đã xác nhận đơn hàng $trackingCode và đóng gói chống sốc.',
                        isLatest: false,
                        isDone: true,
                        isLastItem: true,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildShopeeStatusTabChip(String key, String label) {
    final selected = _orderStatusTab == key;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        selectedColor: const Color(0xFF059669),
        backgroundColor: const Color(0xFFF6F8F7),
        labelStyle: TextStyle(
          color: selected ? Colors.white : const Color(0xFF0F172A),
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
        side: BorderSide(
          color: selected ? const Color(0xFF059669) : const Color(0xFFD1FAE5),
        ),
        onSelected: (_) => setState(() => _orderStatusTab = key),
      ),
    );
  }

  Widget _buildShopeeStepIcon(IconData icon, String label, bool active) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: active ? const Color(0xFF059669) : const Color(0xFFF1F5F9),
            shape: BoxShape.circle,
          ),
          child: Icon(
            icon,
            size: 17,
            color: active ? Colors.white : Colors.grey,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: active ? FontWeight.w800 : FontWeight.w600,
            color: active ? const Color(0xFF065F46) : Colors.black45,
          ),
        ),
      ],
    );
  }

  Widget _buildShopeeStepLine(bool active) {
    return Expanded(
      child: Container(
        height: 2.5,
        margin: const EdgeInsets.only(bottom: 14),
        color: active ? const Color(0xFF10B981) : Colors.grey.shade200,
      ),
    );
  }

  Widget _buildShopeeVerticalLogItem({
    required String time,
    required String title,
    required String desc,
    required bool isLatest,
    required bool isDone,
    bool isLastItem = false,
  }) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                time,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isLatest ? FontWeight.w800 : FontWeight.w600,
                  color: isLatest ? const Color(0xFF059669) : Colors.black45,
                ),
              ),
            ),
          ),
          Column(
            children: [
              Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: isLatest
                      ? const Color(0xFF059669)
                      : isDone
                          ? const Color(0xFF6EE7B7)
                          : Colors.grey.shade300,
                  shape: BoxShape.circle,
                  border: isLatest
                      ? Border.all(color: const Color(0xFFD1FAE5), width: 3)
                      : null,
                ),
              ),
              if (!isLastItem)
                Expanded(
                  child: Container(
                    width: 2,
                    color: isDone ? const Color(0xFFA7F3D0) : Colors.grey.shade200,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: isLatest ? const Color(0xFF059669) : const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    desc,
                    style: TextStyle(
                      fontSize: 12,
                      color: isLatest ? Colors.black87 : Colors.black54,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTelemetryTile(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFFF6F8F7),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFD1FAE5)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 10, color: Colors.black54, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF065F46))),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // TAB 3: XÁC NHẬN NHẬN HÀNG (CHỈ KHI DRONE GIAO ĐẾN NƠI) & GỬI FEEDBACK CHO ADMIN
  // ===========================================================================
  Widget _buildConfirmAndFeedbackTab() {
    final order = _activeTrackingOrder ?? (_orders.isNotEmpty ? _orders.first : null);
    final trackingCode = order?['trackingNumber']?.toString() ?? 'SDD-20261108-482910';
    final isDelivered = order?['status'] == 'DELIVERED';
    final canConfirmArrival = _hasDroneArrived;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: canConfirmArrival ? const Color(0xFF10B981) : const Color(0xFFFDE68A),
                width: 1.5,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      isDelivered
                          ? Icons.check_circle
                          : canConfirmArrival
                              ? Icons.verified_user
                              : Icons.lock_clock_rounded,
                      color: canConfirmArrival ? const Color(0xFF059669) : const Color(0xFFD97706),
                      size: 28,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isDelivered
                                ? 'Đã Nhận Hàng Thành Công!'
                                : canConfirmArrival
                                    ? 'Drone Đã Hạ Cánh • Sẵn Sàng Nhận Hàng!'
                                    : 'Chờ Drone Giao Đến Điểm Hạ Cánh (${(_droneProgress * 100).round()}%)',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                          ),
                          Text(
                            'Đơn hàng: $trackingCode',
                            style: TextStyle(
                              fontSize: 12,
                              color: canConfirmArrival ? const Color(0xFF059669) : const Color(0xFFD97706),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                if (!canConfirmArrival) ...[
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.info_outline_rounded, color: Color(0xFFD97706), size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Drone đang bay trên đường giao (${(_droneProgress * 100).round()}% hành trình). Tính năng Xác nhận nhận hàng chỉ mở khóa khi Drone đã giao đến nơi (100%)!',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF92400E),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: LinearProgressIndicator(
                            value: _droneProgress.clamp(0.0, 1.0),
                            minHeight: 8,
                            backgroundColor: const Color(0xFFFEF3C7),
                            color: const Color(0xFF059669),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () => setState(() => _currentTab = 2),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFF059669),
                                  side: const BorderSide(color: Color(0xFF059669)),
                                ),
                                icon: const Icon(Icons.map_outlined, size: 16),
                                label: const Text(
                                  'Xem Bản Đồ Drone Bay',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: () => _setSyncedProgress(1.0, paused: true),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF059669),
                                  foregroundColor: Colors.white,
                                ),
                                icon: const Icon(Icons.flight_land_rounded, size: 16),
                                label: const Text(
                                  'Cho Drone Hạ Cánh Ngay',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ] else ...[
                  const Text(
                    'Drone đã hạ cánh an toàn tại điểm giao! Hãy bấm lấy mã OTP 6 số để mở khóa khoang chứa thức ăn và hoàn tất nhận hàng.',
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                  const SizedBox(height: 12),
                ],

                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: (_verifyingOtp || !canConfirmArrival) ? null : _issueOtpForActiveOrder,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF059669),
                      side: BorderSide(
                        color: canConfirmArrival ? const Color(0xFF059669) : Colors.grey.shade300,
                      ),
                    ),
                    icon: const Icon(Icons.key, size: 16),
                    label: Text(
                      canConfirmArrival
                          ? 'Lấy mã OTP mở khoang nhận hàng'
                          : 'Chờ Drone giao đến nơi (100%) để lấy OTP',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                if (_issuedOtpHint != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _issuedOtpHint!,
                    style: const TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _otpController,
                        enabled: canConfirmArrival && !isDelivered,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        decoration: InputDecoration(
                          hintText: canConfirmArrival
                              ? 'Nhập 6 số OTP (VD: 123456)'
                              : 'Khóa cho tới khi Drone giao đến',
                          counterText: '',
                          isDense: true,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    ElevatedButton.icon(
                      onPressed: (_verifyingOtp || !canConfirmArrival || isDelivered)
                          ? null
                          : _confirmDeliveryOtp,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        disabledBackgroundColor: Colors.grey.shade300,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: Icon(
                        isDelivered
                            ? Icons.check_circle_outline
                            : canConfirmArrival
                                ? Icons.verified_rounded
                                : Icons.lock_outline,
                        size: 16,
                      ),
                      label: Text(
                        isDelivered ? 'Đã Nhận Hàng' : 'Xác Nhận Đã Nhận',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),

          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFD1FAE5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Đánh Giá Dịch Vụ & Gửi Feedback Tới Admin',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Ý kiến của bạn sẽ được gửi trực tiếp lên trang Quản trị viên (Admin Feedback).',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(5, (index) {
                    final star = index + 1;
                    return IconButton(
                      onPressed: () => setState(() => _feedbackRating = star),
                      icon: Icon(
                        star <= _feedbackRating ? Icons.star_rounded : Icons.star_outline_rounded,
                        color: const Color(0xFFF59E0B),
                        size: 36,
                      ),
                    );
                  }),
                ),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    'Drone giao siêu nhanh 15 phút!',
                    'Đồ ăn còn nóng hổi, đóng gói kỹ',
                    'Bản đồ theo dõi Drone rất trực quan',
                    'Trải nghiệm tuyệt vời 5 sao',
                  ].map((sample) {
                    return ActionChip(
                      backgroundColor: const Color(0xFFECFDF5),
                      label: Text(sample, style: const TextStyle(fontSize: 11, color: Color(0xFF065F46))),
                      onPressed: () {
                        setState(() {
                          _feedbackCommentController.text = sample;
                        });
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _feedbackCommentController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: 'Nhập nhận xét của bạn về chuyến giao hàng bằng Drone...',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton.icon(
                    onPressed: _submittingFeedback ? null : _submitCustomerFeedback,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF059669),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.send_rounded, size: 18),
                    label: Text(
                      _submittingFeedback ? 'ĐANG GỬI...' : 'GỬI FEEDBACK CHO ADMIN',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ),

          if (_myFeedbacks.isNotEmpty) ...[
            const SizedBox(height: 18),
            const Text(
              'Feedback Đã Gửi & Phản Hồi Từ Admin',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            ..._myFeedbacks.map((fb) {
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Đơn: ${fb['trackingNumber'] ?? ''}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF059669)),
                        ),
                        Text(
                          '${'★' * (int.tryParse(fb['rating'].toString()) ?? 5)} (${fb['rating']}/5)',
                          style: const TextStyle(color: Color(0xFFD97706), fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('“${fb['comment']}”', style: const TextStyle(fontSize: 13)),
                    if (fb['adminReply'] != null && fb['adminReply'].toString().isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          'Admin phản hồi: ${fb['adminReply']}',
                          style: const TextStyle(fontSize: 12, color: Color(0xFF065F46), fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

/// Bản đồ Google Maps thật (Street & Satellite Tiles mt0..3.google.com/vt)
/// kết hợp Drone 4 cánh quạt di chuyển mượt 60 FPS đồng bộ thời gian thực 1:1 với Web Portal!
class _RealGoogleMapsDroneWidget extends StatefulWidget {
  final double originLat;
  final double originLng;
  final String originLabel;
  final double destLat;
  final double destLng;
  final String destLabel;
  final double progress;
  final double droneLat;
  final double droneLng;
  final bool isApproaching;

  const _RealGoogleMapsDroneWidget({
    required this.originLat,
    required this.originLng,
    required this.originLabel,
    required this.destLat,
    required this.destLng,
    required this.destLabel,
    required this.progress,
    required this.droneLat,
    required this.droneLng,
    required this.isApproaching,
  });

  @override
  State<_RealGoogleMapsDroneWidget> createState() =>
      _RealGoogleMapsDroneWidgetState();
}

class _RealGoogleMapsDroneWidgetState
    extends State<_RealGoogleMapsDroneWidget> {
  String _lyrs = 'm'; // 'm': Google Streets, 'y': Google Hybrid Satellite
  String _cameraMode = 'ROUTE'; // 'ROUTE' | 'DRONE'
  int _zoom = 13;
  Offset _panOffset = Offset.zero;

  static double _lngToWorldX(double lng, int zoom) {
    return ((lng + 180.0) / 360.0) * 256.0 * (1 << zoom);
  }

  static double _latToWorldY(double lat, int zoom) {
    final rad = lat * math.pi / 180.0;
    final n = math.pi - math.log(math.tan(math.pi / 4.0 + rad / 2.0));
    return (n / (2.0 * math.pi)) * 256.0 * (1 << zoom);
  }

  @override
  Widget build(BuildContext context) {
    final centerLat = _cameraMode == 'DRONE'
        ? widget.droneLat
        : (widget.originLat + widget.destLat) / 2.0;
    final centerLng = _cameraMode == 'DRONE'
        ? widget.droneLng
        : (widget.originLng + widget.destLng) / 2.0;

    return Container(
      height: 295,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFFEFFDF5),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF6EE7B7), width: 1.5),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth > 0 ? constraints.maxWidth : 380.0;
            final height = constraints.maxHeight > 0 ? constraints.maxHeight : 295.0;

            final centerWorldX = _lngToWorldX(centerLng, _zoom) - _panOffset.dx;
            final centerWorldY = _latToWorldY(centerLat, _zoom) - _panOffset.dy;

            Offset project(double lat, double lng) {
              final wx = _lngToWorldX(lng, _zoom);
              final wy = _latToWorldY(lat, _zoom);
              return Offset(
                width / 2.0 + (wx - centerWorldX),
                height / 2.0 + (wy - centerWorldY),
              );
            }

            final originPt = project(widget.originLat, widget.originLng);
            final destPt = project(widget.destLat, widget.destLng);
            final dronePt = project(widget.droneLat, widget.droneLng);

            final maxTile = 1 << _zoom;
            final startTx = ((centerWorldX - width / 2.0 - 256.0) / 256.0).floor();
            final endTx = ((centerWorldX + width / 2.0 + 256.0) / 256.0).floor();
            final startTy = math.max(
              0,
              ((centerWorldY - height / 2.0 - 256.0) / 256.0).floor(),
            );
            final endTy = math.min(
              maxTile - 1,
              ((centerWorldY + height / 2.0 + 256.0) / 256.0).floor(),
            );

            final tileWidgets = <Widget>[];
            for (int tx = startTx; tx <= endTx; tx++) {
              for (int ty = startTy; ty <= endTy; ty++) {
                final wrappedTx = ((tx % maxTile) + maxTile) % maxTile;
                final left = width / 2.0 + (tx * 256.0 - centerWorldX);
                final top = height / 2.0 + (ty * 256.0 - centerWorldY);
                final serverIdx = (tx + ty).abs() % 4;
                final url =
                    'https://mt$serverIdx.google.com/vt/lyrs=$_lyrs&hl=vi&x=$wrappedTx&y=$ty&z=$_zoom';

                tileWidgets.add(
                  Positioned(
                    key: ValueKey('$_zoom-$_lyrs-$tx-$ty'),
                    left: left,
                    top: top,
                    width: 256,
                    height: 256,
                    child: Image.network(
                      url,
                      width: 256,
                      height: 256,
                      fit: BoxFit.cover,
                      gaplessPlayback: true,
                      errorBuilder: (_, _, _) => Container(
                        color: const Color(0xFFEFFDF5),
                      ),
                    ),
                  ),
                );
              }
            }

            return GestureDetector(
              onPanUpdate: (details) {
                setState(() {
                  _panOffset += details.delta;
                });
              },
              child: Stack(
                children: [
                  // 1. REAL GOOGLE MAPS TILES
                  ...tileWidgets,

                  // 2. FLIGHT ROUTE POLYLINE & SMOOTH 60 FPS DRONE MARKER
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _RealMapRouteAndDroneOverlayPainter(
                        originPt: originPt,
                        destPt: destPt,
                        dronePt: dronePt,
                        originLabel: widget.originLabel,
                        destLabel: widget.destLabel,
                        progress: widget.progress,
                        isApproaching: widget.isApproaching,
                      ),
                    ),
                  ),

                  // 3. TOP CONTROLS: CAMERA FOLLOW & LAYER SWITCH
                  Positioned(
                    top: 10,
                    left: 10,
                    right: 10,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Camera Target Toggle
                        Container(
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.94),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFA7F3D0)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _buildMiniMapBtn(
                                label: '📐 Toàn tuyến',
                                active: _cameraMode == 'ROUTE',
                                onTap: () => setState(() {
                                  _cameraMode = 'ROUTE';
                                  _zoom = 13;
                                  _panOffset = Offset.zero;
                                }),
                              ),
                              const SizedBox(width: 4),
                              _buildMiniMapBtn(
                                label: '🛸 Bám Drone',
                                active: _cameraMode == 'DRONE',
                                onTap: () => setState(() {
                                  _cameraMode = 'DRONE';
                                  _zoom = 15;
                                  _panOffset = Offset.zero;
                                }),
                              ),
                            ],
                          ),
                        ),

                        // Street / Satellite Toggle
                        Container(
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.94),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFA7F3D0)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _buildMiniMapBtn(
                                label: 'Đường phố',
                                active: _lyrs == 'm',
                                onTap: () => setState(() => _lyrs = 'm'),
                              ),
                              const SizedBox(width: 4),
                              _buildMiniMapBtn(
                                label: 'Vệ tinh',
                                active: _lyrs == 'y',
                                onTap: () => setState(() => _lyrs = 'y'),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // 4. BOTTOM HUD: LIVE GPS & ZOOM CONTROLS
                  Positioned(
                    bottom: 10,
                    left: 10,
                    right: 10,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.95),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFF6EE7B7)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.gps_fixed,
                                size: 14,
                                color: Color(0xFF059669),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                'Google Maps Live: ${widget.droneLat.toStringAsFixed(5)}, ${widget.droneLng.toStringAsFixed(5)}',
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF065F46),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.95),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFA7F3D0)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              InkWell(
                                onTap: () => setState(
                                  () => _zoom = math.min(17, _zoom + 1),
                                ),
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(
                                    horizontal: 9,
                                    vertical: 5,
                                  ),
                                  child: Text(
                                    '+',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ),
                              Container(
                                width: 1,
                                height: 16,
                                color: Colors.grey.shade300,
                              ),
                              InkWell(
                                onTap: () => setState(
                                  () => _zoom = math.max(11, _zoom - 1),
                                ),
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(
                                    horizontal: 9,
                                    vertical: 5,
                                  ),
                                  child: Text(
                                    '-',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildMiniMapBtn({
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(7),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF059669) : Colors.transparent,
          borderRadius: BorderRadius.circular(7),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w800,
            color: active ? Colors.white : const Color(0xFF0F172A),
          ),
        ),
      ),
    );
  }
}

class _RealMapRouteAndDroneOverlayPainter extends CustomPainter {
  final Offset originPt;
  final Offset destPt;
  final Offset dronePt;
  final String originLabel;
  final String destLabel;
  final double progress;
  final bool isApproaching;

  _RealMapRouteAndDroneOverlayPainter({
    required this.originPt,
    required this.destPt,
    required this.dronePt,
    required this.originLabel,
    required this.destLabel,
    required this.progress,
    required this.isApproaching,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // 1. Đường bay tổng quan (Viền trắng + xanh lá nhạt)
    canvas.drawLine(
      originPt,
      destPt,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.9)
        ..strokeWidth = 7
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawLine(
      originPt,
      destPt,
      Paint()
        ..color = const Color(0xFF6EE7B7)
        ..strokeWidth = 3.5
        ..strokeCap = StrokeCap.round,
    );

    // 2. Đường bay Drone đã bay qua (Xanh ngọc đậm)
    canvas.drawLine(
      originPt,
      dronePt,
      Paint()
        ..color = const Color(0xFF059669)
        ..strokeWidth = 5
        ..strokeCap = StrokeCap.round,
    );

    // 3. Điểm Xuất Phát (Origin Station)
    canvas.drawCircle(
      originPt,
      14,
      Paint()..color = const Color(0xFF059669).withValues(alpha: 0.25),
    );
    canvas.drawCircle(originPt, 7, Paint()..color = const Color(0xFF059669));
    canvas.drawCircle(originPt, 3, Paint()..color = Colors.white);
    _drawPinLabel(
      canvas,
      originPt.translate(0, 20),
      '🛫 ${originLabel.length > 18 ? '${originLabel.substring(0, 18)}...' : originLabel}',
      const Color(0xFF059669),
    );

    // 4. Điểm Giao Nhận (Destination Landing Zone)
    if (isApproaching) {
      canvas.drawCircle(
        destPt,
        24,
        Paint()..color = const Color(0xFFE11D48).withValues(alpha: 0.22),
      );
    }
    canvas.drawCircle(
      destPt,
      14,
      Paint()..color = const Color(0xFFE11D48).withValues(alpha: 0.28),
    );
    canvas.drawCircle(destPt, 7, Paint()..color = const Color(0xFFE11D48));
    canvas.drawCircle(destPt, 3, Paint()..color = Colors.white);
    _drawPinLabel(
      canvas,
      destPt.translate(0, -22),
      '🛬 ${destLabel.length > 18 ? '${destLabel.substring(0, 18)}...' : destLabel}',
      const Color(0xFFE11D48),
    );

    // 5. Biểu tượng Quadcopter Drone di chuyển mượt 60 FPS
    canvas.drawCircle(
      dronePt,
      24,
      Paint()..color = const Color(0xFF10B981).withValues(alpha: 0.28),
    );

    final armPaint = Paint()
      ..color = const Color(0xFF064E3B)
      ..strokeWidth = 2.8;
    const armOffset = 11.0;
    canvas.drawLine(
      dronePt.translate(-armOffset, -armOffset),
      dronePt.translate(armOffset, armOffset),
      armPaint,
    );
    canvas.drawLine(
      dronePt.translate(armOffset, -armOffset),
      dronePt.translate(-armOffset, armOffset),
      armPaint,
    );
    for (final dx in [-armOffset, armOffset]) {
      for (final dy in [-armOffset, armOffset]) {
        final rotorCenter = dronePt.translate(dx, dy);
        canvas.drawCircle(rotorCenter, 5.5, Paint()..color = Colors.white);
        canvas.drawCircle(
          rotorCenter,
          4.2,
          Paint()..color = const Color(0xFF10B981),
        );
      }
    }

    canvas.drawCircle(dronePt, 7.5, Paint()..color = const Color(0xFF059669));
    canvas.drawCircle(dronePt, 3, Paint()..color = Colors.white);

    // Tag nổi trên Drone ("DRN-VN-04 • XX%")
    _drawPinLabel(
      canvas,
      dronePt.translate(0, -30),
      'DRN-VN-04 • ${(progress * 100).round()}%',
      const Color(0xFF059669),
    );
  }

  void _drawPinLabel(
    Canvas canvas,
    Offset center,
    String text,
    Color borderColor,
  ) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: borderColor,
          fontSize: 10,
          fontWeight: FontWeight.w900,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();

    final rect = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: center,
        width: tp.width + 14,
        height: tp.height + 7,
      ),
      const Radius.circular(6),
    );
    canvas.drawRRect(
      rect,
      Paint()..color = Colors.white.withValues(alpha: 0.95),
    );
    canvas.drawRRect(
      rect,
      Paint()
        ..color = borderColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4,
    );
    tp.paint(
      canvas,
      Offset(center.dx - tp.width / 2, center.dy - tp.height / 2),
    );
  }

  @override
  bool shouldRepaint(
    covariant _RealMapRouteAndDroneOverlayPainter oldDelegate,
  ) =>
      oldDelegate.dronePt != dronePt ||
      oldDelegate.originPt != originPt ||
      oldDelegate.destPt != destPt ||
      oldDelegate.progress != progress;
}
