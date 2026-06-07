import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:login_to/core/database/database_service.dart';
import 'package:login_to/features/vault/presentation/pages/vault_home_page.dart';
import 'package:login_to/ui/themes/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize database
  final dbService = DatabaseService();
  await dbService.initialize();
  
  runApp(
    ProviderScope(
      child: LoginToApp(),
    ),
  );
}

class LoginToApp extends StatelessWidget {
  const LoginToApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LoginTo',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      home: const VaultHomePage(),
      debugShowCheckedModeBanner: false,
    );
  }
}
