// admin-web/src/components/common/FilterBar.tsx
import { useEffect, useState } from "react";
import { Collapse, Paper, Group, Button } from "@mantine/core";

type FilterBarProps<T extends object> = {
  open: boolean;
  initialValues: T; // current applied values from parent (for hydration/sync)
  emptyValues: T;   // what "Clear" should reset to
  onApply: (values: T) => void;
  onClear: () => void;
  panelId?: string;
  children: (args: {
    values: T;
    setValues: React.Dispatch<React.SetStateAction<T>>;
  }) => React.ReactNode;
};

export function FilterBar<T extends object>({
  open,
  initialValues,
  emptyValues,
  onApply,
  onClear,
  children,
  panelId,
}: FilterBarProps<T>) {
  const [values, setValues] = useState<T>(initialValues);

  // keep draft in sync if URL/parent changes applied filters
  useEffect(() => {
    setValues(initialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialValues)]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onApply(values);
  }

  function handleClear() {
    setValues(emptyValues);
    onClear();
  }

  return (
    <Collapse in={open} id={panelId}>
      <Paper withBorder p="md" radius="md" className="bg-white mt-3">
        <form onSubmit={handleSubmit}>
          {children({ values, setValues })}
          <Group justify="flex-end" mt="md">
            <Button type="button" variant="subtle" onClick={handleClear}>
              Clear
            </Button>
            <Button type="submit">Apply filters</Button>
          </Group>
        </form>
      </Paper>
    </Collapse>
  );
}
