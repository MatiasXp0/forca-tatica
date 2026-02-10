import React from 'react';
import { Shield } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig';

export const Login = () => {
  const handleLogin = () => {
    signInWithPopup(auth, googleProvider).catch((error) => {
      console.error('Erro no login:', error);
      alert('Erro ao fazer login. Tente novamente.');
    });
  };

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/30 p-8 rounded-2xl text-center max-w-sm w-full fade-in">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Shield size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-2">FORÇA TÁTICA</h1>
        <p className="text-gray-400 text-sm mb-6 font-semibold">
          Painel de Acesso Operacional
        </p>
        <button
          onClick={handleLogin}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-bold transition shadow-lg hover:scale-[1.02]"
        >
          LOGAR COM GOOGLE
        </button>
      </div>
    </div>
  );
};
