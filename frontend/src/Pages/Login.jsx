import { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle, User, Lock, ArrowRight, Activity } from 'lucide-react';
import { supabase } from '../supabaseClient';
import PasswordInput from "../Components/PasswordInput";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [viewState, setViewState] = useState('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [msg, setMsg] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode('reset');
        setViewState('form');
        setIsRecovery(true);
        if (session?.user?.email) setEmail(session.user.email);
        setMsg("Recovery session active. Please enter your new password.");
      }
    });
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setMsg("");

    if ((mode === 'register' || isRecovery) && password !== confirmPassword) {
      setMsg("Passwords do not match.");
      return;
    }

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) throw error;

        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw factorError;

        if (factors?.totp?.length > 0) {
          setViewState('mfa_challenge');
        } else {
          onLogin(data.user);
        }
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: { data: { company_name: companyName, is_admin: true } }
        });
        if (error) throw error;
        setViewState('success');
      } else if (mode === 'reset') {
        if (isRecovery) {
          const { error } = await supabase.auth.updateUser({ password: password });
          if (error) throw error;
          setMsg("Password updated successfully!");
          setIsRecovery(false);
          setTimeout(() => switchTo('login'), 3000);
        } else {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
          });
          if (error) throw error;
          setMsg("Reset link sent to your email.");
          setTimeout(() => switchTo('login'), 4000);
        }
      }
    } catch (err) {
      setMsg(err.message || "Action failed.");
    }
  };

  const verifyMfa = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factorId = factors.totp[0].id;
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: mfaCode });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      onLogin(user);
    } catch (err) {
      setMsg("Invalid 2FA code.");
    }
  };

  const switchTo = (newMode) => {
    setMode(newMode);
    setViewState('form');
    setIsRecovery(false);
    setMsg("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setCompanyName("");
    setMfaCode("");
  };

  return (
    /* Removed the toggle button and the outer theme div for simplicity */
    <div className="login-backdrop-enterprise">
      <div className="login-card-enterprise fade-in-up">
        {/* LEFT BRAND SIDE - Kept dark for Enterprise feel */}
        <div className="login-brand-side">
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
          <div className="floating-shape shape-3"></div>
          <div className="brand-content">
            <div className="logo-box-large"><ShieldCheck size={48} color="white" /></div>
            <h1>
              <span style={{ color: '#f8fafc' }}>Bug Prioritization System</span>
              <span style={{ color: '#3b82f6' }}>OS</span>
            </h1>
            <p>ML-driven defect classification that gets smarter with every bug you submit</p>
            <div className="brand-stat-ent">
              <Activity size={16} /> <span>System Operational</span>
            </div>
          </div>
        </div>

        {/* RIGHT FORM SIDE - Theme Locked */}
        <div className="login-form-side">
          {viewState === 'success' ? (
            <div className="fade-in center-content">
              <div className="success-icon-large"><CheckCircle size={48} color="#10b981" /></div>
              <h2 className="login-title">Account Initialized</h2>
              <p className="login-sub">Your enterprise profile has been securely generated.</p>
              <button className="sys-btn full" onClick={() => switchTo('login')} style={{ marginTop: 20 }}>PROCEED TO DASHBOARD</button>
            </div>
          ) : viewState === 'mfa_challenge' ? (
            <div className="fade-in center-content">
              <div className="logo-box-large"><Lock size={48} color="#3b82f6" /></div>
              <h2 className="login-title">Security Verification</h2>
              <p className="login-sub">Enter the 6-digit code from your authenticator app.</p>
              <input
                className="sys-input login-input"
                placeholder="000000"
                maxLength="6"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value)}
                style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px', marginTop: '20px' }}
              />
              <button className="sys-btn full" onClick={verifyMfa} style={{ marginTop: 20 }}>VERIFY IDENTITY</button>
              {msg && <div className="msg-banner error" style={{ marginTop: '15px' }}>{msg}</div>}
            </div>
          ) : (
            <div className="fade-in form-content-wrapper">
              <h2 className="login-title">
                {mode === 'login' && 'Welcome Back'}
                {mode === 'register' && 'Create Profile'}
                {mode === 'reset' && (isRecovery ? 'Set New Password' : 'Reset Password')}
              </h2>
              <p className="login-sub">
                {mode === 'login' && 'Authenticate to access the intelligence dashboard.'}
                {mode === 'register' && 'Deploy a new organization instance.'}
                {mode === 'reset' && (isRecovery ? 'Create a secure new password for your account.' : 'Enter your email to receive a recovery link.')}
              </p>

              <form onSubmit={handleAuth} className="modern-form">
                <div className="input-group">
                  <User size={20} className="input-icon" />
                  <input
                    className="sys-input login-input"
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={isRecovery}
                  />
                </div>

                {(mode !== 'reset' || isRecovery) && (
                  <div className="input-group">
                    <PasswordInput
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isRecovery ? "New Password" : "Password"}
                    />
                  </div>
                )}

                {(mode === 'register' || isRecovery) && (
                  <div className="input-group fade-in">
                    <PasswordInput
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm Password"
                    />
                  </div>
                )}

                {mode === 'register' && (
                  <div className="input-group fade-in">
                    <ShieldCheck size={20} className="input-icon" />
                    <input
                      className="sys-input login-input"
                      placeholder="Company Name"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      required
                    />
                  </div>
                )}

                <button className="sys-btn full login-btn-ent" type="submit">
                  {mode === 'login' ? 'AUTHENTICATE' : mode === 'register' ? 'INITIALIZE ACCOUNT' : (isRecovery ? 'UPDATE PASSWORD' : 'SEND RESET LINK')}
                  <ArrowRight size={18} />
                </button>
              </form>

              {msg && <div className={`msg-banner ${msg.includes('sent') || msg.includes('success') ? 'success' : 'error'}`}>{msg}</div>}

              <div className="login-links-ent">
                {mode === 'login' ? (
                  <>
                    <span onClick={() => switchTo('reset')}>Forgot Password?</span>
                    <span style={{ opacity: 0.3 }}>•</span>
                    <span onClick={() => switchTo('register')} className="accent-link">Create Account</span>
                  </>
                ) : (
                  <span onClick={() => switchTo('login')} className="back-link">← Return to Login</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}