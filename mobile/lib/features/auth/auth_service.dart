
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/session_manager.dart';

class AuthService {
  // Địa chỉ backend ASP.NET Core trên máy local.
  static const String baseUrl = 'https://localhost:7178';

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final uri = Uri.parse('$baseUrl/api/auth/login');

    try {
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'email': email.trim(),
          'password': password,
        }),
      );

      dynamic decoded;

      try {
        decoded = jsonDecode(response.body);
      } catch (_) {
        throw AuthException('Phản hồi từ máy chủ không hợp lệ.');
      }

      if (response.statusCode == 200) {
        if (decoded is! Map) {
          throw AuthException('Dữ liệu đăng nhập không hợp lệ.');
        }

        final data = Map<String, dynamic>.from(decoded);

        // Lưu Access Token, Refresh Token và thông tin người dùng.
        await SessionManager.saveSession(data);

        return data;
      }

      if (decoded is Map) {
        final message =
            decoded['detail'] ?? decoded['title'];

        throw AuthException(
          message?.toString() ?? 'Đăng nhập thất bại.',
        );
      }

      throw AuthException(
        'Đăng nhập thất bại. Mã lỗi: ${response.statusCode}',
      );
    } on AuthException {
      rethrow;
    } on http.ClientException {
      throw AuthException(
        'Không thể kết nối máy chủ. Vui lòng kiểm tra backend.',
      );
    } catch (e) {
      throw AuthException('Có lỗi xảy ra: $e');
    }
  }
}

class AuthException implements Exception {
  final String message;

  AuthException(this.message);

  @override
  String toString() => message;
}
