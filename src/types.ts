/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CheckinEntry {
  id: string;
  date: string; // ISO String
  text: string;
  mood: number; // 1 to 10
  aiResponse: string;
}

export interface UserData {
  name: string;
  goal: string;
  entries: CheckinEntry[];
}
