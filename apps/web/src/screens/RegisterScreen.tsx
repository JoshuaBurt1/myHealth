// RegisterScreen.tsx

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase'; 
import { UserPlus, User, Mail, Lock } from 'lucide-react';

const RegisterScreen: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const notifyMobileApp = (uid: string) => {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'AUTH_SUCCESS',
        uid: uid
      }));
    } else {
      console.log("Not in a native shell, skipping mobile sync.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        email.trim(), 
        password.trim()
      );

      const uid = userCredential.user.uid;
      const sanitizedName = name.trim();

      await setDoc(doc(db, 'users', uid), {
        display_name: sanitizedName,
        gems: 1, 
        last_login: serverTimestamp(), 
      });

      await setDoc(doc(db, 'users', uid, 'profile', 'user_data'), {
        name: sanitizedName,
        goal: ""
      });

      await setDoc(doc(db, 'users', uid, 'myHealth_privacy', 'settings'), {
        allowGroupMembers: true,
        allowFollowers: false,
        allowFollowing: false,
        allowPublic: false,
      });

      notifyMobileApp(uid);

      // CHANGED: Navigate to the tutorial screen first
      navigate(`/tutorial/${uid}`);
      
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Join Us</h1>
          <p className="text-slate-500 mt-2">Create your myHealth account</p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-3.5 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Display Name"
              className="w-full pl-10 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-slate-400" size={20} />
            <input
              type="email"
              placeholder="Email"
              className="w-full pl-10 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-slate-400" size={20} />
            <input
              type="password"
              placeholder="Password"
              className="w-full pl-10 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
              loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
          >
            <UserPlus size={20} />
            {loading ? 'Creating Account...' : 'Register Now'}
          </button>
        </form>

        <div className="text-center">
          <Link to="/login" className="text-blue-600 hover:underline text-sm font-medium">
            Already have an account? Login Here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterScreen;