export type Page = 'home' | 'camera' | 'arm' | 'music' | 'web' | 'chat' | 'settings';

export type SystemStatus = {
  camera: 'online' | 'offline' | 'connecting';
  arm: 'online' | 'offline' | 'connecting';
  mcp: 'online' | 'offline' | 'connecting';
  gemini: 'online' | 'offline' | 'connecting';
  xiaozhi: 'online' | 'offline' | 'connecting';
};

export type SofiaState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type ArmJoint = 'base' | 'middle' | 'gripper';

export type ArmMove = {
  base: string;
  middle: string;
  gripper: string;
  durations: [number, number, number];
};
