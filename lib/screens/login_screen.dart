import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
// Conditional import for web-only functionality
import 'dart:html' as html; 

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  // --- PWA Logic Variables ---
  dynamic _deferredPrompt;
  bool _showInstallButton = false;

  @override
  void initState() {
    super.initState();
    _setupPWAInstallLogic();
  }

  // --- PWA Logic (Re-integrated from your working project) ---
  void _setupPWAInstallLogic() {
    if (kIsWeb) {
      if (_isAlreadyInstalled()) return;

      html.window.addEventListener('beforeinstallprompt', (event) {
        event.preventDefault();
        _deferredPrompt = event;
        // On modern web, we can show this to everyone or just mobile
        setState(() => _showInstallButton = true);
      });

      html.window.addEventListener('appinstalled', (event) {
        setState(() => _showInstallButton = false);
      });

      if (_isIOSDevice() && !_isAlreadyInstalled()) {
        setState(() => _showInstallButton = true);
      }
    }
  }

  bool _isAlreadyInstalled() {
    final isStandalone = html.window.matchMedia('(display-mode: standalone)').matches;
    bool isIosStandalone = false;
    try {
      isIosStandalone = (html.window.navigator as dynamic).standalone == true;
    } catch (e) {
      isIosStandalone = false; 
    }
    return isStandalone || isIosStandalone;
  }

  bool _isIOSDevice() {
    final userAgent = html.window.navigator.userAgent.toLowerCase();
    final isModernIpad = userAgent.contains("macintosh") && html.window.navigator.maxTouchPoints! > 0;
    return userAgent.contains("iphone") || userAgent.contains("ipad") || isModernIpad;
  }

  Future<void> _handlePWAInstall() async {
    if (_deferredPrompt != null) {
      _deferredPrompt.prompt();
      _deferredPrompt = null;
      setState(() => _showInstallButton = false);
    } else if (_isIOSDevice()) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text("Install App"),
          content: const Text(
            "To install myHealth, tap the 'Share' icon in Safari and select 'Add to Home Screen'.",
            style: TextStyle(height: 1.4),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Got it!"),
            )
          ],
        )
      );
    }
  }

  // --- Auth Logic ---
  Future<void> _login() async {
    try {
      final userCredential = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
      );
      final String uid = userCredential.user!.uid;
      if (mounted) context.go('/profile/$uid');
    } on FirebaseAuthException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message ?? 'Login failed')));
    }
  }

  Future<void> _loginWithGoogle() async {
    try {
      GoogleAuthProvider googleProvider = GoogleAuthProvider();
      UserCredential userCredential = await FirebaseAuth.instance.signInWithPopup(googleProvider);
      final String uid = userCredential.user!.uid;
      if (mounted) context.go('/profile/$uid');
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Google Sign-In failed')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView( // Added for small screens
          child: Container(
            constraints: const BoxConstraints(maxWidth: 400),
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // --- THE NEW PWA BUTTON ---
                if (_showInstallButton) ...[
                  OutlinedButton.icon(
                    onPressed: _handlePWAInstall,
                    icon: const Icon(Icons.download_for_offline, color: Colors.indigo),
                    label: const Text('Install App for Offline Access'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 45),
                      side: const BorderSide(color: Colors.indigo),
                    ),
                  ),
                  const SizedBox(height: 30),
                ],
                
                const Text('Welcome Back', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
                const SizedBox(height: 30),
                TextField(controller: _emailController, decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder())),
                const SizedBox(height: 15),
                TextField(controller: _passwordController, decoration: const InputDecoration(labelText: 'Password', border: OutlineInputBorder()), obscureText: true),
                const SizedBox(height: 25),
                ElevatedButton(
                  onPressed: _login, 
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.indigo,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 50)
                  ),
                  child: const Text('Login'),
                ),
                const SizedBox(height: 20),
                TextButton(
                  onPressed: () => context.push('/register'), 
                  child: const Text("Don't have an account? Register Here"),
                ),
                const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Text("OR")),
                OutlinedButton.icon(
                  onPressed: _loginWithGoogle,
                  icon: SvgPicture.string(_googleIconSvg, height: 18),
                  label: const Text('Sign in with Google'),
                  style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

const String _googleIconSvg = '''<svg width="18" height="18" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg"><path fill="#EA4335" d="M533.5 278.4c0-18.6-1.5-37-4.7-54.8H272.1v103.8h147.1c-6.2 33.4-25.9 61.7-55.1 80.7v66h88.9c52.1-48 80.5-118.7 80.5-195.7z"/><path fill="#34A853" d="M272.1 544.3c74.1 0 136.3-24.5 181.7-66.2l-88.9-66c-24.7 16.6-56.4 26.5-92.7 26.5-71.3 0-131.7-48.1-153.4-112.6H27.6v70.7c45.2 89.6 137.9 147.6 244.5 147.6z"/><path fill="#4A90E2" d="M118.7 326c-10.4-31-10.4-64.5 0-95.5V159.7H27.6c-37.7 75.2-37.7 165.1 0 240.3l91.1-74z"/><path fill="#FBBC05" d="M272.1 106.1c40.3-.6 79.3 14.7 109.1 43.1l81.5-81.5C413.9 24.9 344.7-1 272.1 0 165.5 0 72.8 58 27.6 147.6l91.1 70.8c21.7-64.5 82.2-112.3 153.4-112.3z"/></svg>''';