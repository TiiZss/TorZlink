// Ink/chalk cache color depth on first import. Docker PTYs often lack COLORTERM,
// so hex sheen colors quantize to 256-color (gray banding on logo shade cells).
if (!process.env.COLORTERM) process.env.COLORTERM = "truecolor";
if (process.env.FORCE_COLOR === undefined) process.env.FORCE_COLOR = "3";
