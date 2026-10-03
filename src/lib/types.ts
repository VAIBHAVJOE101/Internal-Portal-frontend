// Shapes returned by the portal backend.

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface Me {
  username: string
  role: 'ADMIN' | 'READER'
  admin: boolean
  name?: string
  avatarUrl?: string | null
  profileUrl?: string
  provider: 'github' | 'local'
}

export interface PublicInfo {
  mode: 'mock' | 'real'
  environment: string
  loginUrl: string
  githubOrg?: string
  adminTeam?: string
}

// ---------------------------------------------------------------- inventory

export type ColumnType =
  | 'TEXT'
  | 'LONGTEXT'
  | 'NUMBER'
  | 'DATE'
  | 'DATETIME'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTISELECT'
  | 'LIST'
  | 'URL'
  | 'IP'
  | 'EMAIL'
  | 'REFERENCE'

export interface Choice {
  value: string
  color?: string
}

export interface ColumnOptions {
  choices?: Choice[]
  refPage?: string
}

export interface InventoryColumn {
  id: number
  key: string
  label: string
  type: ColumnType
  required: boolean
  locked: boolean
  visible: boolean
  width?: number | null
  sortOrder: number
  options?: ColumnOptions | null
  expiryTracking: boolean
  description?: string | null
}

export interface InventoryPage {
  id: number
  slug: string
  name: string
  description?: string | null
  icon?: string | null
  group?: string | null
  sortOrder: number
  system: boolean
  columns: InventoryColumn[]
  recordCount: number
  updatedAt: string
}

export interface InventoryRecord {
  id: number
  data: Record<string, unknown>
  createdBy?: string
  createdAt: string
  updatedBy?: string
  updatedAt: string
}

export interface ExpiringItem {
  pageSlug: string
  pageName: string
  recordId: number
  title: string
  columnKey: string
  columnLabel: string
  expiresOn: string
  daysLeft: number
}

// ---------------------------------------------------------------- kafka

export interface KafkaInstance {
  id: number
  name: string
  environment?: string
  brokers: string[]
  connectUrls: string[]
  securityProtocol: string
  saslMechanism?: string
  credentialRef?: string
  enabled: boolean
  extra: Record<string, unknown>
}

export interface HealthSnapshot {
  id: number
  instanceId: number
  ts: string
  status: string
  brokersOnline?: number
  brokersTotal?: number
  topics?: number
  underReplicated?: number
  connectorsTotal?: number
  connectorsFailed?: number
  maxLag?: number
  message?: string
}

export interface InstanceCard {
  instance: KafkaInstance
  lastHealth: HealthSnapshot | null
}

export interface ClusterOverview {
  instance: KafkaInstance
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNREACHABLE'
  clusterId?: string
  controllerId?: number
  brokersOnline: number
  brokersExpected: number
  topics: number
  partitions: number
  underReplicated: number
  offlinePartitions: number
  consumerGroups: number
  connectorsTotal: number
  connectorsFailed: number
  kafkaConnectVersion?: string
  error?: string
  latencyMs: number
}

export interface BrokerInfo {
  id: number
  host: string
  port: number
  rack?: string
  controller: boolean
}

export interface TopicSummary {
  name: string
  partitions: number
  replicationFactor: number
  internal: boolean
  underReplicated: number
  retentionMs?: string
  cleanupPolicy?: string
}

export interface PartitionInfo {
  partition: number
  leader?: number
  replicas: number[]
  isr: number[]
  earliestOffset?: number
  latestOffset?: number
}

export interface ConfigEntry {
  name: string
  value?: string | null
  source: string
  isDefault: boolean
  readOnly: boolean
  sensitive: boolean
}

export interface TopicDetail {
  name: string
  internal: boolean
  partitions: PartitionInfo[]
  configs: ConfigEntry[]
  messages: number
}

export interface ConsumerGroupSummary {
  groupId: string
  state: string
  members: number
  topics: string[]
  totalLag: number
}

export interface OffsetLag {
  topic: string
  partition: number
  committed?: number
  end?: number
  lag?: number
}

export interface ConsumerGroupDetail {
  groupId: string
  state: string
  coordinator?: number
  members: { memberId: string; clientId: string; host: string; assignments: string[] }[]
  offsets: OffsetLag[]
  totalLag: number
}

export interface ConnectorTask {
  id: number
  state: string
  workerId?: string
  trace?: string | null
}

export interface Connector {
  name: string
  type: string
  state: string
  workerId?: string
  tasks: ConnectorTask[]
  config: Record<string, string>
  lag?: number | null
}

export interface RawResponse {
  status: number
  body: unknown
  url: string
  latencyMs: number
}

// ---------------------------------------------------------------- boards

export interface Person {
  displayName: string
  uniqueName: string
  imageUrl?: string | null
}

export interface Iteration {
  id: string
  name: string
  path: string
  startDate?: string
  finishDate?: string
  timeFrame?: string
}

export interface WorkItem {
  id: number
  title: string
  type: string
  state: string
  assignedTo?: Person | null
  startDate?: string | null
  endDate?: string | null
  remainingWork?: number | null
  storyPoints?: number | null
  priority?: number | null
  tags: string[]
  parentId?: number | null
  url?: string
  changedDate?: string
  rev: number
  description?: string | null
  acceptanceCriteria?: string | null
  commentCount?: number | null
}

export interface WorkItemComment {
  id: number
  text: string
  author: Person
  createdDate: string
  modifiedDate?: string | null
}

export interface Sprint {
  iteration: Iteration
  columns: string[]
  items: WorkItem[]
  iterations: Iteration[]
}

// ---------------------------------------------------------------- github

export interface Repo {
  name: string
  fullName: string
  privateRepo: boolean
  defaultBranch: string
  pushedAt: string
  htmlUrl: string
  language?: string
  archived: boolean
}

export interface WorkflowRun {
  id: number
  name: string
  title: string
  repo: string
  branch: string
  event: string
  status: string
  conclusion?: string | null
  actor: string
  actorAvatar?: string | null
  runNumber: number
  attempt: number
  createdAt: string
  updatedAt: string
  durationSeconds?: number | null
  htmlUrl: string
  headSha: string
}

export interface Team {
  id: number
  slug: string
  name: string
  description?: string
  privacy: string
  membersCount?: number | null
  parent?: string | null
  htmlUrl: string
}

export interface Member {
  login: string
  avatarUrl?: string | null
  role?: string | null
  htmlUrl?: string | null
  state: string
}

// ---------------------------------------------------------------- connectivity

export type TestType = 'DNS' | 'TCP' | 'HTTP' | 'TLS'
export type ScheduleType = 'NONE' | 'INTERVAL' | 'CRON'

export interface ConnTarget {
  id: number
  name: string
  testType: TestType
  host?: string
  port?: number
  url?: string
  httpMethod?: string
  expectedStatus?: number
  timeoutMs: number
  scheduleType: ScheduleType
  intervalSeconds?: number
  cron?: string
  enabled: boolean
  failureThreshold: number
  consecutiveFailures: number
  lastStatus?: 'UP' | 'DOWN' | null
  lastRunAt?: string
  lastLatencyMs?: number
  tags: string[]
  nextRunAt?: string
  uptime24h?: number | null
  avgLatency24h?: number | null
  description: string
}

export interface ConnResult {
  id: number
  targetId?: number
  ts: string
  testType: TestType
  target: string
  success: boolean
  latencyMs?: number
  message?: string
  details?: Record<string, unknown> | null
  triggeredBy?: string
}

// ---------------------------------------------------------------- app kafka

export interface RouteRow {
  id: string
  docId: string
  index: number
  api?: string
  operationId?: string
  method?: string
  publicUrl?: string
  internalUrl?: string
  mappings: Record<string, string | null>
}

export interface RoutesConfig {
  source: string
  mappingFields: string[]
  configured: boolean
}

export interface RouteChange {
  rowId: string
  operationId?: string
  publicUrl?: string
  field: string
  before?: string | null
  after?: string | null
}

export interface ApplyResult {
  requested: number
  succeeded: number
  failed: number
  results: { rowId: string; operationId?: string; success: boolean; message: string }[]
}

// ---------------------------------------------------------------- alerts / audit / settings

export type Severity = 'CRITICAL' | 'WARNING' | 'INFO'

export type AlertType =
  | 'KAFKA_UNREACHABLE'
  | 'KAFKA_BROKER_DOWN'
  | 'KAFKA_UNDER_REPLICATED'
  | 'KAFKA_OFFLINE_PARTITIONS'
  | 'KAFKA_CONNECTOR_FAILED'
  | 'KAFKA_CONNECT_UNREACHABLE'
  | 'KAFKA_CONSUMER_LAG'
  | 'CONNECTIVITY_FAILURE'
  | 'CREDENTIAL_EXPIRY'

export type AlertStatus = 'PENDING' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'

export interface AlertItem {
  id: number
  type?: AlertType | null
  typeLabel?: string | null
  source: string
  severity: Severity
  title: string
  message?: string
  resource?: string
  status: AlertStatus
  occurrences: number
  firstSeen: string
  lastSeen: string
  firedAt?: string | null
  clearedSince?: string | null
  lastNotifiedAt?: string | null
  nextNotifyAt?: string | null
  notificationCount: number
  escalationLevel: number
  snoozedUntil?: string | null
  snoozedBy?: string | null
  reopenCount: number
  acknowledgedBy?: string
  acknowledgedAt?: string
  resolvedAt?: string
  resolvedBy?: string | null
  resolvedReason?: string | null
  justFired?: boolean
}

export interface AlertEventItem {
  id: number
  alertId: number
  ts: string
  kind: string
  channel?: string | null
  success?: boolean | null
  message?: string | null
  actor?: string | null
}

export interface EscalationStep {
  afterMinutes: number
  emails: string[]
  teams: boolean
  raiseToCritical: boolean
}

export interface AlertPolicy {
  type: AlertType
  label: string
  description: string
  source: string
  enabled: boolean
  severity: Severity
  minOccurrences: number
  pendingSeconds: number
  repeatMinutes: number
  backoffMultiplier: number
  maxRepeatMinutes: number
  maxNotifications: number
  notifyOnResolve: boolean
  resolveGraceSeconds: number
  staleMinutes: number
  reopenWindowMinutes: number
  emailEnabled: boolean
  emailRecipients: string[]
  teamsEnabled: boolean
  escalation: EscalationStep[]
  params: Record<string, number | string>
  mutedUntil?: string | null
  muteReason?: string | null
  customized: boolean
  updatedBy?: string | null
  updatedAt?: string | null
}

export interface AlertSummary {
  active: number
  pending: number
  critical: number
  warning: number
  info: number
}

export interface AuditEntry {
  id: number
  ts: string
  username: string
  role?: string
  action: string
  targetType: string
  targetId?: string
  details?: unknown
  clientIp?: string
  success: boolean
  error?: string
}

export interface SettingField {
  key: string
  label: string
  secret: boolean
  required: boolean
  placeholder?: string
  help?: string
}

export interface SettingView {
  key: string
  type: 'GITHUB' | 'AZURE_DEVOPS' | 'COSMOS' | 'EMAIL' | 'TEAMS' | 'KAFKA_CREDENTIAL'
  label: string
  fields: SettingField[]
  values: Record<string, string>
  secretsSet: Record<string, boolean>
  configured: boolean
  testable: boolean
  updatedBy?: string
  updatedAt?: string
}
