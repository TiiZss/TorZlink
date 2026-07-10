import { Box, Text } from "ink";
import { COLOR } from "../lib/theme";
import type { Hint } from "../lib/keymap";

export function Footer({ hints }: { hints: Hint[] }) {
  return (
    <Box>
      <Text>
        {hints.map((h, i) => (
          <Text key={h.keys + h.label}>
            {i > 0 ? <Text dimColor>{"   "}</Text> : null}
            <Text color={COLOR.alt}>{h.keys}</Text>
            <Text dimColor>{` ${h.label}`}</Text>
          </Text>
        ))}
      </Text>
    </Box>
  );
}
