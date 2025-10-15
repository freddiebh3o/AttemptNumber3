// admin-web/src/components/common/PriorityBadge.tsx
import { Badge } from "@mantine/core";
import { IconBolt, IconArrowUp, IconMinus, IconArrowDown } from "@tabler/icons-react";

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface PriorityBadgeProps {
  priority: Priority;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

export default function PriorityBadge({ priority, size = "sm" }: PriorityBadgeProps) {
  const config = {
    URGENT: {
      color: "red",
      icon: <IconBolt size={12} />,
    },
    HIGH: {
      color: "orange",
      icon: <IconArrowUp size={12} />,
    },
    NORMAL: {
      color: "blue",
      icon: <IconMinus size={12} />,
    },
    LOW: {
      color: "gray",
      icon: <IconArrowDown size={12} />,
    },
  };

  const { color, icon } = config[priority];

  return (
    <Badge color={color} size={size} leftSection={icon}>
      {priority}
    </Badge>
  );
}
