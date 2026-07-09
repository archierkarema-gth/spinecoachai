import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";

export function ComingSoon({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  return (
    <div>
      <TopBar title={title} />
      <div className="px-5">
        <Card>
          <p className="text-sm text-muted-foreground">{note}</p>
        </Card>
      </div>
    </div>
  );
}
