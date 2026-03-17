import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

const PasswordInput = ({ value, onChange, placeholder }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="password-input-wrapper" style={{ position: 'relative', width: '100%' }}>
      {/* 1. LOCK ICON COLOR */}
      <Lock 
        size={20} 
        style={{ 
          position: 'absolute', 
          left: '12px', 
          top: '50%', 
          transform: 'translateY(-50%)', 
          zIndex: 10,
          color: 'var(--text-sec)', // This links it to your theme toggle
          opacity: 0.7
        }} 
      />
      
      <input
        className="sys-input login-input"
        style={{ 
          paddingLeft: '40px', 
          paddingRight: '45px', 
          width: '100%',
          color: 'var(--text-main)', // Ensures text matches theme
          background: 'var(--input-bg)' // Ensures background matches theme
        }}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
      />

      {/* 2. EYE ICON COLOR */}
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        style={{
          position: 'absolute',
          right: '12px', 
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: 'var(--text-sec)', // Match this to the Lock icon
          opacity: 0.7
        }}
      >
        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
};

export default PasswordInput;