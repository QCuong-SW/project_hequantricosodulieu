
import 'package:material_ui/material_ui.dart';

class TrackingPage extends StatefulWidget {
  const TrackingPage({super.key});

  @override
  State<TrackingPage> createState() => _TrackingPageState();
}

class _TrackingPageState extends State<TrackingPage> {
  final _trackingController = TextEditingController();
  bool _isSearching = false;

  @override
  void dispose() {
    _trackingController.dispose();
    super.dispose();
  }

  void _searchOrder() {
    final trackingNumber = _trackingController.text.trim();

    if (trackingNumber.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng nhập mã vận đơn'),
        ),
      );
      return;
    }

    // Backend hiện chưa có API tra cứu đơn hàng.
    // Không hiển thị dữ liệu giả.
    setState(() {
      _isSearching = true;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'API theo dõi đơn hàng chưa được triển khai trên Backend.',
        ),
      ),
    );

    setState(() {
      _isSearching = false;
    });
  }

  @override
  Widget build(BuildContext context) {
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

              // Nhập mã vận đơn
              TextField(
                controller: _trackingController,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  hintText: 'Ví dụ: SDD-000001',
                  prefixIcon: const Icon(Icons.local_shipping_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                ),
              ),

              const SizedBox(height: 16),

              // Nút tra cứu
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _isSearching ? null : _searchOrder,
                  icon: const Icon(Icons.search),
                  label: const Text('TRA CỨU ĐƠN HÀNG'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 28),

              // Khu vực kết quả
              Card(
                elevation: 1,
                color: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: SizedBox(
                    width: double.infinity,
                    child: Column(
                      children: [
                        const Icon(
                          Icons.location_searching,
                          size: 64,
                          color: Color(0xFF2563EB),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Hành trình đơn hàng',
                          style: TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Thông tin trạng thái, vị trí Drone và '
                          'lịch sử giao hàng sẽ hiển thị tại đây.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.black54,
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.orange.shade50,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            'Chưa kết nối API theo dõi đơn hàng',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.orange.shade900,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Các trạng thái theo SQL Module 02
              const Text(
                'Các trạng thái vận chuyển',
                style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),

              _buildStatusItem(
                Icons.description_outlined,
                'DRAFT',
                'Bản nháp',
              ),
              _buildStatusItem(
                Icons.pending_actions,
                'PENDING_APPROVAL',
                'Chờ phê duyệt',
              ),
              _buildStatusItem(
                Icons.check_circle_outline,
                'APPROVED',
                'Đã phê duyệt',
              ),
              _buildStatusItem(
                Icons.schedule,
                'SCHEDULED',
                'Đã lên lịch',
              ),
              _buildStatusItem(
                Icons.flight_takeoff,
                'IN_TRANSIT',
                'Đang vận chuyển',
              ),
              _buildStatusItem(
                Icons.delivery_dining,
                'DELIVERING',
                'Đang giao hàng',
              ),
              _buildStatusItem(
                Icons.location_on_outlined,
                'ARRIVED',
                'Drone đã đến',
              ),
              _buildStatusItem(
                Icons.task_alt,
                'DELIVERED',
                'Giao hàng thành công',
              ),
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
  ) {
    return Card(
      elevation: 0,
      color: Colors.white,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFEFF6FF),
          child: Icon(
            icon,
            color: const Color(0xFF2563EB),
          ),
        ),
        title: Text(
          description,
          style: const TextStyle(
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Text(code),
      ),
    );
  }
}
