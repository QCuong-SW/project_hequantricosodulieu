
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';

void main() {
  testWidgets('Customer app displays login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const SmartDroneApp());

    expect(find.text('SmartDroneDelivery'), findsOneWidget);
    expect(find.text('Đăng nhập tài khoản khách hàng'), findsOneWidget);
    expect(find.text('ĐĂNG NHẬP'), findsOneWidget);
  });
}
