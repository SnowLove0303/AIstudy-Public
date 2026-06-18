import type {
  CourseCreateInput,
  CourseMoveInput,
  CourseRenameInput,
  CourseReorderInput,
  CourseSectionReorderInput,
  CourseStore,
  CourseSyncStatus
} from "./courseTypes";

declare global {
  interface Window {
    aistudyCourses?: {
      load: () => Promise<CourseStore>;
      save: (store: CourseStore) => Promise<CourseStore>;
      create: (input: CourseCreateInput) => Promise<CourseStore>;
      rename: (input: CourseRenameInput) => Promise<CourseStore>;
      move: (input: CourseMoveInput) => Promise<CourseStore>;
      reorder: (input: CourseReorderInput) => Promise<CourseStore>;
      delete: (courseId: string) => Promise<CourseStore>;
      select: (courseId: string | null) => Promise<CourseStore>;
      syncStatus: () => Promise<CourseSyncStatus>;
    };
    aistudyCourseSections?: {
      create: (input: { name: string }) => Promise<CourseStore>;
      rename: (input: { id: string; name: string }) => Promise<CourseStore>;
      toggle: (input: { id: string; collapsed: boolean }) => Promise<CourseStore>;
      reorder: (input: CourseSectionReorderInput) => Promise<CourseStore>;
      delete: (sectionId: string) => Promise<CourseStore>;
    };
  }
}

function requireCourseApi() {
  if (!window.aistudyCourses) {
    throw new Error("课程服务不可用。");
  }
  return window.aistudyCourses;
}

function requireCourseSectionApi() {
  if (!window.aistudyCourseSections) {
    throw new Error("课程分区服务不可用。");
  }
  return window.aistudyCourseSections;
}

export const courseApi = {
  load: () => requireCourseApi().load(),
  createCourse: (input: CourseCreateInput) => requireCourseApi().create(input),
  renameCourse: (input: CourseRenameInput) => requireCourseApi().rename(input),
  moveCourse: (input: CourseMoveInput) => requireCourseApi().move(input),
  reorderCourse: (input: CourseReorderInput) => requireCourseApi().reorder(input),
  deleteCourse: (courseId: string) => requireCourseApi().delete(courseId),
  selectCourse: (courseId: string | null) => requireCourseApi().select(courseId),
  syncStatus: () => requireCourseApi().syncStatus(),
  createSection: (name: string) => requireCourseSectionApi().create({ name }),
  renameSection: (id: string, name: string) => requireCourseSectionApi().rename({ id, name }),
  toggleSection: (id: string, collapsed: boolean) => requireCourseSectionApi().toggle({ id, collapsed }),
  reorderSection: (id: string, beforeSectionId: string | null) => requireCourseSectionApi().reorder({ id, beforeSectionId }),
  deleteSection: (sectionId: string) => requireCourseSectionApi().delete(sectionId)
};
