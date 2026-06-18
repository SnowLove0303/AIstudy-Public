type SaveDrainTask = () => Promise<unknown> | unknown;

const beforeCloseTasks = new Set<SaveDrainTask>();

export function registerBeforeCloseSave(task: SaveDrainTask) {
  beforeCloseTasks.add(task);
  return () => {
    beforeCloseTasks.delete(task);
  };
}

export async function drainBeforeCloseSaves() {
  const tasks = [...beforeCloseTasks];
  await Promise.allSettled(tasks.map((task) => task()));
}
