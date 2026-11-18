import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:http/http.dart' as http;

import '../../core/session_manager.dart';
import '../auth/auth_service.dart';
import '../delivery_otp/otp_confirmation_page.dart';

class TrackingPage extends StatefulWidget {
  const TrackingPage({super.key});

  @override
  State<TrackingPage> createState() => _TrackingPageState();
}

class _TrackingPageState extends State<TrackingPage> {
  final _trackingController = TextEditingController(text: 'SDD-20261108-482910');
  bool _isSearching = false;
  Map<String, dynamic>? _orderData;
  String? _errorMessage;

  @override
  void dispose() {
    _trackingController.dispose();
    super.dispose();
  }

  Future<void> _searchOrder() async {
    final trackingNumber = _trackingController.text.trim();

    if (trackingNumber.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng nhập mã vận đơn'),
        ),
      );
      return;
    }

    setState(() {
      _isSearching = true;
      _errorMessage = null;
    });

    try {
      final token = await SessionManager.getAccessToken();
      final uri = Uri.parse(
        '${AuthService.baseUrl}/api/v1/delivery-orders/tracking/$trackingNumber',
      );

      final response = await http.get(
        uri,
        headers: {
          'Accept': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
      );

      final decoded = jsonDecode(response.body);
      if (response.statusCode == 200 && decoded is Map) {
        final data = decoded['data'] ?? decoded;
        if (data is Map) {
          setState(() {
            _orderData = Map<String, dynamic>.from(data);
          });
          return;
        }
      }

      final msg = (decoded is Map ? decoded['message'] : null)?.toString() ??
          'Không tìm thấy đơn hàng với mã $trackingNumber.';
      setState(() {
        _orderData = null;
        _errorMessage = msg;
      });
    } catch (e) {
      setState(() {
        _orderData = null;
        _errorMessage = 'Không thể kết nối máy chủ: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSearching = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentStatus = _orderData?['status']?.toString() ?? '';
    final snapshot = _orderData?['addressSnapshot'] as Map<String, dynamic>?;

    return Scaffold(
      backgroundColor: const Color(0xFFF3F6FC),
      appBar: AppBar(
        title: const Text('Theo dõi đơn hàng'),
        backgroundColor: const Color(0xFF2563EB),
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Tra cứu vận đơn',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF172554),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Nhập mã vận đơn để kiểm tra hành trình giao hàng.',
                style: TextStyle(
                  color: Colors.black54,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 24),

              TextField(
                controller: _trackingController,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  hintText: 'Ví dụ: SDD-20261108-482910',
                  prefixIcon: const Icon(Icons.local_shipping_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                ),
              ),

              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _isSearching ? null : _searchOrder,
                  icon: _isSearching
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Icon(Icons.search),
                  label: Text(_isSearching ? 'ĐANG TRA CỨU...' : 'TRA CỨU ĐƠN HÀNG'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              if (_errorMessage != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: TextStyle(
                      color: Colors.red.shade800,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),

              Card(
                elevation: 1,
                color: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: SizedBox(
                    width: double.infinity,
                    child: _orderData == null
                        ? const Column(
                            children: [
                              Icon(
                                Icons.location_searching,
                                size: 56,
                                color: Color(0xFF2563EB),
                              ),
                              SizedBox(height: 12),
                              Text(
                                'Hành trình đơn hàng',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              SizedBox(height: 8),
                              Text(
                                'Bấm "TRA CỨU ĐƠN HÀNG" để tải trạng thái thực tế từ Backend.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Colors.black54),
                              ),
                            ],
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      _orderData!['trackingNumber']?.toString() ?? '',
                                      style: const TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF172554),
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: currentStatus == 'DELIVERED'
                                          ? Colors.green.shade100
                                          : Colors.blue.shade100,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      currentStatus,
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: currentStatus == 'DELIVERED'
                                            ? Colors.green.shade900
                                            : Colors.blue.shade900,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const Divider(height: 24),
                              Text(
                                'Khối lượng: ${_orderData!['totalWeightKg']} kg  |  Phí: ${_orderData!['shippingFee']} đ',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              if (snapshot != null) ...[
                                const SizedBox(height: 8),
                                Text('Từ: ${snapshot['senderName']} (${snapshot['senderAddressText']})'),
                                const SizedBox(height: 4),
                                Text('Đến: ${snapshot['recipientName']} (${snapshot['recipientAddressText']})'),
                              ],
                              const SizedBox(height: 16),
                              SizedBox(
                                width: double.infinity,
                                child: OutlinedButton.icon(
                                  onPressed: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => OtpConfirmationPage(
                                          orderId: _orderData!['trackingNumber']?.toString() ??
                                              _orderData!['id']?.toString() ??
                                              '',
                                          trackingNumber:
                                              _orderData!['trackingNumber']?.toString(),
                                        ),
                                      ),
                                    ).then((_) => _searchOrder());
                                  },
                                  icon: const Icon(Icons.verified_user_outlined),
                                  label: const Text('Xác nhận OTP nhận hàng'),
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              const Text(
                'Các trạng thái vận chuyển',
                style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),

              _buildStatusItem(Icons.description_outlined, 'DRAFT', 'Bản nháp', currentStatus),
              _buildStatusItem(Icons.pending_actions, 'PENDING_APPROVAL', 'Chờ phê duyệt', currentStatus),
              _buildStatusItem(Icons.check_circle_outline, 'APPROVED', 'Đã phê duyệt', currentStatus),
              _buildStatusItem(Icons.schedule, 'SCHEDULED', 'Đã lên lịch', currentStatus),
              _buildStatusItem(Icons.flight_takeoff, 'IN_TRANSIT', 'Đang vận chuyển', currentStatus),
              _buildStatusItem(Icons.delivery_dining, 'DELIVERING', 'Đang giao hàng', currentStatus),
              _buildStatusItem(Icons.location_on_outlined, 'ARRIVED', 'Drone đã đến', currentStatus),
              _buildStatusItem(Icons.task_alt, 'DELIVERED', 'Giao hàng thành công', currentStatus),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusItem(
    IconData icon,
    String code,
    String description,
    String activeCode,
  ) {
    final isCurrent = code.toUpperCase() == activeCode.toUpperCase();
    return Card(
      elevation: isCurrent ? 2 : 0,
      color: isCurrent ? const Color(0xFFDBEAFE) : Colors.white,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isCurrent ? const Color(0xFF2563EB) : const Color(0xFFEFF6FF),
          child: Icon(
            icon,
            color: isCurrent ? Colors.white : const Color(0xFF2563EB),
          ),
        ),
        title: Text(
          description,
          style: TextStyle(
            fontWeight: isCurrent ? FontWeight.bold : FontWeight.w600,
          ),
        ),
        subtitle: Text(code),
        trailing: isCurrent
            ? const Icon(Icons.check_circle, color: Color(0xFF2563EB))
            : null,
      ),
    );
  }
}
