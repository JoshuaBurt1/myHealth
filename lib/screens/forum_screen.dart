import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';

class ForumScreen extends StatelessWidget {
  const ForumScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Community Forum")),
      body: StreamBuilder<QuerySnapshot>(
        // Order posts by newest first
        stream: FirebaseFirestore.instance
          .collection('myHealth_posts')
          .orderBy('createdAt', descending: true) // Newest at the top
          .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) return Center(child: Text("Error: ${snapshot.error}"));
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final posts = snapshot.data!.docs;

          return ListView.builder(
            itemCount: posts.length,
            itemBuilder: (context, index) {
            final post = posts[index].data() as Map<String, dynamic>;
            final dynamic createdAt = post['createdAt'];
            final DateTime date = (createdAt is Timestamp) 
                ? createdAt.toDate() 
                : DateTime.now(); // Fallback to current time while loading              
            final String currentUserId = FirebaseAuth.instance.currentUser?.uid ?? "";
            final String authorId = post['authorId'] ?? "";
            final String postId = posts[index].id; // Get the document ID for deletion
            
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.person)),
                  title: Text(post['content'] ?? ""),
                  subtitle: InkWell(
                    onTap: () {
                      final String authorId = post['authorId'] ?? "";
                      context.go('/profile/$authorId');
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4.0),
                      child: Text(
                        "By ${post['authorName']} • ${DateFormat.yMMMd().add_jm().format(date)}",
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.indigo,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  // Move trailing inside the ListTile, outside the subtitle's InkWell
                  trailing: currentUserId == authorId 
                      ? IconButton(
                          icon: const Icon(Icons.delete_outline, color: Colors.red),
                          onPressed: () => _confirmDelete(context, postId),
                        )
                      : null,
                ), // End of ListTile
              ); // End of Card
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showPostDialog(context),
        child: const Icon(Icons.add_comment),
      ),
    );
  }

  void _showPostDialog(BuildContext context) {
    final TextEditingController postController = TextEditingController();
    final user = FirebaseAuth.instance.currentUser;

    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Please log in to post!")),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("New Post"),
        content: TextField(
          controller: postController,
          maxLines: 3,
          decoration: const InputDecoration(hintText: "What's on your mind?"),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
          ElevatedButton(
            onPressed: () async {
              if (postController.text.isNotEmpty) {
                // 1. Fetch the user's real name from their profile
                final profileDoc = await FirebaseFirestore.instance
                    .collection('users')
                    .doc(user.uid)
                    .collection('profile')
                    .doc('user_data')
                    .get();

                String realName = "Anonymous";
                if (profileDoc.exists && profileDoc.data() != null) {
                  realName = profileDoc.data()!['name'] ?? "Anonymous";
                }

                // 2. Create the post with the real name
                await FirebaseFirestore.instance.collection('myHealth_posts').add({
                  'content': postController.text,
                  'authorId': user.uid,
                  'authorName': realName, // Using the name from the database!
                  'createdAt': FieldValue.serverTimestamp(),
                });
                
                if (context.mounted) Navigator.pop(context);
              }
            },
            child: const Text("Post"),
          ),
        ],
      ),
    );
  }

  // Add this inside the ForumScreen class
  void _confirmDelete(BuildContext context, String postId) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Delete Post?"),
        content: const Text("This cannot be undone."),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context), // Close the popup
            child: const Text("Cancel"),
          ),
          TextButton(
            onPressed: () async {
              // Delete from Firestore
              await FirebaseFirestore.instance.collection('myHealth_posts').doc(postId).delete();
              
              // Close the popup
              if (context.mounted) Navigator.pop(context);
              
              // Optional: Show a little confirmation message at the bottom
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("Post deleted")),
                );
              }
            },
            child: const Text("Delete", style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}