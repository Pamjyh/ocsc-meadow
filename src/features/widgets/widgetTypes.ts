import type { AmbientLayers, AmbientTrackId } from './ambientAudio';

export type CoreWidgetType =
  | 'core_welcome'
  | 'core_countdown'
  | 'core_pass_rollup'
  | 'core_subjects';

export type ExtraWidgetType =
  | 'ytm_player'
  | 'photo_collection'
  | 'sticky_note'
  | 'study_streak'
  | 'aesthetic_clock'
  | 'daily_goals'
  | 'quick_study';

export type WidgetType = CoreWidgetType | ExtraWidgetType;

export type WidgetSize = 'half' | 'full';

export type StickyColor = 'yellow' | 'peach' | 'mint' | 'lavender';

export type WidgetGroup = 'core' | 'cozy' | 'study';

export interface WidgetGridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetItem {
  id: string;
  type: WidgetType;
  visible: boolean;
  size: WidgetSize;
  grid: WidgetGridRect;
  config: Record<string, unknown>;
}

export interface WidgetLayoutState {
  version: 2;
  items: WidgetItem[];
}

export interface AmbientPlayerState {
  trackId: AmbientTrackId;
  isPlaying: boolean;
  volume: number;
  layers: AmbientLayers;
}

export interface WidgetCatalogMeta {
  type: WidgetType;
  title: string;
  description: string;
  emoji: string;
  group: WidgetGroup;
  isCore: boolean;
  multiInstance: boolean;
  defaultVisible: boolean;
  defaultSize: WidgetSize;
  defaultGrid: WidgetGridRect;
  minW: number;
  minH: number;
  defaultConfig: Record<string, unknown>;
}

export const GRID_COLS = 12;
export const GRID_ROW_HEIGHT = 46;
export const GRID_GAP = 16;
export const GRID_MAX_H = 18;

export const CORE_WIDGET_TYPES: readonly CoreWidgetType[] = [
  'core_welcome',
  'core_countdown',
  'core_pass_rollup',
  'core_subjects',
] as const;

export const WIDGET_CATALOG: readonly WidgetCatalogMeta[] = [
  {
    type: 'core_welcome',
    title: 'การ์ดทักทาย & ปุ่มอ่านต่อ',
    description: 'คำทักทาย สถานะซิงก์ และปุ่มลัดอ่านเนื้อหาหรือทำข้อสอบต่อ',
    emoji: '👋',
    group: 'core',
    isCore: true,
    multiInstance: false,
    defaultVisible: true,
    defaultSize: 'half',
    defaultGrid: { x: 0, y: 0, w: 6, h: 5 },
    minW: 4,
    minH: 4,
    defaultConfig: {},
  },
  {
    type: 'core_countdown',
    title: 'นับถอยหลังวันสอบ',
    description: 'นับถอยหลังสู่วันสอบจริงพร้อมสรุปบทเรียนและชุด PDF ที่ทำแล้ว',
    emoji: '⏳',
    group: 'core',
    isCore: true,
    multiInstance: false,
    defaultVisible: true,
    defaultSize: 'half',
    defaultGrid: { x: 6, y: 0, w: 6, h: 5 },
    minW: 4,
    minH: 4,
    defaultConfig: {},
  },
  {
    type: 'core_pass_rollup',
    title: 'เกณฑ์ผ่าน 3 วิชา ก.พ.',
    description: 'ประเมินคะแนนรวมเทียบเกณฑ์ผ่าน 60% / 50% / 60% ตามใบผลสอบจริง',
    emoji: '🏆',
    group: 'core',
    isCore: true,
    multiInstance: false,
    defaultVisible: true,
    defaultSize: 'full',
    defaultGrid: { x: 0, y: 5, w: 12, h: 5 },
    minW: 5,
    minH: 4,
    defaultConfig: {},
  },
  {
    type: 'core_subjects',
    title: 'ความก้าวหน้า 4 หมวดวิชา',
    description: 'การ์ดแยกคณิต ไทย อังกฤษ และกฎหมาย พร้อมปุ่มลัดอ่านสรุปและทำข้อสอบ',
    emoji: '📚',
    group: 'core',
    isCore: true,
    multiInstance: false,
    defaultVisible: true,
    defaultSize: 'full',
    defaultGrid: { x: 0, y: 10, w: 12, h: 4 },
    minW: 4,
    minH: 4,
    defaultConfig: {},
  },
  {
    type: 'ytm_player',
    title: 'เสียงอ่านหนังสือ & Lo-fi',
    description: 'เสียงฝนตกเบาๆ Lo-fi ลมทุ่งหญ้า และโทนโฟกัส ฝังในเว็บเล่นต่อเนื่องทุกหน้า',
    emoji: '🎧',
    group: 'cozy',
    isCore: false,
    multiInstance: false,
    defaultVisible: true,
    defaultSize: 'half',
    defaultGrid: { x: 0, y: 14, w: 6, h: 6 },
    minW: 4,
    minH: 5,
    defaultConfig: {},
  },
  {
    type: 'photo_collection',
    title: 'คอลเลกชันรูปภาพ',
    description: 'กรอบรูปสบายตาแบบสไลด์โชว์ อัปโหลดรูปจากเครื่องเก็บเป็นส่วนตัว',
    emoji: '🖼️',
    group: 'cozy',
    isCore: false,
    multiInstance: false,
    defaultVisible: true,
    defaultSize: 'half',
    defaultGrid: { x: 6, y: 14, w: 6, h: 6 },
    minW: 4,
    minH: 5,
    defaultConfig: {
      autoPlay: true,
      intervalSec: 6,
    },
  },
  {
    type: 'sticky_note',
    title: 'โพสอิท',
    description: 'กระดาษโน้ตสีพาสเทล เพิ่มได้หลายใบสำหรับจดสูตรหรือคำให้กำลังใจ',
    emoji: '📝',
    group: 'cozy',
    isCore: false,
    multiInstance: true,
    defaultVisible: true,
    defaultSize: 'half',
    defaultGrid: { x: 0, y: 20, w: 6, h: 5 },
    minW: 3,
    minH: 4,
    defaultConfig: {
      title: 'กำลังใจวันนี้',
      text: 'ค่อยๆ เก็บวันละนิด เดี๋ยวก็ครบทุกวิชา สู้ๆ นะครับ!',
      color: 'yellow' as StickyColor,
    },
  },
  {
    type: 'study_streak',
    title: 'สถิติความสม่ำเสมอ (Heatmap)',
    description: 'ตารางความสม่ำเสมอ 12 สัปดาห์ พร้อมนับวันต่อเนื่องและเช็กอินอ่านหนังสือประจำวัน',
    emoji: '🔥',
    group: 'study',
    isCore: false,
    multiInstance: false,
    defaultVisible: true,
    defaultSize: 'half',
    defaultGrid: { x: 6, y: 20, w: 6, h: 5 },
    minW: 4,
    minH: 5,
    defaultConfig: {},
  },
  {
    type: 'aesthetic_clock',
    title: 'นาฬิกา & คำทักทาย',
    description: 'นาฬิกาสบายตาพร้อมคำทักทายตามช่วงเวลาและข้อความส่วนตัว',
    emoji: '🕰️',
    group: 'cozy',
    isCore: false,
    multiInstance: false,
    defaultVisible: false,
    defaultSize: 'half',
    defaultGrid: { x: 6, y: 25, w: 6, h: 5 },
    minW: 3,
    minH: 4,
    defaultConfig: {
      customQuote: 'หายใจลึกๆ แล้วค่อยๆ ไปทีละก้าว',
    },
  },
  {
    type: 'daily_goals',
    title: 'เป้าหมายวันนี้ (3 ข้อ)',
    description: 'เช็กลิสต์เบาๆ วันละ 3 อย่าง รีเซ็ตติ๊กถูกให้อัตโนมัติเมื่อขึ้นวันใหม่',
    emoji: '✅',
    group: 'study',
    isCore: false,
    multiInstance: false,
    defaultVisible: false,
    defaultSize: 'half',
    defaultGrid: { x: 0, y: 25, w: 6, h: 5 },
    minW: 4,
    minH: 5,
    defaultConfig: {
      lastDate: '',
      tasks: [
        { id: 't1', text: 'อ่านสรุปเนื้อหา 1 บท', done: false },
        { id: 't2', text: 'ฝึกทำโจทย์สั้นๆ 5 ข้อ', done: false },
        { id: 't3', text: 'พักสายตาและดื่มน้ำให้เพียงพอ', done: false },
      ],
    },
  },
  {
    type: 'quick_study',
    title: 'โจทย์วันละข้อ',
    description: 'สุ่มโจทย์ ก.พ. วันละข้อพร้อมเฉลยทันที และปุ่มอ่านต่อจากเดิม',
    emoji: '💡',
    group: 'study',
    isCore: false,
    multiInstance: false,
    defaultVisible: false,
    defaultSize: 'full',
    defaultGrid: { x: 0, y: 30, w: 12, h: 7 },
    minW: 5,
    minH: 6,
    defaultConfig: {},
  },
] as const;

export const WIDGET_CATALOG_MAP: Record<WidgetType, WidgetCatalogMeta> = WIDGET_CATALOG.reduce(
  (acc, item) => {
    acc[item.type] = item;
    return acc;
  },
  {} as Record<WidgetType, WidgetCatalogMeta>,
);

export function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === 'string' && value in WIDGET_CATALOG_MAP;
}
