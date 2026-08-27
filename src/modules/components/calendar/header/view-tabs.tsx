import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCalendar } from "../contexts/calendar-context";
import { Columns, Grid2X2, Grid3X3, List } from "lucide-react";
import { TCalendarView } from "../types";
import { memo } from "react";

const tabs = [
  {
    name: "Day",
    value: "day",
    icon: () => <List className="h-4 w-4" />,
  },
  {
    name: "Week",
    value: "week",
    icon: () => <Columns className="h-4 w-4" />,
  },
  {
    name: "Month",
    value: "month",
    icon: () => <Grid3X3 className="h-4 w-4" />,
  },
  {
    name: "Year",
    value: "year",
    icon: () => <Grid2X2 className="h-4 w-4" />,
  },
];

function Views() {
  const { view, setView } = useCalendar();

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as TCalendarView)}
      className="w-full gap-2 sm:w-auto"
    >
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border-border bg-card/80 p-1 sm:w-auto">
        {tabs.map(({ icon: Icon, name, value }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="h-8 flex-none px-2.5"
          >
            <Icon />
            <span>{name}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export default memo(Views);
