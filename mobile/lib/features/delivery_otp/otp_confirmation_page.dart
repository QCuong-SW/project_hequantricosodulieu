import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../core/session_manager.dart';
import '../auth/auth_service.dart';

class OtpConfirmationPage extends StatefulWidget {
  final String orderId;
  final String? trackingNumber;

  const OtpConfirmationPage({
    super.key,
    required this.orderId,
    this.trackingNumber,
  });

  @override
  State<OtpConfirmationPage> createState() => _OtpConfirmationPageState();
}

class _OtpConfirmationPageState extends State<OtpConfirmationPage> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();

  bool _isLoading = false;
  bool _obscureOtp = false;
  String? _demoOtpHint;
  bool _isDelivered = false;

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _generateDemoOtp() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final token = await SessionManager.getAccessToken();
      final uri = Uri.parse(
        '${AuthService.baseUrl}/api/v1/delivery-confirmations/generate-otp',
      );
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'orderId': widget.orderId}),
      );

      final decoded = jsonDecode(response.body);
      if (response.statusCode == 200 && decoded is Map) {
        final demoOtp = decoded['demoOtp']?.toString() ?? '123456';
        setState(() {
          _demoOtpHint = 'Mã OTP vừa phát hành: $demoOtp';
          _otpController.text = demoOtp;
        });
      }
    } catch (_) {
      setState(() {
        _demoOtpHint = 'Mã OTP Demo mặc định: 123456';
        _otpController.text = '123456';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _confirmDelivery() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final token = await SessionManager.getAccessToken();
      final uri = Uri.parse(
        '${AuthService.baseUrl}/api/v1/delivery-confirmations/verify-otp',
      );
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'orderId': widget.orderId,
          'otpCode': _otpController.text.trim(),
        }),
      );

      final decoded = jsonDecode(response.body);
      final message = (decoded is Map ? decoded['message'] : null)?.toString() ??
          'Đã xử lý xác thực OTP.';

      if (!mounted) return;

      if (response.statusCode == 200) {
        setState(() {
          _isDelivered = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Không thể kết nối máy chủ: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F8F7),
      appBar: AppBar(
        title: const Text('Xác nhận nhận hàng'),
        backgroundColor: const Color(0xFF059669),
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 430),
              child: Card(
                elevation: 2,
                color: Colors.white,
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
                        Icon(
                          _isDelivered
                              ? Icons.check_circle
                              : Icons.verified_user_outlined,
                          size: 76,
                          color: const Color(0xFF059669),
                        ),

                        const SizedBox(height: 20),

                        Text(
                          _isDelivered
                              ? 'Giao hàng hoàn tất!'
                              : 'Xác nhận giao hàng',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 23,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0F172A),
                          ),
                        ),

                        const SizedBox(height: 12),

                        const Text(
                          'Vui lòng nhập mã OTP 6 số để xác nhận bạn đã nhận kiện hàng từ Drone.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.black54,
                            fontSize: 15,
                            height: 1.5,
                          ),
                        ),

                        const SizedBox(height: 20),

                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFECFDF5),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
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
                                  padding: const EdgeInsets.only(top: 6),
                                  child: Text(
                                    'Mã vận đơn: ${widget.trackingNumber}',
                                    style: const TextStyle(fontSize: 14),
                                  ),
                                ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16),

                        OutlinedButton.icon(
                          onPressed: _isLoading ? null : _generateDemoOtp,
                          icon: const Icon(Icons.key),
                          label: const Text('Nhận mã OTP 6 số (SHA-256)'),
                        ),

                        if (_demoOtpHint != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(
                              _demoOtpHint!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Color(0xFF15803D),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),

                        const SizedBox(height: 20),

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
                            hintText: '123456',
                            counterText: '',
                            prefixIcon: const Icon(Icons.lock_outline),
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
                            onPressed: _isLoading ? null : _confirmDelivery,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF059669),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: Text(
                              _isLoading
                                  ? 'ĐANG XÁC MINH...'
                                  : 'XÁC NHẬN ĐÃ NHẬN HÀNG',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
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
