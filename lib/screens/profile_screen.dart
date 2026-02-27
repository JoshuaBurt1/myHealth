import 'dart:typed_data';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shimmer/shimmer.dart';
import 'package:go_router/go_router.dart';
import 'package:image/image.dart' as img;

class ProfileScreen extends StatefulWidget {
  final String userId;
  const ProfileScreen({super.key, required this.userId});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Uint8List? _webImage;
  bool _isUploading = false;
  final TextEditingController _nameController = TextEditingController();
  bool _isSavingName = false;
  final TextEditingController _ageController = TextEditingController();
  final TextEditingController _heightController = TextEditingController();
  final TextEditingController _weightController = TextEditingController();
  final TextEditingController _bmiController = TextEditingController();
  final TextEditingController _goalController = TextEditingController();
  final TextEditingController _bpController = TextEditingController(); // Blood Pressure
  final TextEditingController _hrController = TextEditingController(); // Heart Rate
  final TextEditingController _spo2Controller = TextEditingController(); // SpO2
  final TextEditingController _rrController = TextEditingController(); // Respiratory Rate
  final TextEditingController _tempController = TextEditingController(); // Temperature
  bool _isLoading = false;
  int _followerCount = 0;
  int _followingCount = 0;
  bool _isFollowing = false;
  

  @override
  void initState() {
    super.initState();
    // Wait for the framework to be ready before calling Firebase
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _loadUserData();
      }
    });
  }

  @override
  void didUpdateWidget(covariant ProfileScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.userId != widget.userId) {
      setState(() {
        _webImage = null;
        _nameController.clear();
        _isLoading = true;
      });
      _loadUserData();
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _ageController.dispose();
    _heightController.dispose();
    _weightController.dispose();
    _bmiController.dispose();
    _goalController.dispose();
    _bpController.dispose();
    _hrController.dispose();
    _spo2Controller.dispose();
    _rrController.dispose();
    _tempController.dispose();
    super.dispose();
  }

  void _showConnectionsList(String type) {
    // 'type' will be either 'followers' or 'following'
    final String title = type == 'followers' ? "Followers" : "Following";

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const Divider(),
              Expanded(
                child: FutureBuilder<QuerySnapshot>(
                  future: FirebaseFirestore.instance
                      .collection('users')
                      .doc(widget.userId)
                      .collection(type) // Now dynamic!
                      .get(),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    
                    if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                      return Center(child: Text("No $title yet."));
                    }

                    var docs = snapshot.data!.docs;

                    return ListView.builder(
                      itemCount: docs.length,
                      itemBuilder: (context, index) {
                        var data = docs[index].data() as Map<String, dynamic>;
                        return ListTile(
                          leading: const CircleAvatar(child: Icon(Icons.person)),
                          title: Text(data['name'] ?? "Anonymous"),
                          onTap: () {
                            Navigator.pop(context); // Close sheet
                            // Navigate to new profile
                            context.go('/profile/${docs[index].id}');
                          },
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _calculateBMI() {
    double? height = double.tryParse(_heightController.text); // in cm
    double? weight = double.tryParse(_weightController.text); // in kg
    
    if (height != null && weight != null && height > 0) {
      // Formula: kg / (m^2)
      double bmi = weight / ((height / 100) * (height / 100));
      _bmiController.text = bmi.toStringAsFixed(1);
    } else {
      _bmiController.clear();
    }
  }

  void _validateAndSave() {
    // 1. Check Age (Reasonable range 0-120)
    int? age = int.tryParse(_ageController.text);
    if (_ageController.text.isNotEmpty && (age == null || age < 0 || age > 999)) {
      _showError("Please enter a valid age (0-999)");
      return;
    }

    // 2. Check SpO2 (Oxygen saturation usually 70-100%)
    double? spo2 = double.tryParse(_spo2Controller.text);
    if (_spo2Controller.text.isNotEmpty && (spo2 == null || spo2 < 0 || spo2 > 100)) {
      _showError("SpO2 must be between 0 and 100%");
      return;
    }

    // 3. Check Heart Rate (Reasonable range 30-220 BPM)
    int? hr = int.tryParse(_hrController.text);
    if (_hrController.text.isNotEmpty && (hr == null || hr < 30 || hr > 250)) {
      _showError("Please enter a realistic Heart Rate (30-250 BPM)");
      return;
    }

    // 4. Check Temperature (Celsius range 30-45)
    double? temp = double.tryParse(_tempController.text);
    if (_tempController.text.isNotEmpty && (temp == null || temp < 30 || temp > 45)) {
      _showError("Please enter a realistic temperature (30°C - 45°C)");
      return;
    }

    // If all checks pass, save to Firestore
    _saveProfileData();
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.redAccent),
    );
  }

  Future<void> _loadUserData() async {
    final currentUser = FirebaseAuth.instance.currentUser;
    if (currentUser == null || !mounted) return;

    setState(() => _isLoading = true);

    try {
      final userRef = FirebaseFirestore.instance.collection('users').doc(widget.userId);
      final results = await Future.wait([
        userRef.collection('followers').count().get(),
        userRef.collection('following').count().get(),
        FirebaseFirestore.instance.collection('users').doc(currentUser.uid).collection('following').doc(widget.userId).get(),
        userRef.collection('profile').doc('user_data').get(),
        userRef.collection('profile').doc('image_data').get(),
      ]);

      final int followersCount = (results[0] as AggregateQuerySnapshot).count ?? 0;
      final int followingCount = (results[1] as AggregateQuerySnapshot).count ?? 0;
      final bool isFollowing = (results[2] as DocumentSnapshot).exists;
      final DocumentSnapshot nameDoc = results[3] as DocumentSnapshot;
      final DocumentSnapshot imageDoc = results[4] as DocumentSnapshot;

      if (nameDoc.exists) {
        final data = nameDoc.data() as Map<String, dynamic>;
        // We ONLY load Name and Goal. Vital signs/Physical stats are left empty for new input.
        _nameController.text = data['name'] ?? '';
        _goalController.text = data['goal'] ?? '';
      } else if (widget.userId == currentUser.uid) {
        _nameController.text = currentUser.displayName ?? '';
      }

      if (imageDoc.exists) {
        final data = imageDoc.data() as Map<String, dynamic>;
        if (data.containsKey('imageId')) {
          _webImage = base64Decode(data['imageId']);
        }
      }

      if (mounted) {
        setState(() {
          _followerCount = followersCount;
          _followingCount = followingCount;
          _isFollowing = isFollowing;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveProfileData() async {
    setState(() => _isSavingName = true);
    final timestamp = DateTime.now().toIso8601String();

    try {
      // Always update name and goal
      Map<String, dynamic> updateData = {
        'name': _nameController.text,
        'goal': _goalController.text,
      };

      // Helper to create entry
      Map<String, dynamic> toEntry(String val) => {'value': val, 'dateTime': timestamp};

      // ONLY add to Firestore if the user typed something in the field
      void addIfNotEmpty(String key, TextEditingController controller) {
        if (controller.text.trim().isNotEmpty) {
          updateData[key] = FieldValue.arrayUnion([toEntry(controller.text.trim())]);
        }
      }

      addIfNotEmpty('age', _ageController);
      addIfNotEmpty('height', _heightController);
      addIfNotEmpty('weight', _weightController);
      addIfNotEmpty('blood_pressure', _bpController);
      addIfNotEmpty('heart_rate', _hrController);
      addIfNotEmpty('spo2', _spo2Controller);
      addIfNotEmpty('resp_rate', _rrController);
      addIfNotEmpty('temp', _tempController);

      await FirebaseFirestore.instance
          .collection('users')
          .doc(widget.userId)
          .collection('profile')
          .doc('user_data')
          .set(updateData, SetOptions(merge: true));

      // Clear vital fields after save to prepare for next measurement
      _ageController.clear();
      _heightController.clear();
      _weightController.clear();
      _bpController.clear();
      _hrController.clear();
      _spo2Controller.clear();
      _rrController.clear();
      _tempController.clear();
      _bmiController.clear();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Entries Saved to History!')));
      }
    } finally {
      if (mounted) setState(() => _isSavingName = false);
    }
  }

  Future<void> _removeImage() async {
    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(widget.userId)
          .collection('profile')
          .doc('image_data')
          .delete();
      
      setState(() {
        _webImage = null;
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Photo removed')),
      );
    } catch (e) {
      print("Delete error: $e");
    }
  }

  Future<void> _pickImage() async {
    final ImagePicker picker = ImagePicker();
    final XFile? image = await picker.pickImage(source: ImageSource.gallery);

    if (image != null) {
      var f = await image.readAsBytes();
      setState(() => _webImage = f);
      await _saveToFirestore(f);
    }
  }

  Future<void> _toggleFollow(bool isFollowing) async {
    final currentUserId = FirebaseAuth.instance.currentUser?.uid;
    if (currentUserId == null || currentUserId == widget.userId) return;

    String myName = FirebaseAuth.instance.currentUser?.displayName ?? "User";
    String targetName = _nameController.text.isNotEmpty ? _nameController.text : "User";

    setState(() {
      _isFollowing = !isFollowing;
      _followerCount = isFollowing ? _followerCount - 1 : _followerCount + 1;
    });

    try {
      final batch = FirebaseFirestore.instance.batch();
      
      final followingRef = FirebaseFirestore.instance
          .collection('users').doc(currentUserId)
          .collection('following').doc(widget.userId);
          
      final followersRef = FirebaseFirestore.instance
          .collection('users').doc(widget.userId)
          .collection('followers').doc(currentUserId);

      if (isFollowing) {
        batch.delete(followingRef);
        batch.delete(followersRef);
      } else {
        // 2. IMPORTANT: Save the names inside the connection documents
        batch.set(followingRef, {
          'timestamp': FieldValue.serverTimestamp(),
          'name': targetName, // Save who I am following
        });
        
        batch.set(followersRef, {
          'timestamp': FieldValue.serverTimestamp(),
          'name': myName,     // Save who followed them
          'uid': currentUserId,
        });
      }

      await batch.commit();
    } catch (e) {
      print("Follow error: $e");
      // Revert UI on error
      _loadUserData(); 
    }
  }

  Future<void> _saveToFirestore(Uint8List bytes) async {
    setState(() => _isUploading = true);
    try {
      img.Image? decoded = img.decodeImage(bytes);
      if (decoded == null) return;
      img.Image smaller = img.copyResize(decoded, width: 300);
      String base64String = base64Encode(img.encodeJpg(smaller, quality: 70));

      await FirebaseFirestore.instance
          .collection('users')
          .doc(widget.userId)
          .collection('profile')
          .doc('image_data')
          .set({
        'imageId': base64String,
        'lastUpdated': FieldValue.serverTimestamp(),
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile image saved!')),
        );
      }
    } catch (e) {
      print("Upload error: $e");
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Widget _buildShimmerPlaceholder({required double width, required double height, double radius = 0}) {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }

  Widget _buildBadge(IconData icon, Color color, String label) {
    return Tooltip(
      message: label,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          shape: BoxShape.circle,
          border: Border.all(color: color.withOpacity(0.5), width: 1),
        ),
        child: Icon(icon, color: color, size: 20),
      ),
    );
  }
  
  // Helper for Stat Columns
  Column _buildStatColumn(String label, int count) {
    return Column(
      children: [
        Text(count.toString(), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        Text(label, style: const TextStyle(color: Colors.grey)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool isMe = widget.userId == FirebaseAuth.instance.currentUser?.uid;
    return Scaffold(
      appBar: AppBar(title: Text(isMe ? "My Profile" : "User Profile")),
      body: SingleChildScrollView(
        child: Column(
          children: [
            const SizedBox(height: 40),
            
            // --- PROFILE IMAGE AREA ---
            Center(
              child: _isLoading 
                ? _buildShimmerPlaceholder(width: 120, height: 120, radius: 60) // Shimmering Circle
                : Stack(
                    alignment: Alignment.center,
                    children: [
                      CircleAvatar(
                        radius: 60,
                        backgroundColor: Colors.grey[300],
                        backgroundImage: _webImage != null ? MemoryImage(_webImage!) : null,
                        child: _webImage == null ? const Icon(Icons.person, size: 60) : null,
                      ),
                      if (_isUploading) const CircularProgressIndicator(),
                    ],
                  ),
            ),

            // --- BADGES AREA ---
            if (!_isLoading)
              Padding(
                padding: const EdgeInsets.only(top: 10, bottom: 5),
                child: Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 8,
                  children: [
                    if (_followerCount > 10) 
                      _buildBadge(Icons.stars, Colors.amber, "Social Butterfly"),
                    if (_webImage != null)
                      _buildBadge(Icons.camera_alt, Colors.blue, "Photogenic"),
                    if (_followingCount > 0)
                      _buildBadge(Icons.trending_up, Colors.green, "Networker"),
                  ],
                ),
              ),

            const SizedBox(height: 10),

            if (isMe && !_isLoading)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton.icon(
                    onPressed: _isUploading ? null : _pickImage,
                    icon: const Icon(Icons.edit),
                    label: const Text('Change Photo'),
                  ),
                  if (_webImage != null)
                    TextButton.icon(
                      onPressed: _isUploading ? null : _removeImage,
                      icon: const Icon(Icons.delete_outline, color: Colors.red),
                      label: const Text('Remove', style: TextStyle(color: Colors.red)),
                    ),
                ],
              ),

            // 1. Stats Row
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 25),
              child: Container(
                decoration: BoxDecoration(
                  border: Border.symmetric(
                    horizontal: BorderSide(color: Colors.grey.shade200, width: 1),
                  ),
                ),
                padding: const EdgeInsets.symmetric(vertical: 15),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // Followers Column
                    Expanded(
                      child: InkWell(
                        onTap: () => _showConnectionsList('followers'),
                        child: _buildStatColumn("Followers", _followerCount),
                      ),
                    ),
                    
                    // Vertical Divider
                    Container(height: 30, width: 1, color: Colors.grey.shade300),

                    // Following Column
                    Expanded(
                      child: InkWell(
                        onTap: () => _showConnectionsList('following'),
                        child: _buildStatColumn("Following", _followingCount),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // 2. Follow Button (Only show if NOT my profile)
            if (!isMe && !_isLoading)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 30),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isFollowing ? Colors.grey[200] : Colors.indigo,
                    foregroundColor: _isFollowing ? Colors.black : Colors.white,
                  ),
                  onPressed: () => _toggleFollow(_isFollowing),
                  child: Text(_isFollowing ? "Following" : "Follow"),
                ),
              ),
            ),

            const SizedBox(height: 10),

            if (!_isLoading)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 10),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    "Basic Information",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey[800],
                    ),
                  ),
                ),
              ),

            // --- PROFILE INFO AREA ---
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 30),
              child: Column(
                children: [
                  // Name Field
                  TextField(
                    controller: _nameController,
                    enabled: isMe,
                    decoration: InputDecoration(
                      labelText: 'Name',
                      prefixIcon: const Icon(Icons.person),
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 15),

                  // Row for Age and Goal
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _ageController,
                          enabled: isMe,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Age',
                            prefixIcon: Icon(Icons.calendar_today),
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: TextField(
                          controller: _goalController,
                          enabled: isMe,
                          decoration: const InputDecoration(
                            labelText: 'Goal',
                            prefixIcon: Icon(Icons.flag),
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 15),

                  // Grid for Height, Weight, BMI
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _heightController,
                          enabled: isMe,
                          keyboardType: TextInputType.number,
                          onChanged: (_) => _calculateBMI(),
                          decoration: const InputDecoration(
                            labelText: 'Height (cm)',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _weightController,
                          enabled: isMe,
                          keyboardType: TextInputType.number,
                          onChanged: (_) => _calculateBMI(),
                          decoration: const InputDecoration(
                            labelText: 'Weight (kg)',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _bmiController,
                          enabled: false, // BMI is calculated
                          decoration: InputDecoration(
                            labelText: 'Estimated BMI',
                            filled: true,
                            fillColor: Colors.grey[100],
                            border: const OutlineInputBorder(),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // --- VITAL SIGNS HEADER ---
            if (!_isLoading)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 15),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    "Vital Signs",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.red[800], // Red color to distinguish medical data
                    ),
                  ),
                ),
              ),

            // --- VITAL SIGNS FIELDS ---
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 30),
              child: Column(
                children: [
                  // Blood Pressure & Heart Rate Row
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _bpController,
                          enabled: isMe,
                          decoration: const InputDecoration(
                            labelText: 'Blood Pressure',
                            hintText: '120/80',
                            helperText: 'Systolic/Diastolic',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _hrController,
                          enabled: isMe,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Heart Rate',
                            helperText: '60-100 BPM',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 15),

                  // SpO2 & Respiratory Rate Row
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _spo2Controller,
                          enabled: isMe,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'SpO2 (%)',
                            helperText: 'Normal: 95-100%',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _rrController,
                          enabled: isMe,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Resp Rate',
                            helperText: '12-20 Breaths/min',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 15),

                  // Temperature Field
                  TextField(
                    controller: _tempController,
                    enabled: isMe,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Temperature (°C)',
                      helperText: 'Normal: 36.1 - 37.2°C',
                      prefixIcon: Icon(Icons.thermostat),
                      border: OutlineInputBorder(),
                    ),
                  ),
                  
                  const SizedBox(height: 10),
                ],
              ),
            ),
            // --- SINGLE CONSOLIDATED SAVE BUTTON ---
            if (isMe && !_isLoading)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 20),
                child: SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigo,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: _isSavingName ? null : _validateAndSave,
                    icon: _isSavingName 
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.cloud_upload),
                    label: const Text("Update Profile & Vitals", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}