
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class SessionManager {
  static const String _accessTokenKey = 'accessToken';
  static const String _refreshTokenKey = 'refreshToken';
  static const String _accessTokenExpiryKey = 'accessTokenExpiresAt';
  static const String _userKey = 'currentUser';

  // Lưu token và thông tin người dùng sau khi đăng nhập thành công.
  static Future<void> saveSession(
    Map<String, dynamic> response,
  ) async {
    final prefs = await SharedPreferences.getInstance();

    final accessToken = response['accessToken'] as String?;
    final refreshToken = response['refreshToken'] as String?;

    if (accessToken == null ||
        accessToken.isEmpty ||
        refreshToken == null ||
        refreshToken.isEmpty) {
      throw const FormatException('Phản hồi đăng nhập thiếu token.');
    }

    await prefs.setString(_accessTokenKey, accessToken);
    await prefs.setString(_refreshTokenKey, refreshToken);

    final expiry = response['accessTokenExpiresAt'];
    if (expiry != null) {
      await prefs.setString(_accessTokenExpiryKey, expiry.toString());
    }

    final user = response['user'];
    if (user != null) {
      await prefs.setString(_userKey, jsonEncode(user));
    }
  }

  // Đọc Access Token.
  static Future<String?> getAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_accessTokenKey);
  }

  // Đọc Refresh Token.
  static Future<String?> getRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_refreshTokenKey);
  }

  // Đọc thông tin người dùng.
  static Future<Map<String, dynamic>?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString(_userKey);

    if (userJson == null) return null;

    try {
      return jsonDecode(userJson) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  // Kiểm tra Access Token còn hạn hay không.
  static Future<bool> hasValidSession() async {
    final prefs = await SharedPreferences.getInstance();

    final token = prefs.getString(_accessTokenKey);
    final expiryString = prefs.getString(_accessTokenExpiryKey);

    if (token == null || token.isEmpty || expiryString == null) {
      return false;
    }

    final expiry = DateTime.tryParse(expiryString);

    if (expiry == null) return false;

    return expiry.isAfter(DateTime.now().toUtc());
  }

  // Xóa phiên đăng nhập khi người dùng đăng xuất.
  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
    await prefs.remove(_accessTokenExpiryKey);
    await prefs.remove(_userKey);
  }
}
