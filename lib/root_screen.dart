import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'user_search_delegate.dart';

class RootScreen extends StatelessWidget {
  final Widget child;
  const RootScreen({super.key, required this.child});

  // 1. Helper method to determine the title based on route
  String _getRouteTitle(BuildContext context) {
    final String location = GoRouterState.of(context).uri.path;
    if (location == '/store') return 'Store';
    if (location == '/forum') return 'Forum';
    if (location == '/data') return 'Data';
    if (location.startsWith('/profile')) return 'Profile';
    return 'Home'; // Default for '/'
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        // 2. Dynamic Title using the helper
        title: Text('myHealth - ${_getRouteTitle(context)}'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              showSearch(
                context: context,
                delegate: UserSearchDelegate(),
              );
            },
          ),
          StreamBuilder<User?>(
            stream: FirebaseAuth.instance.authStateChanges(),
            builder: (context, snapshot) {
              if (snapshot.hasData) {
                // Showing the user's name if available, otherwise 'Logged In'
                final displayName = snapshot.data?.displayName ?? "User";
                return Row(
                  children: [
                    Text(displayName),
                    IconButton(
                      icon: const Icon(Icons.logout),
                      onPressed: () => FirebaseAuth.instance.signOut(),
                    ),
                  ],
                );
              } else {
                return TextButton(
                  style: TextButton.styleFrom(foregroundColor: Colors.white),
                  onPressed: () => context.go('/login'),
                  child: const Text("Log In"),
                );
              }
            },
          ),
        ],
      ),
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _calculateSelectedIndex(context),
        onTap: (index) => _onItemTapped(index, context),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: Colors.indigo,
        unselectedItemColor: Colors.grey,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.store), label: 'Store'),
          BottomNavigationBarItem(icon: Icon(Icons.forum), label: 'Forum'),
          BottomNavigationBarItem(icon: Icon(Icons.dataset), label: 'Data'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }

  static int _calculateSelectedIndex(BuildContext context) {
    final String location = GoRouterState.of(context).uri.path;
    if (location == '/store') return 1;
    if (location == '/forum') return 2;
    if (location == '/data') return 3;
    if (location.startsWith('/profile')) return 4;
    return 0;
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0: context.go('/'); break;
      case 1: context.go('/store'); break;
      case 2: context.go('/forum'); break;
      case 3: context.go('/data'); break;
      case 4:
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          context.go('/profile/${user.uid}');
        } else {
          context.go('/login');
        }
        break;
    }
  }
}