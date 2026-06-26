const disabledMessage = "AIstudy does not enable the simple-mind-map RichText/Formula plugins, so Quill is intentionally stubbed out.";

function throwDisabled() {
  throw new Error(disabledMessage);
}

export default class Quill {
  static sources = {
    API: "api",
    SILENT: "silent",
    USER: "user"
  };

  constructor() {
    throwDisabled();
  }

  static import() {
    throwDisabled();
  }

  static register() {
    throwDisabled();
  }
}
