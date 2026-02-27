import 'package:flutter/material.dart';
import 'firebase_options.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:async';
import 'package:go_router/go_router.dart';
import 'root_screen.dart';
import 'screens/home_screen.dart';
import 'screens/store_screen.dart';
import 'screens/forum_screen.dart';
import 'screens/data_screen.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/profile_screen.dart';


void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    print("Firebase initialization failed: $e");
    // If you see an error here, your firebase_options.dart is likely wrong
  }

  runApp(const MyApp());
}

// The Router defines the URLs
final _router = GoRouter(
  initialLocation: '/',
  refreshListenable: GoRouterRefreshStream(FirebaseAuth.instance.authStateChanges()),
  redirect: (context, state) {
    final bool loggedIn = FirebaseAuth.instance.currentUser != null;
    final bool goingToProfile = state.matchedLocation.startsWith('/profile');
    if (goingToProfile && !loggedIn) {
      return '/login';
    }
    return null;
  },
  routes: [
    ShellRoute(
      builder: (context, state, child) => RootScreen(child: child),
      routes: [
        GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
        GoRoute(path: '/store', builder: (context, state) => const StoreScreen()),
        GoRoute(path: '/forum', builder: (context, state) => const ForumScreen()),
        GoRoute(path: '/data', builder: (context, state) => const DataScreen()),
        GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
        GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
        GoRoute(
          path: '/profile/:userId',
          builder: (context, state) {
            final id = state.pathParameters['userId']!; 
            return ProfileScreen(userId: id); 
          },
        ),
      ],
    ),
  ],
);

// Small helper class needed for the refreshListenable
class GoRouterRefreshStream extends ChangeNotifier {
  late final StreamSubscription<dynamic> _subscription;
  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.listen((_) => notifyListeners());
  }
  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      title: 'myHealth',
    );
  }
}