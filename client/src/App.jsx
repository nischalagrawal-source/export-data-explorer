import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';
import {
  Upload, Users, Building2, TrendingUp, Package, Globe, Ship,
  Plus, Trash2, Search, Filter, ChevronDown, RefreshCw,
  FileSpreadsheet, Calendar, DollarSign, ArrowUpRight, ArrowDownRight,
  LayoutDashboard, Target, UserCheck, Building, Settings, Menu, X,
  Download, FileDown, Lightbulb, ShoppingCart, UserPlus, FileText,
  MessageSquare, Send, Bug, Sparkles, HelpCircle, FileSearch, FilePlus2,
  LogOut, Lock, User, Eye, EyeOff, Shield, UserCog, Key, Database
} from 'lucide-react';

// API Base URL - always use relative path (works on Vercel)
const API_BASE = '/api';

// Configure axios to include auth token
const getAuthHeader = () => {
  const token = localStorage.getItem('ede_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Create axios instance with auth
const api = axios.create({ baseURL: API_BASE });

// Add auth header to all requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ede_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (logout user) — 403 is NOT an auth failure (it means role restriction)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('ede_token');
      localStorage.removeItem('ede_user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// USD to INR conversion rate (can be updated)
const USD_TO_INR = 83.5;

// Color palette
const COLORS = {
  gold: '#f59e0b',
  emerald: '#10b981',
  sky: '#0ea5e9',
  coral: '#f97316',
  violet: '#8b5cf6',
  rose: '#f43f5e',
  teal: '#14b8a6',
  amber: '#fbbf24',
};

const CHART_COLORS = [COLORS.gold, COLORS.emerald, COLORS.sky, COLORS.coral, COLORS.violet, COLORS.rose, COLORS.teal, COLORS.amber];

// Custom Tooltip for charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card rounded-lg p-3 text-sm">
        <p className="text-white font-medium mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }}></span>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Format currency in USD
const formatCurrency = (value) => {
  if (!value) return '$0';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value?.toFixed(2) || 0}`;
};

// Format currency in INR
const formatINR = (value) => {
  if (!value) return '₹0';
  const inrValue = value * USD_TO_INR;
  if (inrValue >= 10000000) return `₹${(inrValue / 10000000).toFixed(2)} Cr`;
  if (inrValue >= 100000) return `₹${(inrValue / 100000).toFixed(2)} L`;
  if (inrValue >= 1000) return `₹${(inrValue / 1000).toFixed(1)}K`;
  return `₹${inrValue?.toFixed(0) || 0}`;
};

// Format both currencies
const formatDualCurrency = (value) => {
  return `${formatCurrency(value)} / ${formatINR(value)}`;
};

// Format number
const formatNumber = (value) => {
  return value?.toLocaleString() || '0';
};

// Format name - handle "TO ORDER" and similar placeholder values
const formatName = (name) => {
  if (!name) return 'Name Not Available';
  const upperName = name.toUpperCase().trim();
  const placeholders = ['TO ORDER', 'TO THE ORDER', 'NULL', 'N/A', 'NA', 'NONE', '-', '--', 'NIL', 'NOT AVAILABLE'];
  if (placeholders.includes(upperName) || upperName.length < 2) {
    return 'Name Not Available';
  }
  return name;
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, subValue, trend, color = 'gold', delay = 0 }) => (
  <div 
    className={`glass-card rounded-xl p-5 hover-lift animate-slide-up`}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-start justify-between">
      <div className={`p-3 rounded-lg bg-accent-${color}/20`}>
        <Icon className={`w-5 h-5 text-accent-${color}`} style={{ color: COLORS[color] }} />
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
    <div className="mt-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-slate-400 mt-1">{label}</p>
      {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
    </div>
  </div>
);

// Navigation Item
const NavItem = ({ icon: Icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      active 
        ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-400 border-l-2 border-amber-500' 
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`}
  >
    <Icon className="w-5 h-5" />
    <span className="font-medium">{label}</span>
    {badge && (
      <span className="ml-auto bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full">
        {badge}
      </span>
    )}
  </button>
);

// Login Component
const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post(`/auth/login`, { username, password });
      if (response.data.success) {
        localStorage.setItem('ede_token', response.data.token);
        localStorage.setItem('ede_user', JSON.stringify(response.data.user));
        onLogin(response.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setDemoLoading(true);

    try {
      const response = await api.post(`/auth/demo-login`);
      if (response.data.success) {
        localStorage.setItem('ede_token', response.data.token);
        localStorage.setItem('ede_user', JSON.stringify(response.data.user));
        onLogin(response.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Demo login failed. Please try again.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Package className="w-8 h-8 text-navy-950" />
          </div>
          <h1 className="text-2xl font-bold text-white">Export Data Explorer</h1>
          <p className="text-slate-400 mt-2">Sign in to access the dashboard</p>
        </div>

        {/* Login Form */}
        <div className="glass-card rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-rose-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-400 mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || demoLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-navy-950 font-semibold py-3 rounded-lg hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-xs text-slate-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          {/* Try Demo Button */}
          <button
            onClick={handleDemoLogin}
            disabled={loading || demoLoading}
            className="w-full bg-white/5 border border-white/10 text-white font-semibold py-3 rounded-lg hover:bg-white/10 hover:border-amber-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
          >
            {demoLoading ? (
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-amber-400 group-hover:text-amber-300" />
                <span>Try Demo</span>
                <span className="text-xs text-slate-400 ml-1">(Read-only)</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Agrovilla Export Data Explorer
        </p>
      </div>
    </div>
  );
};

// Data Management Component (Admin Only)
const DataManagement = () => {
  const [summary, setSummary] = useState([]);
  const [uploadLog, setUploadLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const fetchSummary = async (silent) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get('/data-management/summary');
      setSummary(res.data.data || []);
      setUploadLog(res.data.uploadLog || []);
    } catch (err) {
      console.error('Error fetching data summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // Auto-refresh every 15 seconds to catch newly processed data
    const interval = setInterval(() => fetchSummary(true), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (monthYear, dataType) => {
    const label = `${dataType} data for ${monthYear}`;
    if (!window.confirm(`Are you sure you want to delete all ${label}? This cannot be undone.`)) return;
    try {
      setDeleting(`${monthYear}-${dataType}`);
      const res = await api.delete(`/data-management/${monthYear}/${dataType}`);
      alert(`Deleted ${res.data.deleted} rows of ${label}.`);
      fetchSummary();
    } catch (err) {
      alert(`Error deleting: ${err.response?.data?.error || err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteMonth = async (monthYear) => {
    if (!window.confirm(`Delete ALL data (fruits + vegetables) for ${monthYear}? This cannot be undone.`)) return;
    try {
      setDeleting(monthYear);
      const res = await api.delete(`/data-management/${monthYear}`);
      alert(`Deleted ${res.data.deleted} rows for ${monthYear}.`);
      fetchSummary();
    } catch (err) {
      alert(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  // Group by month
  const monthGroups = {};
  summary.forEach(row => {
    if (!monthGroups[row.month_year]) monthGroups[row.month_year] = [];
    monthGroups[row.month_year].push(row);
  });
  const sortedMonths = Object.keys(monthGroups).sort().reverse();
  const totalRows = summary.reduce((s, r) => s + parseInt(r.row_count), 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-amber-400" />
            <h3 className="text-lg font-semibold text-white">Data Management</h3>
            <span className="text-xs bg-white/10 px-2 py-1 rounded text-slate-400">
              {totalRows.toLocaleString()} total rows | {sortedMonths.length} months
            </span>
          </div>
          <button onClick={fetchSummary} className="btn-secondary text-sm flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8"><div className="spinner mx-auto"></div></div>
        ) : sortedMonths.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No data in the database. Upload files to get started.</p>
        ) : (
          <div className="space-y-3">
            {sortedMonths.map(month => {
              const rows = monthGroups[month];
              const monthTotal = rows.reduce((s, r) => s + parseInt(r.row_count), 0);
              return (
                <div key={month} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-amber-400" />
                      <span className="text-white font-semibold text-lg">{month}</span>
                      <span className="text-xs bg-white/10 px-2 py-1 rounded text-slate-400">
                        {monthTotal.toLocaleString()} rows
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteMonth(month)}
                      disabled={deleting === month}
                      className="text-rose-400 hover:text-rose-300 text-sm flex items-center gap-1 px-3 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 transition-all disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {rows.map(row => (
                      <div key={`${row.month_year}-${row.data_type}`} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium px-2 py-0.5 rounded ${row.data_type === 'fruits' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {row.data_type === 'fruits' ? '🍎 Fruits' : '🥬 Vegetables'}
                          </span>
                          <div className="text-sm text-slate-300">
                            <span className="font-medium">{parseInt(row.row_count).toLocaleString()}</span> rows
                            <span className="text-slate-500 ml-2">|</span>
                            <span className="text-slate-400 ml-2">{parseInt(row.unique_exporters)} exporters</span>
                            <span className="text-slate-500 ml-2">|</span>
                            <span className="text-slate-400 ml-2">${parseFloat(row.total_fob || 0).toLocaleString(undefined, {maximumFractionDigits: 0})} FOB</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(row.month_year, row.data_type)}
                          disabled={deleting === `${row.month_year}-${row.data_type}`}
                          className="text-rose-400 hover:text-rose-300 p-1.5 rounded hover:bg-rose-500/20 transition-all disabled:opacity-50"
                          title={`Delete ${row.data_type} for ${row.month_year}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload History */}
      {uploadLog.length > 0 && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-400" /> Upload History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-white/10">
                  <th className="text-left p-3">Filename</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Rows</th>
                  <th className="text-left p-3">Uploaded By</th>
                  <th className="text-left p-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {uploadLog.map((log, i) => (
                  <tr key={i} className={`border-b border-white/5 hover:bg-white/5 ${log.data_deleted ? 'opacity-50' : ''}`}>
                    <td className={`p-3 ${log.data_deleted ? 'line-through text-slate-500' : 'text-white'}`}>{log.filename}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${log.data_deleted ? 'bg-rose-500/20 text-rose-400 line-through' : log.data_type === 'fruits' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {log.data_type}
                      </span>
                    </td>
                    <td className={`p-3 ${log.data_deleted ? 'line-through text-slate-500' : 'text-slate-300'}`}>{parseInt(log.row_count || 0).toLocaleString()}</td>
                    <td className={`p-3 ${log.data_deleted ? 'text-slate-500' : 'text-slate-300'}`}>{log.uploaded_by}</td>
                    <td className="p-3 text-slate-400">
                      {new Date(log.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {log.data_deleted && <span className="ml-2 text-xs text-rose-400">(data deleted)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// User Management Component (Admin Only)
const UserManagement = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', role: 'user' });
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', newUser);
      setSuccess('User created successfully');
      setShowAddUser(false);
      setNewUser({ username: '', password: '', full_name: '', role: 'user' });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await api.put(`/users/${user.id}`, { active: user.active ? 0 : 1 });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleResetPassword = async (userId) => {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    try {
      await api.put(`/users/${userId}`, { password: newPassword });
      setSuccess('Password reset successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/users/${userId}`);
      setSuccess('User deleted successfully');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <UserCog className="w-6 h-6 text-amber-400" />
          User Management
        </h2>
        <button onClick={() => setShowAddUser(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-rose-400 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-rose-300 hover:text-white">×</button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-emerald-400 text-sm">
          {success}
          <button onClick={() => setSuccess('')} className="ml-2 text-emerald-300 hover:text-white">×</button>
        </div>
      )}

      {/* Users Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="text-left text-slate-400 font-medium p-4">Username</th>
              <th className="text-left text-slate-400 font-medium p-4">Full Name</th>
              <th className="text-left text-slate-400 font-medium p-4">Role</th>
              <th className="text-left text-slate-400 font-medium p-4">Status</th>
              <th className="text-left text-slate-400 font-medium p-4">Last Login</th>
              <th className="text-right text-slate-400 font-medium p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-white/5">
                <td className="p-4 text-white font-medium">{user.username}</td>
                <td className="p-4 text-slate-300">{user.full_name || '-'}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    user.role === 'admin' 
                      ? 'bg-amber-500/20 text-amber-400' 
                      : user.role === 'demo'
                      ? 'bg-violet-500/20 text-violet-400'
                      : user.role === 'uploader'
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'bg-sky-500/20 text-sky-400'
                  }`}>
                    {user.role === 'admin' ? 'Admin' : user.role === 'demo' ? 'Demo' : user.role === 'uploader' ? 'Uploader' : 'User'}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    user.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {user.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4 text-slate-400 text-sm">
                  {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                </td>
                <td className="p-4 text-right">
                  {user.id !== currentUser.id && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`p-2 rounded-lg ${user.active ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
                        title={user.active ? 'Deactivate' : 'Activate'}
                      >
                        {user.active ? <X className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                        title="Reset Password"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {user.id === currentUser.id && (
                    <span className="text-slate-500 text-sm">(You)</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Add New User</h3>
              <button onClick={() => setShowAddUser(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Username *</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Password *</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
                  placeholder="Min 6 characters"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Full Name</label>
                <input
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
                >
                  <option value="user">User</option>
                  <option value="uploader">Uploader (Upload Only)</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary justify-center">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Change Password Component
const ChangePassword = () => {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (form.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      setSuccess('Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 max-w-md">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Key className="w-5 h-5 text-amber-400" />
        Change Password
      </h3>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-rose-400 text-sm mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-emerald-400 text-sm mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-2">Current Password</label>
          <input
            type="password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">New Password</label>
          <input
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
            placeholder="Min 6 characters"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">Confirm New Password</label>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? (
            <div className="w-5 h-5 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            'Change Password'
          )}
        </button>
      </form>
    </div>
  );
};

// Main App Component
function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('ede_token');
    const user = localStorage.getItem('ede_user');
    
    if (token && user) {
      // Verify token is still valid
      api.get('/auth/verify')
        .then(response => {
          setCurrentUser(JSON.parse(user));
          setIsAuthenticated(true);
        })
        .catch(() => {
          // Token invalid, clear storage
          localStorage.removeItem('ede_token');
          localStorage.removeItem('ede_user');
        })
        .finally(() => {
          setAuthLoading(false);
        });
    } else {
      setAuthLoading(false);
    }
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('ede_token');
    localStorage.removeItem('ede_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Main app content (wrapped in AuthenticatedApp component for cleanliness)
  return <AuthenticatedApp currentUser={currentUser} onLogout={handleLogout} />;
}

// Authenticated App Component (the original App content)
function AuthenticatedApp({ currentUser, onLogout }) {
  const isDemo = currentUser?.role === 'demo' || currentUser?.is_demo === true;
  const isUploader = currentUser?.role === 'uploader';
  const [activeTab, setActiveTab] = useState(isUploader ? 'upload' : 'dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [demoToast, setDemoToast] = useState('');
  
  // Data states
  const [competitors, setCompetitors] = useState([]);
  const [clients, setClients] = useState([]);
  const [companyName, setCompanyName] = useState('AGNA ORG AGROVILLA INDIA PRIVATE LIMITED');
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [compareMonth, setCompareMonth] = useState('');
  
  // Analytics states
  const [dashboardData, setDashboardData] = useState(null);
  const [competitorAnalytics, setCompetitorAnalytics] = useState({ competitors: [], comparison: [] });
  const [clientAnalytics, setClientAnalytics] = useState({ clients: [], comparison: [] });
  const [companyComparison, setCompanyComparison] = useState({ company_name: '', data: [] });
  const [trends, setTrends] = useState([]);
  
  // Form states
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newClient, setNewClient] = useState('');
  const [uploadType, setUploadType] = useState('fruits');
  const [uploadStatus, setUploadStatus] = useState(null);
  
  // Search suggestions
  const [competitorSuggestions, setCompetitorSuggestions] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [searchingCompetitors, setSearchingCompetitors] = useState(false);
  const [searchingClients, setSearchingClients] = useState(false);
  
  // Detail view
  const [detailView, setDetailView] = useState(null); // { entity, type, data }
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Intelligence data
  const [prospectiveClients, setProspectiveClients] = useState(null);
  const [crossSellData, setCrossSellData] = useState(null);
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);
  
  // Feedback
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackData, setFeedbackData] = useState({ user_name: '', feedback_type: 'suggestion', message: '' });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  
  // Custom Reports
  const [customReportFilters, setCustomReportFilters] = useState({ countries: '', exporters: '', consignees: '' });
  const [customReportData, setCustomReportData] = useState(null);
  const [loadingCustomReport, setLoadingCustomReport] = useState(false);
  
  // Monthly Comparison
  const [monthlyComparisonData, setMonthlyComparisonData] = useState(null);
  const [loadingMonthlyComparison, setLoadingMonthlyComparison] = useState(false);
  const [comparisonDetailView, setComparisonDetailView] = useState(null);
  
  // Benchmarking
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);

  // Show demo toast notification
  const showDemoToast = (message) => {
    setDemoToast(message || 'This action is not available in demo mode.');
    setTimeout(() => setDemoToast(''), 3000);
  };

  // Fetch initial data
  useEffect(() => {
    if (!isUploader) {
      fetchCompetitors();
      fetchClients();
      fetchCompany();
    }
    fetchMonths();
  }, []);

  // Fetch analytics when month changes (skip for uploader)
  useEffect(() => {
    if (months.length > 0 && !isUploader) {
      fetchDashboard();
      fetchCompetitorAnalytics();
      fetchClientAnalytics();
      fetchCompanyComparison();
      fetchTrends();
    }
  }, [selectedMonth, compareMonth, months]);

  const fetchCompetitors = async () => {
    try {
      const res = await api.get(`/competitors`);
      setCompetitors(res.data);
    } catch (err) {
      console.error('Error fetching competitors:', err);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get(`/clients`);
      setClients(res.data);
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  const fetchCompany = async () => {
    try {
      const res = await api.get(`/company`);
      setCompanyName(res.data?.company_name || 'AGNA');
    } catch (err) {
      console.error('Error fetching company:', err);
    }
  };

  const fetchMonths = async () => {
    try {
      const res = await api.get(`/analytics/months`);
      setMonths(res.data);
      if (res.data.length > 0) {
        setSelectedMonth(res.data[0]);
        if (res.data.length > 1) {
          setCompareMonth(res.data[1]);
        }
      }
    } catch (err) {
      console.error('Error fetching months:', err);
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await api.get(`/analytics/dashboard`, {
        params: { month: selectedMonth }
      });
      setDashboardData(res.data);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    }
  };

  const fetchCompetitorAnalytics = async () => {
    try {
      const res = await api.get(`/analytics/competitors`, {
        params: { month: selectedMonth, compareMonth }
      });
      setCompetitorAnalytics(res.data);
    } catch (err) {
      console.error('Error fetching competitor analytics:', err);
    }
  };

  const fetchClientAnalytics = async () => {
    try {
      const res = await api.get(`/analytics/clients`, {
        params: { month: selectedMonth, compareMonth }
      });
      setClientAnalytics(res.data);
    } catch (err) {
      console.error('Error fetching client analytics:', err);
    }
  };

  const fetchCompanyComparison = async () => {
    try {
      const res = await api.get(`/analytics/company-comparison`, {
        params: { month: selectedMonth }
      });
      setCompanyComparison(res.data);
    } catch (err) {
      console.error('Error fetching company comparison:', err);
    }
  };

  const fetchTrends = async () => {
    try {
      const res = await api.get(`/analytics/trends`);
      setTrends(res.data);
    } catch (err) {
      console.error('Error fetching trends:', err);
    }
  };

  // Search competitors in data
  const searchCompetitors = async (query) => {
    if (query.length < 2) {
      setCompetitorSuggestions([]);
      return;
    }
    setSearchingCompetitors(true);
    try {
      const res = await api.get(`/competitors/search`, { params: { q: query } });
      setCompetitorSuggestions(res.data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchingCompetitors(false);
    }
  };

  // Search clients in data
  const searchClients = async (query) => {
    if (query.length < 2) {
      setClientSuggestions([]);
      return;
    }
    setSearchingClients(true);
    try {
      const res = await api.get(`/clients/search`, { params: { q: query } });
      setClientSuggestions(res.data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchingClients(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newCompetitor) searchCompetitors(newCompetitor);
    }, 300);
    return () => clearTimeout(timer);
  }, [newCompetitor]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newClient) searchClients(newClient);
    }, 300);
    return () => clearTimeout(timer);
  }, [newClient]);

  const toggleCompetitorSelection = (name) => {
    setSelectedCompetitors(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const toggleClientSelection = (name) => {
    setSelectedClients(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleAddCompetitor = async (e) => {
    e.preventDefault();
    if (isDemo) { showDemoToast('Adding competitors is not available in demo mode.'); return; }
    const namesToAdd = selectedCompetitors.length > 0 ? selectedCompetitors : (newCompetitor.trim() ? [newCompetitor] : []);
    if (namesToAdd.length === 0) return;
    
    try {
      const res = await api.post(`/competitors`, { names: namesToAdd });
      if (res.data.added.length > 0) {
        setNewCompetitor('');
        setSelectedCompetitors([]);
        setCompetitorSuggestions([]);
        fetchCompetitors();
        fetchCompetitorAnalytics();
        fetchCompanyComparison();
      }
      if (res.data.errors.length > 0) {
        alert(`Some names couldn't be added: ${res.data.errors.map(e => e.name).join(', ')}`);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Error adding competitor');
    }
  };

  const handleDeleteCompetitor = async (id) => {
    if (isDemo) { showDemoToast('Removing competitors is not available in demo mode.'); return; }
    if (!confirm('Remove this competitor from tracking?')) return;
    try {
      await api.delete(`/competitors/${id}`);
      fetchCompetitors();
      fetchCompetitorAnalytics();
      fetchCompanyComparison();
    } catch (err) {
      alert('Error removing competitor');
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (isDemo) { showDemoToast('Adding clients is not available in demo mode.'); return; }
    const namesToAdd = selectedClients.length > 0 ? selectedClients : (newClient.trim() ? [newClient] : []);
    if (namesToAdd.length === 0) return;
    
    try {
      const res = await api.post(`/clients`, { names: namesToAdd });
      if (res.data.added.length > 0) {
        setNewClient('');
        setSelectedClients([]);
        setClientSuggestions([]);
        fetchClients();
        fetchClientAnalytics();
      }
      if (res.data.errors.length > 0) {
        alert(`Some names couldn't be added: ${res.data.errors.map(e => e.name).join(', ')}`);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Error adding client');
    }
  };

  const handleDeleteClient = async (id) => {
    if (isDemo) { showDemoToast('Removing clients is not available in demo mode.'); return; }
    if (!confirm('Remove this client from tracking?')) return;
    try {
      await api.delete(`/clients/${id}`);
      fetchClients();
      fetchClientAnalytics();
    } catch (err) {
      alert('Error removing client');
    }
  };

  const handleUpdateCompany = async () => {
    if (isDemo) { showDemoToast('Updating company settings is not available in demo mode.'); return; }
    try {
      await api.put(`/company`, { company_name: companyName });
      fetchCompanyComparison();
      alert('Company name updated!');
    } catch (err) {
      alert('Error updating company name');
    }
  };

  const handleFileUpload = async (e) => {
    if (isDemo) { showDemoToast('File upload is not available in demo mode.'); e.target.value = ''; return; }
    const file = e.target.files[0];
    if (!file) return;

    // Client-side file size validation (50MB max)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadStatus({ success: false, message: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.` });
      e.target.value = '';
      return;
    }

    // Step 1: Validate file first (check duplicates & HS code mismatch)
    setLoading(true);
    setUploadStatus({ success: true, message: `Validating ${file.name}...` });

    try {
      const validateForm = new FormData();
      validateForm.append('file', file);
      validateForm.append('dataType', uploadType);
      const valRes = await api.post('/upload/validate', validateForm, { timeout: 120000 });
      const { warnings } = valRes.data;

      if (warnings && warnings.length > 0) {
        // HS code mismatch = hard block, no option to proceed
        const hasMismatch = warnings.some(w => w.type === 'hs_mismatch');
        if (hasMismatch) {
          const mismatchMsg = warnings.find(w => w.type === 'hs_mismatch').message;
          setLoading(false);
          setUploadStatus({ success: false, message: `Upload blocked: ${mismatchMsg}` });
          e.target.value = '';
          alert(`🚨 CATEGORY MISMATCH\n\n${mismatchMsg}\n\nPlease select the correct category and try again.`);
          return;
        }

        // Other warnings (duplicate, same name) = ask to proceed
        const warningMessages = warnings.map(w => {
          if (w.type === 'duplicate') return `⚠️ DUPLICATE FILE: ${w.message}`;
          if (w.type === 'same_name') return `⚠️ SAME FILENAME: ${w.message}`;
          return w.message;
        }).join('\n\n');

        const proceed = window.confirm(`${warningMessages}\n\nDo you still want to proceed with the upload?`);
        if (!proceed) {
          setLoading(false);
          setUploadStatus({ success: false, message: 'Upload cancelled by user.' });
          e.target.value = '';
          return;
        }
      }
    } catch (valErr) {
      console.error('Validation error:', valErr);
      // If validation endpoint fails, warn user but let them proceed
      const proceed = window.confirm('Could not validate the file before upload. Do you want to proceed anyway?\n\nMake sure you have selected the correct category (Fruits or Vegetables).');
      if (!proceed) {
        setLoading(false);
        setUploadStatus({ success: false, message: 'Upload cancelled.' });
        e.target.value = '';
        return;
      }
    }

    // Step 2: Proceed with actual upload
    setUploadStatus({ success: true, message: `Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)...` });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('dataType', uploadType);

    try {
      const res = await api.post(`/upload`, formData, {
        timeout: 600000, // 10 minute timeout for large files
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadStatus({ success: true, message: `Uploading... ${pct}% (${(progressEvent.loaded / 1024 / 1024).toFixed(1)}MB / ${(progressEvent.total / 1024 / 1024).toFixed(1)}MB)` });
          } else {
            setUploadStatus({ success: true, message: `Uploading... ${(progressEvent.loaded / 1024 / 1024).toFixed(1)}MB sent` });
          }
        }
      });
      
      // If server returns a jobId, poll for completion
      if (res.data.jobId) {
        setUploadStatus({
          success: true,
          message: `Upload received. Processing ${res.data.totalRows} rows in background...`
        });
        
        // Poll for upload status
        const jobId = res.data.jobId;
        let attempts = 0;
        const maxAttempts = 120; // Poll for up to 4 minutes
        
        const pollStatus = async () => {
          try {
            const statusRes = await api.get(`/upload/status/${jobId}`);
            const job = statusRes.data;
            
            if (job.status === 'completed') {
              let skipDetail = '';
              if (job.skipReasons && job.skipped > 0) {
                const reasons = [];
                if (job.skipReasons.duplicate > 0) reasons.push(`${job.skipReasons.duplicate} duplicates`);
                if (job.skipReasons.noId > 0) reasons.push(`${job.skipReasons.noId} missing ID`);
                if (job.skipReasons.error > 0) reasons.push(`${job.skipReasons.error} errors`);
                skipDetail = reasons.length > 0 ? ` (${reasons.join(', ')})` : '';
              }
              setUploadStatus({
                success: job.inserted > 0,
                message: job.inserted > 0 
                  ? `Successfully imported ${job.inserted} records. ${job.skipped > 0 ? `${job.skipped} skipped${skipDetail}.` : ''}`
                  : `No records imported. ${job.skipped} rows processed but couldn't match required columns.`,
                columnsFound: job.columnsFound,
                skipReasons: job.skipReasons
              });
              setLoading(false);
              fetchMonths();
              if (!isUploader) {
                fetchDashboard();
                fetchCompetitorAnalytics();
                fetchClientAnalytics();
                fetchCompanyComparison();
                fetchTrends();
              }
              return;
            } else if (job.status === 'error') {
              setUploadStatus({
                success: false,
                message: `Upload processing failed: ${job.error}`
              });
              setLoading(false);
              return;
            } else {
              // Still processing - update progress
              const progress = job.progress || 0;
              setUploadStatus({
                success: true,
                message: `Processing... ${progress}/${job.totalRows} rows (${job.inserted} inserted, ${job.skipped} skipped)`
              });
              
              attempts++;
              if (attempts < maxAttempts) {
                setTimeout(pollStatus, 2000); // Poll every 2 seconds
              } else {
                setUploadStatus({
                  success: true,
                  message: `Upload is still processing in the background. Refresh the page in a minute to see results.`
                });
                setLoading(false);
              }
            }
          } catch (pollErr) {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(pollStatus, 3000); // Retry after 3 seconds on error
            } else {
              setUploadStatus({
                success: true,
                message: `Upload is processing in the background. Refresh the page to see results.`
              });
              setLoading(false);
            }
          }
        };
        
        // Start polling after a short delay
        setTimeout(pollStatus, 2000);
      } else {
        // Legacy response (direct result)
        setUploadStatus({
          success: res.data.inserted > 0,
          message: res.data.inserted > 0 
            ? `Successfully imported ${res.data.inserted} records (${res.data.skipped} skipped)`
            : `No records imported. ${res.data.skipped} rows processed but couldn't match required columns.`,
          columnsFound: res.data.columnsFound
        });
        setLoading(false);
        fetchMonths();
        fetchDashboard();
        fetchCompetitorAnalytics();
        fetchClientAnalytics();
        fetchCompanyComparison();
        fetchTrends();
      }
    } catch (err) {
      console.error('Upload error:', err);
      let errorMessage = 'Upload failed';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.status === 502) {
        errorMessage = 'Upload failed: Server gateway error. The file may be too large for the server. Try a smaller file or contact the administrator.';
      } else if (err.response?.status === 413) {
        errorMessage = 'Upload failed: File is too large. Maximum size is 50MB.';
      } else if (err.response?.status) {
        errorMessage = `Upload failed (HTTP ${err.response.status})`;
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Upload timed out. The file may be too large for the server to process. Try splitting it into smaller files.';
      } else if (err.message) {
        errorMessage = `Upload failed: ${err.message}`;
      }
      setUploadStatus({
        success: false,
        message: errorMessage
      });
      setLoading(false);
    } finally {
      e.target.value = '';
    }
  };

  const refreshData = () => {
    setLoading(true);
    Promise.all([
      fetchDashboard(),
      fetchCompetitorAnalytics(),
      fetchClientAnalytics(),
      fetchCompanyComparison(),
      fetchTrends()
    ]).finally(() => setLoading(false));
  };

  // Export functions
  const handleExport = (type) => {
    const month = selectedMonth || '';
    const url = `${API_BASE}/export/${type}?month=${month}`;
    window.open(url, '_blank');
  };

  // Fetch detailed entity analysis
  const fetchEntityDetails = async (entity, type) => {
    setLoadingDetails(true);
    try {
      const res = await api.get(`/analytics/entity-details`, {
        params: { entity, type, month: selectedMonth }
      });
      setDetailView({ entity, type, data: res.data });
    } catch (err) {
      console.error('Error fetching details:', err);
      alert('Error loading details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetailView = () => setDetailView(null);

  // Submit feedback
  const submitFeedback = async (e) => {
    e.preventDefault();
    if (isDemo) { showDemoToast('Feedback submission is not available in demo mode.'); return; }
    if (!feedbackData.message.trim()) return;
    
    setFeedbackSubmitting(true);
    try {
      await api.post(`/feedback`, {
        ...feedbackData,
        page: activeTab
      });
      alert('Thank you for your feedback!');
      setFeedbackData({ user_name: '', feedback_type: 'suggestion', message: '' });
      setShowFeedback(false);
    } catch (err) {
      alert('Error submitting feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Fetch intelligence data
  const fetchProspectiveClients = async () => {
    setLoadingIntelligence(true);
    try {
      const res = await api.get(`/intelligence/prospective-clients`);
      setProspectiveClients(res.data);
    } catch (err) {
      console.error('Error fetching prospective clients:', err);
    } finally {
      setLoadingIntelligence(false);
    }
  };

  const fetchCrossSellData = async () => {
    setLoadingIntelligence(true);
    try {
      const res = await api.get(`/intelligence/cross-sell`);
      setCrossSellData(res.data);
    } catch (err) {
      console.error('Error fetching cross-sell data:', err);
    } finally {
      setLoadingIntelligence(false);
    }
  };

  // Export entity details to Excel
  const exportEntityToExcel = () => {
    if (!detailView?.data) return;
    const { entity, type } = detailView;
    const month = selectedMonth || '';
    const url = `${API_BASE}/export/entity-details?entity=${encodeURIComponent(entity)}&type=${type}&month=${month}`;
    window.open(url, '_blank');
  };

  // Generate PDF from detail view (text format)
  const generatePDF = () => {
    if (!detailView?.data) return;
    
    const { entity, type, data } = detailView;
    const content = `
EXPORT DATA EXPLORER - ${type === 'exporter' ? 'COMPETITOR' : 'CLIENT'} ANALYSIS REPORT
${'='.repeat(70)}

Entity: ${entity}
Type: ${type === 'exporter' ? 'Competitor (Exporter)' : 'Client (Consignee)'}
Report Date: ${new Date().toLocaleDateString()}
${selectedMonth ? `Period: ${selectedMonth}` : 'Period: All Time'}

SUMMARY
${'-'.repeat(40)}
Total Shipments: ${data.summary?.total_shipments || 0}
Total FOB Value: $${(data.summary?.total_fob || 0).toLocaleString()} (₹${((data.summary?.total_fob || 0) * USD_TO_INR).toLocaleString()})
Total Quantity: ${Math.round(data.summary?.total_quantity || 0).toLocaleString()} KG
Unique Products: ${data.summary?.unique_products || 0}
Unique Countries: ${data.summary?.unique_countries || 0}
First Shipment: ${data.summary?.first_shipment || 'N/A'}
Last Shipment: ${data.summary?.last_shipment || 'N/A'}

TOP PRODUCTS
${'-'.repeat(40)}
${data.products?.slice(0, 20).map((p, i) => 
  `${i+1}. ${p.product_description}
     HS Code: ${p.hs_code} | Qty: ${Math.round(p.total_quantity)} ${p.unit} | FOB: $${p.total_fob.toLocaleString()}`
).join('\n') || 'No products'}

DESTINATION COUNTRIES
${'-'.repeat(40)}
${data.countries?.slice(0, 15).map((c, i) => 
  `${i+1}. ${c.country_of_destination}: ${c.shipment_count} shipments, $${c.total_fob.toLocaleString()}`
).join('\n') || 'No country data'}

${type === 'exporter' ? 'TOP CLIENTS' : 'TOP SUPPLIERS'}
${'-'.repeat(40)}
${(type === 'exporter' ? data.clients : data.suppliers)?.slice(0, 15).map((item, i) => 
  `${i+1}. ${type === 'exporter' ? item.consignee_name : item.exporter_name}: $${item.total_fob.toLocaleString()}`
).join('\n') || 'No data'}

RECENT SHIPMENTS
${'-'.repeat(40)}
${data.recentShipments?.slice(0, 20).map((s, i) => 
  `${s.shipment_date || 'N/A'} | ${s.declaration_id} | ${s.product_description?.substring(0, 40)} | $${s.fob_value?.toLocaleString() || 0}`
).join('\n') || 'No shipments'}

${'='.repeat(70)}
Generated by Export Data Explorer
    `.trim();

    // Create and download PDF-like text file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity.replace(/[^a-zA-Z0-9]/g, '_')}_report_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Fetch custom report data
  const fetchCustomReport = async () => {
    const { countries, exporters, consignees } = customReportFilters;
    if (!countries.trim() && !exporters.trim() && !consignees.trim()) {
      alert('Please enter at least one country, exporter, or consignee name');
      return;
    }
    
    setLoadingCustomReport(true);
    try {
      const params = new URLSearchParams();
      if (countries.trim()) params.append('countries', countries);
      if (exporters.trim()) params.append('exporters', exporters);
      if (consignees.trim()) params.append('consignees', consignees);
      if (selectedMonth) params.append('month', selectedMonth);
      
      const res = await api.get(`/custom-report?${params.toString()}`);
      setCustomReportData(res.data);
    } catch (err) {
      console.error('Error fetching custom report:', err);
      alert(err.response?.data?.error || 'Error generating report');
    } finally {
      setLoadingCustomReport(false);
    }
  };
  
  // Export custom report to Excel
  const exportCustomReportToExcel = () => {
    const { countries, exporters, consignees } = customReportFilters;
    const params = new URLSearchParams();
    if (countries.trim()) params.append('countries', countries);
    if (exporters.trim()) params.append('exporters', exporters);
    if (consignees.trim()) params.append('consignees', consignees);
    if (selectedMonth) params.append('month', selectedMonth);
    
    const url = `${API_BASE}/export/custom-report?${params.toString()}`;
    window.open(url, '_blank');
  };
  
  // Export prospective clients to Excel
  const exportProspectiveClientsToExcel = () => {
    window.open(`${API_BASE}/export/prospective-clients`, '_blank');
  };
  
  // Export cross-sell to Excel
  const exportCrossSellToExcel = () => {
    window.open(`${API_BASE}/export/cross-sell`, '_blank');
  };
  
  // Fetch monthly comparison data
  const fetchMonthlyComparison = async () => {
    if (!selectedMonth || !compareMonth) {
      alert('Please select both current and comparison months');
      return;
    }
    setLoadingMonthlyComparison(true);
    try {
      const res = await api.get(`/monthly-comparison`, {
        params: { currentMonth: selectedMonth, previousMonth: compareMonth }
      });
      setMonthlyComparisonData(res.data);
    } catch (err) {
      console.error('Error fetching monthly comparison:', err);
      alert('Error loading comparison data');
    } finally {
      setLoadingMonthlyComparison(false);
    }
  };
  
  // Export monthly comparison to Excel
  const exportMonthlyComparisonToExcel = () => {
    if (!selectedMonth || !compareMonth) return;
    window.open(`${API_BASE}/export/monthly-comparison?currentMonth=${selectedMonth}&previousMonth=${compareMonth}`, '_blank');
  };
  
  // Fetch benchmarking data
  const fetchBenchmarkData = async () => {
    setLoadingBenchmark(true);
    try {
      const res = await api.get(`/benchmarking`, {
        params: { month: selectedMonth }
      });
      setBenchmarkData(res.data);
    } catch (err) {
      console.error('Error fetching benchmark data:', err);
      alert('Error loading benchmark data');
    } finally {
      setLoadingBenchmark(false);
    }
  };
  
  // Export benchmarking to Excel
  const exportBenchmarkToExcel = () => {
    window.open(`${API_BASE}/export/benchmarking?month=${selectedMonth || ''}`, '_blank');
  };

  // Calculate comparison percentages
  const calculateTrend = (current, previous) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="min-h-screen flex">
      {/* Demo Toast Notification */}
      {demoToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-amber-500/20 border border-amber-500/40 backdrop-blur-lg rounded-lg px-5 py-3 flex items-center gap-3 shadow-xl">
            <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <span className="text-amber-200 text-sm font-medium">{demoToast}</span>
            <button onClick={() => setDemoToast('')} className="text-amber-400/60 hover:text-amber-400 ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-navy-950/50 border-r border-white/5 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Ship className="w-6 h-6 text-navy-950" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-display text-lg font-semibold text-white">EDE</h1>
                <p className="text-xs text-slate-500">Export Data Explorer</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {!isUploader && (
            <NavItem
              icon={LayoutDashboard}
              label={sidebarOpen ? "Dashboard" : ""}
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
            />
          )}
          {!isDemo && (
            <NavItem
              icon={Upload}
              label={sidebarOpen ? "Import Data" : ""}
              active={activeTab === 'upload'}
              onClick={() => setActiveTab('upload')}
            />
          )}
          {!isUploader && (
            <>
              <NavItem
                icon={Target}
                label={sidebarOpen ? "Competitors" : ""}
                active={activeTab === 'competitors'}
                onClick={() => setActiveTab('competitors')}
                badge={sidebarOpen ? competitors.length : null}
              />
              <NavItem
                icon={UserCheck}
                label={sidebarOpen ? "Clients" : ""}
                active={activeTab === 'clients'}
                onClick={() => setActiveTab('clients')}
                badge={sidebarOpen ? clients.length : null}
              />
              <NavItem
                icon={Building}
                label={sidebarOpen ? `${companyName} Analysis` : ""}
                active={activeTab === 'company'}
                onClick={() => setActiveTab('company')}
              />
              <NavItem
                icon={TrendingUp}
                label={sidebarOpen ? "Trends" : ""}
                active={activeTab === 'trends'}
                onClick={() => setActiveTab('trends')}
              />
              <NavItem
                icon={Lightbulb}
                label={sidebarOpen ? "Intelligence" : ""}
                active={activeTab === 'intelligence'}
                onClick={() => setActiveTab('intelligence')}
              />
              <NavItem
                icon={TrendingUp}
                label={sidebarOpen ? "Monthly Compare" : ""}
                active={activeTab === 'monthly-comparison'}
                onClick={() => setActiveTab('monthly-comparison')}
              />
              <NavItem
                icon={Target}
                label={sidebarOpen ? "AGNA Benchmark" : ""}
                active={activeTab === 'benchmarking'}
                onClick={() => setActiveTab('benchmarking')}
              />
              <NavItem
                icon={FileSearch}
                label={sidebarOpen ? "Custom Reports" : ""}
                active={activeTab === 'custom-reports'}
                onClick={() => setActiveTab('custom-reports')}
              />
              <NavItem
                icon={Settings}
                label={sidebarOpen ? "Settings" : ""}
                active={activeTab === 'settings'}
                onClick={() => setActiveTab('settings')}
              />
              {currentUser?.role === 'admin' && (
                <>
                  <NavItem
                    icon={Database}
                    label={sidebarOpen ? "Data Management" : ""}
                    active={activeTab === 'data-management'}
                    onClick={() => setActiveTab('data-management')}
                  />
                  <NavItem
                    icon={UserCog}
                    label={sidebarOpen ? "Users" : ""}
                    active={activeTab === 'users'}
                    onClick={() => setActiveTab('users')}
                  />
                </>
              )}
            </>
          )}
        </nav>

        {/* User Info & Logout */}
        <div className="border-t border-white/5 p-4">
          {sidebarOpen && (
            <div className="mb-3 px-2">
              <p className="text-white text-sm font-medium truncate">{currentUser?.full_name || currentUser?.username}</p>
              <p className="text-slate-500 text-xs flex items-center gap-1">
                {isDemo ? <Sparkles className="w-3 h-3 text-amber-400" /> : isUploader ? <Upload className="w-3 h-3 text-sky-400" /> : currentUser?.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                {isDemo ? <span className="text-amber-400">Demo Account</span> : isUploader ? <span className="text-sky-400">Uploader</span> : currentUser?.role === 'admin' ? 'Administrator' : 'User'}
              </p>
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-all"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>

        {/* Sidebar Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-4 border-t border-white/5 text-slate-400 hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 glass border-b border-white/5 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white capitalize">
                {activeTab === 'company' ? `${companyName} Analysis` : activeTab.replace('-', ' ')}
              </h2>
              <p className="text-sm text-slate-400">
                {activeTab === 'dashboard' && 'Overview of export data and key metrics'}
                {activeTab === 'upload' && 'Import Excel files for fruits and vegetables'}
                {activeTab === 'competitors' && 'Track and analyze competitor shipments'}
                {activeTab === 'clients' && 'Monitor client purchases and trends'}
                {activeTab === 'company' && 'Compare your performance with competitors'}
                {activeTab === 'trends' && 'Historical trends and patterns'}
                {activeTab === 'intelligence' && 'Find new business opportunities'}
                {activeTab === 'monthly-comparison' && 'Compare current month with previous month'}
                {activeTab === 'benchmarking' && 'Benchmark AGNA against competitors and client vendors'}
                {activeTab === 'custom-reports' && 'Generate custom reports by country or company'}
                {activeTab === 'settings' && 'Configure your company and preferences'}
                {activeTab === 'users' && 'Manage user accounts and permissions'}
                {activeTab === 'data-management' && 'View, manage and delete uploaded data by month'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Month Selector */}
              {months.length > 0 && activeTab !== 'upload' && activeTab !== 'settings' && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">All Time</option>
                    {months.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  {(activeTab === 'competitors' || activeTab === 'clients') && (
                    <>
                      <span className="text-slate-500 text-sm">vs</span>
                      <select
                        value={compareMonth}
                        onChange={(e) => setCompareMonth(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">No Comparison</option>
                        {months.filter(m => m !== selectedMonth).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}
              <button onClick={refreshData} className="btn-secondary" disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {!loading && 'Refresh'}
              </button>
            </div>
          </div>
        </header>

        {/* Demo Mode Banner */}
        {isDemo && (
          <div className="mx-6 mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-amber-200 text-sm font-medium">Demo Mode</p>
                <p className="text-amber-200/60 text-xs">You are viewing sample data. Some actions are restricted.</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-all"
            >
              Sign in with your account
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              {/* Export Button */}
              {dashboardData?.summary?.total_shipments > 0 && (
                <div className="flex justify-end">
                  <button onClick={() => handleExport('summary')} className="btn-secondary">
                    <FileDown className="w-4 h-4" />
                    Export Summary Report
                  </button>
                </div>
              )}
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={Ship}
                  label="Total Shipments"
                  value={formatNumber(dashboardData?.summary?.total_shipments)}
                  color="gold"
                  delay={0}
                />
                <StatCard
                  icon={DollarSign}
                  label="Total FOB Value"
                  value={formatCurrency(dashboardData?.summary?.total_fob)}
                  color="emerald"
                  delay={100}
                />
                <StatCard
                  icon={Building2}
                  label="Unique Exporters"
                  value={formatNumber(dashboardData?.summary?.unique_exporters)}
                  color="sky"
                  delay={200}
                />
                <StatCard
                  icon={Globe}
                  label="Destination Countries"
                  value={formatNumber(dashboardData?.summary?.unique_countries)}
                  color="coral"
                  delay={300}
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Breakdown */}
                <div className="glass-card rounded-xl p-6 animate-slide-up delay-200">
                  <h3 className="text-lg font-semibold text-white mb-4">Category Breakdown</h3>
                  {dashboardData?.byCategory?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={dashboardData.byCategory}
                          dataKey="total_fob"
                          nameKey="data_type"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                        >
                          {dashboardData.byCategory.map((entry, index) => (
                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-slate-500">
                      No data available. Import Excel files to see analytics.
                    </div>
                  )}
                </div>

                {/* Top Exporters */}
                <div className="glass-card rounded-xl p-6 animate-slide-up delay-300">
                  <h3 className="text-lg font-semibold text-white mb-4">Top 10 Exporters by FOB</h3>
                  {dashboardData?.topExporters?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dashboardData.topExporters.slice(0, 5)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" tickFormatter={formatCurrency} />
                        <YAxis type="category" dataKey="exporter_name" width={100} tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total_fob" fill={COLORS.gold} radius={[0, 4, 4, 0]} name="FOB Value" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-slate-500">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Top Countries */}
              <div className="glass-card rounded-xl p-6 animate-slide-up delay-400">
                <h3 className="text-lg font-semibold text-white mb-4">Top Destination Countries</h3>
                {dashboardData?.topCountries?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dashboardData.topCountries.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="country_of_destination" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis tickFormatter={formatCurrency} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total_fob" fill={COLORS.emerald} radius={[4, 4, 0, 0]} name="FOB Value" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    No data available
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <div className="glass-card rounded-xl p-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                    <FileSpreadsheet className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Import Export Data</h3>
                  <p className="text-slate-400 mt-2">Upload Excel files containing fruits or vegetables export data</p>
                </div>

                {/* Data Type Selection */}
                <div className="flex justify-center gap-4 mb-6">
                  <button
                    onClick={() => setUploadType('fruits')}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${
                      uploadType === 'fruits'
                        ? 'bg-amber-500 text-navy-950'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    🍎 Fruits
                  </button>
                  <button
                    onClick={() => setUploadType('vegetables')}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${
                      uploadType === 'vegetables'
                        ? 'bg-emerald-500 text-navy-950'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    🥬 Vegetables
                  </button>
                </div>

                {/* Upload Zone */}
                <label className="drop-zone block cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={loading}
                  />
                  {loading ? (
                    <div className="flex flex-col items-center">
                      <div className="spinner mb-4"></div>
                      <p className="text-slate-300">Processing file...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-white font-medium">Drop Excel file here or click to browse</p>
                      <p className="text-slate-500 text-sm mt-2">Supports .xlsx and .xls files</p>
                      <p className="text-amber-400/70 text-xs mt-2">
                        {uploadType === 'fruits' ? '08_Exp files → Fruits (HS Code 08xx)' : '07_Exp files → Vegetables (HS Code 07xx)'}
                      </p>
                    </>
                  )}
                </label>

                {/* Upload Status */}
                {uploadStatus && (
                  <div className={`mt-4 p-4 rounded-lg ${
                    uploadStatus.success 
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' 
                      : 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
                  }`}>
                    <p className="font-medium">{uploadStatus.message}</p>
                    {uploadStatus.columnsFound && uploadStatus.columnsFound.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-xs text-slate-400 mb-2">Columns found in your file:</p>
                        <div className="flex flex-wrap gap-1">
                          {uploadStatus.columnsFound.map((col, i) => (
                            <span key={i} className="text-xs bg-white/10 px-2 py-1 rounded">
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Expected Columns */}
                <div className="mt-8 p-4 bg-white/5 rounded-lg">
                  <h4 className="text-sm font-semibold text-white mb-3">Expected Excel Columns:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div>• Declaration ID (unique)</div>
                    <div>• Exporter Name</div>
                    <div>• Consignee Name</div>
                    <div>• Product Description</div>
                    <div>• HS Code</div>
                    <div>• Quantity & Unit</div>
                    <div>• FOB Value</div>
                    <div>• Shipment Date</div>
                    <div>• Port of Loading</div>
                    <div>• Port of Discharge</div>
                    <div>• Country of Destination</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Competitors Tab */}
          {activeTab === 'competitors' && (
            <div className="space-y-6 animate-fade-in">
              {/* Add Competitor */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Track New Competitor</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Type part of the company name to search. Select one or more matching companies from your data.
                </p>
                <form onSubmit={handleAddCompetitor} className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={newCompetitor}
                        onChange={(e) => setNewCompetitor(e.target.value)}
                        placeholder="Search by company name (e.g., 'apex' or 'agro')"
                        className="w-full"
                      />
                      {searchingCompetitors && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <button type="submit" className="btn-primary" disabled={selectedCompetitors.length === 0 && !newCompetitor.trim()}>
                      <Plus className="w-4 h-4" />
                      Add {selectedCompetitors.length > 0 ? `(${selectedCompetitors.length})` : 'Competitor'}
                    </button>
                  </div>
                  
                  {/* Search Results */}
                  {competitorSuggestions.length > 0 && (
                    <div className="bg-navy-900/50 rounded-lg border border-white/10 max-h-80 overflow-y-auto">
                      <div className="p-3 border-b border-white/10 bg-white/5">
                        <p className="text-xs text-slate-400">
                          Found {competitorSuggestions.length} matching exporters. Click to select:
                        </p>
                      </div>
                      {competitorSuggestions.map((s, i) => (
                        <div
                          key={i}
                          onClick={() => !s.already_tracked && toggleCompetitorSelection(s.name)}
                          className={`p-3 border-b border-white/5 cursor-pointer transition-colors ${
                            s.already_tracked 
                              ? 'opacity-50 cursor-not-allowed bg-emerald-500/10' 
                              : selectedCompetitors.includes(s.name)
                                ? 'bg-amber-500/20 border-l-2 border-l-amber-500'
                                : 'hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                s.already_tracked 
                                  ? 'border-emerald-500 bg-emerald-500'
                                  : selectedCompetitors.includes(s.name)
                                    ? 'border-amber-500 bg-amber-500'
                                    : 'border-slate-500'
                              }`}>
                                {(s.already_tracked || selectedCompetitors.includes(s.name)) && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-white font-medium">{s.name}</p>
                                {s.already_tracked && (
                                  <span className="text-xs text-emerald-400">Already tracking</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-amber-400 font-mono">{formatCurrency(s.total_fob)}</p>
                              <p className="text-slate-500 text-xs">{s.shipment_count} shipments</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {newCompetitor.length >= 2 && competitorSuggestions.length === 0 && !searchingCompetitors && (
                    <p className="text-slate-500 text-sm p-3 bg-white/5 rounded-lg">
                      No matching exporters found in your data. You can still add "{newCompetitor.toUpperCase()}" manually.
                    </p>
                  )}
                </form>
              </div>

              {/* Competitor List */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Tracked Competitors ({competitors.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {competitors.map(c => (
                    <div key={c.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-slate-300">{c.name}</span>
                      <button
                        onClick={() => handleDeleteCompetitor(c.id)}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {competitors.length === 0 && (
                    <p className="text-slate-500">No competitors being tracked. Search and add some above!</p>
                  )}
                </div>
              </div>

              {/* Competitor Analytics */}
              {competitorAnalytics.competitors.length > 0 && (
                <>
                  {/* Stats Table */}
                  <div className="glass-card rounded-xl p-6 overflow-x-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Competitor Performance</h3>
                      <button onClick={() => handleExport('competitors')} className="btn-secondary text-sm">
                        <Download className="w-4 h-4" />
                        Export to Excel
                      </button>
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Exporter</th>
                          <th>Shipments</th>
                          <th>Total FOB</th>
                          <th>Products</th>
                          <th>Countries</th>
                          <th>Categories</th>
                          {compareMonth && <th>vs {compareMonth}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {competitorAnalytics.competitors.map((comp, i) => {
                          const prevData = competitorAnalytics.comparison.find(
                            c => c.exporter_name === comp.exporter_name
                          );
                          const trend = prevData ? calculateTrend(comp.total_fob, prevData.total_fob) : null;
                          
                          return (
                            <tr 
                              key={i} 
                              onClick={() => fetchEntityDetails(comp.exporter_name, 'exporter')}
                              className="cursor-pointer hover:bg-amber-500/10 transition-colors"
                            >
                              <td className="font-medium text-white">
                                {comp.exporter_name}
                                <span className="ml-2 text-xs text-slate-500">Click for details</span>
                              </td>
                              <td>{formatNumber(comp.shipment_count)}</td>
                              <td className="text-amber-400 font-mono">{formatCurrency(comp.total_fob)}</td>
                              <td>{comp.product_count}</td>
                              <td>{comp.country_count}</td>
                              <td>
                                <span className={`badge ${comp.categories?.includes('fruits') ? 'badge-gold' : 'badge-emerald'}`}>
                                  {comp.categories}
                                </span>
                              </td>
                              {compareMonth && (
                                <td>
                                  {trend !== null ? (
                                    <span className={`flex items-center gap-1 ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                      {Math.abs(trend).toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">N/A</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Competitor Chart */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">FOB Value Comparison</h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={competitorAnalytics.competitors}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="exporter_name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={100} />
                        <YAxis tickFormatter={formatCurrency} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="total_fob" fill={COLORS.gold} radius={[4, 4, 0, 0]} name="FOB Value" />
                        <Bar dataKey="shipment_count" fill={COLORS.sky} radius={[4, 4, 0, 0]} name="Shipments" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Clients Tab */}
          {activeTab === 'clients' && (
            <div className="space-y-6 animate-fade-in">
              {/* Add Client */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Track New Client</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Type part of the client/consignee name to search. Select one or more matching companies from your data.
                </p>
                <form onSubmit={handleAddClient} className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={newClient}
                        onChange={(e) => setNewClient(e.target.value)}
                        placeholder="Search by client name (e.g., 'fresh' or 'foods')"
                        className="w-full"
                      />
                      {searchingClients && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <button type="submit" className="btn-primary" disabled={selectedClients.length === 0 && !newClient.trim()}>
                      <Plus className="w-4 h-4" />
                      Add {selectedClients.length > 0 ? `(${selectedClients.length})` : 'Client'}
                    </button>
                  </div>
                  
                  {/* Search Results */}
                  {clientSuggestions.length > 0 && (
                    <div className="bg-navy-900/50 rounded-lg border border-white/10 max-h-80 overflow-y-auto">
                      <div className="p-3 border-b border-white/10 bg-white/5">
                        <p className="text-xs text-slate-400">
                          Found {clientSuggestions.length} matching consignees. Click to select:
                        </p>
                      </div>
                      {clientSuggestions.map((s, i) => (
                        <div
                          key={i}
                          onClick={() => !s.already_tracked && toggleClientSelection(s.name)}
                          className={`p-3 border-b border-white/5 cursor-pointer transition-colors ${
                            s.already_tracked 
                              ? 'opacity-50 cursor-not-allowed bg-emerald-500/10' 
                              : selectedClients.includes(s.name)
                                ? 'bg-emerald-500/20 border-l-2 border-l-emerald-500'
                                : 'hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                s.already_tracked 
                                  ? 'border-emerald-500 bg-emerald-500'
                                  : selectedClients.includes(s.name)
                                    ? 'border-emerald-500 bg-emerald-500'
                                    : 'border-slate-500'
                              }`}>
                                {(s.already_tracked || selectedClients.includes(s.name)) && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-white font-medium">{s.name}</p>
                                <p className="text-xs text-slate-500">{s.countries}</p>
                                {s.already_tracked && (
                                  <span className="text-xs text-emerald-400">Already tracking</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-emerald-400 font-mono">{formatCurrency(s.total_fob)}</p>
                              <p className="text-slate-500 text-xs">{s.shipment_count} shipments</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {newClient.length >= 2 && clientSuggestions.length === 0 && !searchingClients && (
                    <p className="text-slate-500 text-sm p-3 bg-white/5 rounded-lg">
                      No matching consignees found in your data. You can still add "{newClient.toUpperCase()}" manually.
                    </p>
                  )}
                </form>
              </div>

              {/* Client List */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Tracked Clients ({clients.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {clients.map(c => (
                    <div key={c.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-slate-300">{c.name}</span>
                      <button
                        onClick={() => handleDeleteClient(c.id)}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {clients.length === 0 && (
                    <p className="text-slate-500">No clients being tracked. Search and add some above!</p>
                  )}
                </div>
              </div>

              {/* Client Analytics */}
              {clientAnalytics.clients.length > 0 && (
                <>
                  {/* Stats Table */}
                  <div className="glass-card rounded-xl p-6 overflow-x-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Client Activity</h3>
                      <button onClick={() => handleExport('clients')} className="btn-secondary text-sm">
                        <Download className="w-4 h-4" />
                        Export to Excel
                      </button>
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Client/Consignee</th>
                          <th>Shipments</th>
                          <th>Total FOB</th>
                          <th>Products</th>
                          <th>Suppliers</th>
                          <th>Categories</th>
                          {compareMonth && <th>vs {compareMonth}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {clientAnalytics.clients.map((client, i) => {
                          const prevData = clientAnalytics.comparison.find(
                            c => c.consignee_name === client.consignee_name
                          );
                          const trend = prevData ? calculateTrend(client.total_fob, prevData.total_fob) : null;
                          
                          return (
                            <tr 
                              key={i}
                              onClick={() => fetchEntityDetails(client.consignee_name, 'consignee')}
                              className="cursor-pointer hover:bg-emerald-500/10 transition-colors"
                            >
                              <td className="font-medium text-white">
                                {formatName(client.consignee_name)}
                                <span className="ml-2 text-xs text-slate-500">Click for details</span>
                              </td>
                              <td>{formatNumber(client.shipment_count)}</td>
                              <td className="text-emerald-400 font-mono">{formatCurrency(client.total_fob)}</td>
                              <td>{client.product_count}</td>
                              <td>{client.supplier_count}</td>
                              <td>
                                <span className={`badge ${client.categories?.includes('fruits') ? 'badge-gold' : 'badge-emerald'}`}>
                                  {client.categories}
                                </span>
                              </td>
                              {compareMonth && (
                                <td>
                                  {trend !== null ? (
                                    <span className={`flex items-center gap-1 ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                      {Math.abs(trend).toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">N/A</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Client Chart */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Purchase Volume Comparison</h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={clientAnalytics.clients}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="consignee_name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={100} />
                        <YAxis tickFormatter={formatCurrency} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="total_fob" fill={COLORS.emerald} radius={[4, 4, 0, 0]} name="FOB Value" />
                        <Bar dataKey="shipment_count" fill={COLORS.violet} radius={[4, 4, 0, 0]} name="Shipments" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Company Comparison Tab */}
          {activeTab === 'company' && (
            <div className="space-y-6 animate-fade-in">
              {/* Company vs Competitors */}
              {companyComparison.data.length > 0 ? (
                <>
                  {/* Overview Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {companyComparison.data.filter(d => d.is_company).map((company, i) => (
                      <StatCard
                        key={i}
                        icon={Building}
                        label={`${company.exporter_name} Shipments`}
                        value={formatNumber(company.shipment_count)}
                        subValue={`FOB: ${formatCurrency(company.total_fob)}`}
                        color="gold"
                      />
                    ))}
                  </div>

                  {/* Comparison Table */}
                  <div className="glass-card rounded-xl p-6 overflow-x-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        {companyComparison.company_name} vs Competitors
                      </h3>
                      <button onClick={() => handleExport('company-comparison')} className="btn-secondary text-sm">
                        <Download className="w-4 h-4" />
                        Export to Excel
                      </button>
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Type</th>
                          <th>Shipments</th>
                          <th>Total FOB</th>
                          <th>Products</th>
                          <th>Countries</th>
                          <th>Clients</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companyComparison.data.map((item, i) => (
                          <tr key={i} className={item.is_company ? 'bg-amber-500/10' : ''}>
                            <td className={`font-medium ${item.is_company ? 'text-amber-400' : 'text-white'}`}>
                              {item.exporter_name}
                              {item.is_company && <span className="ml-2 badge badge-gold">YOU</span>}
                            </td>
                            <td>
                              <span className={`badge ${item.is_company ? 'badge-gold' : 'badge-sky'}`}>
                                {item.is_company ? 'Company' : 'Competitor'}
                              </span>
                            </td>
                            <td>{formatNumber(item.shipment_count)}</td>
                            <td className="font-mono text-emerald-400">{formatCurrency(item.total_fob)}</td>
                            <td>{item.product_count}</td>
                            <td>{item.country_count}</td>
                            <td>{item.client_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Comparison Chart */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Market Position</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={companyComparison.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="exporter_name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={100} />
                        <YAxis yAxisId="left" tickFormatter={formatCurrency} />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="total_fob" name="FOB Value" radius={[4, 4, 0, 0]}>
                          {companyComparison.data.map((entry, index) => (
                            <Cell key={index} fill={entry.is_company ? COLORS.gold : COLORS.sky} />
                          ))}
                        </Bar>
                        <Bar yAxisId="right" dataKey="shipment_count" name="Shipments" radius={[4, 4, 0, 0]}>
                          {companyComparison.data.map((entry, index) => (
                            <Cell key={index} fill={entry.is_company ? COLORS.amber : COLORS.violet} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="glass-card rounded-xl p-12 text-center">
                  <Building className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Comparison Data</h3>
                  <p className="text-slate-400 mb-4">
                    Add competitors and import data to see company comparison analytics
                  </p>
                  <button onClick={() => setActiveTab('competitors')} className="btn-primary">
                    <Plus className="w-4 h-4" />
                    Add Competitors
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Trends Tab */}
          {activeTab === 'trends' && (
            <div className="space-y-6 animate-fade-in">
              {trends.length > 0 ? (
                <>
                  {/* Shipment Trends */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Monthly Shipment Trends</h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart data={trends}>
                        <defs>
                          <linearGradient id="colorFob" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.gold} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS.gold} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorShipments" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="month_year" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tickFormatter={formatCurrency} />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="total_fob"
                          stroke={COLORS.gold}
                          fill="url(#colorFob)"
                          name="FOB Value"
                        />
                        <Area
                          yAxisId="right"
                          type="monotone"
                          dataKey="shipment_count"
                          stroke={COLORS.emerald}
                          fill="url(#colorShipments)"
                          name="Shipments"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Product Diversity */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Product Diversity Over Time</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="month_year" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="product_count"
                          stroke={COLORS.violet}
                          strokeWidth={2}
                          dot={{ fill: COLORS.violet }}
                          name="Unique Products"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="glass-card rounded-xl p-12 text-center">
                  <TrendingUp className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Trend Data</h3>
                  <p className="text-slate-400">Import export data to see historical trends</p>
                </div>
              )}
            </div>
          )}

          {/* Entity Detail Modal */}
          {detailView && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
              <div className="glass-card rounded-xl w-full max-w-6xl my-8 animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                  <div>
                    <h2 className="text-xl font-bold text-white">{detailView.entity}</h2>
                    <p className="text-sm text-slate-400">
                      {detailView.type === 'exporter' ? 'Competitor Analysis' : 'Client Analysis'}
                      {selectedMonth && ` • ${selectedMonth}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={exportEntityToExcel} className="btn-primary text-sm">
                      <FileSpreadsheet className="w-4 h-4" />
                      Export Excel
                    </button>
                    <button onClick={generatePDF} className="btn-secondary text-sm">
                      <FileText className="w-4 h-4" />
                      Export PDF
                    </button>
                    <button onClick={closeDetailView} className="text-slate-400 hover:text-white p-2">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {loadingDetails ? (
                  <div className="p-12 flex justify-center">
                    <div className="spinner"></div>
                  </div>
                ) : detailView.data && (
                  <div className="p-6 space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-2xl font-bold text-amber-400">
                          {formatNumber(detailView.data.summary?.total_shipments)}
                        </p>
                        <p className="text-sm text-slate-400">Total Shipments</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-xl font-bold text-emerald-400">
                          {formatCurrency(detailView.data.summary?.total_fob)}
                        </p>
                        <p className="text-sm text-amber-400">
                          {formatINR(detailView.data.summary?.total_fob)}
                        </p>
                        <p className="text-sm text-slate-400">Total FOB Value</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-2xl font-bold text-sky-400">
                          {formatNumber(Math.round(detailView.data.summary?.total_quantity || 0))} KG
                        </p>
                        <p className="text-sm text-slate-400">Total Quantity</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-2xl font-bold text-violet-400">
                          {detailView.data.summary?.unique_products}
                        </p>
                        <p className="text-sm text-slate-400">Unique Products</p>
                        <p className="text-xs text-slate-500">
                          {detailView.data.summary?.first_shipment} - {detailView.data.summary?.last_shipment}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Products Breakdown */}
                      <div className="bg-white/5 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Top Products</h3>
                        <div className="max-h-80 overflow-y-auto space-y-2">
                          {detailView.data.products?.slice(0, 15).map((p, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{p.product_description}</p>
                                <p className="text-xs text-slate-500">HS: {p.hs_code} • {p.data_type}</p>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-sm font-mono text-amber-400">{formatCurrency(p.total_fob)}</p>
                                <p className="text-xs text-slate-500">{formatNumber(Math.round(p.total_quantity))} {p.unit}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Countries Breakdown */}
                      <div className="bg-white/5 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Destination Countries</h3>
                        <div className="max-h-80 overflow-y-auto">
                          {detailView.data.countries?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                              <BarChart data={detailView.data.countries.slice(0, 10)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis type="number" tickFormatter={formatCurrency} />
                                <YAxis type="category" dataKey="country_of_destination" width={100} tick={{ fontSize: 10 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="total_fob" fill={COLORS.emerald} radius={[0, 4, 4, 0]} name="FOB Value" />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <p className="text-slate-500 text-center py-8">No country data</p>
                          )}
                        </div>
                      </div>

                      {/* Monthly Trend */}
                      <div className="bg-white/5 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Monthly Trend</h3>
                        {detailView.data.monthlyTrend?.length > 0 ? (
                          <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={detailView.data.monthlyTrend}>
                              <defs>
                                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={COLORS.gold} stopOpacity={0.3} />
                                  <stop offset="95%" stopColor={COLORS.gold} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="month_year" tick={{ fontSize: 10 }} />
                              <YAxis tickFormatter={formatCurrency} />
                              <Tooltip content={<CustomTooltip />} />
                              <Area type="monotone" dataKey="total_fob" stroke={COLORS.gold} fill="url(#colorTrend)" name="FOB Value" />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-slate-500 text-center py-8">No trend data</p>
                        )}
                      </div>

                      {/* Clients/Suppliers */}
                      <div className="bg-white/5 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-white mb-4">
                          {detailView.type === 'exporter' ? 'Top Clients (Buyers)' : 'Top Suppliers'}
                        </h3>
                        <div className="max-h-80 overflow-y-auto space-y-2">
                          {(detailView.type === 'exporter' ? detailView.data.clients : detailView.data.suppliers)?.slice(0, 10).map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">
                                  {formatName(detailView.type === 'exporter' ? item.consignee_name : item.exporter_name)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {detailView.type === 'exporter' ? item.country_of_destination : `${item.shipment_count} shipments`}
                                </p>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-sm font-mono text-emerald-400">{formatCurrency(item.total_fob)}</p>
                                <p className="text-xs text-slate-500">{item.shipment_count} shipments</p>
                              </div>
                            </div>
                          ))}
                          {((detailView.type === 'exporter' ? detailView.data.clients : detailView.data.suppliers)?.length === 0) && (
                            <p className="text-slate-500 text-center py-4">No data available</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ports Info */}
                    <div className="bg-white/5 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-4">Shipping Routes</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {detailView.data.ports?.slice(0, 9).map((p, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-white/5 rounded text-sm">
                            <span className="text-slate-300">{p.indian_port}</span>
                            <span className="text-slate-500">→</span>
                            <span className="text-slate-300">{p.foreign_port}</span>
                            <span className="ml-auto text-amber-400">{p.shipment_count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Shipments with Dates */}
                    <div className="bg-white/5 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-4">Recent Shipments</h3>
                      <div className="overflow-x-auto">
                        <table className="data-table text-sm">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Declaration</th>
                              <th>Product</th>
                              <th>Qty</th>
                              <th>FOB (USD)</th>
                              <th>FOB (INR)</th>
                              <th>Country</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailView.data.recentShipments?.slice(0, 20).map((s, i) => (
                              <tr key={i}>
                                <td className="text-amber-400 whitespace-nowrap">{s.shipment_date || 'N/A'}</td>
                                <td className="font-mono text-xs">{s.declaration_id}</td>
                                <td className="max-w-xs truncate" title={s.product_description}>
                                  {s.product_description?.substring(0, 40)}...
                                </td>
                                <td>{formatNumber(Math.round(s.quantity || 0))} {s.unit}</td>
                                <td className="text-emerald-400 font-mono">{formatCurrency(s.fob_value)}</td>
                                <td className="text-amber-400 font-mono">{formatINR(s.fob_value)}</td>
                                <td>{s.country_of_destination}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(!detailView.data.recentShipments || detailView.data.recentShipments.length === 0) && (
                          <p className="text-slate-500 text-center py-4">No shipment data available</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Intelligence Tab */}
          {activeTab === 'intelligence' && (
            <div className="space-y-6 animate-fade-in">
              {/* Intelligence Header */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-amber-500/20">
                    <Lightbulb className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Business Intelligence</h3>
                    <p className="text-sm text-slate-400">
                      AI-powered insights to find new opportunities for {companyName}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={fetchProspectiveClients} 
                    className="btn-primary"
                    disabled={loadingIntelligence}
                  >
                    <UserPlus className="w-4 h-4" />
                    Find Prospective Clients
                  </button>
                  <button 
                    onClick={fetchCrossSellData} 
                    className="btn-secondary"
                    disabled={loadingIntelligence}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Cross-Sell Analysis
                  </button>
                </div>
              </div>

              {loadingIntelligence && (
                <div className="glass-card rounded-xl p-12 flex justify-center">
                  <div className="spinner"></div>
                </div>
              )}

              {/* Prospective Clients Results */}
              {prospectiveClients && !loadingIntelligence && (
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        🎯 Prospective Clients for {prospectiveClients.companyName}
                      </h3>
                      <p className="text-sm text-slate-400">
                        These buyers purchase products similar to yours but from other exporters.
                        Based on {prospectiveClients.companyProducts?.length || 0} products you export.
                      </p>
                    </div>
                    {prospectiveClients.prospectiveClients?.length > 0 && (
                      <button onClick={exportProspectiveClientsToExcel} className="btn-primary text-sm">
                        <FileSpreadsheet className="w-4 h-4" />
                        Export to Excel
                      </button>
                    )}
                  </div>
                  
                  {prospectiveClients.message && (
                    <div className="p-4 bg-amber-500/20 rounded-lg text-amber-300 mb-4">
                      {prospectiveClients.message}
                    </div>
                  )}

                  {prospectiveClients.prospectiveClients?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Potential Client</th>
                            <th>Country</th>
                            <th>Shipments</th>
                            <th>Total FOB (USD)</th>
                            <th>Total FOB (INR)</th>
                            <th>Qty (KG)</th>
                            <th>Current Suppliers</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prospectiveClients.prospectiveClients.slice(0, 50).map((client, i) => (
                            <tr key={i}>
                              <td className="font-medium text-white">{formatName(client.consignee_name)}</td>
                              <td>{client.country_of_destination}</td>
                              <td>{client.total_shipments}</td>
                              <td className="text-emerald-400 font-mono">{formatCurrency(client.total_fob)}</td>
                              <td className="text-amber-400 font-mono">{formatINR(client.total_fob)}</td>
                              <td>{formatNumber(Math.round(client.total_quantity || 0))}</td>
                              <td className="text-xs text-slate-400 max-w-xs truncate" title={client.current_suppliers}>
                                {client.current_suppliers?.substring(0, 50)}...
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">
                      No prospective clients found. Make sure your company name is set correctly in Settings.
                    </p>
                  )}
                </div>
              )}

              {/* Cross-Sell Analysis Results */}
              {crossSellData && !loadingIntelligence && (
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        🛒 Cross-Sell Opportunities
                      </h3>
                      <p className="text-sm text-slate-400">
                        Products your {crossSellData.clientCount} existing clients buy from competitors that you don't supply.
                        These are upselling opportunities!
                      </p>
                    </div>
                    {crossSellData.crossSellOpportunities?.length > 0 && (
                      <button onClick={exportCrossSellToExcel} className="btn-primary text-sm">
                        <FileSpreadsheet className="w-4 h-4" />
                        Export to Excel
                      </button>
                    )}
                  </div>

                  {crossSellData.message && (
                    <div className="p-4 bg-amber-500/20 rounded-lg text-amber-300 mb-4">
                      {crossSellData.message}
                    </div>
                  )}

                  {crossSellData.crossSellOpportunities?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Your Client</th>
                            <th>Product They Buy</th>
                            <th>HS Code</th>
                            <th>Competitor Supplying</th>
                            <th>FOB (USD)</th>
                            <th>FOB (INR)</th>
                            <th>Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {crossSellData.crossSellOpportunities.slice(0, 50).map((opp, i) => (
                            <tr key={i} className="hover:bg-amber-500/10">
                              <td className="font-medium text-white">{formatName(opp.client_name)}</td>
                              <td className="max-w-xs truncate text-sm" title={opp.product_description}>
                                {opp.product_description?.substring(0, 40)}
                              </td>
                              <td className="font-mono text-xs">{opp.hs_code}</td>
                              <td className="text-rose-400">{opp.competitor}</td>
                              <td className="text-emerald-400 font-mono">{formatCurrency(opp.total_fob)}</td>
                              <td className="text-amber-400 font-mono">{formatINR(opp.total_fob)}</td>
                              <td>{formatNumber(Math.round(opp.total_quantity || 0))} {opp.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">
                      No cross-sell opportunities found. Your clients may already be buying everything from you!
                    </p>
                  )}
                </div>
              )}

              {!prospectiveClients && !crossSellData && !loadingIntelligence && (
                <div className="glass-card rounded-xl p-12 text-center">
                  <Lightbulb className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Get Started with Intelligence</h3>
                  <p className="text-slate-400 mb-6 max-w-md mx-auto">
                    Click one of the buttons above to analyze your market opportunities. 
                    Make sure your company name is set correctly in Settings for accurate results.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Monthly Comparison Tab */}
          {activeTab === 'monthly-comparison' && (
            <div className="space-y-6 animate-fade-in">
              {/* Month Selection */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-violet-500/20">
                    <TrendingUp className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Monthly Comparison Analysis</h3>
                    <p className="text-sm text-slate-400">
                      Compare current month with previous month for competitors and clients
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Current Month</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-4 py-2"
                    >
                      <option value="">Select Month</option>
                      {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <span className="text-slate-500 mt-6">vs</span>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Previous Month</label>
                    <select
                      value={compareMonth}
                      onChange={(e) => setCompareMonth(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-4 py-2"
                    >
                      <option value="">Select Month</option>
                      {months.filter(m => m !== selectedMonth).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={fetchMonthlyComparison}
                    className="btn-primary mt-6"
                    disabled={loadingMonthlyComparison || !selectedMonth || !compareMonth}
                  >
                    {loadingMonthlyComparison ? (
                      <div className="w-5 h-5 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Analyze
                      </>
                    )}
                  </button>
                  {monthlyComparisonData && (
                    <button onClick={exportMonthlyComparisonToExcel} className="btn-secondary mt-6">
                      <FileSpreadsheet className="w-4 h-4" />
                      Export Excel
                    </button>
                  )}
                </div>
              </div>

              {monthlyComparisonData && (
                <>
                  {/* Competitor Comparison */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      📊 Competitor Comparison: {selectedMonth} vs {compareMonth}
                    </h3>
                    {monthlyComparisonData.competitorComparison?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Competitor</th>
                              <th>Current Shipments</th>
                              <th>Prev Shipments</th>
                              <th>Change</th>
                              <th>Current FOB</th>
                              <th>Prev FOB</th>
                              <th>FOB Change</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyComparisonData.competitorComparison.map((comp, i) => (
                              <tr key={i} className={comp.isNew ? 'bg-emerald-500/10' : comp.isDropped ? 'bg-rose-500/10' : ''}>
                                <td className="font-medium text-white">{comp.name}</td>
                                <td>{comp.current?.shipments || 0}</td>
                                <td>{comp.previous?.shipments || 0}</td>
                                <td className={parseFloat(comp.shipmentChange) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                  {comp.shipmentChange ? `${comp.shipmentChange}%` : 'N/A'}
                                </td>
                                <td className="text-emerald-400 font-mono">{formatCurrency(comp.current?.total_fob)}</td>
                                <td className="text-slate-400 font-mono">{formatCurrency(comp.previous?.total_fob)}</td>
                                <td className={parseFloat(comp.fobChange) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                  {comp.fobChange ? `${comp.fobChange}%` : 'N/A'}
                                </td>
                                <td>
                                  {comp.isNew && <span className="badge badge-emerald">NEW</span>}
                                  {comp.isDropped && <span className="badge badge-rose">DROPPED</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No competitor data for comparison</p>
                    )}
                  </div>

                  {/* Client Comparison */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      👥 Client Comparison: {selectedMonth} vs {compareMonth}
                    </h3>
                    {monthlyComparisonData.clientComparison?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Client</th>
                              <th>Current Shipments</th>
                              <th>Prev Shipments</th>
                              <th>Change</th>
                              <th>Current FOB</th>
                              <th>Prev FOB</th>
                              <th>FOB Change</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyComparisonData.clientComparison.map((client, i) => (
                              <tr key={i} className={client.isNew ? 'bg-emerald-500/10' : ''}>
                                <td className="font-medium text-white">{formatName(client.name)}</td>
                                <td>{client.current?.shipments || 0}</td>
                                <td>{client.previous?.shipments || 0}</td>
                                <td className={parseFloat(client.shipmentChange) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                  {client.shipmentChange ? `${client.shipmentChange}%` : 'N/A'}
                                </td>
                                <td className="text-emerald-400 font-mono">{formatCurrency(client.current?.total_fob)}</td>
                                <td className="text-slate-400 font-mono">{formatCurrency(client.previous?.total_fob)}</td>
                                <td className={parseFloat(client.fobChange) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                  {client.fobChange ? `${client.fobChange}%` : 'N/A'}
                                </td>
                                <td>
                                  {client.isNew && <span className="badge badge-emerald">NEW</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No client data for comparison</p>
                    )}
                  </div>

                  {/* New Suppliers to Our Clients */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      ⚠️ New Competitors Supplying to Your Clients
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">
                      These suppliers started selling to your tracked clients in {selectedMonth}
                    </p>
                    {monthlyComparisonData.newSuppliersToClients?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Your Client</th>
                              <th>New Supplier (Competitor)</th>
                              <th>Shipments</th>
                              <th>FOB (USD)</th>
                              <th>FOB (INR)</th>
                              <th>Products</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyComparisonData.newSuppliersToClients.map((row, i) => (
                              <tr key={i} className="bg-amber-500/5">
                                <td className="font-medium text-white">{formatName(row.client)}</td>
                                <td className="text-rose-400">{row.new_supplier}</td>
                                <td>{row.shipments}</td>
                                <td className="text-emerald-400 font-mono">{formatCurrency(row.total_fob)}</td>
                                <td className="text-amber-400 font-mono">{formatINR(row.total_fob)}</td>
                                <td className="text-xs max-w-xs truncate">{row.products?.substring(0, 50)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No new competitor entries detected</p>
                    )}
                  </div>

                  {/* All New Supplier-Client Relationships */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      🔄 All New Supplier-Client Relationships
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">
                      New supplier-client combinations appearing in {selectedMonth} but not in {compareMonth}
                    </p>
                    {monthlyComparisonData.clientsNewSuppliers?.length > 0 ? (
                      <div className="overflow-x-auto max-h-96">
                        <table className="data-table text-sm">
                          <thead className="sticky top-0 bg-navy-900">
                            <tr>
                              <th>Client</th>
                              <th>New Supplier</th>
                              <th>Shipments</th>
                              <th>FOB (USD)</th>
                              <th>FOB (INR)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyComparisonData.clientsNewSuppliers.slice(0, 50).map((row, i) => (
                              <tr key={i}>
                                <td className="text-white">{formatName(row.client)}</td>
                                <td>{row.new_supplier}</td>
                                <td>{row.shipments}</td>
                                <td className="text-emerald-400 font-mono">{formatCurrency(row.total_fob)}</td>
                                <td className="text-amber-400 font-mono">{formatINR(row.total_fob)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No new relationships detected</p>
                    )}
                  </div>
                </>
              )}

              {/* Empty State */}
              {!monthlyComparisonData && !loadingMonthlyComparison && (
                <div className="glass-card rounded-xl p-12 text-center">
                  <TrendingUp className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Monthly Comparison</h3>
                  <p className="text-slate-400 mb-4 max-w-md mx-auto">
                    Select two months above to compare competitor and client activity. 
                    See who's growing, who's new, and track market changes.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Benchmarking Tab */}
          {activeTab === 'benchmarking' && (
            <div className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-amber-500/20">
                      <Target className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">AGNA Benchmarking</h3>
                      <p className="text-sm text-slate-400">
                        Compare {companyName} against competitors and analyze client vendor preferences
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={fetchBenchmarkData}
                      className="btn-primary"
                      disabled={loadingBenchmark}
                    >
                      {loadingBenchmark ? (
                        <div className="w-5 h-5 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Analyze
                        </>
                      )}
                    </button>
                    {benchmarkData && (
                      <button onClick={exportBenchmarkToExcel} className="btn-secondary">
                        <FileSpreadsheet className="w-4 h-4" />
                        Export Excel
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {benchmarkData && (
                <>
                  {/* Company Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                      icon={Ship}
                      label="Your Shipments"
                      value={formatNumber(benchmarkData.companyData?.shipments)}
                      color="gold"
                    />
                    <StatCard
                      icon={DollarSign}
                      label="Your FOB Value"
                      value={formatCurrency(benchmarkData.companyData?.total_fob)}
                      subValue={formatINR(benchmarkData.companyData?.total_fob)}
                      color="emerald"
                    />
                    <StatCard
                      icon={Globe}
                      label="Market Share"
                      value={`${benchmarkData.companyMarketShare}%`}
                      color="sky"
                    />
                    <StatCard
                      icon={Target}
                      label="Market Rank"
                      value={`#${benchmarkData.companyRank}`}
                      color="violet"
                    />
                  </div>

                  {/* Competitor Benchmark Table */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      📊 {companyName} vs Competitors
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Company</th>
                            <th>Shipments</th>
                            <th>FOB (USD)</th>
                            <th>FOB (INR)</th>
                            <th>Products</th>
                            <th>Countries</th>
                            <th>Clients</th>
                            <th>Avg/Shipment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Your company first */}
                          <tr className="bg-amber-500/20 border-l-4 border-amber-500">
                            <td className="font-bold text-amber-400">
                              {companyName} <span className="badge badge-gold ml-2">YOU</span>
                            </td>
                            <td className="font-bold">{formatNumber(benchmarkData.companyData?.shipments)}</td>
                            <td className="font-bold text-emerald-400">{formatCurrency(benchmarkData.companyData?.total_fob)}</td>
                            <td className="font-bold text-amber-400">{formatINR(benchmarkData.companyData?.total_fob)}</td>
                            <td className="font-bold">{benchmarkData.companyData?.products}</td>
                            <td className="font-bold">{benchmarkData.companyData?.countries}</td>
                            <td className="font-bold">{benchmarkData.companyData?.clients}</td>
                            <td className="font-bold">{formatCurrency(benchmarkData.companyData?.avg_fob_per_shipment)}</td>
                          </tr>
                          {/* Competitors */}
                          {benchmarkData.competitorBenchmark?.map((comp, i) => (
                            <tr key={i}>
                              <td className="text-white">{comp.name}</td>
                              <td>{formatNumber(comp.shipments)}</td>
                              <td className="text-emerald-400 font-mono">{formatCurrency(comp.total_fob)}</td>
                              <td className="text-amber-400 font-mono">{formatINR(comp.total_fob)}</td>
                              <td>{comp.products}</td>
                              <td>{comp.countries}</td>
                              <td>{comp.clients}</td>
                              <td className="font-mono">{formatCurrency(comp.avg_fob_per_shipment)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Benchmark Chart */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Market Position Chart</h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={[
                        { name: companyName, fob: benchmarkData.companyData?.total_fob || 0, isYou: true },
                        ...(benchmarkData.competitorBenchmark?.map(c => ({ name: c.name, fob: c.total_fob, isYou: false })) || [])
                      ].sort((a, b) => b.fob - a.fob)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                        <YAxis tickFormatter={formatCurrency} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="fob" name="FOB Value" radius={[4, 4, 0, 0]}>
                          {[{ name: companyName, fob: benchmarkData.companyData?.total_fob || 0, isYou: true },
                            ...(benchmarkData.competitorBenchmark?.map(c => ({ name: c.name, fob: c.total_fob, isYou: false })) || [])
                          ].sort((a, b) => b.fob - a.fob).map((entry, index) => (
                            <Cell key={index} fill={entry.isYou ? COLORS.gold : COLORS.sky} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Client Vendor Analysis */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      👥 Your Clients' Vendor Analysis
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">
                      How your clients split their business between you and competitors
                    </p>
                    {benchmarkData.clientVendorAnalysis?.length > 0 ? (
                      <div className="overflow-x-auto max-h-96">
                        <table className="data-table text-sm">
                          <thead className="sticky top-0 bg-navy-900">
                            <tr>
                              <th>Client</th>
                              <th>Vendor</th>
                              <th>Type</th>
                              <th>Shipments</th>
                              <th>FOB (USD)</th>
                              <th>FOB (INR)</th>
                              <th>Products</th>
                            </tr>
                          </thead>
                          <tbody>
                            {benchmarkData.clientVendorAnalysis.map((row, i) => (
                              <tr key={i} className={row.is_your_company ? 'bg-amber-500/10' : ''}>
                                <td className="text-white">{formatName(row.client)}</td>
                                <td className={row.is_your_company ? 'text-amber-400 font-medium' : 'text-slate-300'}>
                                  {row.vendor}
                                  {row.is_your_company === 1 && <span className="badge badge-gold ml-2">YOU</span>}
                                </td>
                                <td>
                                  <span className={`badge ${row.is_your_company ? 'badge-gold' : 'badge-sky'}`}>
                                    {row.is_your_company ? 'Your Company' : 'Competitor'}
                                  </span>
                                </td>
                                <td>{row.shipments}</td>
                                <td className="text-emerald-400 font-mono">{formatCurrency(row.total_fob)}</td>
                                <td className="text-amber-400 font-mono">{formatINR(row.total_fob)}</td>
                                <td>{row.products}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No client vendor data available</p>
                    )}
                  </div>
                </>
              )}

              {/* Empty State */}
              {!benchmarkData && !loadingBenchmark && (
                <div className="glass-card rounded-xl p-12 text-center">
                  <Target className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">AGNA Benchmarking</h3>
                  <p className="text-slate-400 mb-6 max-w-md mx-auto">
                    Click "Analyze" above to benchmark your company against competitors 
                    and see how your clients split their business.
                  </p>
                  <button onClick={fetchBenchmarkData} className="btn-primary">
                    <Target className="w-4 h-4" />
                    Start Benchmarking
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Custom Reports Tab */}
          {activeTab === 'custom-reports' && (
            <div className="space-y-6 animate-fade-in">
              {/* Filter Form */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-sky-500/20">
                    <FileSearch className="w-6 h-6 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Custom Report Generator</h3>
                    <p className="text-sm text-slate-400">
                      Generate detailed reports by selecting specific countries, exporters, or consignees
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Countries (comma separated)</label>
                    <input
                      type="text"
                      value={customReportFilters.countries}
                      onChange={(e) => setCustomReportFilters({...customReportFilters, countries: e.target.value})}
                      placeholder="e.g., USA, UK, UAE"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Exporters (comma separated)</label>
                    <input
                      type="text"
                      value={customReportFilters.exporters}
                      onChange={(e) => setCustomReportFilters({...customReportFilters, exporters: e.target.value})}
                      placeholder="e.g., AGNA, APEX"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Consignees (comma separated)</label>
                    <input
                      type="text"
                      value={customReportFilters.consignees}
                      onChange={(e) => setCustomReportFilters({...customReportFilters, consignees: e.target.value})}
                      placeholder="e.g., Fresh Foods, Global Trade"
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={fetchCustomReport} 
                    className="btn-primary"
                    disabled={loadingCustomReport}
                  >
                    {loadingCustomReport ? (
                      <div className="w-5 h-5 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Generate Report
                      </>
                    )}
                  </button>
                  {customReportData && (
                    <button onClick={exportCustomReportToExcel} className="btn-secondary">
                      <FileSpreadsheet className="w-4 h-4" />
                      Download Excel
                    </button>
                  )}
                </div>
              </div>

              {/* Report Results */}
              {customReportData && (
                <>
                  {/* Summary */}
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">📊 Summary</h3>
                    {customReportData.summary?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Entity</th>
                              <th>Shipments</th>
                              <th>Quantity</th>
                              <th>Products</th>
                              <th>FOB (USD)</th>
                              <th>FOB (INR)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customReportData.summary.map((row, i) => (
                              <tr key={i}>
                                <td className="font-medium text-white">{row.group_by || row.Entity}</td>
                                <td>{formatNumber(row.total_shipments || row['Total Shipments'])}</td>
                                <td>{formatNumber(Math.round(row.total_quantity || row['Total Quantity'] || 0))}</td>
                                <td>{row.total_products || row['Total Products']}</td>
                                <td className="text-emerald-400 font-mono">
                                  {formatCurrency(row.total_value || row['Total Value (USD)'])}
                                </td>
                                <td className="text-amber-400 font-mono">
                                  {formatINR(row.total_value || row['Total Value (USD)'])}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No summary data found</p>
                    )}
                  </div>

                  {/* Detailed Data */}
                  <div className="glass-card rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        📋 Detailed Shipments ({customReportData.details?.length || 0} records)
                      </h3>
                      <button onClick={exportCustomReportToExcel} className="btn-primary text-sm">
                        <FileSpreadsheet className="w-4 h-4" />
                        Export Full Data to Excel
                      </button>
                    </div>
                    {customReportData.details?.length > 0 ? (
                      <div className="overflow-x-auto max-h-96">
                        <table className="data-table text-sm">
                          <thead className="sticky top-0 bg-navy-900">
                            <tr>
                              <th>Date</th>
                              <th>Declaration</th>
                              <th>Exporter</th>
                              <th>Consignee</th>
                              <th>Product</th>
                              <th>Qty</th>
                              <th>FOB (USD)</th>
                              <th>FOB (INR)</th>
                              <th>Country</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customReportData.details.slice(0, 100).map((row, i) => (
                              <tr key={i}>
                                <td className="text-amber-400 whitespace-nowrap">{row['Shipment Date'] || 'N/A'}</td>
                                <td className="font-mono text-xs">{row['Declaration ID']}</td>
                                <td className="max-w-xs truncate">{row.Exporter}</td>
                                <td className="max-w-xs truncate">{formatName(row.Consignee)}</td>
                                <td className="max-w-xs truncate" title={row.Product}>{row.Product?.substring(0, 30)}</td>
                                <td>{formatNumber(Math.round(row.Quantity || 0))} {row.Unit}</td>
                                <td className="text-emerald-400 font-mono">{formatCurrency(row['FOB Value (USD)'])}</td>
                                <td className="text-amber-400 font-mono">{formatINR(row['FOB Value (USD)'])}</td>
                                <td>{row.Country}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {customReportData.details.length > 100 && (
                          <p className="text-slate-500 text-sm text-center mt-4">
                            Showing first 100 records. Download Excel for full data.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-8">No detailed data found</p>
                    )}
                  </div>
                </>
              )}

              {/* Empty State */}
              {!customReportData && !loadingCustomReport && (
                <div className="glass-card rounded-xl p-12 text-center">
                  <FileSearch className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Generate Custom Reports</h3>
                  <p className="text-slate-400 mb-6 max-w-md mx-auto">
                    Enter countries, exporters, or consignees above to generate a detailed report. 
                    You can filter by any combination of these fields.
                  </p>
                  <div className="text-sm text-slate-500">
                    <p>Examples:</p>
                    <p className="mt-2">• Countries: <span className="text-amber-400">USA, UK, UAE</span></p>
                    <p>• Exporters: <span className="text-amber-400">AGNA, APEX AGRO</span></p>
                    <p>• Consignees: <span className="text-amber-400">FRESH FOODS, GLOBAL</span></p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              {/* Company Settings */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Company Settings</h3>
                {isDemo && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-200/80 text-xs">Settings are read-only in demo mode.</span>
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Your Company Name</label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => !isDemo && setCompanyName(e.target.value)}
                        placeholder="Enter your company name"
                        className={`flex-1 ${isDemo ? 'opacity-60 cursor-not-allowed' : ''}`}
                        readOnly={isDemo}
                      />
                      <button onClick={handleUpdateCompany} className={`btn-primary ${isDemo ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isDemo}>
                        Save
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      This name will be used to match and highlight your company's data in the exports
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Summary */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Data Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-2xl font-bold text-amber-400">{competitors.length}</p>
                    <p className="text-sm text-slate-400">Tracked Competitors</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-2xl font-bold text-emerald-400">{clients.length}</p>
                    <p className="text-sm text-slate-400">Tracked Clients</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-2xl font-bold text-sky-400">{months.length}</p>
                    <p className="text-sm text-slate-400">Months of Data</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-2xl font-bold text-violet-400">
                      {formatNumber(dashboardData?.summary?.total_shipments || 0)}
                    </p>
                    <p className="text-sm text-slate-400">Total Records</p>
                  </div>
                </div>
              </div>

              {/* Change Password - hidden for demo */}
              {!isDemo && <ChangePassword />}

              {/* About */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">About EDE</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Export Data Explorer (EDE) is a comprehensive trade intelligence platform for analyzing 
                  Indian export data. Track your competitors, monitor client activity, and gain insights 
                  into market trends with detailed analytics and visualizations.
                </p>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-slate-500">Version 1.0.0</p>
                </div>
              </div>
            </div>
          )}

          {/* Data Management Tab (Admin Only) */}
          {activeTab === 'data-management' && currentUser?.role === 'admin' && (
            <DataManagement />
          )}

          {/* Users Tab (Admin Only) */}
          {activeTab === 'users' && currentUser?.role === 'admin' && (
            <div className="animate-fade-in">
              <UserManagement currentUser={currentUser} />
            </div>
          )}
        </div>

        {/* Feedback Button */}
        <button
          onClick={() => setShowFeedback(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-amber-500 to-amber-600 text-navy-950 p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all z-40"
          title="Send Feedback"
        >
          <MessageSquare className="w-6 h-6" />
        </button>

        {/* Feedback Modal */}
        {showFeedback && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-xl w-full max-w-md animate-scale-in">
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-bold text-white">Send Feedback</h2>
                <button onClick={() => setShowFeedback(false)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={submitFeedback} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Your Name (optional)</label>
                  <input
                    type="text"
                    value={feedbackData.user_name}
                    onChange={(e) => setFeedbackData({...feedbackData, user_name: e.target.value})}
                    placeholder="Enter your name"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Feedback Type</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'bug', icon: Bug, label: 'Bug', color: 'rose' },
                      { value: 'suggestion', icon: Sparkles, label: 'Suggestion', color: 'amber' },
                      { value: 'question', icon: HelpCircle, label: 'Question', color: 'sky' },
                    ].map(type => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFeedbackData({...feedbackData, feedback_type: type.value})}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                          feedbackData.feedback_type === type.value
                            ? `bg-${type.color}-500/20 border-${type.color}-500 text-${type.color}-400`
                            : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Message *</label>
                  <textarea
                    value={feedbackData.message}
                    onChange={(e) => setFeedbackData({...feedbackData, message: e.target.value})}
                    placeholder="Describe your feedback, bug, or question..."
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={feedbackSubmitting || !feedbackData.message.trim()}
                  className="btn-primary w-full justify-center"
                >
                  {feedbackSubmitting ? (
                    <div className="w-5 h-5 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Feedback
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Feedback Button Component (floating)
const FeedbackButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className="fixed bottom-6 right-6 bg-gradient-to-r from-amber-500 to-amber-600 text-navy-950 p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all z-40"
    title="Send Feedback"
  >
    <MessageSquare className="w-6 h-6" />
  </button>
);

export default App;

