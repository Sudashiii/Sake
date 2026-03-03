import React, { useState } from 'react';
import { Link as LinkIcon, CheckCircle2, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

export function ConnectPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setStatus('loading');
    setTimeout(() => {
      setStatus('connected');
    }, 1500);
  };

  const handleDisconnect = () => {
    setStatus('idle');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="text-foreground">Z-Library Connection</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your Z-Library account to search and download books directly.
        </p>
      </div>

      {/* Status card */}
      <div className={`bg-card border rounded-xl p-5 ${
        status === 'connected' ? 'border-[#4ade80]/20' : status === 'error' ? 'border-destructive/20' : 'border-border'
      }`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            status === 'connected' ? 'bg-[#1a2a1a]' : 'bg-secondary'
          }`}>
            {status === 'connected' ? (
              <CheckCircle2 className="w-5 h-5 text-[#4ade80]" />
            ) : (
              <LinkIcon className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm text-foreground">
              {status === 'connected' ? 'Connected' : 'Not Connected'}
            </p>
            <p className="text-xs text-muted-foreground">
              {status === 'connected' ? email : 'Sign in to your Z-Library account'}
            </p>
          </div>
        </div>

        {status === 'connected' ? (
          <button
            onClick={handleDisconnect}
            className="w-full py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            Disconnect
          </button>
        ) : (
          <form onSubmit={handleConnect} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Z-Library Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-input-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-input-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all outline-none"
              />
            </div>

            {status === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Invalid credentials. Please try again.
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
              {status === 'loading' ? 'Connecting...' : 'Connect Account'}
            </button>
          </form>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your credentials are used only to authenticate with Z-Library's servers. They are not stored or transmitted to any third party.
        </p>
      </div>
    </div>
  );
}
