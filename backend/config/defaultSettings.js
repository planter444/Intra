module.exports = {
  branding: {
    organizationName: 'KEREA',
    appName: 'KEREA HRMS',
    logoText: 'KH',
    primaryColor: '#166534',
    secondaryColor: '#22c55e',
    accentColor: '#86efac',
    backgroundColor: '#f4fbf6',
    cardColor: '#ffffff',
    textColor: '#0f172a',
    gradientFrom: '#14532d',
    gradientTo: '#22c55e'
  },
  labels: {
    employeeDirectoryTitle: 'Employees',
    employeeDirectorySubtitle: 'Manage employee records and staff.',
    leaveModuleTitle: 'Leave Management',
    documentsModuleTitle: 'Document Center',
    profileModuleTitle: 'My Profile',
    dashboardWelcome: 'Welcome back',
    dashboardTitleSuffix: 'Dashboard',
    dashboardQuickActionsTitle: 'Quick actions',
    dashboardQuickActionsSubtitle: 'Jump straight into the areas you use most often.',
    dashboardOpenLeavesText: 'Open leave dashboard',
    dashboardOpenProfileText: 'Review my profile',
    dashboardOpenEmployeesText: 'Manage employees',
    dashboardOpenDocumentsText: 'Open documents',
    loginPortalLabel: '',
    loginTitle: 'Sign in to KEREA HRMS',
    loginSubtitle: 'Sign in to your account',
    loginEmailLabel: 'Email',
    loginPasswordLabel: 'Password',
    loginEmailPlaceholder: 'name@kerea.local',
    loginPasswordPlaceholder: 'Enter password',
    loginButtonText: 'Login',
    loginFooterText: '2026 KEREA. All rights reserved.',
    profileSubtitle: 'Employees can update contact details such as phone number. Identity and role information is managed by supervisors, Admin, or CEO.',
    documentsSubtitle: 'Structured employee folders are secured behind authenticated download and preview endpoints.',
    actingHrLabel: 'CEO',
    navigationDashboard: 'Dashboard',
    navigationEmployees: 'Employees',
    navigationLeaves: 'Leave Management',
    navigationDocuments: 'Documents',
    navigationSettings: 'Settings',
    navigationAudit: 'Audit Logs'
  },
  interface: {
    dashboardHeroTitle: 'Workforce Management System',
    dashboardHeroSubtitle: 'Secure intranet experience for employees, supervisors, executives, and administrators.',
    loginHeroTitle: '',
    loginHeroSubtitle: '',
    loginHighlights: '',
    showAnnouncements: true,
    showLeaveCalendar: true,
    showDocumentPreview: true,
    sidebarCollapsedByDefault: false
  },
  navigation: {
    employee: ['dashboard', 'profile', 'leaves', 'documents'],
    supervisor: ['dashboard', 'employees', 'profile', 'leaves', 'documents'],
    hr: ['dashboard', 'employees', 'profile', 'leaves', 'documents'],
    admin: ['dashboard', 'employees', 'profile', 'leaves', 'documents', 'settings', 'audit'],
    ceo: ['dashboard', 'employees', 'profile', 'leaves', 'documents', 'settings']
  },
  departments: [
    { name: 'Executive Office', description: 'Executive leadership team' },
    { name: 'Finance', description: 'Accounting and reporting' },
    { name: 'Operations', description: 'Operational delivery' },
    { name: 'Marketing', description: 'Marketing and communications' }
  ],
  leaveTypes: [
    { code: 'annual', label: 'Annual Leave', defaultDays: 21, requiresCeoApproval: false, isPaid: true, requiresDocument: false, canCarryForward: true },
    { code: 'sick', label: 'Sick Leave', defaultDays: 14, requiresCeoApproval: false, isPaid: true, requiresDocument: false, canCarryForward: false },
    { code: 'maternity', label: 'Maternity Leave', defaultDays: 90, requiresCeoApproval: true, isPaid: true, requiresDocument: false, canCarryForward: false },
    { code: 'paternity', label: 'Paternity Leave', defaultDays: 14, requiresCeoApproval: true, isPaid: true, requiresDocument: false, canCarryForward: false }
  ]
};
