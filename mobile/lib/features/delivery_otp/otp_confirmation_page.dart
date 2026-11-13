
import 'package:material_ui/material_ui.dart';

class OtpConfirmationPage extends StatefulWidget {
  final String orderId;
  final String? trackingNumber;

  const OtpConfirmationPage({
    super.key,
    required this.orderId,
    this.trackingNumber,
  });

  @override
  State<OtpConfirmationPage> createState() =>
      _OtpConfirmationPageState();
}

class _OtpConfirmationPageState
    extends State<OtpConfirmationPage> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();

  final bool _isLoading = false;
  bool _obscureOtp = true;

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  void _confirmDelivery() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    // Backend hiện chưa có API xác minh OTP.
    // Không tự đánh dấu đơn hàng đã giao thành công.
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'API xác minh OTP chưa được triển khai trên Backend.',
        ),
        backgroundColor: Colors.orange,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F6FC),
      appBar: AppBar(
        title: const Text('Xác nhận nhận hàng'),
        backgroundColor: const Color(0xFF2563EB),
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 430),
              child: Card(
                elevation: 3,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Icon(
                          Icons.verified_user_outlined,
                          size: 76,
                          color: Color(0xFF2563EB),
                        ),

                        const SizedBox(height: 20),

                        const Text(
                          'Xác nhận giao hàng',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 23,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF172554),
                          ),
                        ),

                        const SizedBox(height: 12),

                        const Text(
                          'Vui lòng nhập mã OTP để xác nhận '
                          'bạn đã nhận được kiện hàng.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.black54,
                            fontSize: 15,
                            height: 1.5,
                          ),
                        ),

                        const SizedBox(height: 24),

                        // Thông tin đơn hàng
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Thông tin đơn hàng',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),

                              const SizedBox(height: 10),

                              Text(
                                'Mã đơn: ${widget.orderId}',
                                style: const TextStyle(fontSize: 14),
                              ),

                              if (widget.trackingNumber != null)
                                Padding(
                                  padding:
                                      const EdgeInsets.only(top: 6),
                                  child: Text(
                                    'Mã vận đơn: '
                                    '${widget.trackingNumber}',
                                    style: const TextStyle(
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 28),

                        const Text(
                          'Mã xác nhận OTP',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),

                        const SizedBox(height: 10),

                        TextFormField(
                          controller: _otpController,
                          keyboardType: TextInputType.number,
                          obscureText: _obscureOtp,
                          maxLength: 6,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 25,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 12,
                          ),
                          decoration: InputDecoration(
                            hintText: '000000',
                            counterText: '',
                            prefixIcon: const Icon(
                              Icons.lock_outline,
                            ),
                            suffixIcon: IconButton(
                              onPressed: () {
                                setState(() {
                                  _obscureOtp = !_obscureOtp;
                                });
                              },
                              icon: Icon(
                                _obscureOtp
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Vui lòng nhập mã OTP';
                            }

                            if (!RegExp(r'^\d{6}$').hasMatch(value)) {
                              return 'Mã OTP phải gồm đúng 6 chữ số';
                            }

                            return null;
                          },
                        ),

                        const SizedBox(height: 24),

                        SizedBox(
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _isLoading
                                ? null
                                : _confirmDelivery,
                            style: ElevatedButton.styleFrom(
                              backgroundColor:
                                  const Color(0xFF2563EB),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius:
                                    BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text(
                              'XÁC NHẬN ĐÃ NHẬN HÀNG',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 20),

                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.orange.shade50,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              Icon(
                                Icons.info_outline,
                                color: Colors.orange.shade800,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Chức năng xác minh OTP cần API '
                                  'Backend để kiểm tra mã, thời hạn '
                                  'và số lần nhập sai.',
                                  style: TextStyle(
                                    color: Colors.orange.shade900,
                                    fontSize: 13,
                                    height: 1.4,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
