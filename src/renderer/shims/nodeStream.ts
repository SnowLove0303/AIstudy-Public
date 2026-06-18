export class Stream {
  on() {
    return this;
  }

  emit() {
    return false;
  }
}

export default { Stream };
