
import 'package:material_ui/material_ui.dart';

import 'core/session_manager.dart';
import 'features/auth/login_page.dart';
import 'features/home/customer_home_page.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SmartDroneApp());
}

class SmartDroneApp extends StatelessWidget {
  const SmartDroneApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SmartDroneDelivery',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
        ),
        useMaterial3: true,
      ),
      home: const SessionGate(),
    );
  }
}

// Kiểm tra phiên đăng nhập khi ứng dụng được mở.
class SessionGate extends StatefulWidget {
  const SessionGate({super.key});

  @override
  State<SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<SessionGate> {
  Widget? _destination;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    Widget destination = const LoginPage();

    try {
      final hasValidToken =
          await SessionManager.hasValidSession();

      final user = await SessionManager.getCurrentUser();

      if (hasValidToken && user != null) {
        destination = const CustomerHomePage();
      }
    } catch (_) {
      destination = const LoginPage();
    }

    if (!mounted) return;

    setState(() {
      _destination = destination;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_destination == null) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    return _destination!;
  }
}
