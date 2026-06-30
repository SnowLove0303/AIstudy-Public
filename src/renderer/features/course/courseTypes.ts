export type Course = {
  id: string;
  name: string;
  description: string;
  sectionId: string | null;
  lastWorkspaceMode: "mindmap" | "word" | "textbook";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CourseSection = {
  id: string;
  name: string;
  sortOrder: number;
  collapsed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CourseStore = {
  sections: CourseSection[];
  courses: Course[];
  activeCourseId: string | null;
};

export type CourseSyncStatus = {
  state: "saved" | "saving" | "waiting" | "attention";
  pendingCount: number;
};

export type CourseCreateInput = {
  name: string;
  description: string;
  sectionId: string | null;
};

export type CourseRenameInput = {
  id: string;
  name: string;
  description: string;
};

export type CourseMoveInput = {
  id: string;
  sectionId: string | null;
};

export type CourseReorderInput = {
  id: string;
  sectionId: string | null;
  beforeCourseId?: string | null;
};

export type CourseSectionReorderInput = {
  id: string;
  beforeSectionId?: string | null;
};

export function normalizeSectionName(value: string) {
  return value.trim().slice(0, 40);
}

export function sortByOrderThenUpdated<T extends { sortOrder: number; updatedAt: string }>(items: T[]) {
  return [...items].sort((first, second) => {
    const orderDelta = (Number.isFinite(first.sortOrder) ? first.sortOrder : 0) - (Number.isFinite(second.sortOrder) ? second.sortOrder : 0);
    if (orderDelta !== 0) return orderDelta;
    return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
  });
}
