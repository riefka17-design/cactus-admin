

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  CreditCard,
  Ticket,
  Settings,
  ChevronRight,
  Search,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Check,
  X,
  TrendingUp,
  Clock,
  RefreshCw,
  Menu,
  X as CloseIcon,
  AlertTriangle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';

// Types
type Page = 'dashboard' | 'workshops' | 'registrations' | 'payments' | 'tickets' | 'settings';

interface Workshop {
  id: string;
  title: string;
  description: string;
  theme: string;
  emoji: string;
  date: string;
  deadline: string;
  time_start: string;
  time_end: string;
  location: string;
  instructor: string;
  price: number;
  seats_total: number;
  seats_taken: number;
  difficulty: string;
  color: string;
  is_active: boolean;
}

interface Registration {
  id: string;
  registration_number: string;
  user_id: string;
  workshop_id: string;
  full_name: string;
  nickname: string;
  email: string;
  phone: string;
  university: string;
  faculty: string;
  character_name: string;
  status: string;
  created_at: string;
  workshop?: Workshop;
}

interface Payment {
  id: string;
  registration_id: string;
  user_id: string;
  method: string;
  amount: number;
  proof_url: string;
  proof_data: string;
  status: string;
  verified_at: string;
  rejection_reason: string;
  created_at: string;
  registration?: Registration;
}

interface Ticket {
  id: string;
  registration_id: string;
  user_id: string;
  ticket_number: string;
  qr_code: string;
  is_used: boolean;
  used_at: string;
  created_at: string;
  registration?: Registration;
}

// Admin color theme (extending CACTUS)
const adminColors = {
  primary: '#6b9460',
  primaryLight: '#9cbf8e',
  primaryDark: '#4e7248',
  accent: '#f0c060',
  accentDark: '#d9a030',
  danger: '#c0392b',
  dangerLight: '#e74c3c',
  ink: '#5a3e2b',
  inkSoft: '#8a6a52',
  inkLight: '#b89a82',
  cream: '#fdf8ef',
  ivory: '#f9f2e3',
  parchment: '#f3e9d2',
  paper: '#faf5e8',
  sage: '#9cbf8e',
  sageLight: '#c8dbc0',
  sageDark: '#6b9460',
  pink: '#f5c5bb',
  pinkLight: '#fde8e4',
  blue: '#b5cfe0',
  blueLight: '#dceaf4',
  honey: '#f0c060',
  border: '#ddd0b8',
};

// Safe string helpers to prevent crashes
const safeString = (val: unknown, fallback = ''): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  return String(val);
};

const safeLower = (val: unknown): string => {
  return safeString(val).toLowerCase();
};

const safeFirstChar = (val: unknown): string => {
  const str = safeString(val);
  return str.length > 0 ? str[0] : '?';
};

const safeDate = (val: unknown): Date | null => {
  if (!val) return null;
  try {
    const date = new Date(val as string);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
};

const safeDateStr = (val: unknown, opts?: Intl.DateTimeFormatOptions): string => {
  const date = safeDate(val);
  if (!date) return 'Invalid date';
  return date.toLocaleDateString('en-US', opts);
};

const safeNumber = (val: unknown, fallback = 0): number => {
  if (val === null || val === undefined) return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

const safePercent = (num: number, denom: number): number => {
  if (!denom || denom === 0) return 0;
  return Math.round((num / denom) * 100);
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data state
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [workshopFilter, setWorkshopFilter] = useState('');
  const [registrationFilter, setRegistrationFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [ticketFilter, setTicketFilter] = useState('');

  // Modal state
  const [showWorkshopModal, setShowWorkshopModal] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const [viewingRegistration, setViewingRegistration] = useState<Registration | null>(null);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  // Stats calculation - with safe number operations
  const stats = useMemo(() => {
    const safeWorkshops = workshops || [];
    const safeRegistrations = registrations || [];
    const safePayments = payments || [];
    const safeTickets = tickets || [];

    const totalRevenue = safePayments
      .filter(p => p.status === 'verified')
      .reduce((sum, p) => sum + safeNumber(p.amount, 0), 0);
    const pendingPayments = safePayments.filter(p => p.status === 'waiting').length;
    const verifiedPayments = safePayments.filter(p => p.status === 'verified').length;
    const totalSeats = safeWorkshops.reduce((sum, w) => sum + safeNumber(w.seats_total, 0), 0);
    const takenSeats = safeWorkshops.reduce((sum, w) => sum + safeNumber(w.seats_taken, 0), 0);
    const checkedIn = safeTickets.filter(t => t.is_used).length;

    return {
      totalWorkshops: safeWorkshops.length,
      activeWorkshops: safeWorkshops.filter(w => w.is_active).length,
      totalRegistrations: safeRegistrations.length,
      pendingRegistrations: safeRegistrations.filter(r => r.status === 'pending').length,
      confirmedRegistrations: safeRegistrations.filter(r => r.status === 'confirmed').length,
      totalRevenue,
      pendingPayments,
      verifiedPayments,
      totalSeats,
      takenSeats,
      occupancyRate: safePercent(takenSeats, totalSeats),
      totalTickets: safeTickets.length,
      checkedIn,
      checkInRate: safePercent(checkedIn, safeTickets.length),
    };
  }, [workshops, registrations, payments, tickets]);

  // Fetch all data
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    // Check if Supabase is configured
    if (!isSupabaseConfigured) {
      console.warn('[App] Supabase not configured - running in offline mode');
      setFetchError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
      setLoading(false);
      return;
    }

    try {
      console.log('[App] Fetching data from Supabase...');

      // Fetch each table individually with error handling for each
      const [workshopsRes, registrationsRes, paymentsRes, ticketsRes] = await Promise.all([
      supabase.from('workshops').select('*'),
      supabase.from('registrations').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('tickets').select('*'),
      ]);

      // Log any errors from individual queries
      if (workshopsRes.error) {
        console.error('[App] Workshops fetch error:', workshopsRes.error);
      }
      if (registrationsRes.error) {
        console.error('[App] Registrations fetch error:', registrationsRes.error);
      }
      if (paymentsRes.error) {
        console.error('[App] Payments fetch error:', paymentsRes.error);
      }
      if (ticketsRes.error) {
        console.error('[App] Tickets fetch error:', ticketsRes.error);
      }

      // Set data with fallbacks to empty arrays
      setWorkshops(workshopsRes.data || []);
      setRegistrations(registrationsRes.data || []);
      setPayments(paymentsRes.data || []);
      setTickets(ticketsRes.data || []);

      console.log('[App] Data fetched successfully:', {
        workshops: workshopsRes.data?.length || 0,
        registrations: registrationsRes.data?.length || 0,
        payments: paymentsRes.data?.length || 0,
        tickets: ticketsRes.data?.length || 0,
      });
    } catch (error) {
      console.error('[App] Error fetching data:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch data from server');
      // Ensure all arrays have fallbacks even on error
      setWorkshops([]);
      setRegistrations([]);
      setPayments([]);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Filtered data - with safe string operations
  const filteredWorkshops = useMemo(() => {
    if (!workshopFilter) return workshops;
    const filter = workshopFilter.toLowerCase();
    return workshops.filter(w =>
      safeLower(w.title).includes(filter) ||
      safeLower(w.theme).includes(filter) ||
      safeLower(w.instructor).includes(filter)
    );
  }, [workshops, workshopFilter]);

  const filteredRegistrations = useMemo(() => {
    if (!registrationFilter) return registrations;
    const filter = registrationFilter.toLowerCase();
    return registrations.filter(r =>
      safeLower(r.full_name).includes(filter) ||
      safeLower(r.email).includes(filter) ||
      safeLower(r.registration_number).includes(filter)
    );
  }, [registrations, registrationFilter]);

  const filteredPayments = useMemo(() => {
    if (!paymentFilter) return payments;
    return payments.filter(p => p.status === paymentFilter);
  }, [payments, paymentFilter]);

  const filteredTickets = useMemo(() => {
    if (!ticketFilter) return tickets;
    const filter = ticketFilter.toLowerCase();
    return tickets.filter(t => safeLower(t.ticket_number).includes(filter));
  }, [tickets, ticketFilter]);

  // Actions
  const handleVerifyPayment = async (paymentId: string, approve: boolean, reason?: string) => {
    try {
      const updates: Record<string, unknown> = {
        status: approve ? 'verified' : 'rejected',
        verified_at: new Date().toISOString(),
      };
      if (!approve && reason) {
        updates.rejection_reason = reason;
      }
      const { error } = await supabase
  .from('payments')
  .update(updates)
  .eq('id', paymentId);

if (error) {
  console.error('PAYMENT UPDATE ERROR:', error);
  alert(error.message);
  return;
}
      await fetchAllData();
    } catch (error) {
      console.error('Error updating payment:', error);
    }
  };

  const handleCheckIn = async (ticketId: string) => {
    try {
const { error } = await supabase
  .from('tickets')
  .update({
    is_used: true,
    used_at: new Date().toISOString(),
  })
  .eq('id', ticketId);
  if (error)
    { console.error('CHECKIN ERROR:', error);
      alert(error.message);
      return;}
  await fetchAllData();
    } catch (error) {
      console.error('Error checking in:', error);
    }
  };

  const handleDeleteWorkshop = async (workshopId: string) => {
    if (!confirm('Are you sure you want to delete this workshop?')) return;
    try {
      const { error } = await supabase
  .from('workshops')
  .delete()
  .eq('id', workshopId);

if (error) {
  console.error('DELETE ERROR:', error);
  alert(error.message);
  return;
}
      await fetchAllData();
    } catch (error) {
      console.error('Error deleting workshop:', error);
    }
  };

  const navItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'workshops' as Page, label: 'Workshops', icon: CalendarDays },
    { id: 'registrations' as Page, label: 'Registrations', icon: Users },
    { id: 'payments' as Page, label: 'Payments', icon: CreditCard },
    { id: 'tickets' as Page, label: 'Check-In', icon: Ticket },
    { id: 'settings' as Page, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen" style={{ background: adminColors.cream }}>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-between backdrop-blur-xl border-b" style={{ background: 'rgba(253,248,239,0.95)', borderColor: adminColors.border }}>
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-xl hover:bg-[#f3e9d2] transition-colors">
          <Menu size={24} style={{ color: adminColors.ink }} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${adminColors.sageLight}, ${adminColors.sage})` }}>
            <span className="text-xs font-bold" style={{ color: adminColors.primaryDark }}>AD</span>
          </div>
          <span className="font-bold text-sm" style={{ color: adminColors.ink }}>CACTUS Admin</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 p-4" style={{ background: adminColors.ivory }}>
            <div className="flex justify-end mb-4">
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-xl hover:bg-[#f3e9d2]">
                <CloseIcon size={24} style={{ color: adminColors.ink }} />
              </button>
            </div>
            <nav className="flex flex-col gap-2">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setCurrentPage(item.id); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left font-semibold transition-all"
                  style={{
                    background: currentPage === item.id ? `linear-gradient(135deg, ${adminColors.sage}, ${adminColors.primaryDark})` : 'transparent',
                    color: currentPage === item.id ? '#fff' : adminColors.inkSoft,
                  }}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Sidebar - Desktop */}
      <aside
        className="hidden lg:block fixed left-0 top-0 bottom-0 z-40 transition-all duration-300"
        style={{
          width: sidebarOpen ? '260px' : '80px',
          background: adminColors.ivory,
          borderRight: `1.5px solid ${adminColors.border}`,
        }}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${adminColors.sageLight}, ${adminColors.sage})` }}
          >
            <span className="font-bold text-sm" style={{ color: adminColors.primaryDark }}>AD</span>
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="font-bold text-sm" style={{ color: adminColors.ink }}>CACTUS</p>
              <p className="text-xs" style={{ color: adminColors.inkSoft }}>Admin Dashboard</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="px-3 mt-4 flex flex-col gap-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all group"
              style={{
                background: currentPage === item.id
                  ? `linear-gradient(135deg, ${adminColors.sage}, ${adminColors.primaryDark})`
                  : 'transparent',
                color: currentPage === item.id ? '#fff' : adminColors.inkSoft,
              }}
            >
              <item.icon size={20} className="flex-shrink-0" />
              {sidebarOpen && <span className="font-semibold text-sm">{item.label}</span>}
              {currentPage === item.id && sidebarOpen && (
                <ChevronRight size={16} className="ml-auto" />
              )}
            </button>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 p-2 rounded-xl transition-colors"
          style={{ background: adminColors.parchment, color: adminColors.inkSoft }}
        >
          <ChevronRight size={18} className={`transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
        </button>

        {/* User */}
        <div className="absolute bottom-4 left-3 right-3 p-3 rounded-xl" style={{ background: adminColors.parchment }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: adminColors.pink }}
            >
              <span style={{ color: adminColors.ink }}>A</span>
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="font-semibold text-sm truncate" style={{ color: adminColors.ink }}>Admin User</p>
                <p className="text-xs truncate" style={{ color: adminColors.inkLight }}>admin@cactus.id</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className="transition-all duration-300 pt-16 lg:pt-0"
        style={{ marginLeft: sidebarOpen ? '260px' : '80px' }}
      >
        {/* Top Bar */}
        <header className="sticky top-0 lg:top-4 z-30 mx-4 lg:mx-6 lg:my-4 px-4 lg:px-6 py-3 lg:py-4 rounded-2xl backdrop-blur-xl flex items-center justify-between"
          style={{
            background: 'rgba(253,248,239,0.90)',
            border: `1.5px solid ${adminColors.border}`,
            boxShadow: '0 4px 14px rgba(100,70,40,0.12)',
          }}
        >
          <div>
            <h1 className="font-bold text-lg lg:text-xl" style={{ color: adminColors.ink }}>
              {navItems.find(n => n.id === currentPage)?.label}
            </h1>
            <p className="text-xs lg:text-sm" style={{ color: adminColors.inkSoft }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAllData}
              className="p-2.5 rounded-xl transition-colors"
              style={{ background: adminColors.parchment, color: adminColors.inkSoft }}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="px-4 lg:px-6 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-12 h-12 rounded-full animate-spin border-4 border-t-4"
                style={{ borderColor: adminColors.sageLight, borderTopColor: adminColors.sage }}
              />
            </div>
          ) : fetchError ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-md p-6 rounded-2xl" style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}` }}>
                <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: adminColors.danger }} />
                <h2 className="font-bold text-lg mb-2" style={{ color: adminColors.ink }}>Connection Error</h2>
                <p className="text-sm mb-4" style={{ color: adminColors.inkSoft }}>{fetchError}</p>
                <button
                  onClick={fetchAllData}
                  className="px-4 py-2 rounded-xl font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${adminColors.sage}, ${adminColors.primaryDark})` }}
                >
                  Retry Connection
                </button>
              </div>
            </div>
          ) : (
            <>
              {currentPage === 'dashboard' && <DashboardPage stats={stats} workshops={workshops} payments={payments} registrations={registrations} />}
              {currentPage === 'workshops' && (
                <WorkshopsPage
                  workshops={filteredWorkshops}
                  filter={workshopFilter}
                  setFilter={setWorkshopFilter}
                  onEdit={(w) => { setEditingWorkshop(w); setShowWorkshopModal(true); }}
                  onDelete={handleDeleteWorkshop}
                  onAdd={() => { setEditingWorkshop(null); setShowWorkshopModal(true); }}
                />
              )}
              {currentPage === 'registrations' && (
                <RegistrationsPage
                  registrations={filteredRegistrations}
                  filter={registrationFilter}
                  setFilter={setRegistrationFilter}
                  onView={setViewingRegistration}
                />
              )}
              {currentPage === 'payments' && (
                <PaymentsPage
                  payments={filteredPayments}
                  filter={paymentFilter}
                  setFilter={setPaymentFilter}
                  onView={setViewingPayment}
                  onVerify={handleVerifyPayment}
                />
              )}
              {currentPage === 'tickets' && (
                <TicketsPage
                  tickets={filteredTickets}
                  filter={ticketFilter}
                  setFilter={setTicketFilter}
                  onCheckIn={handleCheckIn}
                />
              )}
              {currentPage === 'settings' && <SettingsPage />}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      {showWorkshopModal && (
        <WorkshopModal
          workshop={editingWorkshop}
          onClose={() => { setShowWorkshopModal(false); setEditingWorkshop(null); }}
          onSave={fetchAllData}
        />
      )}

      {viewingRegistration && (
        <RegistrationModal
          registration={viewingRegistration}
          onClose={() => setViewingRegistration(null)}
        />
      )}

      {viewingPayment && (
        <PaymentModal
          payment={viewingPayment}
          onClose={() => setViewingPayment(null)}
          onVerify={handleVerifyPayment}
        />
      )}
    </div>
  );
}

// Dashboard Page
function DashboardPage({ stats, workshops, payments, registrations }: {
  stats: Record<string, number>;
  workshops: Workshop[];
  payments: Payment[];
  registrations: Registration[];
}) {
  const recentPayments = (payments || []).slice(0, 5);
  const recentRegistrations = (registrations || []).slice(0, 5);
  const upcomingWorkshops = (workshops || [])
    .filter(w => {
      const date = safeDate(w.date);
      return date ? date >= new Date() : false;
    })
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Workshops"
          value={stats.totalWorkshops}
          subtitle={`${stats.activeWorkshops} active`}
          color={adminColors.sage}
          icon={<CalendarDays size={22} />}
        />
        <StatCard
          title="Registrations"
          value={stats.totalRegistrations}
          subtitle={`${stats.confirmedRegistrations} confirmed`}
          color={adminColors.blue}
          icon={<Users size={22} />}
        />
        <StatCard
          title="Revenue"
          value={`Rp ${(stats.totalRevenue / 1000).toFixed(0)}k`}
          subtitle={`${stats.pendingPayments} pending`}
          color={adminColors.honey}
          icon={<TrendingUp size={22} />}
        />
        <StatCard
          title="Check-Ins"
          value={`${stats.checkInRate}%`}
          subtitle={`${stats.checkedIn}/${stats.totalTickets}`}
          color={adminColors.primary}
          icon={<Ticket size={22} />}
        />
      </div>

      {/* Occupancy Bar */}
      <div className="p-5 rounded-2xl" style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold" style={{ color: adminColors.ink }}>Overall Occupancy</span>
          <span className="font-bold text-2xl" style={{ color: adminColors.primaryDark }}>{stats.occupancyRate}%</span>
        </div>
        <div className="h-4 rounded-full overflow-hidden" style={{ background: adminColors.parchment }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${stats.occupancyRate}%`,
              background: `linear-gradient(90deg, ${adminColors.sage}, ${adminColors.primaryDark})`,
            }}
          />
        </div>
        <p className="mt-2 text-sm" style={{ color: adminColors.inkSoft }}>
          {stats.takenSeats} of {stats.totalSeats} seats filled
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Workshops */}
        <div className="p-5 rounded-2xl" style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}` }}>
          <h3 className="font-bold mb-4" style={{ color: adminColors.ink }}>Upcoming Workshops</h3>
          <div className="space-y-3">
            {upcomingWorkshops.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: adminColors.inkLight }}>No upcoming workshops</p>
            ) : (
              upcomingWorkshops.map(w => (
                <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: adminColors.parchment }}>
                  <span className="text-2xl">{safeString(w.emoji, '')}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: adminColors.ink }}>{safeString(w.title)}</p>
                    <p className="text-sm" style={{ color: adminColors.inkSoft }}>
                      {safeDateStr(w.date)} - {safeNumber(w.seats_taken)}/{safeNumber(w.seats_total)} seats
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="p-5 rounded-2xl" style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}` }}>
          <h3 className="font-bold mb-4" style={{ color: adminColors.ink }}>Recent Payments</h3>
          <div className="space-y-3">
            {recentPayments.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: adminColors.inkLight }}>No payments yet</p>
            ) : (
              recentPayments.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: adminColors.parchment }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: p.status === 'verified' ? adminColors.sageLight : p.status === 'rejected' ? adminColors.pinkLight : adminColors.blueLight }}>
                    <CreditCard size={18} style={{ color: p.status === 'verified' ? adminColors.primaryDark : adminColors.ink }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-sm" style={{ color: adminColors.ink }}>
                      Rp {safeNumber(p.amount, 0).toLocaleString()}
                    </p>
                    <p className="text-xs" style={{ color: adminColors.inkSoft }}>
                      {safeString(p.registration?.full_name, 'Unknown')}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: p.status === 'verified' ? adminColors.sageLight : p.status === 'rejected' ? adminColors.pinkLight : adminColors.parchment,
                      color: p.status === 'verified' ? adminColors.primaryDark : p.status === 'rejected' ? adminColors.danger : adminColors.ink,
                    }}>
                    {safeString(p.status)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Registrations */}
      <div className="p-5 rounded-2xl" style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}` }}>
        <h3 className="font-bold mb-4" style={{ color: adminColors.ink }}>Recent Registrations</h3>
        <div className="space-y-3">
          {recentRegistrations.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: adminColors.inkLight }}>No registrations yet</p>
          ) : (
            recentRegistrations.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: adminColors.parchment }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: adminColors.sageLight }}>
                  <span className="font-bold text-sm" style={{ color: adminColors.primaryDark }}>{safeFirstChar(r.full_name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-sm" style={{ color: adminColors.ink }}>{safeString(r.full_name)}</p>
                  <p className="text-xs" style={{ color: adminColors.inkSoft }}>{safeString(r.workshop?.title, 'Unknown workshop')}</p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: r.status === 'confirmed' ? adminColors.sageLight : r.status === 'cancelled' ? adminColors.pinkLight : adminColors.parchment,
                    color: r.status === 'confirmed' ? adminColors.primaryDark : adminColors.ink,
                  }}>
                  {safeString(r.status)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, color, icon }: { title: string; value: string | number; subtitle: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="p-5 rounded-2xl" style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}` }}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl" style={{ background: `${color}20`, color }}>{icon}</div>
      </div>
      <p className="font-bold text-2xl mb-1" style={{ color: adminColors.ink }}>{value}</p>
      <p className="text-sm font-semibold" style={{ color: adminColors.inkSoft }}>{title}</p>
      <p className="text-xs mt-1" style={{ color: adminColors.inkLight }}>{subtitle}</p>
    </div>
  );
}

// Workshops Page
function WorkshopsPage({ workshops, filter, setFilter, onEdit, onDelete, onAdd }: {
  workshops: Workshop[];
  filter: string;
  setFilter: (f: string) => void;
  onEdit: (w: Workshop) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: adminColors.inkLight }} />
          <input
            type="text"
            placeholder="Search workshops..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl text-sm"
            style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
          />
        </div>
        <button
          onClick={onAdd}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white transition-all hover:translate-y-[-2px]"
          style={{ background: `linear-gradient(135deg, ${adminColors.sage}, ${adminColors.primaryDark})`, boxShadow: `0 4px 14px ${adminColors.primary}40` }}
        >
          <Plus size={18} />
          Add Workshop
        </button>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workshops.map(workshop => {
          const seatsTaken = safeNumber(workshop.seats_taken, 0);
          const seatsTotal = safeNumber(workshop.seats_total, 1);
          const seatPercent = safePercent(seatsTaken, seatsTotal);

          return (
          <div key={workshop.id} className="rounded-2xl overflow-hidden" style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}` }}>
            <div className="h-2" style={{ background: safeString(workshop.color, adminColors.sageLight) }} />
            <div className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">{safeString(workshop.emoji, '')}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate" style={{ color: adminColors.ink }}>{safeString(workshop.title)}</h3>
                  <p className="text-sm" style={{ color: adminColors.inkSoft }}>{safeString(workshop.theme)}</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays size={14} style={{ color: adminColors.inkLight }} />
                  <span style={{ color: adminColors.inkSoft }}>{safeDateStr(workshop.date)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={14} style={{ color: adminColors.inkLight }} />
                  <span style={{ color: adminColors.inkSoft }}>{safeString(workshop.time_start)} - {safeString(workshop.time_end)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users size={14} style={{ color: adminColors.inkLight }} />
                  <span style={{ color: adminColors.inkSoft }}>{seatsTaken}/{seatsTotal} seats</span>
                </div>
              </div>
              {/* Seats bar */}
              <div className="mb-4">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: adminColors.parchment }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${seatPercent}%`,
                      background: adminColors.sage,
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold" style={{ color: adminColors.ink }}>
                  Rp {safeNumber(workshop.price, 0).toLocaleString()}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(workshop)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ background: adminColors.parchment, color: adminColors.inkSoft }}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(workshop.id)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ background: adminColors.pinkLight, color: adminColors.danger }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {workshops.length === 0 && (
        <div className="text-center py-12">
          <CalendarDays size={48} className="mx-auto mb-4" style={{ color: adminColors.inkLight }} />
          <p className="font-semibold" style={{ color: adminColors.inkSoft }}>No workshops found</p>
        </div>
      )}
    </div>
  );
}

// Registrations Page
function RegistrationsPage({ registrations, filter, setFilter, onView }: {
  registrations: Registration[];
  filter: string;
  setFilter: (f: string) => void;
  onView: (r: Registration) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: adminColors.inkLight }} />
        <input
          type="text"
          placeholder="Search by name, email, or registration number..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl text-sm"
          style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}` }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: adminColors.parchment }}>
                <th className="text-left px-5 py-4 font-semibold" style={{ color: adminColors.ink }}>Reg. Number</th>
                <th className="text-left px-5 py-4 font-semibold" style={{ color: adminColors.ink }}>Participant</th>
                <th className="text-left px-5 py-4 font-semibold hidden md:table-cell" style={{ color: adminColors.ink }}>Workshop</th>
                <th className="text-left px-5 py-4 font-semibold hidden lg:table-cell" style={{ color: adminColors.ink }}>University</th>
                <th className="text-left px-5 py-4 font-semibold" style={{ color: adminColors.ink }}>Status</th>
                <th className="text-left px-5 py-4 font-semibold" style={{ color: adminColors.ink }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map(reg => (
                <tr key={reg.id} className="border-t" style={{ borderColor: adminColors.border }}>
                  <td className="px-5 py-4 font-mono text-xs" style={{ color: adminColors.inkSoft }}>{safeString(reg.registration_number)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: adminColors.sageLight }}>
                        <span className="font-semibold text-xs" style={{ color: adminColors.primaryDark }}>{safeFirstChar(reg.full_name)}</span>
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: adminColors.ink }}>{safeString(reg.full_name)}</p>
                        <p className="text-xs" style={{ color: adminColors.inkLight }}>{safeString(reg.email)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell" style={{ color: adminColors.inkSoft }}>
                    <span className="mr-2">{safeString(reg.workshop?.emoji)}</span>
                    {safeString(reg.workshop?.title)}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell" style={{ color: adminColors.inkSoft }}>{safeString(reg.university)}</td>
                  <td className="px-5 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: reg.status === 'confirmed' ? adminColors.sageLight : reg.status === 'cancelled' ? adminColors.pinkLight : adminColors.parchment,
                        color: reg.status === 'confirmed' ? adminColors.primaryDark : reg.status === 'cancelled' ? adminColors.danger : adminColors.ink,
                      }}>
                      {safeString(reg.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => onView(reg)}
                      className="p-2 rounded-lg transition-colors"
                      style={{ background: adminColors.parchment, color: adminColors.inkSoft }}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {registrations.length === 0 && (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto mb-4" style={{ color: adminColors.inkLight }} />
            <p className="font-semibold" style={{ color: adminColors.inkSoft }}>No registrations found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Payments Page
function PaymentsPage({ payments, filter, setFilter, onView, onVerify }: {
  payments: Payment[];
  filter: string;
  setFilter: (f: string) => void;
  onView: (p: Payment) => void;
  onVerify: (id: string, approve: boolean, reason?: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {['', 'waiting', 'verified', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: filter === status
                  ? `linear-gradient(135deg, ${adminColors.sage}, ${adminColors.primaryDark})`
                  : adminColors.parchment,
                color: filter === status ? '#fff' : adminColors.inkSoft,
              }}
            >
              {status === '' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {payments.map(payment => (
          <div key={payment.id} className="p-5 rounded-2xl" style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}` }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: payment.status === 'verified' ? adminColors.sageLight
                      : payment.status === 'rejected' ? adminColors.pinkLight
                      : adminColors.blueLight,
                  }}
                >
                  <CreditCard size={18} style={{ color: payment.status === 'verified' ? adminColors.primaryDark : adminColors.ink }} />
                </div>
                <div>
                  <p className="font-bold" style={{ color: adminColors.ink }}>Rp {safeNumber(payment.amount, 0).toLocaleString()}</p>
                  <p className="text-xs" style={{ color: adminColors.inkLight }}>{safeString(payment.method)}</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: payment.status === 'verified' ? adminColors.sageLight
                    : payment.status === 'rejected' ? adminColors.pinkLight
                    : adminColors.parchment,
                  color: payment.status === 'verified' ? adminColors.primaryDark
                    : payment.status === 'rejected' ? adminColors.danger
                    : adminColors.ink,
                }}
              >
                {safeString(payment.status)}
              </span>
            </div>
            <div className="mb-4 p-3 rounded-xl" style={{ background: adminColors.parchment }}>
              <p className="font-semibold text-sm truncate" style={{ color: adminColors.ink }}>
                {safeString(payment.registration?.full_name, 'Unknown')}
              </p>
              <p className="text-xs truncate" style={{ color: adminColors.inkLight }}>
                {safeString(payment.registration?.email)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onView(payment)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: adminColors.parchment, color: adminColors.ink }}
              >
                <Eye size={16} /> View
              </button>
              {payment.status === 'waiting' && (
                <>
                  <button
                    onClick={() => onVerify(payment.id, true)}
                    className="p-2 rounded-xl transition-colors"
                    style={{ background: adminColors.sageLight, color: adminColors.primaryDark }}
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => onVerify(payment.id, false)}
                    className="p-2 rounded-xl transition-colors"
                    style={{ background: adminColors.pinkLight, color: adminColors.danger }}
                  >
                    <X size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {payments.length === 0 && (
        <div className="text-center py-12">
          <CreditCard size={48} className="mx-auto mb-4" style={{ color: adminColors.inkLight }} />
          <p className="font-semibold" style={{ color: adminColors.inkSoft }}>No payments found</p>
        </div>
      )}
    </div>
  );
}

// Tickets Page
function TicketsPage({ tickets, filter, setFilter, onCheckIn }: {
  tickets: Ticket[];
  filter: string;
  setFilter: (f: string) => void;
  onCheckIn: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: adminColors.inkLight }} />
        <input
          type="text"
          placeholder="Search by ticket number..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl text-sm"
          style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
        />
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tickets.map(ticket => {
          const usedAtDate = safeDate(ticket.used_at);
          return (
          <div key={ticket.id} className="p-5 rounded-2xl" style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}` }}>
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: ticket.is_used ? adminColors.sageLight : adminColors.honey + '30',
                  color: ticket.is_used ? adminColors.primaryDark : adminColors.accentDark,
                }}
              >
                {ticket.is_used ? 'Checked In' : 'Pending'}
              </span>
              {ticket.is_used && (
                <Check size={18} style={{ color: adminColors.primaryDark }} />
              )}
            </div>
            <div className="text-center mb-4">
              <div className="w-20 h-20 mx-auto mb-3 rounded-xl flex items-center justify-center"
                style={{ background: adminColors.parchment, border: `2px dashed ${adminColors.border}` }}
              >
                <span style={{ color: adminColors.inkLight }}>QR</span>
              </div>
              <p className="font-mono text-xs" style={{ color: adminColors.inkSoft }}>{safeString(ticket.ticket_number)}</p>
            </div>
            <div className="p-3 rounded-xl mb-4" style={{ background: adminColors.parchment }}>
              <p className="font-semibold text-sm truncate" style={{ color: adminColors.ink }}>
                {safeString(ticket.registration?.full_name, 'Unknown')}
              </p>
              <p className="text-xs truncate" style={{ color: adminColors.inkLight }}>
                {safeString(ticket.registration?.workshop?.title)}
              </p>
            </div>
            {!ticket.is_used && (
              <button
                onClick={() => onCheckIn(ticket.id)}
                className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:translate-y-[-2px]"
                style={{ background: `linear-gradient(135deg, ${adminColors.sage}, ${adminColors.primaryDark})` }}
              >
                Check In
              </button>
            )}
            {ticket.is_used && usedAtDate && (
              <p className="text-xs text-center" style={{ color: adminColors.inkLight }}>
                Checked in at {usedAtDate.toLocaleString()}
              </p>
            )}
          </div>
          );
        })}
      </div>

      {tickets.length === 0 && (
        <div className="text-center py-12">
          <Ticket size={48} className="mx-auto mb-4" style={{ color: adminColors.inkLight }} />
          <p className="font-semibold" style={{ color: adminColors.inkSoft }}>No tickets found</p>
        </div>
      )}
    </div>
  );
}

// Settings Page
function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="p-6 rounded-2xl" style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}` }}>
        <h3 className="font-bold mb-4" style={{ color: adminColors.ink }}>General Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Platform Name</label>
            <input
              type="text"
              defaultValue="CACTUS Workshop Platform"
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Support Email</label>
            <input
              type="email"
              defaultValue="support@cactus.id"
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
            />
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl" style={{ background: adminColors.ivory, border: `1.5px solid ${adminColors.border}` }}>
        <h3 className="font-bold mb-4" style={{ color: adminColors.ink }}>Payment Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Default Payment Deadline (hours)</label>
            <input
              type="number"
              defaultValue={24}
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
            />
          </div>
        </div>
      </div>

      <button
        className="px-6 py-3 rounded-xl font-semibold text-white"
        style={{ background: `linear-gradient(135deg, ${adminColors.sage}, ${adminColors.primaryDark})` }}
      >
        Save Changes
      </button>
    </div>
  );
}

// Workshop Modal
function WorkshopModal({ workshop, onClose, onSave }: { workshop: Workshop | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    title: workshop?.title || '',
    description: workshop?.description || '',
    theme: workshop?.theme || '',
    emoji: workshop?.emoji || '',
    date: workshop?.date || '',
    deadline: workshop?.deadline || '',
    time_start: workshop?.time_start || '',
    time_end: workshop?.time_end || '',
    location: workshop?.location || '',
    instructor: workshop?.instructor || '',
    price: workshop?.price || 0,
    seats_total: workshop?.seats_total || 20,
    difficulty: workshop?.difficulty || 'beginner',
    color: workshop?.color || '#c8dbc0',
  });

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    let result;
    if (workshop) {
      result = await supabase.from('workshops').update(form).eq('id', workshop.id).select();
    } else {
      result = await supabase.from('workshops').insert([form]).select();
    }

    console.log('[CACTUS ADMIN] Save result:', result);

    console.log('[CACTUS ADMIN] Workshop ID:', workshop?.id);
    console.log('[CACTUS ADMIN] Form Data:', form);
    console.log('[CACTUS ADMIN] Result Data:', result.data);
    console.log('[CACTUS ADMIN] Result Error:', result.error);

    if (result.error) {
      alert('Gagal menyimpan: ' + result.error.message);
      console.error('[CACTUS ADMIN] Supabase error:', result.error);
      return; // jangan tutup modal kalau gagal
    }


  alert('UPDATE SUCCESS');

  onClose();
  window.location.reload();

  } catch (error) {
    console.error('Error saving workshop:', error);
    alert('Terjadi error: ' + (error instanceof Error ? error.message : String(error)));
  }
};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6"
        style={{ background: adminColors.ivory, border: `2px solid ${adminColors.border}` }}
      >
        <h2 className="font-bold text-xl mb-6" style={{ color: adminColors.ink }}>
          {workshop ? 'Edit Workshop' : 'New Workshop'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Emoji</label>
              <input
                type="text"
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Theme</label>
              <input
                type="text"
                value={form.theme}
                onChange={(e) => setForm({ ...form, theme: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Deadline</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Start Time</label>
              <input
                type="text"
                value={form.time_start}
                onChange={(e) => setForm({ ...form, time_start: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>End Time</label>
              <input
                type="text"
                value={form.time_end}
                onChange={(e) => setForm({ ...form, time_end: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Instructor</label>
              <input
                type="text"
                value={form.instructor}
                onChange={(e) => setForm({ ...form, instructor: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Price (Rp)</label>
              <input
                type="number"
                value={safeNumber(form.price, 0)}
                onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Total Seats</label>
              <input
                type="number"
                value={safeNumber(form.seats_total, 20)}
                onChange={(e) => setForm({ ...form, seats_total: parseInt(e.target.value) || 20 })}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: adminColors.ink }}>Color</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full h-12 rounded-xl cursor-pointer"
                style={{ background: adminColors.parchment, border: `1.5px solid ${adminColors.border}` }}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold"
              style={{ background: adminColors.parchment, color: adminColors.ink }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${adminColors.sage}, ${adminColors.primaryDark})` }}
            >
              {workshop ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Registration Modal
function RegistrationModal({ registration, onClose }: { registration: Registration; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl p-6"
        style={{ background: adminColors.ivory, border: `2px solid ${adminColors.border}` }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-xl" style={{ color: adminColors.ink }}>Registration Details</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ background: adminColors.parchment }}>
            <X size={18} style={{ color: adminColors.ink }} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl" style={{ background: adminColors.parchment }}>
            <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Registration Number</p>
            <p className="font-mono" style={{ color: adminColors.ink }}>{safeString(registration.registration_number)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
              <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Full Name</p>
              <p className="font-semibold" style={{ color: adminColors.ink }}>{safeString(registration.full_name)}</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
              <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Nickname</p>
              <p style={{ color: adminColors.ink }}>{safeString(registration.nickname, '-')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
              <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Email</p>
              <p className="text-sm truncate" style={{ color: adminColors.ink }}>{safeString(registration.email)}</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
              <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Phone</p>
              <p className="text-sm" style={{ color: adminColors.ink }}>{safeString(registration.phone)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
              <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>University</p>
              <p className="text-sm" style={{ color: adminColors.ink }}>{safeString(registration.university)}</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
              <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Faculty</p>
              <p className="text-sm" style={{ color: adminColors.ink }}>{safeString(registration.faculty)}</p>
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
            <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Character Name</p>
            <p className="font-semibold" style={{ color: adminColors.ink }}>{safeString(registration.character_name)}</p>
          </div>

          <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
            <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Workshop</p>
            <p style={{ color: adminColors.ink }}>
              <span className="mr-2">{safeString(registration.workshop?.emoji)}</span>
              {safeString(registration.workshop?.title)}
            </p>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold" style={{ color: adminColors.inkLight }}>Status</span>
            <span className="px-4 py-2 rounded-full text-sm font-semibold"
              style={{
                background: registration.status === 'confirmed' ? adminColors.sageLight
                  : registration.status === 'cancelled' ? adminColors.pinkLight
                  : adminColors.parchment,
                color: registration.status === 'confirmed' ? adminColors.primaryDark
                  : registration.status === 'cancelled' ? adminColors.danger
                  : adminColors.ink,
              }}
            >
              {safeString(registration.status)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Payment Modal
function PaymentModal({ payment, onClose, onVerify }: { payment: Payment; onClose: () => void; onVerify: (id: string, approve: boolean, reason?: string) => void }) {
  const [rejectReason, setRejectReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl p-6"
        style={{ background: adminColors.ivory, border: `2px solid ${adminColors.border}` }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-xl" style={{ color: adminColors.ink }}>Payment Details</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ background: adminColors.parchment }}>
            <X size={18} style={{ color: adminColors.ink }} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl text-center" style={{ background: adminColors.parchment }}>
            <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Amount</p>
            <p className="font-bold text-2xl" style={{ color: adminColors.ink }}>Rp {safeNumber(payment.amount, 0).toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
              <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Method</p>
              <p className="font-semibold" style={{ color: adminColors.ink }}>{safeString(payment.method)}</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
              <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Status</p>
              <span className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: payment.status === 'verified' ? adminColors.sageLight
                    : payment.status === 'rejected' ? adminColors.pinkLight
                    : adminColors.parchment,
                  color: payment.status === 'verified' ? adminColors.primaryDark
                    : payment.status === 'rejected' ? adminColors.danger
                    : adminColors.ink,
                }}
              >
                {safeString(payment.status)}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
            <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Participant</p>
            <p className="font-semibold" style={{ color: adminColors.ink }}>{safeString(payment.registration?.full_name)}</p>
            <p className="text-sm" style={{ color: adminColors.inkLight }}>{safeString(payment.registration?.email)}</p>
          </div>

          <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
            <p className="text-xs font-semibold mb-1" style={{ color: adminColors.inkLight }}>Workshop</p>
            <p style={{ color: adminColors.ink }}>
              <span className="mr-2">{safeString(payment.registration?.workshop?.emoji)}</span>
              {safeString(payment.registration?.workshop?.title)}
            </p>
          </div>

          {payment.proof_url && (
            <div className="p-3 rounded-xl" style={{ background: adminColors.parchment }}>
              <p className="text-xs font-semibold mb-2" style={{ color: adminColors.inkLight }}>Proof of Payment</p>
              <img src={safeString(payment.proof_url)} alt="Proof" className="w-full rounded-lg" />
            </div>
          )}

          {payment.status === 'waiting' && (
            <>
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: adminColors.inkLight }}>Rejection Reason (if rejecting)</label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{ background: adminColors.paper, border: `1.5px solid ${adminColors.border}`, color: adminColors.ink }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { onVerify(payment.id, false, rejectReason); onClose(); }}
                  className="flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                  style={{ background: adminColors.pinkLight, color: adminColors.danger }}
                >
                  <X size={18} /> Reject
                </button>
                <button
                  onClick={() => { onVerify(payment.id, true); onClose(); }}
                  className="flex-1 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${adminColors.sage}, ${adminColors.primaryDark})` }}
                >
                  <Check size={18} /> Approve
                </button>
              </div>
            </>
          )}

          {payment.status === 'rejected' && payment.rejection_reason && (
            <div className="p-3 rounded-xl" style={{ background: adminColors.pinkLight }}>
              <p className="text-xs font-semibold mb-1" style={{ color: adminColors.danger }}>Rejection Reason</p>
              <p className="text-sm" style={{ color: adminColors.ink }}>{safeString(payment.rejection_reason)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
