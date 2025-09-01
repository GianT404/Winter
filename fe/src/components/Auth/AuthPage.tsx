import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';

interface AuthLayoutProps {
  onLoginSubmit: (email: string, password: string) => Promise<void>;
  onRegisterSubmit: (email: string, password: string, name: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  onLoginSubmit,
  onRegisterSubmit,
  loading,
  error,
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Video refs để control video playback
  const loginVideoRef = useRef<HTMLVideoElement>(null);
  const registerVideoRef = useRef<HTMLVideoElement>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Đảm bảo video luôn phát khi component mount và khi chuyển đổi
  useEffect(() => {
    const playVideos = async () => {
      try {
        if (loginVideoRef.current) {
          await loginVideoRef.current.play();
        }
        if (registerVideoRef.current) {
          await registerVideoRef.current.play();
        }
      } catch (error) {
        console.log('Video autoplay prevented:', error);
      }
    };

    // Delay một chút để đảm bảo video elements đã được render
    const timer = setTimeout(playVideos, 100);
    return () => clearTimeout(timer);
  }, []);

  // Sync video playback khi chuyển đổi
  useEffect(() => {
    const syncVideos = () => {
      if (loginVideoRef.current && registerVideoRef.current) {
        const activeVideo = isLogin ? loginVideoRef.current : registerVideoRef.current;
        const inactiveVideo = isLogin ? registerVideoRef.current : loginVideoRef.current;
        
        // Sync thời gian của video không active với video active
        if (!inactiveVideo.paused && !activeVideo.paused) {
          inactiveVideo.currentTime = activeVideo.currentTime;
        }
        
        // Đảm bảo cả hai video đều đang phát
        activeVideo.play().catch(console.log);
        inactiveVideo.play().catch(console.log);
      }
    };

    if (!isTransitioning) {
      syncVideos();
    }
  }, [isLogin, isTransitioning]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onLoginSubmit(loginEmail, loginPassword);
    } catch (err) {
      console.error('Lỗi đăng nhập:', err);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerPassword !== confirmPassword) {
      return;
    }
    await onRegisterSubmit(registerEmail, registerPassword, name);
  };

  const switchMode = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setIsLogin(!isLogin);
      setIsTransitioning(false);
    }, 100);
  };

  const handleVideoLoad = (videoRef: React.RefObject<HTMLVideoElement | null>) => {
    if (videoRef.current) {
      videoRef.current.play().catch(console.log);
    }
  };

  const passwordsMatch = registerPassword === confirmPassword || confirmPassword === '';

  return (
    <div className="h-screen w-screen flex overflow-hidden relative">
      {/* Đăng nhập */}
      <div 
        className={`absolute inset-0 flex transition-all duration-700 ease-in-out transform ${
          isLogin && !isTransitioning 
            ? 'translate-x-0 opacity-100' 
            : isLogin && isTransitioning
            ? 'translate-x-0 opacity-50 scale-95'
            : 'translate-x-full opacity-0'
        }`}
      >
        {/* Form Đăng nhập - Bên trái */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-8 bg-white">
          <div className="w-full max-w-md transform transition-all duration-500">
            <div className="glass rounded-2xl p-6 md:p-8 shadow-2xl bg-white/80 backdrop-blur-sm border border-white/20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center">
                <img src="../CatWith-removebg.png" alt="WinterX Logo" />
              </div>
              <div className="text-center mb-6 md:mb-8">
                <h2 className="text-2xl font-bold text-gray-900">WinterX</h2>
                <p className="text-gray-600 mt-2">Đăng nhập để tiếp tục</p>
                <p className="text-red-600 mt-2">Server đang bảo trì</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white/50 backdrop-blur-sm"
                      placeholder="Nhập email của bạn"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-2">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white/50 backdrop-blur-sm"
                      placeholder="Nhập mật khẩu"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showLoginPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleLoginSubmit}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Đang đăng nhập...
                    </div>
                  ) : (
                    'Đăng nhập'
                  )}
                </button>
              </div>

              <div className="mt-6 text-center">
                <p className="text-gray-600">
                  Chưa có tài khoản?{' '}
                  <button
                    onClick={switchMode}
                    className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    Đăng ký
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Video Đăng nhập - Bên phải */}
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={loginVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => handleVideoLoad(loginVideoRef)}
            onCanPlay={() => handleVideoLoad(loginVideoRef)}
            preload="auto"
            style={{ display: 'block' }}
          >
            <source src="/tess.mp4" type="video/mp4" />
          </video>
        </div>
      </div>

      {/* Đăng ký */}
      <div 
        className={`absolute inset-0 flex transition-all duration-700 ease-in-out transform ${
          !isLogin && !isTransitioning 
            ? 'translate-x-0 opacity-100' 
            : !isLogin && isTransitioning
            ? 'translate-x-0 opacity-50 scale-95'
            : '-translate-x-full opacity-0'
        }`}
      >
        {/* Video Đăng ký - Bên trái */}
        <div className="flex-1 relative overflow-hidden">
          <video
            src="/tess.mp4"
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => handleVideoLoad(registerVideoRef)}
            onCanPlay={() => handleVideoLoad(registerVideoRef)}
            preload="auto"
            style={{ display: 'block' }}
          >
          </video>
        </div>

        {/* Form Đăng ký - Bên phải */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-8 bg-white">
          <div className="w-full max-w-md transform transition-all duration-500">
            <div className="glass rounded-2xl p-6 md:p-8 shadow-2xl bg-white/80 backdrop-blur-sm border border-white/20">
              <div className="text-center mb-6 md:mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center">
                <img src="../CatWith-removebg.png" alt="WinterX Logo" />
              </div>
                <h2 className="text-2xl font-bold text-gray-900">Tạo tài khoản mới</h2>
                <p className="text-gray-600 mt-2">Đăng ký để bắt đầu hành trình mới</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="register-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Họ tên
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="register-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-white/50 backdrop-blur-sm"
                      placeholder="Nhập họ tên của bạn"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="register-email"
                      type="email"
                      required
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-white/50 backdrop-blur-sm"
                      placeholder="Nhập email của bạn"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-2">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="register-password"
                      type={showRegisterPassword ? 'text' : 'password'}
                      required
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-white/50 backdrop-blur-sm"
                      placeholder="Tạo mật khẩu"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showRegisterPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                    Nhập lại mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full pl-11 pr-11 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-white/50 backdrop-blur-sm ${
                        passwordsMatch ? 'border-gray-300' : 'border-red-300'
                      }`}
                      placeholder="Nhập lại mật khẩu"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {!passwordsMatch && (
                    <p className="text-red-600 text-sm mt-1">Mật khẩu không khớp</p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRegisterSubmit}
                  disabled={loading || !passwordsMatch}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Đang tạo tài khoản...
                    </div>
                  ) : (
                    'Tạo tài khoản'
                  )}
                </button>
              </div>

              <div className="mt-6 text-center">
                <p className="text-gray-600">
                  Đã có tài khoản?{' '}
                  <button
                    onClick={switchMode}
                    className="text-purple-600 hover:text-purple-700 font-medium transition-colors"
                  >
                    Đăng nhập
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
