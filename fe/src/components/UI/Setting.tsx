import React, { useState } from 'react';
import { User, Mail, Calendar, Lock, Eye, EyeOff, Save, Edit3, LogOut, Shield, Bell, Palette } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/api';
import Avatar from './Avatar';

interface SettingProps {
isOpen: boolean;
  onClose?: () => void;
}

export const Setting: React.FC<SettingProps> = ({ onClose }) => {
  const { user, updateUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'preferences' | 'about'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Password change states
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  if (!user) return null;

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedName(user.name);
      setError(null);
      setSuccess(null);
    }
    setIsEditing(!isEditing);
  };
  
  const handleSaveProfile = async () => {
    if (!editedName.trim()) {
      setError('Tên không được để trống');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const updatedUser = await userService.updateProfileInfo({
        name: editedName.trim(),
      });

      updateUser(updatedUser);
      setIsEditing(false);
      setSuccess('Cập nhật thông tin thành công!');
    } catch (error: any) {
      console.error('Profile update error:', error);
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('Có lỗi xảy ra khi cập nhật thông tin');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng điền đầy đủ thông tin mật khẩu');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và xác nhận mật khẩu không khớp');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      await userService.changePassword({
        currentPassword,
        newPassword
      });

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setSuccess('Đổi mật khẩu thành công!');
    } catch (error: any) {
      console.error('Password change error:', error);
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('Có lỗi xảy ra khi đổi mật khẩu');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleTabChange = (tab: 'profile' | 'password' | 'preferences' | 'about') => {
    setActiveTab(tab);
    clearMessages();
  };
  
  return (
    <div className="flex-1 flex flex-col bg-white pixel-font">
      {/* Header */}
      <div className="p-6 border-b-4 border-gray-800 bg-gradient-to-r from-blue-400 to-purple-500">
        <h1 className="text-xl font-bold text-white tracking-widest jersey-title">
          CÀI ĐẶT HỆ THỐNG
        </h1>
        <p className="text-white/80 mt-2 vt323-body">
          Quản lý thông tin cá nhân và cài đặt tài khoản
        </p>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-gray-100 border-r-4 border-gray-800 p-4">
          <nav className="space-y-2">
            <button
              onClick={() => handleTabChange('profile')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded border-2 transition-colors press-start-ui text-xs ${
                activeTab === 'profile'
                  ? 'bg-blue-500 text-white border-blue-700 pixel-shadow'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50'
              }`}
            >
              <User className="w-5 h-5 pixelated" />
              <span>THÔNG TIN CÁ NHÂN</span>
            </button>

            <button
              onClick={() => handleTabChange('password')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded border-2 transition-colors press-start-ui text-xs ${
                activeTab === 'password'
                  ? 'bg-red-500 text-white border-red-700 pixel-shadow'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-red-50'
              }`}
            >
              <Lock className="w-5 h-5 pixelated" />
              <span>ĐỔI MẬT KHẨU</span>
            </button>

            <button
              onClick={() => handleTabChange('preferences')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded border-2 transition-colors press-start-ui text-xs ${
                activeTab === 'preferences'
                  ? 'bg-green-500 text-white border-green-700 pixel-shadow'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-green-50'
              }`}
            >
              <Palette className="w-5 h-5 pixelated" />
              <span>TÙY CHỈNH</span>
            </button>

            <button
              onClick={() => handleTabChange('about')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded border-2 transition-colors press-start-ui text-xs ${
                activeTab === 'about'
                  ? 'bg-purple-500 text-white border-purple-700 pixel-shadow'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-purple-50'
              }`}
            >
              <Shield className="w-5 h-5 pixelated" />
              <span>VỀ ỨNG DỤNG</span>
            </button>

            <hr className="border-2 border-gray-400 my-4" />

            <button
              onClick={logout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded border-2 bg-red-50 text-red-700 border-red-300 hover:bg-red-100 transition-colors press-start-ui text-xs"
            >
              <LogOut className="w-5 h-5 pixelated" />
              <span>ĐĂNG XUẤT</span>
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Success/Error Messages */}
          {(success || error) && (
            <div className="mb-6">
              {success && (
                <div className="bg-green-200 border-4 border-green-600 rounded-lg p-4 pixel-box-shadow">
                  <p className="text-green-800 text-sm font-bold press-start-ui">{success}</p>
                </div>
              )}
              {error && (
                <div className="bg-red-200 border-4 border-red-600 rounded-lg p-4 pixel-box-shadow">
                  <p className="text-red-800 text-sm font-bold press-start-ui">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="bg-white border-4 border-gray-800 rounded-lg p-6 pixel-box-shadow">
                <h2 className="text-lg font-bold text-gray-900 mb-6 uppercase press-start-ui">
                  THÔNG TIN CÁ NHÂN
                </h2>

                {/* Avatar Section */}
                <div className="flex flex-col items-center space-y-4 mb-8">
                  <div className="border-4 border-gray-800 rounded-lg p-2 bg-gray-50 pixel-box-shadow">
                    <Avatar
                      src={user?.avatar}
                      alt={user?.name}
                      size="xl"
                      editable={true}
                      className="pixelated"
                    />
                  </div>
                  <p className="text-xxl text-center">
                    NHẤP VÀO ẢNH ĐỂ THAY ĐỔI
                  </p>
                </div>

                {/* Name Field */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Name Field */}
                    <div>
                      <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-widest press-start-ui">
                        <User className="w-4 h-4 inline mr-2 pixelated" />
                        TÊN HIỂN THỊ
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="w-full px-4 py-3 text-base border-4 border-gray-400 rounded bg-yellow-50 focus:border-blue-500 focus:bg-white transition-colors vt323-body"
                          placeholder="NHẬP TÊN CỦA BẠN"
                          disabled={isSaving}
                        />
                      ) : (
                        <div className="px-4 py-3 text-base bg-gray-200 border-2 border-gray-400 rounded text-gray-900 font-bold vt323-body">
                          {user?.name}
                        </div>
                      )}
                    </div>

                    {/* Email Field */}
                    <div>
                      <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-widest press-start-ui">
                        <Mail className="w-4 h-4 inline mr-2 pixelated" />
                        EMAIL
                      </label>
                      <div className="px-4 py-3 text-base bg-gray-200 border-2 border-gray-400 rounded text-gray-600 vt323-body">
                        {user?.email}
                      </div>
                    </div>
                  </div>
                  {/* Join Date */}
                  {user?.createdAt && (
                    <div>
                      <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-widest press-start-ui">
                        <Calendar className="w-4 h-4 inline mr-2 pixelated" />
                        NGÀY THAM GIA
                      </label>
                      <div className="px-4 py-3 text-base bg-gray-200 border-2 border-gray-400 rounded text-gray-600 vt323-body">
                        {formatDate(user.createdAt)}
                      </div>
                    </div>
                  )}
                  {user?.id && (
                    <div>
                      <label className="block text-sm font-bold text-gray-800 mb-3 uppercase">
                        <Calendar className="w-4 h-4 inline mr-2 pixelated" />
                        ID người dùng
                      </label>
                      <div className="px-4 py-3 text-base bg-gray-200 border-2 border-gray-400 rounded text-gray-600 vt323-body">
                        {user.id}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 mt-8">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleEditToggle}
                        disabled={isSaving}
                        className="px-6 py-3 text-sm text-gray-800 hover:text-red-600 transition-colors rounded border-2 border-gray-600 hover:border-red-600 bg-white hover:bg-red-50 uppercase font-bold press-start-ui pixel-shadow"
                      >
                        HỦY
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSaving || !editedName.trim()}
                        className="flex items-center space-x-2 px-6 py-3 text-sm bg-green-500 text-white rounded border-2 border-green-700 hover:bg-green-600 transition-colors disabled:opacity-50 uppercase font-bold press-start-ui pixel-shadow"
                      >
                        {isSaving ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin pixelated"></div>
                        ) : (
                          <Save className="w-4 h-4 pixelated" />
                        )}
                        <span>{isSaving ? 'ĐANG LƯU...' : 'LƯU'}</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleEditToggle}
                      className="flex items-center space-x-2 px-6 py-3 text-sm bg-blue-500 text-white rounded border-2 border-blue-700 hover:bg-blue-600 transition-colors uppercase font-bold press-start-ui pixel-shadow"
                    >
                      <Edit3 className="w-4 h-4 pixelated" />
                      <span>CHỈNH SỬA</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="space-y-6">
              <div className="bg-white border-4 border-gray-800 rounded-lg p-6 pixel-box-shadow">
                <h2 className="text-lg font-bold text-gray-900 mb-6 uppercase press-start-ui">
                  ĐỔI MẬT KHẨU
                </h2>

                <div className="space-y-6">
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-3 uppercase press-start-ui">
                      MẬT KHẨU HIỆN TẠI
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({
                          ...prev,
                          currentPassword: e.target.value
                        }))}
                        className="w-full px-4 py-3 pr-12 text-base border-4 border-gray-400 rounded bg-white focus:border-blue-500 transition-colors vt323-body"
                        placeholder="NHẬP MẬT KHẨU HIỆN TẠI"
                        disabled={isSaving}
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('current')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      >
                        {showPasswords.current ? <EyeOff className="w-5 h-5 pixelated" /> : <Eye className="w-5 h-5 pixelated" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-3 uppercase press-start-ui">
                      MẬT KHẨU MỚI
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.new ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({
                          ...prev,
                          newPassword: e.target.value
                        }))}
                        className="w-full px-4 py-3 pr-12 text-base border-4 border-gray-400 rounded bg-white focus:border-blue-500 transition-colors vt323-body"
                        placeholder="NHẬP MẬT KHẨU MỚI"
                        disabled={isSaving}
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('new')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      >
                        {showPasswords.new ? <EyeOff className="w-5 h-5 pixelated" /> : <Eye className="w-5 h-5 pixelated" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-3 uppercase press-start-ui">
                      XÁC NHẬN MẬT KHẨU MỚI
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.confirm ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({
                          ...prev,
                          confirmPassword: e.target.value
                        }))}
                        className="w-full px-4 py-3 pr-12 text-base border-4 border-gray-400 rounded bg-white focus:border-blue-500 transition-colors vt323-body"
                        placeholder="NHẬP LẠI MẬT KHẨU MỚI"
                        disabled={isSaving}
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('confirm')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      >
                        {showPasswords.confirm ? <EyeOff className="w-5 h-5 pixelated" /> : <Eye className="w-5 h-5 pixelated" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Requirements */}
                  <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                    <h4 className="text-xl font-bold text-blue-800 mb-2 uppercase press-start-ui">
                      YÊU CẦU MẬT KHẨU:
                    </h4>
                    <ul className="text-lg text-blue-700 space-y-1 vt323-body">
                      <li>• Tối thiểu 6 ký tự</li>
                      <li>• Khác với mật khẩu hiện tại</li>
                      <li>• Nên sử dụng kết hợp chữ và số</li>
                    </ul>
                  </div>

                  {/* Change Password Button */}
                  <button
                    onClick={handlePasswordChange}
                    disabled={isSaving || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    className="w-full flex items-center justify-center space-x-3 px-6 py-4 text-base bg-red-500 text-white rounded border-4 border-red-700 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase font-bold press-start-ui pixel-shadow"
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin pixelated"></div>
                    ) : (
                      <Lock className="w-5 h-5 pixelated" />
                    )}
                    <span>{isSaving ? 'ĐANG ĐỔI MẬT KHẨU...' : 'ĐỔI MẬT KHẨU'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div className="bg-white border-4 border-gray-800 rounded-lg p-6 pixel-box-shadow">
                <h2 className="text-lg font-bold text-gray-900 mb-6 uppercase press-start-ui">
                  TÙY CHỈNH
                </h2>

                <div className="space-y-4 vt323-body">
                  <div className="flex items-center space-x-3">
                    <Bell className="w-5 h-5 text-gray-600 pixelated" />
                    <span className="text-gray-800 font-bold">Thông báo</span>
                    <input type="checkbox" className="toggle toggle-primary" />
                  </div>
                  <div className="flex items-center space-x-3">
                    <Palette className="w-5 h-5 text-gray-600 pixelated" />
                    <span className="text-gray-800 font-bold">Chủ đề</span>
                    <select className="select select-bordered w-full max-w-xs">
                      <option value="light">Sáng</option>
                      <option value="dark">Tối</option>
                      <option value="system">Theo hệ thống</option>
                    </select>
                  </div>
                  
                </div> 
                
              </div>
            </div>

          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              <div className="bg-white border-4 border-gray-800 rounded-lg p-6 pixel-box-shadow">
                <h2 className="text-lg font-bold text-gray-900 mb-6 uppercase press-start-ui">
                  VỀ WINTERX
                </h2>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center">
                <img src="../CatWith-removebg.png" alt="WinterX Logo" />
              </div>
                <div className="space-y-4 vt323-body">
                  <div className="flex justify-between py-2 border-b-2 border-gray-200">
                    <span className="text-gray-600">Phiên bản:</span>
                    <span className="text-gray-900 font-bold">WX.7.22</span>
                  </div>
                  <div className="flex justify-between py-2 border-b-2 border-gray-200">
                    <span className="text-gray-600">Ngày phát hành:</span>
                    <span className="text-gray-900 font-bold">
                        {user?.createdAt ? formatDate(user.createdAt) : 'Chưa xác định'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b-2 border-gray-200">
                    <span className="text-gray-600">Nhà phát triển:</span>
                    <span className="text-gray-900 font-bold">WinterX Team</span>
                  </div>
                    <div className="flex justify-between py-2 border-b-2 border-gray-200">
                        <span className="text-gray-600">Email hỗ trợ:</span>
                        <span className="text-gray-900 font-bold">
                          <a href="mailto:support@winterx.com">support@winterx.com</a>
                        </span>
                  </div>
                  <div className="flex justify-between py-2 border-b-2 border-gray-200">
                    <span className="text-gray-600">Made by:</span>
                    <span className="text-gray-900 font-bold">ミＧＩＡＮ4０４ツ</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Setting;