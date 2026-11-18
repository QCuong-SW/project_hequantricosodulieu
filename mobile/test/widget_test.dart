
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('Customer app displays login screen', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const SmartDroneApp());
    await tester.pumpAndSettle();

    expect(find.text('SmartDroneDelivery'), findsOneWidget);
    expect(find.text('Đăng nhập tài khoản khách hàng'), findsOneWidget);
    expect(find.text('ĐĂNG NHẬP'), findsOneWidget);
  });
}
