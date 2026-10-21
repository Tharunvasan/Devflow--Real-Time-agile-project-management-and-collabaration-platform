// User Types
export type UserRole = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER' | 'TESTER';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Project Types
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
export type MemberRole = 'OWNER' | 'MANAGER' | 'DEVELOPER' | 'TESTER' | 'VIEWER';

export interface ProjectMember {
  user: User;
  role: MemberRole;
  _id: string;
}

export interface Project {
  _id: string;
  name: string;
  key?: string;
  description?: string;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  createdBy: User;
  members: ProjectMember[];
  createdAt: string;
  updatedAt: string;
}

// Task Types
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  _id: string;
  taskKey?: string;
  order?: number;
  title: string;
  description?: string;
  project: Project | string;
  sprint?: Sprint | string;
  assignedTo?: User;
  createdBy: User;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  storyPoints?: number;
  estimatedHours?: number;
  isBlocked: boolean;
  blockedReason?: string;
  labels: string[];
  subtasks?: Subtask[];
  dependencies?: (Task | string)[];
  attachments?: {
    _id: string;
    filename: string;
    url: string;
    uploadedBy: User;
    uploadedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

// Sprint Types
export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export interface Sprint {
  _id: string;
  name: string;
  goal?: string;
  project: Project | string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  tasks: Task[];
  createdBy: User;
  createdAt: string;
  updatedAt: string;
}

export interface SprintStats {
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  progress: number;
  totalStoryPoints?: number;
  completedStoryPoints?: number;
  remainingStoryPoints?: number;
}

export interface BurndownPoint {
  day: string;
  ideal: number;
  actual: number | null;
}

export interface VelocityMetric {
  sprintId: string;
  name: string;
  completedPoints: number;
}

// Issue Types
export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'VERIFIED' | 'CLOSED';

export interface Issue {
  _id: string;
  issueKey?: string;
  title: string;
  description?: string;
  reproductionSteps?: string;
  expectedBehavior?: string;
  resolution?: string;
  relatedTask?: Task | null;
  project: Project | string;
  reportedBy: User;
  assignedTo?: User;
  severity: IssueSeverity;
  priority: IssuePriority;
  status: IssueStatus;
  attachments?: {
    _id: string;
    filename: string;
    url: string;
    uploadedBy: User;
    uploadedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

// Comment Types
export interface Comment {
  _id: string;
  content: string;
  author: User;
  task?: string;
  issue?: string;
  createdAt: string;
  updatedAt: string;
}

// Activity Types
export interface Activity {
  _id: string;
  project: Project | string;
  actor: User;
  action: string;
  details: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// Notification Types
export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'TASK_COMPLETED'
  | 'ISSUE_CREATED'
  | 'ISSUE_ASSIGNED'
  | 'ISSUE_RESOLVED'
  | 'SPRINT_STARTED'
  | 'SPRINT_COMPLETED'
  | 'MEMBER_ADDED'
  | 'COMMENT_ADDED';

export interface Notification {
  _id: string;
  recipient: string;
  type: NotificationType;
  message: string;
  read: boolean;
  relatedProject?: string;
  relatedTask?: string;
  relatedIssue?: string;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: { field: string; message: string }[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

// Dashboard Types
export interface DashboardOverview {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  openIssues: number;
  blockedTasks: number;
  overdueTasks: number;
  teamMembers: number;
}

export interface ChartData {
  _id: string;
  count: number;
}

export interface DashboardStats {
  overview: DashboardOverview;
  charts: {
    tasksByStatus: ChartData[];
    tasksByPriority: ChartData[];
    issuesBySeverity: ChartData[];
    workloadByAssignee: ChartData[];
  };
  activeSprint: Sprint | null;
  recentActivity: {
    recentComments?: Comment[];
    recentTasks: Task[];
    recentIssues?: Issue[];
    recentActivities?: Activity[];
  };
}
